import fs from "fs-extra";
import http from "http";
import https from "https";
import path from "path";
import { globalConfiguration } from "../entity/config";
import Instance from "../entity/instance/instance";
import monitorService from "./monitor_service";
import InstanceSubsystem from "./system_instance";

type AnyRecord = Record<string, any>;

interface IPlayerPayload {
  uuid?: string;
  name?: string;
  muted?: boolean;
  muteReason?: string;
  muteExpiresAt?: number | string;
}

interface IPlayerSnapshotPayload {
  serverId?: string;
  instanceToken?: string;
  localControlToken?: string;
  timestamp?: number;
  players?: IPlayerPayload[];
  supports?: AnyRecord;
  localControl?: AnyRecord;
}

interface IChatPayload {
  serverId?: string;
  instanceToken?: string;
  timestamp?: number;
  playerUuid?: string;
  playerName?: string;
  message?: string;
  source?: string;
  channel?: string;
  tellPlayerName?: string;
  mentionedPlayers?: string[];
}

interface IControllerResponse {
  ok: boolean;
  statusCode: number;
  message: string;
  data: AnyRecord;
}

interface IStoredPlayer {
  playerUuid: string;
  playerName: string;
  online: boolean;
  lastSeenAt: string;
  muted?: boolean;
  muteReason?: string;
  muteExpiresAt?: string;
}

interface IInstanceSnapshotState {
  instanceId: string;
  updatedAt: number;
  dependencies: IMcsmGmDependencySnapshot;
  players: IStoredPlayer[];
  controllerToken?: string;
}

const SNAPSHOT_TIMEOUT_MS = 1000 * 30;
const CHAT_PAGE_LIMIT = 200;

const normalizeText = (value: unknown) => String(value ?? "").trim();
const normalizeNumber = (value: unknown, fallback = 0) => {
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
};

const normalizeIsoTime = (value?: number | string) => {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    return new Date(numeric).toISOString();
  }
  const text = normalizeText(value);
  if (!text) return new Date().toISOString();
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
};

const normalizeChatPluginType = (supports?: AnyRecord): IMcsmGmChatPluginType =>
  supports?.playerChatReflection ? "playerchat" : "native";

const normalizeControllerHost = (value: unknown) => {
  const host = normalizeText(value);
  if (!host || host === "0.0.0.0" || host === "::" || host === "::1") {
    return "127.0.0.1";
  }
  return host;
};

class GmService {
  private readonly snapshotMap = new Map<string, IInstanceSnapshotState>();
  private readonly chatRootDir = path.join(process.cwd(), "data", "gm_chat");

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

  private ensureSnapshotOrThrow(instanceId: string) {
    const instance = this.getInstanceOrThrow(instanceId);
    if (instance.status() !== Instance.STATUS_RUNNING) {
      const error: any = new Error(`Instance ${instance.config.nickname} is not running.`);
      error.status = 409;
      throw error;
    }

    const snapshot = this.snapshotMap.get(instanceId);
    if (!snapshot) {
      const error: any = new Error(`Instance ${instance.config.nickname} has no GM snapshot yet.`);
      error.status = 503;
      throw error;
    }
    if (Date.now() - snapshot.updatedAt > SNAPSHOT_TIMEOUT_MS) {
      const error: any = new Error(`Instance ${instance.config.nickname} GM snapshot is stale.`);
      error.status = 503;
      throw error;
    }
    return { instance, snapshot };
  }

  private buildDependencies(payload: IPlayerSnapshotPayload): IMcsmGmDependencySnapshot {
    const supports = payload.supports || {};
    const localControl = payload.localControl || {};
    const controllerEnabled = Boolean(localControl.enabled) && Boolean(localControl.running);
    const controllerHost = normalizeControllerHost(localControl.host);
    const controllerPort = normalizeNumber(localControl.port, 0);

    return {
      economyAvailable: Boolean(supports.economy),
      pointsAvailable: Boolean(supports.points),
      luckPermsAvailable: Boolean(supports.luckPerms),
      chatPluginAvailable: Boolean(supports.chatReporting),
      chatPluginType: normalizeChatPluginType(supports),
      controller:
        controllerEnabled && controllerPort > 0
          ? {
              host: controllerHost,
              port: controllerPort
            }
          : undefined,
      updatedAt: normalizeIsoTime(payload.timestamp)
    };
  }

  private createChatFilePath(instanceId: string, date = new Date()) {
    const day = date.toISOString().slice(0, 10);
    return path.join(this.chatRootDir, instanceId, `${day}.jsonl`);
  }

