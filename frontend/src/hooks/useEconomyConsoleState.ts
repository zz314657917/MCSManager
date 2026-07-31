import {
  economyCurrenciesApi,
  economyOverviewApi,
  economyTransactionsApi,
  gmExecuteActionApi
} from "@/services/apis";
import { useDocumentVisibility } from "@/hooks/useDocumentVisibility";
import { reportErrorMsg } from "@/tools/validator";
import { computed, onMounted, onUnmounted, ref, watch } from "vue";

export const ECONOMY_PAGE_SIZE = 80;
export const ECONOMY_RANKING_PAGE_SIZE = 500;
export const ECONOMY_POLL_INTERVAL_MS = 10_000;
export const ECONOMY_ALL_SERVERS_KEY = "__all__";

export const createEconomyServerKey = (daemonId: string, instanceId: string) =>
  `${daemonId}:${instanceId}`;

export type EconomyTimeRangeKey = "today" | "24h" | "7d";
export type EconomyRankingRangeKey = "day" | "week" | "month";

export interface EconomyRankingRow {
  rank: number;
  previousRank?: number;
  rankDelta: number;
  daemonId: string;
  instanceId: string;
  playerUuid: string;
  playerName?: string;
  serverName?: string;
  amount: number;
}

export type EconomyWriteActionPayload = {
  kind: "economy_deposit" | "economy_withdraw" | "economy_set";
  daemonId: string;
  instanceId: string;
  playerUuid: string;
  currencyType: string;
  amount: number;
};

export const getEconomyTimeRange = (rangeKey: EconomyTimeRangeKey) => {
  const now = new Date();
  const endAt = now.toISOString();
  const start = new Date(now);

  if (rangeKey === "today") {
    start.setHours(0, 0, 0, 0);
  } else if (rangeKey === "24h") {
    start.setTime(now.getTime() - 24 * 60 * 60 * 1000);
  } else {
    start.setTime(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }

  return {
    startAt: start.toISOString(),
    endAt
  };
};

const getRankingPeriodStart = (rangeKey: EconomyRankingRangeKey, baseDate = new Date()) => {
  const start = new Date(baseDate);
  start.setHours(0, 0, 0, 0);

  if (rangeKey === "week") {
    const day = start.getDay() || 7;
    start.setDate(start.getDate() - day + 1);
  } else if (rangeKey === "month") {
    start.setDate(1);
  }

  return start;
};

const shiftRankingPeriodStart = (date: Date, rangeKey: EconomyRankingRangeKey, offset: number) => {
  const next = new Date(date);
  if (rangeKey === "day") next.setDate(next.getDate() + offset);
  if (rangeKey === "week") next.setDate(next.getDate() + offset * 7);
  if (rangeKey === "month") next.setMonth(next.getMonth() + offset);
  return next;
};

export const getEconomyRankingTimeRange = (rangeKey: EconomyRankingRangeKey, periodOffset = 0) => {
  const now = new Date();
  const currentStart = getRankingPeriodStart(rangeKey, now);
  const start = shiftRankingPeriodStart(currentStart, rangeKey, periodOffset);
  const end = periodOffset === 0 ? now : shiftRankingPeriodStart(currentStart, rangeKey, periodOffset + 1);

  return {
    startAt: start.toISOString(),
    endAt: end.toISOString()
  };
};

const getRankingPlayerKey = (transaction: IMcsmEconomyTransaction) =>
  `${transaction.daemonId}:${transaction.instanceId}:${transaction.playerUuid}`;

const latestBalancesByPlayer = (
  transactions: IMcsmEconomyTransaction[],
  resolveServerName?: (transaction: IMcsmEconomyTransaction) => string | undefined
) => {
  const map = new Map<string, EconomyRankingRow & { occurredAt: string }>();

  for (const transaction of transactions) {
    const key = getRankingPlayerKey(transaction);
    const current = map.get(key);
    if (current && transaction.occurredAt.localeCompare(current.occurredAt) < 0) continue;

    map.set(key, {
      rank: 0,
      rankDelta: 0,
      daemonId: transaction.daemonId,
      instanceId: transaction.instanceId,
      playerUuid: transaction.playerUuid,
      playerName: transaction.playerName,
      serverName: resolveServerName?.(transaction) || transaction.instanceId,
      amount: Number(transaction.balanceAfter || 0),
      occurredAt: transaction.occurredAt
    });
  }

  return map;
};

export const buildEconomyRankingRows = (
  currentTransactions: IMcsmEconomyTransaction[],
  previousTransactions: IMcsmEconomyTransaction[],
  resolveServerName?: (transaction: IMcsmEconomyTransaction) => string | undefined
) => {
  const currentBalances = Array.from(
    latestBalancesByPlayer(currentTransactions, resolveServerName).entries()
  ).sort((a, b) => b[1].amount - a[1].amount);
  const previousBalances = Array.from(
    latestBalancesByPlayer(previousTransactions, resolveServerName).entries()
  ).sort((a, b) => b[1].amount - a[1].amount);
  const previousRankMap = new Map(previousBalances.map(([key], index) => [key, index + 1]));

  return currentBalances.map(([key, value], index) => {
    const rank = index + 1;
    const previousRank = previousRankMap.get(key);
    return {
      rank,
      previousRank,
      rankDelta: previousRank ? previousRank - rank : 0,
      daemonId: value.daemonId,
      instanceId: value.instanceId,
      playerUuid: value.playerUuid,
      playerName: value.playerName,
      serverName: value.serverName,
      amount: value.amount
    } satisfies EconomyRankingRow;
  });
};

const parseErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  return String(error ?? "");
};

