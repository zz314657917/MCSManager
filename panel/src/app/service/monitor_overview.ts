export interface IMonitorNodeOverviewInput {
  daemonId: string;
  daemonIp: string;
  daemonPort: number;
  daemonPrefix: string;
  daemonRemarks: string;
  remoteAvailable: boolean;
  overviewAvailable: boolean;
  overview?: {
    generatedAt: number;
    host: IMcsmMonitorHostSnapshot;
    servers: IMcsmMonitorServerSnapshot[];
  };
}

export function aggregateMonitorOverview(
  nodesInput: IMonitorNodeOverviewInput[]
): IMcsmMonitorOverviewResponse {
  const nodes: IMcsmMonitorNodeOverview[] = [];
  const servers: IMcsmMonitorOverviewResponse["servers"] = [];

  for (const item of nodesInput) {
    const available = item.remoteAvailable && item.overviewAvailable;
    const nodeItem: IMcsmMonitorNodeOverview = {
      daemonId: item.daemonId,
      daemonIp: item.daemonIp,
      daemonPort: item.daemonPort,
      daemonPrefix: item.daemonPrefix,
      daemonRemarks: item.daemonRemarks,
      available,
      host: item.overview?.host,
      servers: item.overview?.servers ?? []
    };
    nodes.push(nodeItem);

    for (const server of nodeItem.servers) {
      servers.push({
        ...server,
        daemonId: nodeItem.daemonId,
        daemonRemarks: nodeItem.daemonRemarks,
        daemonIp: nodeItem.daemonIp,
        daemonPort: nodeItem.daemonPort,
        daemonPrefix: nodeItem.daemonPrefix,
        daemonAvailable: nodeItem.available
      });
    }
  }

  return {
    generatedAt: Date.now(),
    summary: {
      nodesTotal: nodes.length,
      nodesOnline: nodes.filter((node) => node.available).length,
      serversTotal: servers.length,
      serversRunning: servers.filter((server) => server.processRunning).length,
      pluginOnline: servers.filter((server) => server.plugin.online).length
    },
    nodes,
    servers
  };
}
