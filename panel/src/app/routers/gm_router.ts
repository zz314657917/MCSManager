import Router from "@koa/router";
import { ROLE } from "../entity/user";
import permission from "../middleware/permission";
import { getUserNameBySession } from "../service/passport_service";
import gmAuditService from "../service/gm_audit_service";
import RemoteRequest from "../service/remote_command";
import RemoteServiceSubsystem from "../service/remote_service";

const router = new Router({ prefix: "/gm" });

const buildDaemonDisplayName = (remoteService: any) =>
  String(remoteService?.config?.remarks || remoteService?.uuid || "").trim() || remoteService.uuid;

const buildDaemonEndpoint = (remoteService: any) => {
  const ip = String(remoteService?.config?.ip || "");
  const port = Number(remoteService?.config?.port || 0);
  const prefix = String(remoteService?.config?.prefix || "").trim();
  return prefix ? `${ip}:${port}${prefix}` : `${ip}:${port}`;
};

const buildFallbackOverviewServer = (
  remoteService: any,
  instance: any
): IMcsmGmOverviewServer => ({
  daemonId: remoteService.uuid,
  daemonDisplayName: buildDaemonDisplayName(remoteService),
  daemonAvailable: Boolean(remoteService.available),
  daemonEndpoint: buildDaemonEndpoint(remoteService),
  instanceId: instance.instanceUuid,
  instanceDisplayName: instance.config?.nickname || instance.instanceUuid,
  instanceStatus: Number(instance.status || 0),
  playerCount: Number(instance.info?.currentPlayers || 0),
  chatMessagesToday: 0,
  dependencies: {
    economyAvailable: false,
    pointsAvailable: false,
    luckPermsAvailable: false,
    chatPluginAvailable: false,
    chatPluginType: "native",
    updatedAt: new Date().toISOString()
  }
});

const getRemoteServiceOrThrow = (daemonId: string) => {
  const remoteService = RemoteServiceSubsystem.getInstance(daemonId);
  if (!remoteService) {
    const error: any = new Error(`Remote daemon ${daemonId} does not exist.`);
    error.status = 404;
    throw error;
  }
  if (!remoteService.available || !remoteService.socket?.connected) {
    const error: any = new Error(`Remote daemon ${daemonId} is offline.`);
    error.status = 503;
    throw error;
  }
  return remoteService;
};

const requestRemote = async <T = any>(daemonId: string, event: string, data?: any): Promise<T> => {
  const remoteService = getRemoteServiceOrThrow(daemonId);
  return new RemoteRequest(remoteService).request<T>(event, data);
};

const handleRouteError = (ctx: Router.RouterContext, error: any, fallbackStatus = 500) => {
  ctx.status = Number(error?.status) || fallbackStatus;
  ctx.body = error?.message || String(error);
};

router.get("/servers", permission({ level: ROLE.ADMIN }), async (ctx) => {
  const nodes: IMcsmGmOverviewNode[] = [];
  const servers: IMcsmGmOverviewServer[] = [];

  for (const remoteService of RemoteServiceSubsystem.services.values()) {
    let daemonServers: IMcsmGmOverviewServer[] = [];

    if (remoteService.available && remoteService.socket?.connected) {
      try {
        const overview = await new RemoteRequest(remoteService).request<{
          generatedAt: number;
          servers: IMcsmGmOverviewServer[];
        }>("gm/overview");
        daemonServers = (overview?.servers || []).map((item) => ({
          ...item,
          daemonId: remoteService.uuid,
          daemonDisplayName: buildDaemonDisplayName(remoteService),
          daemonAvailable: Boolean(remoteService.available),
          daemonEndpoint: buildDaemonEndpoint(remoteService)
        }));
      } catch (error) {
        try {
          const fallbackInstances = await new RemoteRequest(remoteService).request<any[]>("instance/overview");
          daemonServers = (fallbackInstances || []).map((instance) =>
            buildFallbackOverviewServer(remoteService, instance)
          );
        } catch (fallbackError) {
          daemonServers = [];
        }
      }
    }

    const node: IMcsmGmOverviewNode = {
      daemonId: remoteService.uuid,
      daemonDisplayName: buildDaemonDisplayName(remoteService),
      daemonAvailable: Boolean(remoteService.available),
      daemonEndpoint: buildDaemonEndpoint(remoteService),
      instances: daemonServers
    };

    nodes.push(node);
    servers.push(...daemonServers);
  }

  ctx.body = {
    generatedAt: Date.now(),
    nodes,
    servers
  } satisfies IMcsmGmOverviewResponse;
});

