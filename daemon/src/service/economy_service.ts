import fs from "fs-extra";
import path from "path";
import initSqlJs, { Database, SqlJsStatic } from "sql.js";
import { globalConfiguration } from "../entity/config";
import monitorService from "./monitor_service";
import InstanceSubsystem from "./system_instance";

type AnyRecord = Record<string, any>;

interface IEconomyEventPayload {
  serverId?: string;
  instanceToken?: string;
  timestamp?: number | string;
  playerUuid?: string;
  playerName?: string;
  currencyType?: string;
  currencyName?: string;
  delta?: number | string;
  balanceAfter?: number | string;
  operatorName?: string;
  operatorReason?: string;
  category?: string;
  source?: string;
  referenceId?: string;
}

interface IEconomySnapshotPayload {
  serverId?: string;
  instanceToken?: string;
  timestamp?: number | string;
  provider?: string;
  providerStatus?: string;
  currencies?: Array<{
    type?: string;
    name?: string;
    totalBalance?: number | string;
    playerCount?: number | string;
  }>;
}

interface IEconomyQuery {
  instanceId?: string;
  currencyType?: string;
  playerUuid?: string;
  category?: string;
  source?: string;
  startAt?: string | number;
  endAt?: string | number;
  limit?: number;
  offset?: number;
}

const DEFAULT_CURRENCY_TYPE = "money";
const DEFAULT_CURRENCY_NAME = "落叶币";
const DAY_MS = 24 * 60 * 60 * 1000;

const CATEGORY_SET = new Set<IMcsmEconomyCategory>([
  "SYSTEM_IN",
  "SYSTEM_OUT",
  "PLAYER_TRANSFER",
  "TAX",
  "ADMIN_ADJUST",
  "ROLLBACK",
  "UNKNOWN"
]);

const normalizeText = (value: unknown) => String(value ?? "").trim();
const normalizeNumber = (value: unknown, fallback = 0) => {
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
};

const normalizeIsoTime = (value: unknown, fallback = Date.now()) => {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    return new Date(numeric).toISOString();
  }
  const text = normalizeText(value);
  if (text) {
    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date(fallback).toISOString();
};

const startOfLocalDayIso = (now = Date.now()) => {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
};

const endOfLocalDayIso = (now = Date.now()) => new Date(new Date(startOfLocalDayIso(now)).getTime() + DAY_MS).toISOString();

const normalizeCategory = (value: unknown, delta = 0): IMcsmEconomyCategory => {
  const text = normalizeText(value).toUpperCase();
  if (CATEGORY_SET.has(text as IMcsmEconomyCategory)) return text as IMcsmEconomyCategory;
  if (delta > 0) return "SYSTEM_IN";
  if (delta < 0) return "SYSTEM_OUT";
  return "UNKNOWN";
};

const parseReasonMeta = (reason: string) => {
  if (!reason.startsWith("ECO|")) return {};
  const meta: AnyRecord = {};
  for (const part of reason.split("|").slice(1)) {
    const index = part.indexOf("=");
    if (index <= 0) continue;
    meta[part.slice(0, index)] = part.slice(index + 1);
  }
  return meta;
};

class EconomyDatabase {
  private db?: Database;
  private dirty = false;
  private flushTimer?: NodeJS.Timeout;

  constructor(
    private readonly SQL: SqlJsStatic,
    private readonly filePath: string
  ) {}

  private async open() {
    if (this.db) return this.db;
    await fs.ensureDir(path.dirname(this.filePath));
    if (await fs.pathExists(this.filePath)) {
      this.db = new this.SQL.Database(await fs.readFile(this.filePath));
    } else {
      this.db = new this.SQL.Database();
    }
    this.migrate(this.db);
    return this.db;
  }