  private async readChatLog(instanceId: string): Promise<IMcsmGmChatMessage[]> {
    const filePath = this.createChatFilePath(instanceId);
    if (!(await fs.pathExists(filePath))) {
      return [];
    }
    const content = await fs.readFile(filePath, "utf-8");
    return content
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => {
        try {
          return JSON.parse(line) as IMcsmGmChatMessage;
        } catch (error) {
          return null;
        }
      })
      .filter(Boolean) as IMcsmGmChatMessage[];
  }

  private async appendChatLog(instanceId: string, message: IMcsmGmChatMessage) {
    const filePath = this.createChatFilePath(instanceId);
    await fs.ensureDir(path.dirname(filePath));
    await fs.appendFile(filePath, `${JSON.stringify(message)}\n`, { encoding: "utf-8" });
  }

  private async countTodayMessages(instanceId: string) {
    const messages = await this.readChatLog(instanceId);
    return messages.length;
  }

  private async callController(instanceId: string, request: AnyRecord): Promise<IControllerResponse> {
    const { snapshot } = this.ensureSnapshotOrThrow(instanceId);
    const controller = snapshot.dependencies.controller;
    const token = snapshot.controllerToken;

    if (!controller?.host || !controller.port || !token) {
      const error: any = new Error(`Instance ${instanceId} local control is unavailable.`);
      error.status = 503;
      throw error;
    }

    return new Promise<IControllerResponse>((resolve, reject) => {
      const body = JSON.stringify(request);
      const isHttps = controller.host.startsWith("https://");
      const hostname = controller.host.replace(/^https?:\/\//, "");
      const options: http.RequestOptions = {
        hostname,
        port: controller.port,
        method: "POST",
        path: "/actions",
        timeout: 5000,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Length": Buffer.byteLength(body),
          "X-MCSM-Token": token
        }
      };

      const transport = isHttps ? https : http;
      const req = transport.request(options, (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf-8");
          let parsed: AnyRecord = {};
          try {
            parsed = text ? JSON.parse(text) : {};
          } catch (error) {
            parsed = { message: text };
          }
          resolve({
            ok: Boolean(parsed.ok) && (res.statusCode || 500) < 400,
            statusCode: res.statusCode || 500,
            message: normalizeText(parsed.message || text || `HTTP ${res.statusCode}`),
            data: parsed.data && typeof parsed.data === "object" ? parsed.data : {}
          });
        });
      });

      req.on("error", (error) => {
        const wrapped: any = new Error(`Local control request failed: ${error.message}`);
        wrapped.status = 503;
        reject(wrapped);
      });
      req.on("timeout", () => {
        req.destroy(new Error("Local control request timed out."));
      });

      req.write(body);
      req.end();
    });
  }

  private mapActionRequest(request: IMcsmGmActionRequest): AnyRecord {
    switch (request.kind) {
      case "economy_deposit":
        return { action: "economy", operation: "deposit", playerUuid: request.playerUuid, amount: request.amount };
      case "economy_withdraw":
        return { action: "economy", operation: "withdraw", playerUuid: request.playerUuid, amount: request.amount };
      case "points_give":
        return { action: "points", operation: "give", playerUuid: request.playerUuid, amount: request.amount };
      case "points_take":
        return { action: "points", operation: "take", playerUuid: request.playerUuid, amount: request.amount };
      case "lp_group_add":
        return { action: "luckperms", operation: "group_add", playerUuid: request.playerUuid, group: request.group };
      case "lp_group_switch":
        return {
          action: "luckperms",
          operation: "group_switch",
          playerUuid: request.playerUuid,
          group: request.group
        };
      case "lp_group_remove":
        return { action: "luckperms", operation: "group_remove", playerUuid: request.playerUuid, group: request.group };
      case "lp_permission_set":
        return { action: "luckperms", operation: "permission_set", playerUuid: request.playerUuid, node: request.node };
      case "lp_permission_unset":
        return {
          action: "luckperms",
          operation: "permission_unset",
          playerUuid: request.playerUuid,
          node: request.node
        };
      case "lp_temp_group_add":
        return {
          action: "luckperms",
          operation: "temp_group_add",
          playerUuid: request.playerUuid,
          group: request.group,
          duration: request.duration
        };
      case "lp_temp_group_remove":
        return {
          action: "luckperms",
          operation: "temp_group_remove",
          playerUuid: request.playerUuid,
          group: request.group,
          duration: request.duration
        };
      case "lp_temp_permission_set":
        return {
          action: "luckperms",
          operation: "temp_permission_set",
          playerUuid: request.playerUuid,
          node: request.node,
          duration: request.duration
        };
      case "lp_temp_permission_unset":
        return {
          action: "luckperms",
          operation: "temp_permission_unset",
          playerUuid: request.playerUuid,
          node: request.node,
          duration: request.duration
        };
      case "chat_mute":
        return {
          action: "mute",
          operation: "mute",
          playerUuid: request.playerUuid,
          durationSeconds: request.durationSeconds,
          reason: request.reason,
          operatorName: normalizeText((request as AnyRecord).operatorName)
        };
      case "chat_unmute":
        return { action: "mute", operation: "unmute", playerUuid: request.playerUuid };
      default:
        return { action: "", operation: "" };
    }
  }

  private async queryBalances(instanceId: string, playerUuid: string): Promise<IMcsmGmPlayerBalances> {
    const { snapshot } = this.ensureSnapshotOrThrow(instanceId);

    let economyBalance: number | undefined;
    let pointsBalance: number | undefined;

    if (snapshot.dependencies.economyAvailable) {
      const result = await this.callController(instanceId, {
        action: "economy",
        operation: "balance",
        playerUuid
      });
      if (!result.ok && result.statusCode >= 500) {
        const error: any = new Error(result.message || "Economy balance query failed.");
        error.status = result.statusCode;
        throw error;
      }
      economyBalance = normalizeNumber(result.data.balance, 0);
    }

    if (snapshot.dependencies.pointsAvailable) {
      const result = await this.callController(instanceId, {
        action: "points",
        operation: "balance",
        playerUuid
      });
      if (!result.ok && result.statusCode >= 500) {
        const error: any = new Error(result.message || "PlayerPoints balance query failed.");
        error.status = result.statusCode;
        throw error;
      }
      pointsBalance = normalizeNumber(result.data.points, 0);
    }

    return {
      economyAvailable: snapshot.dependencies.economyAvailable,
      economyBalance,
      pointsAvailable: snapshot.dependencies.pointsAvailable,
      pointsBalance,
      updatedAt: new Date().toISOString()
    };
  }

  private async queryLuckPerms(instanceId: string, playerUuid: string): Promise<IMcsmLuckPermsSnapshot> {
    const { snapshot } = this.ensureSnapshotOrThrow(instanceId);
    if (!snapshot.dependencies.luckPermsAvailable) {
      return {
        available: false,
        availableGroups: [],
        groups: [],
        permissions: [],
        updatedAt: new Date().toISOString()
      };
    }

    const result = await this.callController(instanceId, {
      action: "luckperms",
      operation: "snapshot",
      playerUuid
    });
    if (!result.ok && result.statusCode >= 500) {
      const error: any = new Error(result.message || "LuckPerms snapshot query failed.");
      error.status = result.statusCode;
      throw error;
    }

    const groups = Array.isArray(result.data.groups)
      ? result.data.groups.map((item: AnyRecord) => ({
          name: normalizeText(item.name),
          temporary: Boolean(item.temporary),
          expiresAt: item.expiresAt ? normalizeIsoTime(item.expiresAt) : undefined
        }))
      : [];

    const primaryGroup = normalizeText(result.data.primaryGroup) || undefined;
    const availableGroupsFromController = Array.isArray(result.data.availableGroups)
      ? result.data.availableGroups
          .map((item: unknown) => normalizeText(item))
          .filter(Boolean)
      : [];
    const availableGroups = Array.from(
      new Set([
        ...availableGroupsFromController,
        ...groups.map((item) => item.name),
        ...(primaryGroup ? [primaryGroup] : [])
      ])
    ).sort((left, right) => left.localeCompare(right, "zh-CN"));

    const permissions = Array.isArray(result.data.permissions)
      ? result.data.permissions.map((item: AnyRecord) => ({
          node: normalizeText(item.node),
          value: item.value !== false,
          temporary: Boolean(item.temporary),
          expiresAt: item.expiresAt ? normalizeIsoTime(item.expiresAt) : undefined
        }))
      : [];

    return {
      available: true,
      primaryGroup,
      availableGroups,
      groups,
      permissions,
      updatedAt: new Date().toISOString()
    };
  }

  private async queryModeration(instanceId: string, playerUuid: string): Promise<IMcsmGmModerationStatus> {
    const { snapshot } = this.ensureSnapshotOrThrow(instanceId);
    if (!snapshot.dependencies.chatPluginAvailable) {
      return {
        chatPluginAvailable: false,
        chatPluginType: snapshot.dependencies.chatPluginType,
        muted: false,
        updatedAt: new Date().toISOString()
      };
    }

    const result = await this.callController(instanceId, {
      action: "mute",
      operation: "status",
      playerUuid
    });
    if (!result.ok && result.statusCode >= 500) {
      const error: any = new Error(result.message || "Mute status query failed.");
      error.status = result.statusCode;
      throw error;
    }

    const expireAt =
      result.data.expiresAt && normalizeNumber(result.data.expiresAt, 0) > 0
        ? normalizeIsoTime(result.data.expiresAt)
        : undefined;
    const remainingSeconds =
      expireAt != null ? Math.max(0, Math.floor((new Date(expireAt).getTime() - Date.now()) / 1000)) : undefined;

    return {
      chatPluginAvailable: true,
      chatPluginType: snapshot.dependencies.chatPluginType,
      muted: Boolean(result.data.muted || result.data.expiresAt || result.data.reason),
      remainingSeconds,
      expireAt,
      reason: normalizeText(result.data.reason) || undefined,
      operatorName: normalizeText(result.data.operatorName) || undefined,
      updatedAt: new Date().toISOString()
    };
  }

  public recordPlayerSnapshot(payload: IPlayerSnapshotPayload) {
    const serverId = normalizeText(payload.serverId);
    const instanceToken = normalizeText(payload.instanceToken);
    this.validatePluginPayload(serverId, instanceToken);

    const timestamp = normalizeNumber(payload.timestamp, Date.now());
    const dependencies = this.buildDependencies(payload);
    const players = Array.isArray(payload.players)
      ? payload.players
          .map((item) => {
            const playerUuid = normalizeText(item.uuid);
            const playerName = normalizeText(item.name);
            if (!playerUuid || !playerName) {
              return null;
            }
            return {
              playerUuid,
              playerName,
              online: true,
              lastSeenAt: new Date(timestamp).toISOString(),
              muted: Boolean(item.muted),
              muteReason: normalizeText(item.muteReason) || undefined,
              muteExpiresAt:
                item.muteExpiresAt && normalizeNumber(item.muteExpiresAt, 0) > 0
                  ? normalizeIsoTime(item.muteExpiresAt)
                  : undefined
            } satisfies IStoredPlayer;
          })
          .filter(Boolean) as IStoredPlayer[]
      : [];

    this.snapshotMap.set(serverId, {
      instanceId: serverId,
      updatedAt: timestamp,
      dependencies,
      players,
      controllerToken: normalizeText(payload.localControlToken) || instanceToken
    });

    return {
      serverId,
      playerCount: players.length,
      updatedAt: new Date(timestamp).toISOString()
    };
  }

  public async recordChatMessage(payload: IChatPayload) {
    const serverId = normalizeText(payload.serverId);
    const instanceToken = normalizeText(payload.instanceToken);
    this.validatePluginPayload(serverId, instanceToken);

    const instance = this.getInstanceOrThrow(serverId);
    const message: IMcsmGmChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      daemonId: "",
      instanceId: serverId,
      playerUuid: normalizeText(payload.playerUuid) || undefined,
      playerName: normalizeText(payload.playerName) || undefined,
      senderType: "player",
      channel: normalizeText(payload.channel) || undefined,
      tellPlayerName: normalizeText(payload.tellPlayerName) || undefined,
      mentionedPlayers: Array.isArray(payload.mentionedPlayers)
        ? payload.mentionedPlayers.map((item) => normalizeText(item)).filter(Boolean)
        : undefined,
      source: normalizeText(payload.source) || undefined,
      text: normalizeText(payload.message),
      time: normalizeIsoTime(payload.timestamp)
    };

    if (!message.text) {
      const error: any = new Error("message is required.");
      error.status = 400;
      throw error;
    }

    await this.appendChatLog(serverId, message);
    return {
      instanceId: serverId,
      instanceName: instance.config.nickname,
      messageId: message.id
    };
  }

  public async getOverview() {
    const servers = await Promise.all(
      InstanceSubsystem.getInstances().map(async (instance) => {
        const snapshot = this.snapshotMap.get(instance.instanceUuid);
        return {
          daemonId: "",
          daemonDisplayName: "",
          daemonAvailable: true,
          daemonEndpoint: "",
          instanceId: instance.instanceUuid,
          instanceDisplayName: instance.config.nickname,
          instanceStatus: instance.status(),
          playerCount:
            snapshot?.players.filter((item) => item.online).length ?? normalizeNumber(instance.info.currentPlayers, 0),
          chatMessagesToday: await this.countTodayMessages(instance.instanceUuid),
          dependencies:
            snapshot?.dependencies || {
              economyAvailable: false,
              pointsAvailable: false,
              luckPermsAvailable: false,
              chatPluginAvailable: false,
              chatPluginType: "native",
              updatedAt: new Date().toISOString()
            }
        } satisfies IMcsmGmOverviewServer;
      })
    );

    return {
      generatedAt: Date.now(),
      servers
    };
  }

  public getPlayers(instanceId: string): IMcsmGmPlayerPresence[] {
    const { instance, snapshot } = this.ensureSnapshotOrThrow(instanceId);
    return snapshot.players
      .slice()
      .sort((a, b) => a.playerName.localeCompare(b.playerName, "zh-CN"))
      .map((item) => ({
        daemonId: "",
        daemonDisplayName: "",
        instanceId,
        instanceDisplayName: instance.config.nickname,
        playerUuid: item.playerUuid,
        playerName: item.playerName,
        online: item.online,
        lastSeenAt: item.lastSeenAt
      }));
  }

  public async getChat(instanceId: string, cursor?: string, limit?: number, playerUuid?: string) {
    this.getInstanceOrThrow(instanceId);
    const maxLimit = Math.max(1, Math.min(CHAT_PAGE_LIMIT, Number(limit) || 80));
    const items = await this.readChatLog(instanceId);
    const filtered = playerUuid ? items.filter((item) => item.playerUuid === playerUuid) : items;

    if (!cursor) {
      const sliced = filtered.slice(-maxLimit);
      return {
        items: sliced,
        nextCursor: sliced[sliced.length - 1]?.id,
        hasMore: filtered.length > sliced.length
      };
    }

    const index = filtered.findIndex((item) => item.id === cursor);
    const nextItems = (index >= 0 ? filtered.slice(index + 1) : filtered.slice(-maxLimit)).slice(0, maxLimit);
    return {
      items: nextItems,
      nextCursor: nextItems[nextItems.length - 1]?.id || cursor,
      hasMore: index >= 0 ? filtered.length > index + 1 + nextItems.length : filtered.length > nextItems.length
    };
  }

  public async getBalances(instanceId: string, playerUuid: string) {
    return this.queryBalances(instanceId, playerUuid);
  }

  public async getLuckPerms(instanceId: string, playerUuid: string) {
    return this.queryLuckPerms(instanceId, playerUuid);
  }

  public async getModeration(instanceId: string, playerUuid: string) {
    return this.queryModeration(instanceId, playerUuid);
  }

  public async executeAction(request: IMcsmGmActionRequest): Promise<IMcsmGmActionResult> {
    const { instance, snapshot } = this.ensureSnapshotOrThrow(request.instanceId);
    const player =
      snapshot.players.find((item) => item.playerUuid === request.playerUuid) ||
      ({
        playerUuid: request.playerUuid,
        playerName: request.playerUuid,
        online: false,
        lastSeenAt: new Date().toISOString()
      } as IStoredPlayer);

    let beforeValue: number | undefined;
    if (request.kind === "economy_deposit" || request.kind === "economy_withdraw") {
      const currentBalances = await this.queryBalances(request.instanceId, request.playerUuid);
      beforeValue = currentBalances.economyBalance;
    }
    if (request.kind === "points_give" || request.kind === "points_take") {
      const currentBalances = await this.queryBalances(request.instanceId, request.playerUuid);
      beforeValue = currentBalances.pointsBalance;
    }

    const response = await this.callController(request.instanceId, this.mapActionRequest(request));
    const success = response.ok && response.statusCode < 400;

    const result: IMcsmGmActionResult = {
      success,
      kind: request.kind,
      daemonId: "",
      instanceId: request.instanceId,
      playerUuid: request.playerUuid,
      playerName: normalizeText(response.data.playerName) || player.playerName,
      message: response.message || (success ? "Action executed." : "Action rejected."),
      beforeValue,
      updatedAt: new Date().toISOString()
    };

    if (
      request.kind === "economy_deposit" ||
      request.kind === "economy_withdraw" ||
      request.kind === "points_give" ||
      request.kind === "points_take"
    ) {
      if (success) {
        result.balances = await this.queryBalances(request.instanceId, request.playerUuid);
        if (request.kind === "economy_deposit" || request.kind === "economy_withdraw") {
          result.afterValue = result.balances.economyBalance;
        }
        if (request.kind === "points_give" || request.kind === "points_take") {
          result.afterValue = result.balances.pointsBalance;
        }
      } else {
        result.afterValue = beforeValue;
      }
    }

    if (success && request.kind.startsWith("lp_")) {
      result.luckPerms = await this.queryLuckPerms(request.instanceId, request.playerUuid);
    }

    if (request.kind === "chat_mute" || request.kind === "chat_unmute") {
      try {
        result.moderation = await this.queryModeration(request.instanceId, request.playerUuid);
      } catch (error) {
        if (success) {
          throw error;
        }
      }
    }

    return result;
  }
}

export default new GmService();