router.get("/:daemonId/:instanceId/players", permission({ level: ROLE.ADMIN }), async (ctx) => {
  try {
    const remoteService = getRemoteServiceOrThrow(ctx.params.daemonId);
    const items = await new RemoteRequest(remoteService).request<IMcsmGmPlayerPresence[]>("gm/players", {
      instanceId: ctx.params.instanceId
    });
    ctx.body = (items || []).map((item) => ({
      ...item,
      daemonId: ctx.params.daemonId,
      daemonDisplayName: buildDaemonDisplayName(remoteService)
    }));
  } catch (error) {
    handleRouteError(ctx, error);
  }
});

router.get("/:daemonId/:instanceId/chat", permission({ level: ROLE.ADMIN }), async (ctx) => {
  try {
    const limit = Number(ctx.query.limit || 0) || undefined;
    const remoteService = getRemoteServiceOrThrow(ctx.params.daemonId);
    const response = await new RemoteRequest(remoteService).request<{
      items: IMcsmGmChatMessage[];
      nextCursor?: string;
      hasMore?: boolean;
    }>("gm/chat", {
      instanceId: ctx.params.instanceId,
      cursor: ctx.query.cursor,
      limit,
      playerUuid: ctx.query.playerUuid
    });
    ctx.body = {
      ...response,
      items: (response?.items || []).map((item) => ({
        ...item,
        daemonId: ctx.params.daemonId
      }))
    };
  } catch (error) {
    handleRouteError(ctx, error);
  }
});

router.get(
  "/:daemonId/:instanceId/players/:playerUuid/balances",
  permission({ level: ROLE.ADMIN }),
  async (ctx) => {
    try {
      ctx.body = await requestRemote<IMcsmGmPlayerBalances>(ctx.params.daemonId, "gm/balances", {
        instanceId: ctx.params.instanceId,
        playerUuid: ctx.params.playerUuid
      });
    } catch (error) {
      handleRouteError(ctx, error);
    }
  }
);

router.get(
  "/:daemonId/:instanceId/players/:playerUuid/luckperms",
  permission({ level: ROLE.ADMIN }),
  async (ctx) => {
    try {
      ctx.body = await requestRemote<IMcsmLuckPermsSnapshot>(ctx.params.daemonId, "gm/luckperms", {
        instanceId: ctx.params.instanceId,
        playerUuid: ctx.params.playerUuid
      });
    } catch (error) {
      handleRouteError(ctx, error);
    }
  }
);

router.get(
  "/:daemonId/:instanceId/players/:playerUuid/moderation",
  permission({ level: ROLE.ADMIN }),
  async (ctx) => {
    try {
      ctx.body = await requestRemote<IMcsmGmModerationStatus>(ctx.params.daemonId, "gm/moderation", {
        instanceId: ctx.params.instanceId,
        playerUuid: ctx.params.playerUuid
      });
    } catch (error) {
      handleRouteError(ctx, error);
    }
  }
);

router.post("/actions/execute", permission({ level: ROLE.ADMIN }), async (ctx) => {
  const request = ctx.request.body as IMcsmGmActionRequest;
  if (!request?.daemonId || !request?.instanceId || !request?.playerUuid || !request?.kind) {
    ctx.status = 400;
    ctx.body = "daemonId, instanceId, playerUuid and kind are required.";
    return;
  }

  const operatorName = getUserNameBySession(ctx) || "unknown";

  try {
    const result = await requestRemote<IMcsmGmActionResult>(request.daemonId, "gm/actions/execute", {
      ...request,
      operatorName
    });
    result.daemonId = request.daemonId;

    await gmAuditService.append({
      operatorName,
      daemonId: result.daemonId,
      instanceId: result.instanceId,
      playerUuid: result.playerUuid,
      playerName: result.playerName || result.playerUuid,
      actionKind: result.kind,
      success: result.success,
      message: result.message,
      beforeValue: result.beforeValue,
      afterValue: result.afterValue
    });

    ctx.body = result;
  } catch (error) {
    await gmAuditService.append({
      operatorName,
      daemonId: request.daemonId,
      instanceId: request.instanceId,
      playerUuid: request.playerUuid,
      playerName: request.playerUuid,
      actionKind: request.kind,
      success: false,
      message: error instanceof Error ? error.message : String(error)
    });
    handleRouteError(ctx, error);
  }
});

router.get("/audit", permission({ level: ROLE.ADMIN }), async (ctx) => {
  try {
    ctx.body = await gmAuditService.query({
      daemonId: String(ctx.query.daemonId || ""),
      instanceId: String(ctx.query.instanceId || ""),
      playerUuid: String(ctx.query.playerUuid || ""),
      limit: Number(ctx.query.limit || 0) || undefined
    });
  } catch (error) {
    handleRouteError(ctx, error);
  }
});

export default router;