  private migrate(db: Database) {
    db.run(`
      CREATE TABLE IF NOT EXISTS economy_transactions (
        id TEXT PRIMARY KEY,
        server_id TEXT NOT NULL,
        instance_id TEXT NOT NULL,
        player_uuid TEXT NOT NULL,
        player_name TEXT,
        currency_type TEXT NOT NULL,
        currency_name TEXT,
        delta INTEGER NOT NULL,
        balance_after INTEGER NOT NULL,
        operator_name TEXT,
        operator_reason TEXT,
        category TEXT NOT NULL,
        source TEXT,
        reference_id TEXT,
        occurred_at TEXT NOT NULL,
        received_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS economy_currencies (
        type TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        total_balance INTEGER NOT NULL DEFAULT 0,
        player_count INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT
      );
      CREATE TABLE IF NOT EXISTS economy_provider_status (
        provider TEXT PRIMARY KEY,
        status_text TEXT NOT NULL,
        available INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_economy_time ON economy_transactions(occurred_at);
      CREATE INDEX IF NOT EXISTS idx_economy_currency_time ON economy_transactions(currency_type, occurred_at);
      CREATE INDEX IF NOT EXISTS idx_economy_player_time ON economy_transactions(player_uuid, occurred_at);
      CREATE INDEX IF NOT EXISTS idx_economy_category_time ON economy_transactions(category, occurred_at);
    `);
    this.markDirty();
  }

  private markDirty() {
    this.dirty = true;
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flush().catch(() => undefined);
    }, 250);
    if (typeof this.flushTimer.unref === "function") this.flushTimer.unref();
  }

  async flush() {
    if (!this.db || !this.dirty) return;
    this.dirty = false;
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = undefined;
    }
    await fs.writeFile(this.filePath, Buffer.from(this.db.export()));
  }

  async run(sql: string, params: any[] = []) {
    const db = await this.open();
    db.run(sql, params);
    this.markDirty();
  }

  async query<T = AnyRecord>(sql: string, params: any[] = []): Promise<T[]> {
    const db = await this.open();
    const stmt = db.prepare(sql, params);
    const rows: T[] = [];
    try {
      while (stmt.step()) rows.push(stmt.getAsObject() as T);
    } finally {
      stmt.free();
    }
    return rows;
  }

  async get<T = AnyRecord>(sql: string, params: any[] = []) {
    return (await this.query<T>(sql, params))[0];
  }
}

class EconomyService {
  private sqlPromise?: Promise<SqlJsStatic>;
  private readonly dbMap = new Map<string, EconomyDatabase>();
  private readonly rootDir = path.join(process.cwd(), "data", "EconomyData");

  private getSql() {
    if (!this.sqlPromise) {
      this.sqlPromise = initSqlJs();
    }
    return this.sqlPromise;
  }

  private async getDb(instanceId: string) {
    if (!this.dbMap.has(instanceId)) {
      const SQL = await this.getSql();
      this.dbMap.set(
        instanceId,
        new EconomyDatabase(SQL, path.join(this.rootDir, instanceId, "economy.sqlite"))
      );
    }
    return this.dbMap.get(instanceId)!;
  }

  private getInstanceOrThrow(instanceId: string) {
    const instance = InstanceSubsystem.getInstance(instanceId);
    if (!instance || InstanceSubsystem.isGlobalInstance(instance)) {
      const error: any = new Error(`Instance ${instanceId} does not exist.`);
      error.status = 404;
      throw error;
    }
    return instance;
  }

  private validatePluginPayload(serverId: string, instanceToken: string) {
    if (!serverId) {
      const error: any = new Error("serverId is required.");
      error.status = 400;
      throw error;
    }
    if (!instanceToken) {
      const error: any = new Error("instanceToken is required.");
      error.status = 400;
      throw error;
    }
    const instance = this.getInstanceOrThrow(serverId);
    const expectedToken = monitorService.getExpectedToken(serverId);
    if (instanceToken !== expectedToken && instanceToken !== globalConfiguration.config.key) {
      const error: any = new Error("instanceToken is invalid.");
      error.status = 403;
      throw error;
    }
    return instance;
  }

  private buildWhere(query: IEconomyQuery, defaultToday = false) {
    const where: string[] = [];
    const params: any[] = [];

    const currencyType = normalizeText(query.currencyType);
    if (currencyType) {
      where.push("currency_type = ?");
      params.push(currencyType);
    }

    const playerUuid = normalizeText(query.playerUuid);
    if (playerUuid) {
      where.push("player_uuid = ?");
      params.push(playerUuid);
    }

    const category = normalizeText(query.category).toUpperCase();
    if (category) {
      where.push("category = ?");
      params.push(category);
    }

    const source = normalizeText(query.source);
    if (source) {
      where.push("source = ?");
      params.push(source);
    }

    const startAt = query.startAt ? normalizeIsoTime(query.startAt) : defaultToday ? startOfLocalDayIso() : "";
    const endAt = query.endAt ? normalizeIsoTime(query.endAt) : defaultToday ? endOfLocalDayIso() : "";
    if (startAt) {
      where.push("occurred_at >= ?");
      params.push(startAt);
    }
    if (endAt) {
      where.push("occurred_at < ?");
      params.push(endAt);
    }

    return {
      clause: where.length ? `WHERE ${where.join(" AND ")}` : "",
      params
    };
  }

