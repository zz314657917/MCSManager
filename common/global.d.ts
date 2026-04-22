declare global {
  interface IGlobalInstanceConfig {
    nickname: string;
    startCommand: string;
    stopCommand: string;
    cwd: string;
    ie: string;
    oe: string;
    createDatetime: number;
    lastDatetime: number;
    type: string;
    tag: string[];
    endTime: number;
    fileCode: string;
    processType: ProcessType;
    updateCommand: string;
    runAs: string;
    actionCommandList: any[];
    crlf: number;
    category: number;
    basePort: number;

    // Steam RCON
    enableRcon?: boolean;
    rconPassword?: string;
    rconPort?: number;
    rconIp?: string;

    // Java
    java: IInstanceJavaConfig;

    // Old fields
    terminalOption: {
      haveColor: boolean;
      pty: boolean;
      ptyWindowCol: number;
      ptyWindowRow: number;
    };
    eventTask: {
      autoStart: boolean;
      autoRestart: boolean;
      autoRestartMaxTimes: number;
      ignore: boolean;
    };
    docker: IGlobalInstanceDockerConfig;
    pingConfig: {
      ip?: string;
      port?: number;
      type?: number;
    };
    extraServiceConfig: {
      openFrpTunnelId?: string;
      openFrpToken?: string;
    };
  }

  type ProcessType = "general" | "docker";

  interface IInstanceJavaConfig {
    id: string;
  }

  interface IJavaInfo {
    fullname: string;
    path?: string;
    installTime: number;
    downloading: boolean;
  }

  interface IJavaRuntime {
    info: IJavaInfo;
    path: string;
    usingInstances: string[];
  }

  interface IGlobalInstanceDockerConfig {
    /** Docker image for update command; empty = not used */
    updateCommandImage?: string;
    containerName?: string;
    image?: string;
    memory?: number;
    ports?: string[];
    extraVolumes?: string[];
    maxSpace?: number;
    network?: number;
    io?: number;
    networkMode?: string;
    networkAliases?: string[];
    cpusetCpus?: string;
    cpuUsage?: number;
    workingDir?: string;
    env?: string[];
    changeWorkdir?: boolean;
    memorySwap?: number;
    memorySwappiness?: number;
    labels?: string[];
    capAdd?: string[];
    capDrop?: string[];
    devices?: string[];
    privileged?: boolean;
    /** Upload speed limit in KB/s */
    uploadSpeedLimit?: number;
    /** Download speed limit in KB/s */
    downloadSpeedLimit?: number;
    /** Whether to enable GPU passthrough */
    gpuEnabled?: boolean;
    /** GPU count: -1 = all GPUs, 0 = none, positive integer = specific count */
    gpuCount?: number;
    /** Specific GPU device IDs, e.g. ["0","1"] or ["GPU-xxxx"]. Mutually exclusive with gpuCount */
    gpuDeviceIds?: string[];
    /** GPU driver name, default "nvidia" */
    gpuDriver?: string;
  }

  interface IPanelResponseProtocol {
    data: any;
    timestamp: number;
    status: number;
  }

  interface IPanelOverviewRemoteMappingResponse {
    from: {
      ip: string;
      port: number;
      prefix: string;
    };
    to: {
      ip: string;
      port: number;
      prefix: string;
    };
  }

  interface IPanelOverviewRemoteResponse {
    version: string;
    process?: {
      cpu: number;
      memory: number;
      cwd: string;
    };
    instance?: {
      running: number;
      total: number;
    };
    system?: {
      type: string;
      hostname: string;
      platform: string;
      release: string;
      uptime: number;
      cwd: string;
      loadavg: number[];
      freemem: number;
      cpuUsage: number;
      memUsage: number;
      totalmem: number;
      processCpu: number;
      processMem: number;
      disks?: IMcsmMonitorDiskSnapshot[];
      primaryDisk?: IMcsmMonitorDiskSnapshot;
    };
    cpuMemChart?: {
      cpu: number;
      mem: number;
    }[];
    uuid: string;
    ip: string;
    port: number;
    prefix: string;
    remoteMappings: IPanelOverviewRemoteMappingResponse[];
    available: boolean;
    remarks: string;
    config: {
      language: string;
      uploadSpeedRate: number;
      downloadSpeedRate: number;
      maxDownloadFromUrlFileCount: number;
      portRangeStart: number;
      portRangeEnd: number;
      portAssignInterval: number;
      port: number;
      outputBufferSize: number;
      enableSoftShutdown: boolean;
      softShutdownSkipDocker: boolean;
      softShutdownWaitSeconds: number;
    };
    dockerPlatforms?: string[];
  }

  interface IPanelOverviewResponse {
    version: string;
    specifiedDaemonVersion: string;
    process: {
      cpu: number;
      memory: number;
      cwd: string;
    };
    record: {
      logined: number;
      illegalAccess: number;
      banips: number;
      loginFailed: number;
    };
    system: {
      user: any;
      time: number;
      totalmem: number;
      freemem: number;
      type: string;
      version: string;
      node: string;
      hostname: string;
      loadavg: number[];
      platform: string;
      release: string;
      uptime: number;
      cpu: number;
    };
    chart: {
      system: { cpu: number; mem: number }[];
      request: { value: number; totalInstance: number; runningInstance: number }[];
    };
    remoteCount: {
      available: number;
      total: number;
    };
    remote: IPanelOverviewRemoteResponse[];
  }

  interface IMcsmMonitorTpsSnapshot {
    oneMin: number;
    fiveMin: number;
    fifteenMin: number;
  }

  interface IMcsmMonitorProcessSnapshot {
    pid?: number | string;
    rootPid?: number | string;
    childPid?: number | string;
    rootState?: string;
    childState?: string;
    sessionAlive?: boolean;
    healthy?: boolean;
    cpuPercent?: number;
    memoryBytes?: number;
    memoryPercent?: number;
  }

  interface IMcsmMonitorPluginSnapshot {
    online: boolean;
    lastSeen?: number;
    heartbeatAgeMs?: number;
    pluginVersion?: string;
    serverVersion?: string;
    motd?: string;
    worlds: string[];
    mainThreadBlocked: boolean;
    tps: IMcsmMonitorTpsSnapshot;
    onlinePlayers: number;
    maxPlayers: number;
  }

  interface IMcsmMonitorDiskSnapshot {
    mount: string;
    device: string;
    totalBytes: number;
    usedBytes: number;
    freeBytes: number;
    usagePercent: number;
  }

  interface IMcsmMonitorHistoryPoint {
    timestamp: number;
    tps: number;
    onlinePlayers: number;
    procCpu: number;
    procMemPercent: number;
  }

  interface IMcsmMonitorServerSnapshot {
    serverId: string;
    instanceId: string;
    instanceName: string;
    daemonTime: number;
    status: number;
    statusText: string;
    processRunning: boolean;
    process: IMcsmMonitorProcessSnapshot;
    plugin: IMcsmMonitorPluginSnapshot;
    hostPrimaryDisk?: IMcsmMonitorDiskSnapshot;
    history: IMcsmMonitorHistoryPoint[];
  }

  interface IMcsmMonitorHostSnapshot {
    cpuPercent: number;
    memPercent: number;
    totalmem: number;
    freemem: number;
    hostname: string;
    platform: string;
    loadavg: number[];
    primaryDisk?: IMcsmMonitorDiskSnapshot;
    disks: IMcsmMonitorDiskSnapshot[];
  }

  interface IMcsmMonitorNodeOverview {
    daemonId: string;
    daemonIp: string;
    daemonPort: number;
    daemonPrefix: string;
    daemonRemarks: string;
    available: boolean;
    host?: IMcsmMonitorHostSnapshot;
    servers: IMcsmMonitorServerSnapshot[];
  }

  interface IMcsmMonitorOverviewResponse {
    generatedAt: number;
    summary: {
      nodesTotal: number;
      nodesOnline: number;
      serversTotal: number;
      serversRunning: number;
      pluginOnline: number;
    };
    nodes: IMcsmMonitorNodeOverview[];
    servers: Array<
      IMcsmMonitorServerSnapshot & {
        daemonId: string;
        daemonRemarks: string;
        daemonIp: string;
        daemonPort: number;
        daemonPrefix: string;
        daemonAvailable: boolean;
      }
    >;
  }

  type IMcsmGmChatPluginType = "playerchat" | "native";

  type IMcsmGmActionKind =
    | "economy_deposit"
    | "economy_withdraw"
    | "points_give"
    | "points_take"
    | "lp_group_add"
    | "lp_group_switch"
    | "lp_group_remove"
    | "lp_permission_set"
    | "lp_permission_unset"
    | "lp_temp_group_add"
    | "lp_temp_group_remove"
    | "lp_temp_permission_set"
    | "lp_temp_permission_unset"
    | "chat_mute"
    | "chat_unmute";

  interface IMcsmGmControllerInfo {
    host: string;
    port: number;
  }

  interface IMcsmGmPlayerPresence {
    daemonId: string;
    daemonDisplayName: string;
    instanceId: string;
    instanceDisplayName: string;
    playerUuid: string;
    playerName: string;
    online: boolean;
    lastSeenAt: string;
  }

  interface IMcsmGmPlayerBalances {
    economyAvailable: boolean;
    economyBalance?: number;
    pointsAvailable: boolean;
    pointsBalance?: number;
    updatedAt?: string;
  }

  interface IMcsmGmModerationStatus {
    chatPluginAvailable: boolean;
    chatPluginType: IMcsmGmChatPluginType;
    muted: boolean;
    remainingSeconds?: number;
    expireAt?: string;
    reason?: string;
    operatorName?: string;
    updatedAt?: string;
  }

  interface IMcsmGmInventoryEnchant {
    key: string;
    level: number;
  }

  interface IMcsmGmInventorySlot {
    section: "hotbar" | "main" | "armor" | "offhand";
    slot: number;
    empty: boolean;
    material?: string;
    rawTypeName?: string;
    amount?: number;
    durability?: number;
    maxDurability?: number;
    displayName?: string;
    lore?: string[];
    enchants?: IMcsmGmInventoryEnchant[];
    itemFlags?: string[];
  }

  interface IMcsmGmPlayerInventorySnapshot {
    available: boolean;
    playerUuid: string;
    playerName: string;
    online: boolean;
    source: "bukkit";
    updatedAt: string;
    slots: IMcsmGmInventorySlot[];
  }

  interface IMcsmLuckPermsGroupGrant {
    name: string;
    temporary: boolean;
    expiresAt?: string;
  }

  interface IMcsmLuckPermsPermissionGrant {
    node: string;
    value: boolean;
    temporary: boolean;
    expiresAt?: string;
  }

  interface IMcsmLuckPermsSnapshot {
    available: boolean;
    primaryGroup?: string;
    availableGroups: string[];
    groups: IMcsmLuckPermsGroupGrant[];
    permissions: IMcsmLuckPermsPermissionGrant[];
    updatedAt?: string;
  }

  interface IMcsmGmPlayerSnapshot {
    presence: IMcsmGmPlayerPresence;
    balances: IMcsmGmPlayerBalances;
    luckPerms: IMcsmLuckPermsSnapshot;
    moderation: IMcsmGmModerationStatus;
  }

  interface IMcsmGmChatMessage {
    id: string;
    daemonId: string;
    instanceId: string;
    playerUuid?: string;
    playerName?: string;
    senderType: "player" | "system" | "gm";
    channel?: string;
    tellPlayerName?: string;
    mentionedPlayers?: string[];
    source?: string;
    text: string;
    time: string;
  }

  interface IMcsmGmDependencySnapshot {
    economyAvailable: boolean;
    pointsAvailable: boolean;
    luckPermsAvailable: boolean;
    chatPluginAvailable: boolean;
    chatPluginType: IMcsmGmChatPluginType;
    controller?: IMcsmGmControllerInfo;
    updatedAt?: string;
  }

  interface IMcsmGmOverviewServer {
    daemonId: string;
    daemonDisplayName: string;
    daemonAvailable: boolean;
    daemonEndpoint: string;
    instanceId: string;
    instanceDisplayName: string;
    instanceStatus: number;
    playerCount: number;
    chatMessagesToday: number;
    dependencies: IMcsmGmDependencySnapshot;
  }

  interface IMcsmGmOverviewNode {
    daemonId: string;
    daemonDisplayName: string;
    daemonAvailable: boolean;
    daemonEndpoint: string;
    instances: IMcsmGmOverviewServer[];
  }

  interface IMcsmGmOverviewResponse {
    generatedAt: number;
    nodes: IMcsmGmOverviewNode[];
    servers: IMcsmGmOverviewServer[];
  }

  type IMcsmGmActionRequest =
    | {
        kind: "economy_deposit" | "economy_withdraw";
        daemonId: string;
        instanceId: string;
        playerUuid: string;
        amount: number;
      }
    | {
        kind: "points_give" | "points_take";
        daemonId: string;
        instanceId: string;
        playerUuid: string;
        amount: number;
      }
    | {
        kind: "lp_group_add" | "lp_group_switch" | "lp_group_remove";
        daemonId: string;
        instanceId: string;
        playerUuid: string;
        group: string;
      }
    | {
        kind: "lp_permission_set" | "lp_permission_unset";
        daemonId: string;
        instanceId: string;
        playerUuid: string;
        node: string;
      }
    | {
        kind: "lp_temp_group_add" | "lp_temp_group_remove";
        daemonId: string;
        instanceId: string;
        playerUuid: string;
        group: string;
        duration: string;
      }
    | {
        kind: "lp_temp_permission_set" | "lp_temp_permission_unset";
        daemonId: string;
        instanceId: string;
        playerUuid: string;
        node: string;
        duration: string;
      }
    | {
        kind: "chat_mute";
        daemonId: string;
        instanceId: string;
        playerUuid: string;
        durationSeconds: number;
        reason?: string;
      }
    | {
        kind: "chat_unmute";
        daemonId: string;
        instanceId: string;
        playerUuid: string;
      };

  interface IMcsmGmActionResult {
    success: boolean;
    kind: IMcsmGmActionKind;
    daemonId: string;
    instanceId: string;
    playerUuid: string;
    playerName?: string;
    message: string;
    beforeValue?: number;
    afterValue?: number;
    balances?: IMcsmGmPlayerBalances;
    luckPerms?: IMcsmLuckPermsSnapshot;
    moderation?: IMcsmGmModerationStatus;
    updatedAt: string;
  }

  interface IMcsmGmAuditRecord {
    id: string;
    operatorName: string;
    daemonId: string;
    instanceId: string;
    playerUuid: string;
    playerName: string;
    actionKind: string;
    success: boolean;
    message: string;
    beforeValue?: number;
    afterValue?: number;
    time: string;
  }

  interface IJsonData {
    [key: string]: any;
  }

  interface IMapData<T> {
    [key: string]: T;
  }

  interface IPageLayoutConfig {
    page: string;
    items: ILayoutCard[];
    theme?: {
      pageTitle: string;
      logoImage: string;
      backgroundImage: string;
      /** Main app navigation: "left" = sidebar, "right" = top header only */
      sidebarPosition?: "left" | "right";
    };
  }

  interface ILayoutCardParams {
    field: string;
    label: string;
    type: "string" | "number" | "boolean" | "instance";
  }

  interface ILayoutCard {
    id: string;
    type: string;
    title: string;
    width: number;
    height: string;
    meta: IJsonData;
    disableAdd?: boolean;
    onlyPath?: string[];
    params?: ILayoutCardParams[];
    followId?: string;
    description?: string;
    allowedPages?: Array<string> | null;
    line?: number;
    disableDelete?: boolean;
  }

  interface IQuickStartPackages {
    language: string;
    description: string;
    title: string;
    category: string;
    runtime: string;
    size: string;
    hardware: string;
    remark: string;
    targetLink?: string;
    author: string;
    dockerOptional?: {
      image: string;
      updateCommandImage?: string;
    };
    setupInfo: IGlobalInstanceConfig;
    gameType: string;
    image: string;
    platform: string;
    tags?: string[];
    isSummary?: boolean;
    key?: string;
  }

  interface IQuickStartTemplate {
    languages: {
      label: string;
      value: string;
    }[];
    packages: IQuickStartPackages[];
  }

  export interface IBusinessProductInfo {
    productId: number;
    title: string;
    price: number;
    ispId: number;
    daemonId: string;
    payload?: string;
    remark?: string;
    hours?: number;
    daemonUuid?: string;
  }
}

export {};
