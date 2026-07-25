import Router from "@koa/router";
import { ROLE } from "../entity/user";
import permission from "../middleware/permission";
import RemoteRequest from "../service/remote_command";
import RemoteServiceSubsystem from "../service/remote_service";

const router = new Router({ prefix: "/economy" });

const buildDaemonDisplayName = (remoteService: any) =>
  String(remoteService?.config?.remarks || remoteService?.uuid || "").trim() || remoteService.uuid;

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

const enrichOverview = (
  overview: IMcsmEconomyOverviewResponse,
  remoteService: any
): IMcsmEconomyOverviewResponse => ({
  ...overview,
  servers: (overview.servers || []).map((server) => ({
    ...server,
    daemonId: remoteService.uuid,
    daemonDisplayName: buildDaemonDisplayName(remoteService),
    daemonAvailable: Boolean(remoteService.available)
  }))
});

router.get("/overview", permission({ level: ROLE.ADMIN }), async (ctx) => {
  try {
    const daemonId = String(ctx.query.daemonId || "");
    const query = {
      instanceId: String(ctx.query.instanceId || ""),
      currencyType: String(ctx.query.currencyType || ""),
      startAt: String(ctx.query.startAt || ""),
      endAt: String(ctx.query.endAt || "")
    };

    if (daemonId) {
      const remoteService = getRemoteServiceOrThrow(daemonId);
      const overview = await new RemoteRequest(remoteService).request<IMcsmEconomyOverviewResponse>(
        "economy/overview",
        query
      );
      ctx.body = enrichOverview(overview, remoteService);
      return;
    }

    const overviews: IMcsmEconomyOverviewResponse[] = [];
    for (const remoteService of RemoteServiceSubsystem.services.values()) {
      if (!remoteService.available || !remoteService.socket?.connected) continue;
      try {
        const overview = await new RemoteRequest(remoteService).request<IMcsmEconomyOverviewResponse>(
          "economy/overview",
          query
        );
        overviews.push(enrichOverview(overview, remoteService));
      } catch (error) {
        // Keep the global overview usable when one daemon is stale or lacks the economy module.
      }
    }

    const servers = overviews.reduce<IMcsmEconomyOverviewServer[]>(
      (result, item) => result.concat(item.servers || []),
      []
    );
    ctx.body = {
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
    } satisfies IMcsmEconomyOverviewResponse;
  } catch (error) {
    handleRouteError(ctx, error);
  }
});

router.get("/transactions", permission({ level: ROLE.ADMIN }), async (ctx) => {
  try {
    const daemonId = String(ctx.query.daemonId || "");
    if (!daemonId) {
      ctx.status = 400;
      ctx.body = "daemonId is required.";
      return;
    }
    const response = await requestRemote<IMcsmEconomyTransactionsResponse>(
      daemonId,
      "economy/transactions",
      {
        instanceId: String(ctx.query.instanceId || ""),
        currencyType: String(ctx.query.currencyType || ""),
        playerUuid: String(ctx.query.playerUuid || ""),
        category: String(ctx.query.category || ""),
        source: String(ctx.query.source || ""),
        startAt: String(ctx.query.startAt || ""),
        endAt: String(ctx.query.endAt || ""),
        limit: Number(ctx.query.limit || 0) || undefined,
        offset: Number(ctx.query.offset || 0) || undefined
      }
    );
    ctx.body = {
      ...response,
      items: (response.items || []).map((item) => ({
        ...item,
        daemonId
      }))
    } satisfies IMcsmEconomyTransactionsResponse;
  } catch (error) {
    handleRouteError(ctx, error);
  }
});

router.get("/currencies", permission({ level: ROLE.ADMIN }), async (ctx) => {
  try {
    const daemonId = String(ctx.query.daemonId || "");
    const instanceId = String(ctx.query.instanceId || "");
    if (!daemonId || !instanceId) {
      ctx.status = 400;
      ctx.body = "daemonId and instanceId are required.";
      return;
    }
    ctx.body = await requestRemote<IMcsmEconomyCurrenciesResponse>(daemonId, "economy/currencies", {
      instanceId
    });
  } catch (error) {
    handleRouteError(ctx, error);
  }
});

export default router;
