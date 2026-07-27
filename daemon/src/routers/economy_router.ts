import * as protocol from "../service/protocol";
import economyService from "../service/economy_service";
import { routerApp } from "../service/router";

routerApp.on("economy/overview", async (ctx, data) => {
  try {
    protocol.response(ctx, await economyService.getOverview(data || {}));
  } catch (error: any) {
    protocol.responseError(ctx, error);
  }
});

routerApp.on("economy/transactions", async (ctx, data) => {
  try {
    protocol.response(ctx, await economyService.getTransactions(data || {}));
  } catch (error: any) {
    protocol.responseError(ctx, error);
  }
});

routerApp.on("economy/currencies", async (ctx, data) => {
  try {
    protocol.response(ctx, await economyService.getCurrencies(String(data?.instanceId || "")));
  } catch (error: any) {
    protocol.responseError(ctx, error);
  }
});
