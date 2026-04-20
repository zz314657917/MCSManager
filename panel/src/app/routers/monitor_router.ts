import Router from "@koa/router";
import { ROLE } from "../entity/user";
import permission from "../middleware/permission";
import RemoteRequest from "../service/remote_command";
import { aggregateMonitorOverview, type IMonitorNodeOverviewInput } from "../service/monitor_overview";
import RemoteServiceSubsystem from "../service/remote_service";

const router = new Router({ prefix: "/monitor" });

router.get("/servers", permission({ level: ROLE.ADMIN }), async (ctx) => {
  const nodesInput: IMonitorNodeOverviewInput[] = [];

  for (const remoteService of RemoteServiceSubsystem.services.values()) {
    let overview:
      | {
          generatedAt: number;
          host: IMcsmMonitorHostSnapshot;
          servers: IMcsmMonitorServerSnapshot[];
        }
      | undefined;

    try {
      overview = await new RemoteRequest(remoteService).request("monitor/overview");
    } catch (error) {
      overview = undefined;
    }

    nodesInput.push({
      daemonId: remoteService.uuid,
      daemonIp: remoteService.config.ip,
      daemonPort: remoteService.config.port,
      daemonPrefix: remoteService.config.prefix,
      daemonRemarks: remoteService.config.remarks,
      remoteAvailable: remoteService.available,
      overviewAvailable: Boolean(overview),
      overview
    });
  }

  ctx.body = aggregateMonitorOverview(nodesInput) satisfies IMcsmMonitorOverviewResponse;
});

export default router;
