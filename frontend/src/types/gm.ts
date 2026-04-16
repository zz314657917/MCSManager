export const GM_PLAYER_POLL_INTERVAL_MS = 5000;
export const GM_CHAT_POLL_INTERVAL_MS = 2000;
export const GM_CHAT_PAGE_SIZE = 80;
export const GM_AUDIT_PAGE_SIZE = 20;

export type GmPlayerGroup = {
  serverKey: string;
  daemonDisplayName: string;
  instanceDisplayName: string;
  players: IMcsmGmPlayerPresence[];
};

export const GM_MUTE_PRESETS = [
  { label: "10m", seconds: 10 * 60 },
  { label: "30m", seconds: 30 * 60 },
  { label: "1h", seconds: 60 * 60 },
  { label: "6h", seconds: 6 * 60 * 60 },
  { label: "1d", seconds: 24 * 60 * 60 },
  { label: "7d", seconds: 7 * 24 * 60 * 60 }
] as const;

export const createGmServerKey = (daemonId: string, instanceId: string) => `${daemonId}:${instanceId}`;

export const getGmServerKey = (server?: Pick<IMcsmGmOverviewServer, "daemonId" | "instanceId">) =>
  server ? createGmServerKey(server.daemonId, server.instanceId) : "";

export const formatGmDateTime = (value?: string) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

export const formatGmRelativeSeconds = (seconds?: number) => {
  if (seconds == null || seconds <= 0) return "--";

  const day = 24 * 60 * 60;
  const hour = 60 * 60;
  const minute = 60;

  if (seconds >= day) {
    return `${Math.ceil(seconds / day)}d`;
  }
  if (seconds >= hour) {
    return `${Math.ceil(seconds / hour)}h`;
  }
  if (seconds >= minute) {
    return `${Math.ceil(seconds / minute)}m`;
  }
  return `${seconds}s`;
};

export const sortPlayersByPresence = (a: IMcsmGmPlayerPresence, b: IMcsmGmPlayerPresence) => {
  if (a.online !== b.online) {
    return a.online ? -1 : 1;
  }
  return a.playerName.localeCompare(b.playerName, "zh-CN");
};

export const sortPlayersAcrossServers = (a: IMcsmGmPlayerPresence, b: IMcsmGmPlayerPresence) => {
  if (a.online !== b.online) {
    return a.online ? -1 : 1;
  }

  const daemonResult = a.daemonDisplayName.localeCompare(b.daemonDisplayName, "zh-CN");
  if (daemonResult !== 0) return daemonResult;

  const instanceResult = a.instanceDisplayName.localeCompare(b.instanceDisplayName, "zh-CN");
  if (instanceResult !== 0) return instanceResult;

  return a.playerName.localeCompare(b.playerName, "zh-CN");
};

export const groupPlayersByServer = (players: IMcsmGmPlayerPresence[]): GmPlayerGroup[] => {
  const groups = new Map<string, GmPlayerGroup>();

  for (const player of players) {
    const serverKey = createGmServerKey(player.daemonId, player.instanceId);
    const current =
      groups.get(serverKey) ||
      {
        serverKey,
        daemonDisplayName: player.daemonDisplayName,
        instanceDisplayName: player.instanceDisplayName,
        players: []
      };
    current.players.push(player);
    groups.set(serverKey, current);
  }

  return Array.from(groups.values());
};
