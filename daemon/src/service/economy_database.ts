import fs from "fs-extra";
import path from "path";
import { Database, SqlJsStatic } from "sql.js";

type AnyRecord = Record<string, any>;

export class EconomyDatabase {
  private db?: Database;
  private openPromise?: Promise<Database>;
  private changeVersion = 0;
  private flushedVersion = 0;
  private flushTimer?: NodeJS.Timeout;
  private flushPromise?: Promise<void>;

  constructor(
    private readonly SQL: SqlJsStatic,
    private readonly filePath: string
  ) {}

  private open() {
    if (this.db) return this.db;
    if (!this.openPromise) {
      this.openPromise = (async () => {
        await fs.ensureDir(path.dirname(this.filePath));
        if (await fs.pathExists(this.filePath)) {
          this.db = new this.SQL.Database(await fs.readFile(this.filePath));
        } else {
          this.db = new this.SQL.Database();
        }
        this.migrate(this.db);
        return this.db;
      })().catch((error) => {
        this.openPromise = undefined;
        throw error;
      });
    }
    return this.openPromise;
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
    // A retry of the same plugin event must be idempotent. Keep the first row
    // when upgrading a database that predates this unique index.
    db.run(`
      DELETE FROM economy_transactions
       WHERE reference_id IS NOT NULL
         AND reference_id <> ''
         AND rowid NOT IN (
           SELECT MIN(rowid)
             FROM economy_transactions
            WHERE reference_id IS NOT NULL
              AND reference_id <> ''
            GROUP BY server_id, reference_id
         );
      CREATE UNIQUE INDEX IF NOT EXISTS uq_economy_reference
        ON economy_transactions(server_id, reference_id)
        WHERE reference_id IS NOT NULL AND reference_id <> '';
    `);
    this.markDirty();
  }

  private markDirty() {
    this.changeVersion += 1;
    this.scheduleFlush();
  }

  private scheduleFlush(delay = 250) {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = undefined;
      this.flush().catch(() => undefined);
    }, delay);
    if (typeof this.flushTimer.unref === "function") this.flushTimer.unref();
  }

  async flush() {
    if (this.flushPromise) return this.flushPromise;
    if (!this.db || this.flushedVersion >= this.changeVersion) return;

    this.flushPromise = (async () => {
      if (this.flushTimer) {
        clearTimeout(this.flushTimer);
        this.flushTimer = undefined;
      }
      const version = this.changeVersion;
      const data = Buffer.from(this.db!.export());
      await this.writeAtomic(data);
      // Changes made while the file was being written remain dirty and will
      // be included in the next snapshot.
      this.flushedVersion = Math.max(this.flushedVersion, version);
    })()
      .catch((error) => {
        this.scheduleFlush(1000);
        throw error;
      })
      .finally(() => {
        this.flushPromise = undefined;
        if (this.flushedVersion < this.changeVersion) this.scheduleFlush();
      });
    return this.flushPromise;
  }

  private async writeAtomic(data: Buffer) {
    const temporaryPath = `${this.filePath}.${process.pid}.${Date.now()}.${Math.random()
      .toString(36)
      .slice(2)}.tmp`;
    await fs.writeFile(temporaryPath, data, { flag: "wx" });
    try {
      try {
        await fs.rename(temporaryPath, this.filePath);
      } catch (error: any) {
        // Windows refuses to rename over an existing file. Remove only the
        // known target and retry; POSIX keeps the replacement atomic.
        if (!error || !["EEXIST", "EPERM", "ENOTEMPTY"].includes(error.code)) throw error;
        await fs.remove(this.filePath);
        await fs.rename(temporaryPath, this.filePath);
      }
    } finally {
      if (await fs.pathExists(temporaryPath)) await fs.remove(temporaryPath);
    }
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