const resolveErrorText = (error: unknown, fallbackText: string) => {
  const message = parseErrorMessage(error).trim();
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("403")) return "没有权限访问经济中心。";
  if (lowerMessage.includes("404")) return "经济中心接口不存在，请确认 panel 与 daemon 已更新。";
  if (lowerMessage.includes("503")) return "目标 daemon 离线，暂时无法查询经济数据。";
  if (lowerMessage.includes("500")) return "经济中心服务内部错误，请检查 panel、daemon 和插件日志。";
  if (
    lowerMessage.includes("network error") ||
    lowerMessage.includes("failed to fetch") ||
    lowerMessage.includes("econnrefused") ||
    lowerMessage.includes("timeout")
  ) {
    return "经济中心网络请求失败，请检查面板与远程节点连接。";
  }

  return message || fallbackText;
};

const sortEconomyServers = (items: IMcsmEconomyOverviewServer[]) =>
  items.slice().sort((a, b) => {
    if (a.daemonAvailable !== b.daemonAvailable) return a.daemonAvailable ? -1 : 1;
    if (a.pluginAvailable !== b.pluginAvailable) return a.pluginAvailable ? -1 : 1;
    const daemonResult = a.daemonDisplayName.localeCompare(b.daemonDisplayName, "zh-CN");
    if (daemonResult !== 0) return daemonResult;
    return a.instanceDisplayName.localeCompare(b.instanceDisplayName, "zh-CN");
  });

const getCurrencyFromServer = (server: IMcsmEconomyOverviewServer | undefined) => {
  if (!server) return "money";
  return server.currencyType || server.currencies[0]?.type || "money";
};

const isAllServersKey = (serverKey: string) => !serverKey || serverKey === ECONOMY_ALL_SERVERS_KEY;