  private mapTransaction(row: AnyRecord, daemonId = ""): IMcsmEconomyTransaction {
    return {
      id: String(row.id),
      daemonId,
      instanceId: String(row.instance_id),
      serverId: String(row.server_id),
      playerUuid: String(row.player_uuid),
      playerName: normalizeText(row.player_name) || undefined,
      currencyType: String(row.currency_type),
      currencyName: normalizeText(row.currency_name) || undefined,
      delta: normalizeNumber(row.delta),
      balanceAfter: normalizeNumber(row.balance_after),
      operatorName: normalizeText(row.operator_name) || undefined,
      operatorReason: normalizeText(row.operator_reason) || undefined,
      category: normalizeCategory(row.category),
      source: normalizeText(row.source) || undefined,
      referenceId: normalizeText(row.reference_id) || undefined,
      occurredAt: normalizeIsoTime(row.occurred_at),
      receivedAt: normalizeIsoTime(row.received_at)
    };
  }

  async recordEvent(payload: IEconomyEventPayload) {
    const serverId = normalizeText(payload.serverId);
    const instanceToken = normalizeText(payload.instanceToken);
    this.validatePluginPayload(serverId, instanceToken);

    const delta = Math.trunc(normalizeNumber(payload.delta));
    const balanceAfter = Math.trunc(normalizeNumber(payload.balanceAfter));
    const operatorReason = normalizeText(payload.operatorReason);
    const reasonMeta = parseReasonMeta(operatorReason);
    const category = normalizeCategory(reasonMeta.category || payload.category, delta);
    const currencyType = normalizeText(payload.currencyType) || DEFAULT_CURRENCY_TYPE;
    const currencyName = normalizeText(payload.currencyName) || DEFAULT_CURRENCY_NAME;
    const occurredAt = normalizeIsoTime(payload.timestamp);
    const receivedAt = new Date().toISOString();
    const playerUuid = normalizeText(payload.playerUuid);
    if (!playerUuid) {
      const error: any = new Error("playerUuid is required.");
      error.status = 400;
      throw error;
    }

    const row = {
      id: `${serverId}:${occurredAt}:${playerUuid}:${currencyType}:${delta}:${Math.random()
        .toString(36)
        .slice(2, 10)}`,
      serverId,
      instanceId: serverId,
      playerUuid,
      playerName: normalizeText(payload.playerName),
      currencyType,
      currencyName,
      delta,
      balanceAfter,
      operatorName: normalizeText(payload.operatorName),
      operatorReason,
      category,
      source: normalizeText(reasonMeta.source || payload.source),
      referenceId: normalizeText(reasonMeta.ref || reasonMeta.referenceId || payload.referenceId),
      occurredAt,
      receivedAt
    };

    const db = await this.getDb(serverId);
    await db.run(
      `INSERT OR IGNORE INTO economy_transactions
       (id, server_id, instance_id, player_uuid, player_name, currency_type, currency_name, delta,
        balance_after, operator_name, operator_reason, category, source, reference_id, occurred_at, received_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.serverId,
        row.instanceId,
        row.playerUuid,
        row.playerName,
        row.currencyType,
        row.currencyName,
        row.delta,
        row.balanceAfter,
        row.operatorName,
        row.operatorReason,
        row.category,
        row.source,
        row.referenceId,
        row.occurredAt,
        row.receivedAt
      ]
    );
    await db.run(
      `INSERT INTO economy_currencies(type, name, total_balance, player_count, updated_at)
       VALUES (?, ?, 0, 0, ?)
       ON CONFLICT(type) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at`,
      [currencyType, currencyName, receivedAt]
    );

    return {
      accepted: true,
      transactionId: row.id,
      serverId,
      currencyType,
      receivedAt
    };
  }

  async recordSnapshot(payload: IEconomySnapshotPayload) {
    const serverId = normalizeText(payload.serverId);
    const instanceToken = normalizeText(payload.instanceToken);
    this.validatePluginPayload(serverId, instanceToken);

    const updatedAt = normalizeIsoTime(payload.timestamp);
    const provider = normalizeText(payload.provider) || "PlayerCurrency";
    const providerStatus = normalizeText(payload.providerStatus) || "unknown";
    const currencies = Array.isArray(payload.currencies) ? payload.currencies : [];
    const db = await this.getDb(serverId);
    await db.run(
      `INSERT INTO economy_provider_status(provider, status_text, available, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(provider) DO UPDATE SET
         status_text = excluded.status_text,
         available = excluded.available,
         updated_at = excluded.updated_at`,
      [provider, providerStatus, providerStatus === "available" ? 1 : 0, updatedAt]
    );
    for (const item of currencies) {
      const type = normalizeText(item.type) || DEFAULT_CURRENCY_TYPE;
      const name = normalizeText(item.name) || (type === DEFAULT_CURRENCY_TYPE ? DEFAULT_CURRENCY_NAME : type);
      await db.run(
        `INSERT INTO economy_currencies(type, name, total_balance, player_count, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(type) DO UPDATE SET
           name = excluded.name,
           total_balance = excluded.total_balance,
           player_count = excluded.player_count,
           updated_at = excluded.updated_at`,
        [
          type,
          name,
          Math.trunc(normalizeNumber(item.totalBalance)),
          Math.trunc(normalizeNumber(item.playerCount)),
          updatedAt
        ]
      );
    }

    return {
      accepted: true,
      serverId,
      currencyCount: currencies.length,
      provider,
      providerStatus,
      updatedAt
    };
  }

  async getCurrencies(instanceId: string): Promise<IMcsmEconomyCurrenciesResponse> {
    this.getInstanceOrThrow(instanceId);
    const db = await this.getDb(instanceId);
    const rows = await db.query<AnyRecord>(
      "SELECT type, name, total_balance, player_count, updated_at FROM economy_currencies ORDER BY type"
    );
    const items = rows.map((row) => ({
      type: String(row.type),
      name: normalizeText(row.name) || String(row.type),
      totalBalance: normalizeNumber(row.total_balance),
      playerCount: normalizeNumber(row.player_count),
      updatedAt: normalizeText(row.updated_at) || undefined
    }));
    if (!items.some((item) => item.type === DEFAULT_CURRENCY_TYPE)) {
      items.unshift({
        type: DEFAULT_CURRENCY_TYPE,
        name: DEFAULT_CURRENCY_NAME,
        totalBalance: 0,
        playerCount: 0,
        updatedAt: undefined
      });
    }
    return {
      generatedAt: Date.now(),
      items
    };
  }

  async getTransactions(query: IEconomyQuery): Promise<IMcsmEconomyTransactionsResponse> {
    const instanceId = normalizeText(query.instanceId);
    this.getInstanceOrThrow(instanceId);
    const limit = Math.max(1, Math.min(500, Math.trunc(normalizeNumber(query.limit, 100))));
    const offset = Math.max(0, Math.trunc(normalizeNumber(query.offset, 0)));
    const filter = this.buildWhere(query);
    const db = await this.getDb(instanceId);
    const rows = await db.query<AnyRecord>(
      `SELECT * FROM economy_transactions ${filter.clause}
       ORDER BY occurred_at DESC, received_at DESC
       LIMIT ? OFFSET ?`,
      [...filter.params, limit, offset]
    );
    const totalRow = await db.get<AnyRecord>(
      `SELECT COUNT(1) as total FROM economy_transactions ${filter.clause}`,
      filter.params
    );
    return {
      generatedAt: Date.now(),
      items: rows.map((row) => this.mapTransaction(row)),
      total: normalizeNumber(totalRow?.total)
    };
  }

  private async buildServerOverview(instanceId: string, query: IEconomyQuery): Promise<IMcsmEconomyOverviewServer> {
    const instance = this.getInstanceOrThrow(instanceId);
    const db = await this.getDb(instanceId);
    const currencyType = normalizeText(query.currencyType) || DEFAULT_CURRENCY_TYPE;
    const todayFilter = this.buildWhere({ ...query, instanceId, currencyType }, true);
    const summary = (await db.get<AnyRecord>(
      `SELECT
        COALESCE(SUM(CASE WHEN delta > 0 THEN delta ELSE 0 END), 0) as today_in,
        COALESCE(SUM(CASE WHEN delta < 0 THEN -delta ELSE 0 END), 0) as today_out,
        COALESCE(SUM(delta), 0) as net_change,
        COUNT(1) as transaction_count,
        MAX(occurred_at) as last_event_at
       FROM economy_transactions ${todayFilter.clause}`,
      todayFilter.params
    )) || {};
    const currencies = (await this.getCurrencies(instanceId)).items;
    const selectedCurrency = currencies.find((item) => item.type === currencyType) || {
      type: currencyType,
      name: currencyType === DEFAULT_CURRENCY_TYPE ? DEFAULT_CURRENCY_NAME : currencyType,
      totalBalance: 0,
      playerCount: 0
    };
    const rows = await db.query<AnyRecord>(
      `SELECT occurred_at, delta FROM economy_transactions ${todayFilter.clause}`,
      todayFilter.params
    );
    const hourlyMap = new Map<number, { systemIn: number; systemOut: number; netChange: number; transactionCount: number }>();
    for (let hour = 0; hour < 24; hour++) {
      hourlyMap.set(hour, { systemIn: 0, systemOut: 0, netChange: 0, transactionCount: 0 });
    }
    for (const row of rows) {
      const hour = new Date(normalizeIsoTime(row.occurred_at)).getHours();
      const bucket = hourlyMap.get(hour)!;
      const delta = normalizeNumber(row.delta);
      if (delta > 0) bucket.systemIn += delta;
      if (delta < 0) bucket.systemOut += Math.abs(delta);
      bucket.netChange += delta;
      bucket.transactionCount += 1;
    }
    const sources = await db.query<AnyRecord>(
      `SELECT category, COALESCE(source, '') as source,
        COALESCE(SUM(ABS(delta)), 0) as amount,
        COUNT(1) as transaction_count
       FROM economy_transactions ${todayFilter.clause}
       GROUP BY category, source
       ORDER BY amount DESC
      LIMIT 8`,
      todayFilter.params
    );
    const providerStatus = await db.get<AnyRecord>(
      "SELECT provider, status_text, available, updated_at FROM economy_provider_status WHERE provider = ?",
      ["PlayerCurrency"]
    );
    const lastEventAt = normalizeText(summary.last_event_at) || undefined;
    const pluginStatusText = normalizeText(providerStatus?.status_text) || "waiting";
    return {
      daemonId: "",
      daemonDisplayName: "",
      daemonAvailable: true,
      instanceId,
      instanceDisplayName: instance.config.nickname || instanceId,
      currencyType,
      currencyName: selectedCurrency.name,
      todayIn: normalizeNumber(summary.today_in),
      todayOut: normalizeNumber(summary.today_out),
      netChange: normalizeNumber(summary.net_change),
      transactionCount: normalizeNumber(summary.transaction_count),
      lastEventAt,
      dataDelayMs: lastEventAt ? Math.max(0, Date.now() - new Date(lastEventAt).getTime()) : undefined,
      pluginAvailable: normalizeNumber(providerStatus?.available) === 1,
      pluginStatusText,
      currencies,
      hourly: Array.from(hourlyMap.entries()).map(([hour, item]) => ({
        hour,
        label: `${String(hour).padStart(2, "0")}:00`,
        ...item
      })),
      sources: sources.map((row) => ({
        category: normalizeCategory(row.category),
        source: normalizeText(row.source) || "unknown",
        amount: normalizeNumber(row.amount),
        transactionCount: normalizeNumber(row.transaction_count)
      }))
    };
  }

  async getOverview(query: IEconomyQuery = {}): Promise<IMcsmEconomyOverviewResponse> {
    const instanceId = normalizeText(query.instanceId);
    const instances = instanceId
      ? [this.getInstanceOrThrow(instanceId)]
      : InstanceSubsystem.getInstances().filter((instance) => !InstanceSubsystem.isGlobalInstance(instance));
    const servers = await Promise.all(
      instances.map((instance) => this.buildServerOverview(instance.instanceUuid, query))
    );
    return {
      generatedAt: Date.now(),
      summary: {
        serversTotal: servers.length,
        serversAvailable: servers.filter((item) => item.pluginAvailable).length,
        todayIn: servers.reduce((sum, item) => sum + item.todayIn, 0),
        todayOut: servers.reduce((sum, item) => sum + item.todayOut, 0),
        netChange: servers.reduce((sum, item) => sum + item.netChange, 0),
        transactionCount: servers.reduce((sum, item) => sum + item.transactionCount, 0)
      },
      servers
    };
  }
}

export default new EconomyService();
