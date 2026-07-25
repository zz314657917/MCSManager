import {
  ECONOMY_ALL_SERVERS_KEY,
  createEconomyServerKey,
  type EconomyRankingRangeKey,
  type EconomyTimeRangeKey,
  buildEconomyRankingRows,
  getEconomyRankingTimeRange,
  getEconomyTimeRange
} from "@/hooks/useEconomyConsoleState";
import { computed, ref } from "vue";

type PreviewEconomyServer = {
  server: IMcsmEconomyOverviewServer;
  transactions: IMcsmEconomyTransaction[];
  rankingTransactions?: IMcsmEconomyTransaction[];
};

const delay = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

const rankingPeriodTime = (
  rangeKey: EconomyRankingRangeKey,
  periodOffset: number,
  dayOffset: number,
  hour = 18,
  minute = 0
) => {
  const range = getEconomyRankingTimeRange(rangeKey, periodOffset);
  const date = new Date(range.startAt);
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, minute, 0, 0);
  if (periodOffset === 0 && date.getTime() > Date.now()) {
    date.setTime(Date.now() - Math.max(1, dayOffset + 1) * 10 * 60_000);
  }
  return date.toISOString();
};

const createPreviewTransaction = (
  server: Pick<IMcsmEconomyOverviewServer, "daemonId" | "instanceId">,
  index: number,
  payload: Partial<IMcsmEconomyTransaction> & {
    playerUuid: string;
    currencyType: string;
    delta: number;
    balanceAfter: number;
    category: IMcsmEconomyCategory;
    occurredAt: string;
  }
): IMcsmEconomyTransaction => ({
  id: `preview-economy-${server.instanceId}-${index}`,
  daemonId: server.daemonId,
  instanceId: server.instanceId,
  serverId: server.instanceId,
  playerUuid: payload.playerUuid,
  playerName: payload.playerName,
  currencyType: payload.currencyType,
  currencyName: payload.currencyName || (payload.currencyType === "money" ? "落叶币" : payload.currencyType),
  delta: payload.delta,
  balanceAfter: payload.balanceAfter,
  operatorName: payload.operatorName || "PlayerCurrency",
  operatorReason: payload.operatorReason,
  category: payload.category,
  source: payload.source,
  referenceId: payload.referenceId,
  occurredAt: payload.occurredAt,
  receivedAt: payload.receivedAt || payload.occurredAt
});

const buildHourly = (transactions: IMcsmEconomyTransaction[], currencyType: string) => {
  const map = new Map<number, { systemIn: number; systemOut: number; netChange: number; transactionCount: number }>();
  for (let hour = 0; hour < 24; hour++) {
    map.set(hour, { systemIn: 0, systemOut: 0, netChange: 0, transactionCount: 0 });
  }
  for (const transaction of transactions) {
    if (transaction.currencyType !== currencyType) continue;
    const hour = new Date(transaction.occurredAt).getHours();
    const bucket = map.get(hour);
    if (!bucket) continue;
    if (transaction.delta > 0) bucket.systemIn += transaction.delta;
    if (transaction.delta < 0) bucket.systemOut += Math.abs(transaction.delta);
    bucket.netChange += transaction.delta;
    bucket.transactionCount += 1;
  }
  return Array.from(map.entries()).map(([hour, value]) => ({
    hour,
    label: `${String(hour).padStart(2, "0")}:00`,
    ...value
  }));
};

const buildSources = (transactions: IMcsmEconomyTransaction[], currencyType: string) => {
  const sourceMap = new Map<string, { category: IMcsmEconomyCategory; source: string; amount: number; transactionCount: number }>();
  for (const transaction of transactions) {
    if (transaction.currencyType !== currencyType) continue;
    const source = transaction.source || "unknown";
    const key = `${transaction.category}:${source}`;
    const current =
      sourceMap.get(key) || {
        category: transaction.category,
        source,
        amount: 0,
        transactionCount: 0
      };
    current.amount += Math.abs(transaction.delta);
    current.transactionCount += 1;
    sourceMap.set(key, current);
  }
  return Array.from(sourceMap.values()).sort((a, b) => b.amount - a.amount);
};

const mergePreviewCurrencies = (servers: IMcsmEconomyOverviewServer[]) => {
  const map = new Map<string, IMcsmEconomyCurrency>();
  for (const server of servers) {
    for (const currency of server.currencies) {
      const current = map.get(currency.type);
      const updatedAt =
        !current?.updatedAt || (currency.updatedAt && currency.updatedAt > current.updatedAt)
          ? currency.updatedAt
          : current.updatedAt;
      map.set(currency.type, {
        type: currency.type,
        name: current?.name || currency.name || currency.type,
        totalBalance: (current?.totalBalance || 0) + (currency.totalBalance || 0),
        playerCount: (current?.playerCount || 0) + (currency.playerCount || 0),
        updatedAt
      });
    }
  }
  if (!map.has("money")) {
    map.set("money", {
      type: "money",
      name: "落叶币",
      totalBalance: 0,
      playerCount: 0
    });
  }
  return Array.from(map.values()).sort((a, b) => {
    if (a.type === "money") return -1;
    if (b.type === "money") return 1;
    return a.type.localeCompare(b.type, "zh-CN");
  });
};

