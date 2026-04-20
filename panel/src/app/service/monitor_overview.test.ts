import assert from "assert";

import {
  aggregateMonitorOverview,
  type IMonitorNodeOverviewInput
} from "./monitor_overview";

const baseNode: IMonitorNodeOverviewInput = {
  daemonId: "daemon-1",
  daemonIp: "127.0.0.1",
  daemonPort: 24444,
  daemonPrefix: "",
  daemonRemarks: "Test Node",
  remoteAvailable: true,
  overviewAvailable: false
};

const failedOverviewResult = aggregateMonitorOverview([
  {
    ...baseNode,
    overviewAvailable: false
  }
]);

assert.equal(failedOverviewResult.summary.nodesTotal, 1);
assert.equal(failedOverviewResult.summary.nodesOnline, 0);
assert.equal(failedOverviewResult.nodes[0].available, false);
assert.deepEqual(failedOverviewResult.nodes[0].servers, []);

const successOverviewResult = aggregateMonitorOverview([
  {
    ...baseNode,
    overviewAvailable: true,
    overview: {
      generatedAt: 1,
      host: {
        cpuPercent: 12.5,
        memPercent: 23.4,
        totalmem: 100,
        freemem: 20,
        hostname: "host-a",
        platform: "linux",
        loadavg: [0.1, 0.2, 0.3],
        disks: []
      },
      servers: [
        {
          serverId: "server-a",
          instanceId: "server-a",
          instanceName: "Lobby",
          daemonTime: 1,
          status: 3,
          statusText: "running",
          processRunning: true,
          process: {},
          plugin: {
            online: true,
            worlds: [],
            mainThreadBlocked: false,
            tps: {
              oneMin: 19.8,
              fiveMin: 19.7,
              fifteenMin: 19.6
            },
            onlinePlayers: 5,
            maxPlayers: 20
          },
          history: []
        }
      ]
    }
  }
]);

assert.equal(successOverviewResult.summary.nodesOnline, 1);
assert.equal(successOverviewResult.summary.serversTotal, 1);
assert.equal(successOverviewResult.summary.serversRunning, 1);
assert.equal(successOverviewResult.summary.pluginOnline, 1);
assert.equal(successOverviewResult.nodes[0].available, true);
assert.equal(successOverviewResult.servers[0].daemonAvailable, true);

console.log("monitor_overview tests passed");
process.exit(0);