const mergeCurrencies = (items: IMcsmEconomyCurrency[][]) => {
  const map = new Map<string, IMcsmEconomyCurrency>();
  for (const currencies of items) {
    for (const currency of currencies) {
      const current = map.get(currency.type);
      const nextUpdatedAt =
        !current?.updatedAt || (currency.updatedAt && currency.updatedAt > current.updatedAt)
          ? currency.updatedAt
          : current.updatedAt;
      map.set(currency.type, {
        type: currency.type,
        name: current?.name || currency.name || currency.type,
        totalBalance: (current?.totalBalance || 0) + (currency.totalBalance || 0),
        playerCount: (current?.playerCount || 0) + (currency.playerCount || 0),
        updatedAt: nextUpdatedAt
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

const mergeHourly = (servers: IMcsmEconomyOverviewServer[]) => {
  const map = new Map<number, { systemIn: number; systemOut: number; netChange: number; transactionCount: number }>();
  for (let hour = 0; hour < 24; hour++) {
    map.set(hour, { systemIn: 0, systemOut: 0, netChange: 0, transactionCount: 0 });
  }
  for (const server of servers) {
    for (const item of server.hourly || []) {
      const bucket = map.get(item.hour);
      if (!bucket) continue;
      bucket.systemIn += item.systemIn;
      bucket.systemOut += item.systemOut;
      bucket.netChange += item.netChange;
      bucket.transactionCount += item.transactionCount;
    }
  }
  return Array.from(map.entries()).map(([hour, value]) => ({
    hour,
    label: `${String(hour).padStart(2, "0")}:00`,
    ...value
  }));
};

const mergeSources = (servers: IMcsmEconomyOverviewServer[]) => {
  const map = new Map<string, { category: IMcsmEconomyCategory; source: string; amount: number; transactionCount: number }>();
  for (const server of servers) {
    for (const item of server.sources || []) {
      const key = `${item.category}:${item.source}`;
      const current =
        map.get(key) || {
          category: item.category,
          source: item.source,
          amount: 0,
          transactionCount: 0
        };
      current.amount += item.amount;
      current.transactionCount += item.transactionCount;
      map.set(key, current);
    }
  }
  return Array.from(map.values())
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);
};

export function useEconomyConsoleState() {
  const { isDocumentVisible } = useDocumentVisibility();
  const overviewRequest = economyOverviewApi();
  const transactionsRequest = economyTransactionsApi();
  const rankingTransactionsRequest = economyTransactionsApi();
  const previousRankingTransactionsRequest = economyTransactionsApi();
  const currenciesRequest = economyCurrenciesApi();
  const executeActionRequest = gmExecuteActionApi();

  const overview = ref<IMcsmEconomyOverviewResponse>();
  const servers = ref<IMcsmEconomyOverviewServer[]>([]);
  const serverCurrencies = ref<IMcsmEconomyCurrency[]>([]);
  const transactions = ref<IMcsmEconomyTransaction[]>([]);
  const rankingTransactions = ref<IMcsmEconomyTransaction[]>([]);
  const previousRankingTransactions = ref<IMcsmEconomyTransaction[]>([]);
  const totalTransactions = ref(0);
  const selectedServerKey = ref(ECONOMY_ALL_SERVERS_KEY);
  const selectedCurrencyType = ref("money");
  const selectedRange = ref<EconomyTimeRangeKey>("today");
  const selectedRankingRange = ref<EconomyRankingRangeKey>("day");
  const isRefreshing = ref(false);
  const isTransactionLoading = ref(false);
  const isRankingLoading = ref(false);
  const isExecutingAction = ref(false);
  const latestError = ref("");

  let pollTimer: number | undefined;

  const currentServer = computed(() =>
    isAllServersKey(selectedServerKey.value)
      ? undefined
      : servers.value.find((item) => createEconomyServerKey(item.daemonId, item.instanceId) === selectedServerKey.value)
  );

  const selectedServers = computed(() => {
    if (currentServer.value) return [currentServer.value];
    return isAllServersKey(selectedServerKey.value) ? servers.value : [];
  });

  const summary = computed(
    () => {
      if (currentServer.value) {
        return {
          serversTotal: 1,
          serversAvailable: currentServer.value.pluginAvailable ? 1 : 0,
          todayIn: currentServer.value.todayIn,
          todayOut: currentServer.value.todayOut,
          netChange: currentServer.value.netChange,
          transactionCount: currentServer.value.transactionCount
        };
      }
      return (
        overview.value?.summary || {
          serversTotal: 0,
          serversAvailable: 0,
          todayIn: 0,
          todayOut: 0,
          netChange: 0,
          transactionCount: 0
        }
      );
    }
  );

  const currencies = computed(() => {
    if (currentServer.value) {
      return serverCurrencies.value.length ? serverCurrencies.value : currentServer.value.currencies;
    }
    return mergeCurrencies(selectedServers.value.map((item) => item.currencies));
  });

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

  const scopedHourly = computed(() =>
    currentServer.value ? currentServer.value.hourly || [] : mergeHourly(selectedServers.value)
  );

  const sources = computed(() =>
    currentServer.value ? currentServer.value.sources || [] : mergeSources(selectedServers.value)
  );

  const rankingRows = computed(() =>
    buildEconomyRankingRows(rankingTransactions.value, previousRankingTransactions.value, (transaction) => {
      const server = servers.value.find(
        (item) => item.daemonId === transaction.daemonId && item.instanceId === transaction.instanceId
      );
      return server?.instanceDisplayName || transaction.instanceId;
    }).slice(0, 8)
  );

  const ensureCurrencySelection = () => {
    if (!currencies.value.some((item) => item.type === selectedCurrencyType.value)) {
      selectedCurrencyType.value =
        currentServer.value ? getCurrencyFromServer(currentServer.value) : currencies.value[0]?.type || "money";
    }
  };

  const setError = (error: unknown, fallbackText: string, showToast = false) => {
    const text = resolveErrorText(error, fallbackText);
    latestError.value = text;
    if (showToast) reportErrorMsg(new Error(text));
    return text;
  };

  const ensureServerSelection = () => {
    if (!servers.value.length) {
      selectedServerKey.value = ECONOMY_ALL_SERVERS_KEY;
      return;
    }

    if (isAllServersKey(selectedServerKey.value)) return;

    const matched = servers.value.find((item) => createEconomyServerKey(item.daemonId, item.instanceId) === selectedServerKey.value);
    if (matched) return;

    selectedServerKey.value = ECONOMY_ALL_SERVERS_KEY;
  };

  const loadCurrencies = async (forceRequest = false) => {
    const server = currentServer.value;
    if (!server) {
      serverCurrencies.value = [];
      ensureCurrencySelection();
      return;
    }

    try {
      const response = await currenciesRequest.execute({
        forceRequest,
        params: {
          daemonId: server.daemonId,
          instanceId: server.instanceId
        }
      });
      const nextCurrencies = response.value?.items?.length ? response.value.items : server.currencies;
      serverCurrencies.value = nextCurrencies.slice();
      ensureCurrencySelection();
    } catch (error) {
      serverCurrencies.value = server.currencies.slice();
      ensureCurrencySelection();
      setError(error, "加载货币列表失败。");
    }
  };

  const loadTransactions = async (forceRequest = false) => {
    const queryServers = selectedServers.value.filter((server) => server.daemonAvailable);
    if (!queryServers.length) {
      transactions.value = [];
      totalTransactions.value = 0;
      return;
    }

    const range = getEconomyTimeRange(selectedRange.value);
    isTransactionLoading.value = true;
    try {
      const items: IMcsmEconomyTransaction[] = [];
      let total = 0;
      let failedCount = 0;
      for (const server of queryServers) {
        try {
          const response = await transactionsRequest.execute({
            forceRequest,
            params: {
              daemonId: server.daemonId,
              instanceId: server.instanceId,
              currencyType: selectedCurrencyType.value,
              startAt: range.startAt,
              endAt: range.endAt,
              limit: ECONOMY_PAGE_SIZE,
              offset: 0
            }
          });
          items.push(...(response.value?.items || []));
          total += response.value?.total || 0;
        } catch {
          failedCount += 1;
        }
      }
      if (failedCount >= queryServers.length) {
        throw new Error("所有区服流水加载失败。");
      }
      transactions.value = items
        .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
        .slice(0, ECONOMY_PAGE_SIZE);
      totalTransactions.value = total;
      latestError.value = "";
    } catch (error) {
      transactions.value = [];
      totalTransactions.value = 0;
      setError(error, "加载经济流水失败。", true);
    } finally {
      isTransactionLoading.value = false;
    }
  };

  const loadRanking = async (forceRequest = false) => {
    const queryServers = selectedServers.value.filter((server) => server.daemonAvailable);
    if (!queryServers.length) {
      rankingTransactions.value = [];
      previousRankingTransactions.value = [];
      return;
    }

    const currentRange = getEconomyRankingTimeRange(selectedRankingRange.value);
    const previousRange = getEconomyRankingTimeRange(selectedRankingRange.value, -1);
    isRankingLoading.value = true;
    try {
      const currentItems: IMcsmEconomyTransaction[] = [];
      const previousItems: IMcsmEconomyTransaction[] = [];
      let failedCount = 0;

      for (const server of queryServers) {
        try {
          const currentResponse = await rankingTransactionsRequest.execute({
            forceRequest,
            params: {
              daemonId: server.daemonId,
              instanceId: server.instanceId,
              currencyType: selectedCurrencyType.value,
              startAt: currentRange.startAt,
              endAt: currentRange.endAt,
              limit: ECONOMY_RANKING_PAGE_SIZE,
              offset: 0
            }
          });
          currentItems.push(...(currentResponse.value?.items || []));
          const previousResponse = await previousRankingTransactionsRequest.execute({
            forceRequest,
            params: {
              daemonId: server.daemonId,
              instanceId: server.instanceId,
              currencyType: selectedCurrencyType.value,
              startAt: previousRange.startAt,
              endAt: previousRange.endAt,
              limit: ECONOMY_RANKING_PAGE_SIZE,
              offset: 0
            }
          });
          previousItems.push(...(previousResponse.value?.items || []));
        } catch {
          failedCount += 1;
        }
      }

      if (failedCount >= queryServers.length) {
        throw new Error("所有区服排行榜加载失败。");
      }

      rankingTransactions.value = currentItems;
      previousRankingTransactions.value = previousItems;
      latestError.value = "";
    } catch (error) {
      rankingTransactions.value = [];
      previousRankingTransactions.value = [];
      setError(error, "加载经济排行榜失败。");
    } finally {
      isRankingLoading.value = false;
    }
  };

  const loadOverview = async (forceRequest = false) => {
    const range = getEconomyTimeRange(selectedRange.value);
    const response = await overviewRequest.execute({
      forceRequest,
      params: {
        currencyType: selectedCurrencyType.value,
        startAt: range.startAt,
        endAt: range.endAt
      }
    });
    overview.value = response.value;
    servers.value = sortEconomyServers(response.value?.servers || []);
    ensureServerSelection();
    ensureCurrencySelection();
  };

  const refreshCurrent = async (forceRequest = true) => {
    isRefreshing.value = true;
    latestError.value = "";
    try {
      await loadOverview(forceRequest);
      await loadCurrencies(forceRequest);
      await loadTransactions(forceRequest);
      await loadRanking(forceRequest);
    } catch (error) {
      setError(error, "刷新经济中心失败。", true);
    } finally {
      isRefreshing.value = false;
    }
  };

  const executeEconomyAction = async (payload: EconomyWriteActionPayload) => {
    const amount = Number(payload.amount);
    if (!Number.isFinite(amount) || amount < 0 || (payload.kind !== "economy_set" && amount <= 0)) {
      setError(new Error("请输入有效的余额数值。"), "请输入有效的余额数值。", true);
      return false;
    }
    if (payload.currencyType !== "money") {
      setError(
        new Error("当前仅支持默认 money 货币的余额操作。"),
        "当前仅支持默认 money 货币的余额操作。",
        true
      );
      return false;
    }

    const server = servers.value.find(
      (item) => item.daemonId === payload.daemonId && item.instanceId === payload.instanceId
    );
    if (!server || !server.daemonAvailable || !server.pluginAvailable) {
      setError(new Error("目标实例当前不可操作。"), "目标实例当前不可操作。", true);
      return false;
    }

    isExecutingAction.value = true;
    latestError.value = "";
    try {
      const response = await executeActionRequest.execute({
        data: {
          kind: payload.kind,
          daemonId: payload.daemonId,
          instanceId: payload.instanceId,
          playerUuid: payload.playerUuid,
          amount
        }
      });
      const result = response.value;
      if (!result) {
        throw new Error("经济操作返回了空响应。");
      }
      if (!result.success) {
        setError(new Error(result.message), result.message, true);
        return false;
      }

      await refreshCurrent(true);
      latestError.value = "";
      return true;
    } catch (error) {
      setError(error, "经济操作执行失败。", true);
      return false;
    } finally {
      isExecutingAction.value = false;
    }
  };

  const selectServer = (serverKey: string) => {
    if (serverKey === selectedServerKey.value) return;
    selectedServerKey.value = serverKey || ECONOMY_ALL_SERVERS_KEY;
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

  const clearPollTimer = () => {
    if (pollTimer != null) {
      window.clearInterval(pollTimer);
      pollTimer = undefined;
    }
  };

  const startPollTimer = () => {
    clearPollTimer();
    if (!isDocumentVisible.value) return;
    pollTimer = window.setInterval(() => {
      void refreshCurrent(false);
    }, ECONOMY_POLL_INTERVAL_MS);
  };

  watch(
    selectedServerKey,
    async () => {
      await loadCurrencies(true);
      await loadTransactions(true);
      await loadRanking(true);
    },
    { flush: "post" }
  );

  watch(
    [selectedCurrencyType, selectedRange],
    async () => {
      await refreshCurrent(true);
    },
    { flush: "post" }
  );

  watch(
    selectedRankingRange,
    async () => {
      await loadRanking(true);
    },
    { flush: "post" }
  );

  watch(isDocumentVisible, (visible) => {
    if (!visible) {
      clearPollTimer();
      return;
    }
    void refreshCurrent(true).finally(startPollTimer);
  });

  onMounted(async () => {
    await refreshCurrent(true);
    startPollTimer();
  });

  onUnmounted(() => {
    clearPollTimer();
  });

  return {
    stateSource: "live" as const,
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
    isExecutingAction,
    latestError,
    selectServer,
    selectCurrency,
    setTimeRange,
    setRankingRange,
    refreshCurrent,
    executeEconomyAction
  };
}