const applyServerStats = (
  server: IMcsmEconomyOverviewServer,
  transactions: IMcsmEconomyTransaction[],
  currencyType = server.currencyType
) => {
  const scoped = transactions.filter((item) => item.currencyType === currencyType);
  server.todayIn = scoped.reduce((sum, item) => sum + (item.delta > 0 ? item.delta : 0), 0);
  server.todayOut = scoped.reduce((sum, item) => sum + (item.delta < 0 ? Math.abs(item.delta) : 0), 0);
  server.netChange = scoped.reduce((sum, item) => sum + item.delta, 0);
  server.transactionCount = scoped.length;
  server.lastEventAt = scoped.slice().sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0]?.occurredAt;
  server.dataDelayMs = server.lastEventAt ? Math.max(0, Date.now() - new Date(server.lastEventAt).getTime()) : undefined;
  server.hourly = buildHourly(transactions, currencyType);
  server.sources = buildSources(transactions, currencyType);
};

const createPreviewRecords = (): PreviewEconomyServer[] => {
  const survival: IMcsmEconomyOverviewServer = {
    daemonId: "relay-home-a",
    daemonDisplayName: "家庭节点 A",
    daemonAvailable: true,
    instanceId: "survival-main",
    instanceDisplayName: "生存一区",
    currencyType: "money",
    currencyName: "落叶币",
    todayIn: 0,
    todayOut: 0,
    netChange: 0,
    transactionCount: 0,
    pluginAvailable: true,
    pluginStatusText: "available",
    currencies: [
      {
        type: "money",
        name: "落叶币",
        totalBalance: 12_584_330,
        playerCount: 286,
        updatedAt: minutesAgo(2)
      },
      {
        type: "point",
        name: "点券",
        totalBalance: 184_920,
        playerCount: 123,
        updatedAt: minutesAgo(3)
      }
    ],
    hourly: [],
    sources: []
  };

  const skyblock: IMcsmEconomyOverviewServer = {
    daemonId: "relay-vps-b",
    daemonDisplayName: "异地节点 B",
    daemonAvailable: true,
    instanceId: "skyblock-02",
    instanceDisplayName: "空岛二区",
    currencyType: "money",
    currencyName: "落叶币",
    todayIn: 0,
    todayOut: 0,
    netChange: 0,
    transactionCount: 0,
    pluginAvailable: true,
    pluginStatusText: "available",
    currencies: [
      {
        type: "money",
        name: "落叶币",
        totalBalance: 3_482_800,
        playerCount: 92,
        updatedAt: minutesAgo(16)
      }
    ],
    hourly: [],
    sources: []
  };

  const archive: IMcsmEconomyOverviewServer = {
    daemonId: "relay-backup-c",
    daemonDisplayName: "备份节点 C",
    daemonAvailable: false,
    instanceId: "archive-test",
    instanceDisplayName: "归档服",
    currencyType: "money",
    currencyName: "落叶币",
    todayIn: 0,
    todayOut: 0,
    netChange: 0,
    transactionCount: 0,
    pluginAvailable: false,
    pluginStatusText: "daemon 离线",
    currencies: [
      {
        type: "money",
        name: "落叶币",
        totalBalance: 0,
        playerCount: 0
      }
    ],
    hourly: [],
    sources: []
  };

  const survivalTransactions = [
    createPreviewTransaction(survival, 1, {
      playerUuid: "preview-player-1",
      playerName: "爱马仕",
      currencyType: "money",
      currencyName: "落叶币",
      delta: 12_000,
      balanceAfter: 128_500,
      operatorName: "QuestSystem",
      operatorReason: "ECO|category=SYSTEM_IN|source=daily_quest|ref=quest-1024",
      category: "SYSTEM_IN",
      source: "daily_quest",
      referenceId: "quest-1024",
      occurredAt: minutesAgo(12)
    }),
    createPreviewTransaction(survival, 2, {
      playerUuid: "preview-player-2",
      playerName: "何方妖孽",
      currencyType: "money",
      currencyName: "落叶币",
      delta: -3_500,
      balanceAfter: 82_300,
      operatorName: "Shop",
      operatorReason: "ECO|category=SYSTEM_OUT|source=npc_shop|ref=shop-mineral",
      category: "SYSTEM_OUT",
      source: "npc_shop",
      referenceId: "shop-mineral",
      occurredAt: minutesAgo(28)
    }),
    createPreviewTransaction(survival, 3, {
      playerUuid: "preview-player-3",
      playerName: "落叶",
      currencyType: "money",
      currencyName: "落叶币",
      delta: 6_800,
      balanceAfter: 15_800,
      operatorName: "EventReward",
      operatorReason: "ECO|category=SYSTEM_IN|source=online_reward|ref=event-night",
      category: "SYSTEM_IN",
      source: "online_reward",
      referenceId: "event-night",
      occurredAt: minutesAgo(54)
    }),
    createPreviewTransaction(survival, 4, {
      playerUuid: "preview-player-5",
      playerName: "星河",
      currencyType: "money",
      currencyName: "落叶币",
      delta: -1_200,
      balanceAfter: 246_000,
      operatorName: "Auction",
      operatorReason: "ECO|category=TAX|source=auction_tax|ref=auc-7782",
      category: "TAX",
      source: "auction_tax",
      referenceId: "auc-7782",
      occurredAt: minutesAgo(84)
    }),
    createPreviewTransaction(survival, 5, {
      playerUuid: "preview-player-1",
      playerName: "爱马仕",
      currencyType: "point",
      currencyName: "点券",
      delta: 120,
      balanceAfter: 2_680,
      operatorName: "Recharge",
      operatorReason: "ECO|category=SYSTEM_IN|source=legacy_recharge|ref=preview-order",
      category: "SYSTEM_IN",
      source: "legacy_recharge",
      referenceId: "preview-order",
      occurredAt: minutesAgo(38)
    }),
    createPreviewTransaction(survival, 6, {
      playerUuid: "preview-player-6",
      playerName: "司南",
      currencyType: "money",
      currencyName: "落叶币",
      delta: 48_000,
      balanceAfter: 392_600,
      operatorName: "DungeonReward",
      operatorReason: "ECO|category=SYSTEM_IN|source=dungeon_reward|ref=dungeon-nightmare-17",
      category: "SYSTEM_IN",
      source: "dungeon_reward",
      referenceId: "dungeon-nightmare-17",
      occurredAt: minutesAgo(116)
    }),
    createPreviewTransaction(survival, 7, {
      playerUuid: "preview-player-7",
      playerName: "纸鸢",
      currencyType: "money",
      currencyName: "落叶币",
      delta: 1_800,
      balanceAfter: 24_400,
      operatorName: "VoteReward",
      operatorReason: "ECO|category=SYSTEM_IN|source=vote_reward|ref=vote-20260629",
      category: "SYSTEM_IN",
      source: "vote_reward",
      referenceId: "vote-20260629",
      occurredAt: minutesAgo(164)
    }),
    createPreviewTransaction(survival, 8, {
      playerUuid: "preview-player-8",
      playerName: "北巷",
      currencyType: "money",
      currencyName: "落叶币",
      delta: -2_600,
      balanceAfter: 73_910,
      operatorName: "RepairShop",
      operatorReason: "ECO|category=SYSTEM_OUT|source=repair_fee|ref=repair-diamond-sword",
      category: "SYSTEM_OUT",
      source: "repair_fee",
      referenceId: "repair-diamond-sword",
      occurredAt: minutesAgo(221)
    }),
    createPreviewTransaction(survival, 9, {
      playerUuid: "preview-player-9",
      playerName: "云深",
      currencyType: "money",
      currencyName: "落叶币",
      delta: 50_000,
      balanceAfter: 91_200,
      operatorName: "GM-Blue",
      operatorReason: "ECO|category=ADMIN_ADJUST|source=gm_compensation|ref=ticket-8842",
      category: "ADMIN_ADJUST",
      source: "gm_compensation",
      referenceId: "ticket-8842",
      occurredAt: minutesAgo(302)
    }),
    createPreviewTransaction(survival, 10, {
      playerUuid: "preview-player-10",
      playerName: "南桥",
      currencyType: "money",
      currencyName: "落叶币",
      delta: -7_500,
      balanceAfter: 19_840,
      operatorName: "GM-Blue",
      operatorReason: "ECO|category=ADMIN_ADJUST|source=manual_deduct|ref=audit-1208",
      category: "ADMIN_ADJUST",
      source: "manual_deduct",
      referenceId: "audit-1208",
      occurredAt: minutesAgo(338)
    }),
    createPreviewTransaction(survival, 11, {
      playerUuid: "preview-player-11",
      playerName: "清昼",
      currencyType: "money",
      currencyName: "落叶币",
      delta: -3_000,
      balanceAfter: 67_000,
      operatorName: "Rollback",
      operatorReason: "ECO|category=ROLLBACK|source=rollback_duplicate_reward|ref=rollback-20260629-1",
      category: "ROLLBACK",
      source: "rollback_duplicate_reward",
      referenceId: "rollback-20260629-1",
      occurredAt: minutesAgo(414)
    }),
    createPreviewTransaction(survival, 12, {
      playerUuid: "preview-player-12",
      playerName: "月白",
      currencyType: "money",
      currencyName: "落叶币",
      delta: 22_000,
      balanceAfter: 122_800,
      operatorName: "Trade",
      operatorReason: "ECO|category=PLAYER_TRANSFER|source=player_market|ref=market-trade-5401",
      category: "PLAYER_TRANSFER",
      source: "player_market",
      referenceId: "market-trade-5401",
      occurredAt: minutesAgo(486)
    }),
    createPreviewTransaction(survival, 13, {
      playerUuid: "preview-player-13",
      playerName: "旧城",
      currencyType: "money",
      currencyName: "落叶币",
      delta: -1_650,
      balanceAfter: 44_120,
      operatorName: "MarketTax",
      operatorReason: "ECO|category=TAX|source=player_market_tax|ref=market-trade-5401",
      category: "TAX",
      source: "player_market_tax",
      referenceId: "market-trade-5401",
      occurredAt: minutesAgo(487)
    }),
    createPreviewTransaction(survival, 14, {
      playerUuid: "preview-player-14",
      playerName: "长安",
      currencyType: "money",
      currencyName: "落叶币",
      delta: 3_600,
      balanceAfter: 33_600,
      operatorName: "JobReward",
      operatorReason: "ECO|category=SYSTEM_IN|source=miner_job|ref=job-miner-233",
      category: "SYSTEM_IN",
      source: "miner_job",
      referenceId: "job-miner-233",
      occurredAt: minutesAgo(562)
    }),
    createPreviewTransaction(survival, 15, {
      playerUuid: "preview-player-15",
      playerName: "风起",
      currencyType: "money",
      currencyName: "落叶币",
      delta: -800,
      balanceAfter: 9_500,
      operatorName: "Warp",
      operatorReason: "ECO|category=SYSTEM_OUT|source=warp_fee|ref=warp-end",
      category: "SYSTEM_OUT",
      source: "warp_fee",
      referenceId: "warp-end",
      occurredAt: minutesAgo(621)
    }),
    createPreviewTransaction(survival, 16, {
      playerUuid: "preview-player-2",
      playerName: "何方妖孽",
      currencyType: "point",
      currencyName: "点券",
      delta: -35,
      balanceAfter: 1_125,
      operatorName: "PointShop",
      operatorReason: "ECO|category=SYSTEM_OUT|source=point_shop|ref=cosmetic-wing",
      category: "SYSTEM_OUT",
      source: "point_shop",
      referenceId: "cosmetic-wing",
      occurredAt: minutesAgo(126)
    }),
    createPreviewTransaction(survival, 17, {
      playerUuid: "preview-player-6",
      playerName: "司南",
      currencyType: "point",
      currencyName: "点券",
      delta: 260,
      balanceAfter: 780,
      operatorName: "Recharge",
      operatorReason: "ECO|category=SYSTEM_IN|source=monthly_bonus|ref=monthly-202606",
      category: "SYSTEM_IN",
      source: "monthly_bonus",
      referenceId: "monthly-202606",
      occurredAt: minutesAgo(244)
    }),
    createPreviewTransaction(survival, 18, {
      playerUuid: "preview-player-7",
      playerName: "纸鸢",
      currencyType: "point",
      currencyName: "点券",
      delta: -18,
      balanceAfter: 482,
      operatorName: "MarketTax",
      operatorReason: "ECO|category=TAX|source=point_market_tax|ref=point-trade-2309",
      category: "TAX",
      source: "point_market_tax",
      referenceId: "point-trade-2309",
      occurredAt: minutesAgo(366)
    })
  ];

  const skyblockTransactions = [
    createPreviewTransaction(skyblock, 1, {
      playerUuid: "preview-player-8",
      playerName: "司南",
      currencyType: "money",
      currencyName: "落叶币",
      delta: 2_400,
      balanceAfter: 36_000,
      operatorName: "IslandQuest",
      operatorReason: "ECO|category=SYSTEM_IN|source=island_quest|ref=island-44",
      category: "SYSTEM_IN",
      source: "island_quest",
      referenceId: "island-44",
      occurredAt: minutesAgo(18)
    }),
    createPreviewTransaction(skyblock, 2, {
      playerUuid: "preview-player-9",
      playerName: "纸鸢",
      currencyType: "money",
      currencyName: "落叶币",
      delta: -900,
      balanceAfter: 5_200,
      operatorName: "TeleportShop",
      operatorReason: "ECO|category=SYSTEM_OUT|source=warp_fee|ref=warp-nether",
      category: "SYSTEM_OUT",
      source: "warp_fee",
      referenceId: "warp-nether",
      occurredAt: minutesAgo(44)
    }),
    createPreviewTransaction(skyblock, 3, {
      playerUuid: "preview-player-16",
      playerName: "星河",
      currencyType: "money",
      currencyName: "落叶币",
      delta: 18_500,
      balanceAfter: 246_000,
      operatorName: "IslandQuest",
      operatorReason: "ECO|category=SYSTEM_IN|source=island_top_reward|ref=island-rank-weekly",
      category: "SYSTEM_IN",
      source: "island_top_reward",
      referenceId: "island-rank-weekly",
      occurredAt: minutesAgo(92)
    }),
    createPreviewTransaction(skyblock, 4, {
      playerUuid: "preview-player-17",
      playerName: "渡鸦",
      currencyType: "money",
      currencyName: "落叶币",
      delta: -4_200,
      balanceAfter: 63_400,
      operatorName: "SpawnerShop",
      operatorReason: "ECO|category=SYSTEM_OUT|source=spawner_shop|ref=spawner-cow",
      category: "SYSTEM_OUT",
      source: "spawner_shop",
      referenceId: "spawner-cow",
      occurredAt: minutesAgo(153)
    }),
    createPreviewTransaction(skyblock, 5, {
      playerUuid: "preview-player-18",
      playerName: "青柠",
      currencyType: "money",
      currencyName: "落叶币",
      delta: -2_100,
      balanceAfter: 31_900,
      operatorName: "Auction",
      operatorReason: "ECO|category=TAX|source=auction_tax|ref=auc-sky-2219",
      category: "TAX",
      source: "auction_tax",
      referenceId: "auc-sky-2219",
      occurredAt: minutesAgo(216)
    }),
    createPreviewTransaction(skyblock, 6, {
      playerUuid: "preview-player-19",
      playerName: "林间",
      currencyType: "money",
      currencyName: "落叶币",
      delta: 9_600,
      balanceAfter: 59_600,
      operatorName: "CrateReward",
      operatorReason: "ECO|category=SYSTEM_IN|source=crate_reward|ref=crate-vote-91",
      category: "SYSTEM_IN",
      source: "crate_reward",
      referenceId: "crate-vote-91",
      occurredAt: minutesAgo(284)
    }),
    createPreviewTransaction(skyblock, 7, {
      playerUuid: "preview-player-20",
      playerName: "霜序",
      currencyType: "money",
      currencyName: "落叶币",
      delta: -6_000,
      balanceAfter: 14_000,
      operatorName: "Trade",
      operatorReason: "ECO|category=PLAYER_TRANSFER|source=player_trade|ref=trade-sky-303",
      category: "PLAYER_TRANSFER",
      source: "player_trade",
      referenceId: "trade-sky-303",
      occurredAt: minutesAgo(391)
    }),
    createPreviewTransaction(skyblock, 8, {
      playerUuid: "preview-player-21",
      playerName: "竹影",
      currencyType: "money",
      currencyName: "落叶币",
      delta: 4_000,
      balanceAfter: 44_000,
      operatorName: "GM-Blue",
      operatorReason: "ECO|category=ADMIN_ADJUST|source=event_manual_bonus|ref=sky-event-12",
      category: "ADMIN_ADJUST",
      source: "event_manual_bonus",
      referenceId: "sky-event-12",
      occurredAt: minutesAgo(528)
    })
  ];

  const survivalRankingTransactions = [
    ...survivalTransactions,
    createPreviewTransaction(survival, 101, {
      playerUuid: "preview-player-6",
      playerName: "司南",
      currencyType: "money",
      currencyName: "落叶币",
      delta: 18_000,
      balanceAfter: 328_000,
      operatorName: "DungeonReward",
      operatorReason: "ECO|category=SYSTEM_IN|source=dungeon_reward|ref=rank-current-day-1",
      category: "SYSTEM_IN",
      source: "dungeon_reward",
      referenceId: "rank-current-day-1",
      occurredAt: rankingPeriodTime("day", 0, 0, 10, 12)
    }),
    createPreviewTransaction(survival, 102, {
      playerUuid: "preview-player-5",
      playerName: "星河",
      currencyType: "money",
      currencyName: "落叶币",
      delta: 6_000,
      balanceAfter: 246_000,
      operatorName: "Auction",
      operatorReason: "ECO|category=PLAYER_TRANSFER|source=player_market|ref=rank-current-day-2",
      category: "PLAYER_TRANSFER",
      source: "player_market",
      referenceId: "rank-current-day-2",
      occurredAt: rankingPeriodTime("day", 0, 0, 9, 24)
    }),
    createPreviewTransaction(survival, 103, {
      playerUuid: "preview-player-1",
      playerName: "爱马仕",
      currencyType: "money",
      currencyName: "落叶币",
      delta: 12_000,
      balanceAfter: 128_500,
      operatorName: "QuestSystem",
      operatorReason: "ECO|category=SYSTEM_IN|source=daily_quest|ref=rank-current-day-3",
      category: "SYSTEM_IN",
      source: "daily_quest",
      referenceId: "rank-current-day-3",
      occurredAt: rankingPeriodTime("day", 0, 0, 8, 40)
    }),
    createPreviewTransaction(survival, 104, {
      playerUuid: "preview-player-6",
      playerName: "司南",
      currencyType: "money",
      currencyName: "落叶币",
      delta: 0,
      balanceAfter: 280_000,
      operatorName: "Snapshot",
      operatorReason: "ECO|category=UNKNOWN|source=rank_previous_day|ref=rank-prev-day-1",
      category: "UNKNOWN",
      source: "rank_previous_day",
      referenceId: "rank-prev-day-1",
      occurredAt: rankingPeriodTime("day", -1, 0, 21, 30)
    }),
    createPreviewTransaction(survival, 105, {
      playerUuid: "preview-player-5",
      playerName: "星河",
      currencyType: "money",
      currencyName: "落叶币",
      delta: 0,
      balanceAfter: 360_000,
      operatorName: "Snapshot",
      operatorReason: "ECO|category=UNKNOWN|source=rank_previous_day|ref=rank-prev-day-2",
      category: "UNKNOWN",
      source: "rank_previous_day",
      referenceId: "rank-prev-day-2",
      occurredAt: rankingPeriodTime("day", -1, 0, 21, 18)
    }),
    createPreviewTransaction(survival, 106, {
      playerUuid: "preview-player-1",
      playerName: "爱马仕",
      currencyType: "money",
      currencyName: "落叶币",
      delta: 0,
      balanceAfter: 98_000,
      operatorName: "Snapshot",
      operatorReason: "ECO|category=UNKNOWN|source=rank_previous_day|ref=rank-prev-day-3",
      category: "UNKNOWN",
      source: "rank_previous_day",
      referenceId: "rank-prev-day-3",
      occurredAt: rankingPeriodTime("day", -1, 0, 21, 5)
    }),
    createPreviewTransaction(survival, 107, {
      playerUuid: "preview-player-6",
      playerName: "司南",
      currencyType: "money",
      currencyName: "落叶币",
      delta: 54_000,
      balanceAfter: 392_600,
      operatorName: "DungeonReward",
      operatorReason: "ECO|category=SYSTEM_IN|source=weekly_dungeon|ref=rank-current-week-1",
      category: "SYSTEM_IN",
      source: "weekly_dungeon",
      referenceId: "rank-current-week-1",
      occurredAt: rankingPeriodTime("week", 0, 1, 22, 10)
    }),
    createPreviewTransaction(survival, 108, {
      playerUuid: "preview-player-5",
      playerName: "星河",
      currencyType: "money",
      currencyName: "落叶币",
      delta: 22_000,
      balanceAfter: 246_000,
      operatorName: "Auction",
      operatorReason: "ECO|category=PLAYER_TRANSFER|source=weekly_market|ref=rank-current-week-2",
      category: "PLAYER_TRANSFER",
      source: "weekly_market",
      referenceId: "rank-current-week-2",
      occurredAt: rankingPeriodTime("week", 0, 1, 20, 40)
    }),
    createPreviewTransaction(survival, 109, {
      playerUuid: "preview-player-1",
      playerName: "爱马仕",
      currencyType: "money",
      currencyName: "落叶币",
      delta: 30_000,
      balanceAfter: 158_000,
      operatorName: "QuestSystem",
      operatorReason: "ECO|category=SYSTEM_IN|source=weekly_quest|ref=rank-current-week-3",
      category: "SYSTEM_IN",
      source: "weekly_quest",
      referenceId: "rank-current-week-3",
      occurredAt: rankingPeriodTime("week", 0, 0, 19, 20)
    }),
    createPreviewTransaction(survival, 110, {
      playerUuid: "preview-player-5",
      playerName: "星河",
      currencyType: "money",
      currencyName: "落叶币",
      delta: 0,
      balanceAfter: 420_000,
      operatorName: "Snapshot",
      operatorReason: "ECO|category=UNKNOWN|source=rank_previous_week|ref=rank-prev-week-1",
      category: "UNKNOWN",
      source: "rank_previous_week",
      referenceId: "rank-prev-week-1",
      occurredAt: rankingPeriodTime("week", -1, 4, 20, 50)
    }),
    createPreviewTransaction(survival, 111, {
      playerUuid: "preview-player-6",
      playerName: "司南",
      currencyType: "money",
      currencyName: "落叶币",
      delta: 0,
      balanceAfter: 310_000,
      operatorName: "Snapshot",
      operatorReason: "ECO|category=UNKNOWN|source=rank_previous_week|ref=rank-prev-week-2",
      category: "UNKNOWN",
      source: "rank_previous_week",
      referenceId: "rank-prev-week-2",
      occurredAt: rankingPeriodTime("week", -1, 4, 19, 45)
    }),
    createPreviewTransaction(survival, 112, {
      playerUuid: "preview-player-1",
      playerName: "爱马仕",
      currencyType: "money",
      currencyName: "落叶币",
      delta: 0,
      balanceAfter: 118_000,
      operatorName: "Snapshot",
      operatorReason: "ECO|category=UNKNOWN|source=rank_previous_week|ref=rank-prev-week-3",
      category: "UNKNOWN",
      source: "rank_previous_week",
      referenceId: "rank-prev-week-3",
      occurredAt: rankingPeriodTime("week", -1, 4, 19, 10)
    }),
    createPreviewTransaction(survival, 113, {
      playerUuid: "preview-player-6",
      playerName: "司南",
      currencyType: "point",
      currencyName: "点券",
      delta: 260,
      balanceAfter: 780,
      operatorName: "Recharge",
      operatorReason: "ECO|category=SYSTEM_IN|source=monthly_bonus|ref=rank-current-point-week-1",
      category: "SYSTEM_IN",
      source: "monthly_bonus",
      referenceId: "rank-current-point-week-1",
      occurredAt: rankingPeriodTime("week", 0, 0, 13, 20)
    }),
    createPreviewTransaction(survival, 114, {
      playerUuid: "preview-player-1",
      playerName: "爱马仕",
      currencyType: "point",
      currencyName: "点券",
      delta: 120,
      balanceAfter: 2_680,
      operatorName: "Recharge",
      operatorReason: "ECO|category=SYSTEM_IN|source=rank_current_point_week|ref=rank-current-point-week-2",
      category: "SYSTEM_IN",
      source: "rank_current_point_week",
      referenceId: "rank-current-point-week-2",
      occurredAt: rankingPeriodTime("week", 0, 0, 12, 50)
    }),
    createPreviewTransaction(survival, 115, {
      playerUuid: "preview-player-2",
      playerName: "何方妖孽",
      currencyType: "point",
      currencyName: "点券",
      delta: 0,
      balanceAfter: 1_980,
      operatorName: "Snapshot",
      operatorReason: "ECO|category=UNKNOWN|source=rank_previous_point_week|ref=rank-prev-point-week-1",
      category: "UNKNOWN",
      source: "rank_previous_point_week",
      referenceId: "rank-prev-point-week-1",
      occurredAt: rankingPeriodTime("week", -1, 4, 12, 30)
    })
  ];

  const skyblockRankingTransactions = [
    ...skyblockTransactions,
    createPreviewTransaction(skyblock, 101, {
      playerUuid: "preview-player-16",
      playerName: "星河",
      currencyType: "money",
      currencyName: "落叶币",
      delta: 18_500,
      balanceAfter: 246_000,
      operatorName: "IslandQuest",
      operatorReason: "ECO|category=SYSTEM_IN|source=island_top_reward|ref=rank-current-month-1",
      category: "SYSTEM_IN",
      source: "island_top_reward",
      referenceId: "rank-current-month-1",
      occurredAt: rankingPeriodTime("month", 0, 6, 16, 12)
    }),
    createPreviewTransaction(skyblock, 102, {
      playerUuid: "preview-player-17",
      playerName: "渡鸦",
      currencyType: "money",
      currencyName: "落叶币",
      delta: -4_200,
      balanceAfter: 63_400,
      operatorName: "SpawnerShop",
      operatorReason: "ECO|category=SYSTEM_OUT|source=spawner_shop|ref=rank-current-month-2",
      category: "SYSTEM_OUT",
      source: "spawner_shop",
      referenceId: "rank-current-month-2",
      occurredAt: rankingPeriodTime("month", 0, 5, 15, 24)
    }),
    createPreviewTransaction(skyblock, 103, {
      playerUuid: "preview-player-19",
      playerName: "林间",
      currencyType: "money",
      currencyName: "落叶币",
      delta: 9_600,
      balanceAfter: 59_600,
      operatorName: "CrateReward",
      operatorReason: "ECO|category=SYSTEM_IN|source=crate_reward|ref=rank-current-month-3",
      category: "SYSTEM_IN",
      source: "crate_reward",
      referenceId: "rank-current-month-3",
      occurredAt: rankingPeriodTime("month", 0, 4, 14, 30)
    }),
    createPreviewTransaction(skyblock, 104, {
      playerUuid: "preview-player-17",
      playerName: "渡鸦",
      currencyType: "money",
      currencyName: "落叶币",
      delta: 0,
      balanceAfter: 88_000,
      operatorName: "Snapshot",
      operatorReason: "ECO|category=UNKNOWN|source=rank_previous_month|ref=rank-prev-month-1",
      category: "UNKNOWN",
      source: "rank_previous_month",
      referenceId: "rank-prev-month-1",
      occurredAt: rankingPeriodTime("month", -1, 18, 22, 15)
    }),
    createPreviewTransaction(skyblock, 105, {
      playerUuid: "preview-player-16",
      playerName: "星河",
      currencyType: "money",
      currencyName: "落叶币",
      delta: 0,
      balanceAfter: 140_000,
      operatorName: "Snapshot",
      operatorReason: "ECO|category=UNKNOWN|source=rank_previous_month|ref=rank-prev-month-2",
      category: "UNKNOWN",
      source: "rank_previous_month",
      referenceId: "rank-prev-month-2",
      occurredAt: rankingPeriodTime("month", -1, 18, 22, 0)
    }),
    createPreviewTransaction(skyblock, 106, {
      playerUuid: "preview-player-19",
      playerName: "林间",
      currencyType: "money",
      currencyName: "落叶币",
      delta: 0,
      balanceAfter: 72_000,
      operatorName: "Snapshot",
      operatorReason: "ECO|category=UNKNOWN|source=rank_previous_month|ref=rank-prev-month-3",
      category: "UNKNOWN",
      source: "rank_previous_month",
      referenceId: "rank-prev-month-3",
      occurredAt: rankingPeriodTime("month", -1, 18, 21, 44)
    })
  ];

  applyServerStats(survival, survivalTransactions);
  applyServerStats(skyblock, skyblockTransactions);
  applyServerStats(archive, []);

  return [
    { server: survival, transactions: survivalTransactions, rankingTransactions: survivalRankingTransactions },
    { server: skyblock, transactions: skyblockTransactions, rankingTransactions: skyblockRankingTransactions },
    { server: archive, transactions: [] }
  ];
};

