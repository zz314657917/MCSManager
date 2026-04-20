import * as protocol from "../service/protocol";
import gmService from "../service/gm_service";
import { routerApp } from "../service/router";

routerApp.on("gm/overview", async (ctx) => {
  try {
    protocol.response(ctx, await gmService.getOverview());
  } catch (error: any) {
    protocol.responseError(ctx, error);
  }
});

routerApp.on("gm/players", async (ctx, data) => {
  try {
    protocol.response(ctx, gmService.getPlayers(String(data.instanceId || "")));
  } catch (error: any) {
    protocol.responseError(ctx, error);
  }
});

routerApp.on("gm/chat", async (ctx, data) => {
  try {
    protocol.response(
      ctx,
      await gmService.getChat(
        String(data.instanceId || ""),
        data.cursor ? String(data.cursor) : undefined,
        data.limit == null ? undefined : Number(data.limit),
        data.playerUuid ? String(data.playerUuid) : undefined
      )
    );
  } catch (error: any) {
    protocol.responseError(ctx, error);
  }
});

routerApp.on("gm/balances", async (ctx, data) => {
  try {
    protocol.response(
      ctx,
      await gmService.getBalances(String(data.instanceId || ""), String(data.playerUuid || ""))
    );
  } catch (error: any) {
    protocol.responseError(ctx, error);
  }
});

routerApp.on("gm/luckperms", async (ctx, data) => {
  try {
    protocol.response(
      ctx,
      await gmService.getLuckPerms(String(data.instanceId || ""), String(data.playerUuid || ""))
    );
  } catch (error: any) {
    protocol.responseError(ctx, error);
  }
});

routerApp.on("gm/moderation", async (ctx, data) => {
  try {
    protocol.response(
      ctx,
      await gmService.getModeration(String(data.instanceId || ""), String(data.playerUuid || ""))
    );
  } catch (error: any) {
    protocol.responseError(ctx, error);
  }
});

routerApp.on("gm/inventory", async (ctx, data) => {
  try {
    protocol.response(
      ctx,
      await gmService.getInventory(String(data.instanceId || ""), String(data.playerUuid || ""))
    );
  } catch (error: any) {
    protocol.responseError(ctx, error);
  }
});

routerApp.on("gm/actions/execute", async (ctx, data) => {
  try {
    protocol.response(ctx, await gmService.executeAction(data as IMcsmGmActionRequest));
  } catch (error: any) {
    protocol.responseError(ctx, error);
  }
});