export function useEconomyConsolePreviewState() {
  const records = ref<PreviewEconomyServer[]>(createPreviewRecords());
  const selectedServerKey = ref(ECONOMY_ALL_SERVERS_KEY);
  const selectedCurrencyType = ref("money");
  const selectedRange = ref<EconomyTimeRangeKey>("today");
  const selectedRankingRange = ref<EconomyRankingRangeKey>("day");
  const isRefreshing = ref(false);
  const isTransactionLoading = ref(false);
  const isRankingLoading = ref(false);
  const latestError = ref("");

  const servers = computed(() => records.value.map((item) => item.server));
  const isAllServersSelected = computed(
    () => !selectedServerKey.value || selectedServerKey.value === ECONOMY_ALL_SERVERS_KEY
  );
  const currentRecord = computed(() =>
    records.value.find((item) => createEconomyServerKey(item.server.daemonId, item.server.instanceId) === selectedServerKey.value)
  );
  const selectedRecords = computed(() => (isAllServersSelected.value ? records.value : currentRecord.value ? [currentRecord.value] : []));
  const currentServer = computed(() => currentRecord.value?.server);
  const currencies = computed(() =>
    currentServer.value ? currentServer.value.currencies : mergePreviewCurrencies(servers.value)
  );
  const currentCurrency = computed(
    () =>
      currencies.value.find((item) => item.type === selectedCurrencyType.value) ||
      currencies.value[0] || {
        type: "money",
        name: "落叶币",
        totalBalance: 0,
        playerCount: 0
      }
  );
  const transactions = computed(() => {
    const range = getEconomyTimeRange(selectedRange.value);
    const startTime = new Date(range.startAt).getTime();
    const endTime = new Date(range.endAt).getTime();
    return selectedRecords.value
      .flatMap((record) => record.transactions)
      .filter((item) => item.currencyType === selectedCurrencyType.value)
      .filter((item) => {
        const time = new Date(item.occurredAt).getTime();
        return time >= startTime && time < endTime;
      })
      .slice()
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  });
  const totalTransactions = computed(() => transactions.value.length);
  const summary = computed(() => {
    const scopedServers = selectedRecords.value
      .map((item) => item.server)
      .filter((item) => item.currencyType === selectedCurrencyType.value || item.currencies.some((currency) => currency.type === selectedCurrencyType.value));
    return {
      serversTotal: isAllServersSelected.value ? servers.value.length : scopedServers.length,
      serversAvailable: scopedServers.filter((item) => item.pluginAvailable).length,
      todayIn: scopedServers.reduce((sum, item) => sum + item.todayIn, 0),
      todayOut: scopedServers.reduce((sum, item) => sum + item.todayOut, 0),
      netChange: scopedServers.reduce((sum, item) => sum + item.netChange, 0),
      transactionCount: scopedServers.reduce((sum, item) => sum + item.transactionCount, 0)
    };
  });
  const overview = computed<IMcsmEconomyOverviewResponse>(() => ({
    generatedAt: Date.now(),
    summary: summary.value,
    servers: servers.value
  }));

  const scopedHourly = computed(() => buildHourly(transactions.value, selectedCurrencyType.value));
  const sources = computed(() => buildSources(transactions.value, selectedCurrencyType.value));
  const rankingRows = computed(() => {
    const currentRange = getEconomyRankingTimeRange(selectedRankingRange.value);
    const previousRange = getEconomyRankingTimeRange(selectedRankingRange.value, -1);
    const currentStart = new Date(currentRange.startAt).getTime();
    const currentEnd = new Date(currentRange.endAt).getTime();
    const previousStart = new Date(previousRange.startAt).getTime();
    const previousEnd = new Date(previousRange.endAt).getTime();

    const scopedTransactions = selectedRecords.value
      .flatMap((record) => record.rankingTransactions || record.transactions)
      .filter((item) => item.currencyType === selectedCurrencyType.value);
    const currentTransactions = scopedTransactions.filter((item) => {
      const time = new Date(item.occurredAt).getTime();
      return time >= currentStart && time < currentEnd;
    });
    const previousTransactions = scopedTransactions.filter((item) => {
      const time = new Date(item.occurredAt).getTime();
      return time >= previousStart && time < previousEnd;
    });

    return buildEconomyRankingRows(currentTransactions, previousTransactions, (transaction) => {
      const server = servers.value.find(
        (item) => item.daemonId === transaction.daemonId && item.instanceId === transaction.instanceId
      );
      return server?.instanceDisplayName || transaction.instanceId;
    }).slice(0, 8);
  });

  const selectServer = (serverKey: string) => {
    if (serverKey === selectedServerKey.value) return;
    selectedServerKey.value = serverKey || ECONOMY_ALL_SERVERS_KEY;
    if (!currencies.value.some((item) => item.type === selectedCurrencyType.value)) {
      selectedCurrencyType.value = currentServer.value?.currencyType || currencies.value[0]?.type || "money";
    }
  };

  const selectCurrency = (currencyType: string) => {
    selectedCurrencyType.value = currencyType || "money";
  };

  const setTimeRange = (range: EconomyTimeRangeKey) => {
    selectedRange.value = range;
  };

  const setRankingRange = (range: EconomyRankingRangeKey) => {
    selectedRankingRange.value = range;
  };

  const refreshCurrent = async () => {
    isRefreshing.value = true;
    isTransactionLoading.value = true;
    isRankingLoading.value = true;
    latestError.value = "";
    try {
      await delay(160);
    } finally {
      isRefreshing.value = false;
      isTransactionLoading.value = false;
      isRankingLoading.value = false;
    }
  };

  return {
    stateSource: "preview" as const,
    overview,
    summary,
    servers,
    currencies,
    transactions,
    totalTransactions,
    selectedServerKey,
    selectedCurrencyType,
    selectedRange,
    selectedRankingRange,
    currentServer,
    currentCurrency,
    scopedHourly,
    sources,
    rankingRows,
    isRefreshing,
    isTransactionLoading,
    isRankingLoading,
    latestError,
    selectServer,
    selectCurrency,
    setTimeRange,
    setRankingRange,
    refreshCurrent
  };
}
