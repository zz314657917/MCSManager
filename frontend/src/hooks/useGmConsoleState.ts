import {
  gmAuditApi,
  gmBalancesApi,
  gmChatApi,
  gmExecuteActionApi,
  gmLuckPermsApi,
  gmModerationApi,
  gmPlayersApi,
  gmServersApi
} from "@/services/apis";
import { useDocumentVisibility } from "@/hooks/useDocumentVisibility";
import {
  GM_AUDIT_PAGE_SIZE,
  GM_CHAT_PAGE_SIZE,
  GM_CHAT_POLL_INTERVAL_MS,
  GM_PLAYER_POLL_INTERVAL_MS,
  createGmServerKey,
  getGmServerKey,
  sortPlayersAcrossServers,
  sortPlayersByPresence
} from "@/types/gm";
import { reportErrorMsg } from "@/tools/validator";
import { computed, onMounted, onUnmounted, ref, watch } from "vue";

const parseErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error ?? "");
};

const resolveErrorText = (error: unknown, fallbackText: string) => {
  const message = parseErrorMessage(error).trim();
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("403")) return "没有权限访问 GM 管理页。";
  if (lowerMessage.includes("404")) return "GM 接口不存在，请确认 panel、daemon 和插件都已更新。";
  if (lowerMessage.includes("500")) return "GM 服务内部错误，请检查 panel、daemon 和插件日志。";
  if (
    lowerMessage.includes("network error") ||
    lowerMessage.includes("failed to fetch") ||
    lowerMessage.includes("econnrefused") ||
    lowerMessage.includes("timeout")
  ) {
    return "GM 网络请求失败，请检查面板与远程节点连接。";
  }

  return message || fallbackText;
};

const getChatMessageKey = (message: Pick<IMcsmGmChatMessage, "daemonId" | "instanceId" | "id">) =>
  `${message.daemonId}:${message.instanceId}:${message.id}`;

const mergeChatMessages = (current: IMcsmGmChatMessage[], incoming: IMcsmGmChatMessage[]) => {
  if (!incoming.length) return current;

  const nextMap = new Map<string, IMcsmGmChatMessage>();
  for (const item of current) {
    nextMap.set(getChatMessageKey(item), item);
  }
  for (const item of incoming) {
    nextMap.set(getChatMessageKey(item), item);
  }

  return Array.from(nextMap.values()).sort((a, b) => a.time.localeCompare(b.time));
};

export type GmPanelActionPayload =
  | { kind: "economy_deposit" | "economy_withdraw"; amount: number }
  | { kind: "points_give" | "points_take"; amount: number }
  | { kind: "lp_group_add" | "lp_group_switch" | "lp_group_remove"; group: string }
  | { kind: "lp_permission_set" | "lp_permission_unset"; node: string }
  | { kind: "lp_temp_group_add" | "lp_temp_group_remove"; group: string; duration: string }
  | { kind: "lp_temp_permission_set" | "lp_temp_permission_unset"; node: string; duration: string }
  | { kind: "chat_mute"; durationSeconds: number; reason?: string }
  | { kind: "chat_unmute" };

export function useGmConsoleState() {
  const { isDocumentVisible } = useDocumentVisibility();
  const serversRequest = gmServersApi();
  const balancesRequest = gmBalancesApi();
  const luckPermsRequest = gmLuckPermsApi();
  const moderationRequest = gmModerationApi();
  const executeActionRequest = gmExecuteActionApi();
  const auditRequest = gmAuditApi();

  const nodes = ref<IMcsmGmOverviewNode[]>([]);
  const servers = ref<IMcsmGmOverviewServer[]>([]);
  const playersByServer = ref<Record<string, IMcsmGmPlayerPresence[]>>({});
  const messagesByServer = ref<Record<string, IMcsmGmChatMessage[]>>({});
  const balances = ref<IMcsmGmPlayerBalances>();
  const luckPerms = ref<IMcsmLuckPermsSnapshot>();
  const moderation = ref<IMcsmGmModerationStatus>();
  const auditRecords = ref<IMcsmGmAuditRecord[]>([]);
  const lastActionResult = ref<IMcsmGmActionResult>();

  const selectedServerKey = ref("");
  const selectedPlayerUuid = ref("");
  const isRefreshing = ref(false);
  const isPlayerLoading = ref(false);
  const isChatLoading = ref(false);
  const isDetailLoading = ref(false);
  const isExecutingAction = ref(false);
  const latestError = ref("");
  const nextChatCursorByServer = ref<Record<string, string | undefined>>({});
  const pendingSelectedPlayerUuid = ref("");

  let playerPollTimer: number | undefined;
  let chatPollTimer: number | undefined;

  const currentServer = computed(() =>
    servers.value.find((item) => createGmServerKey(item.daemonId, item.instanceId) === selectedServerKey.value)
  );

  const currentNode = computed(() =>
    nodes.value.find((item) => item.daemonId === currentServer.value?.daemonId)
  );

  const players = computed(() => playersByServer.value[selectedServerKey.value] || []);
  const allPlayers = computed(() =>
    Object.values(playersByServer.value)
      .flat()
      .filter((item) => item.online)
      .slice()
      .sort(sortPlayersAcrossServers)
  );

  const currentPlayer = computed(() =>
    players.value.find((item) => item.playerUuid === selectedPlayerUuid.value)
  );

  const onlinePlayerCount = computed(() => players.value.filter((item) => item.online).length);
  const messages = computed(() =>
    Object.values(messagesByServer.value)
      .flat()
      .sort((a, b) => a.time.localeCompare(b.time))
  );

  const dependencyState = computed(() => {
    return (
      currentServer.value?.dependencies || {
        economyAvailable: false,
        pointsAvailable: false,
        luckPermsAvailable: false,
        chatPluginAvailable: false,
        chatPluginType: "native" as const
      }
    );
  });

  const clearTimers = () => {
    if (playerPollTimer != null) {
      window.clearInterval(playerPollTimer);
      playerPollTimer = undefined;
    }
    if (chatPollTimer != null) {
      window.clearInterval(chatPollTimer);
      chatPollTimer = undefined;
    }
  };

  const resetPlayerDetails = () => {
    balances.value = undefined;
    luckPerms.value = undefined;
    moderation.value = undefined;
    auditRecords.value = [];
    lastActionResult.value = undefined;
  };

  const setError = (error: unknown, fallbackText: string, showToast = false) => {
    const text = resolveErrorText(error, fallbackText);
    latestError.value = text;
    if (showToast) {
      reportErrorMsg(new Error(text));
    }
    return text;
  };

  const pruneChatCache = () => {
    const validKeys = new Set(servers.value.map((item) => getGmServerKey(item)));
    messagesByServer.value = Object.fromEntries(
      Object.entries(messagesByServer.value).filter(([serverKey]) => validKeys.has(serverKey))
    );
    nextChatCursorByServer.value = Object.fromEntries(
      Object.entries(nextChatCursorByServer.value).filter(([serverKey]) => validKeys.has(serverKey))
    );
  };

  const prunePlayerCache = () => {
    const validKeys = new Set(servers.value.map((item) => getGmServerKey(item)));
    playersByServer.value = Object.fromEntries(
      Object.entries(playersByServer.value).filter(([serverKey]) => validKeys.has(serverKey))
    );
  };

  const ensureServerSelection = () => {
    if (!servers.value.length) {
      selectedServerKey.value = "";
      return;
    }

    const matched = servers.value.find((item) => getGmServerKey(item) === selectedServerKey.value);
    if (matched) return;

    const preferred = servers.value.find((item) => item.daemonAvailable) || servers.value[0];
    selectedServerKey.value = getGmServerKey(preferred);
  };

  const ensurePlayerSelection = () => {
    if (!players.value.length) {
      selectedPlayerUuid.value = "";
      return;
    }

    const matched = players.value.find((item) => item.playerUuid === selectedPlayerUuid.value);
    if (!matched) {
      selectedPlayerUuid.value = "";
    }
  };

  const loadServers = async (forceRequest = false) => {
    const result = await serversRequest.execute({ forceRequest });

    nodes.value = result.value?.nodes || [];
    servers.value = (result.value?.servers || []).slice().sort((a, b) => {
      if (a.daemonAvailable !== b.daemonAvailable) {
        return a.daemonAvailable ? -1 : 1;
      }
      if (a.daemonDisplayName !== b.daemonDisplayName) {
        return a.daemonDisplayName.localeCompare(b.daemonDisplayName, "zh-CN");
      }
      return a.instanceDisplayName.localeCompare(b.instanceDisplayName, "zh-CN");
    });

    ensureServerSelection();
    prunePlayerCache();
    pruneChatCache();
    latestError.value = "";
  };

  const loadPlayersForServer = async (forceRequest = false, serverKey = selectedServerKey.value) => {
    const server = servers.value.find((item) => getGmServerKey(item) === serverKey);
    if (!server) {
      delete playersByServer.value[serverKey];
      return;
    }

    const request = gmPlayersApi();
    const result = await request.execute({
      forceRequest,
      url: `/api/gm/${server.daemonId}/${server.instanceId}/players`,
      params: {
        daemonId: server.daemonId,
        instanceId: server.instanceId
      }
    });

    playersByServer.value[serverKey] = (result.value || []).slice().sort(sortPlayersByPresence);

    if (serverKey === selectedServerKey.value) {
      ensurePlayerSelection();
    }
  };

  const loadPlayers = async (forceRequest = false, serverKey = selectedServerKey.value) => {
    isPlayerLoading.value = true;
    try {
      await loadPlayersForServer(forceRequest, serverKey);
      latestError.value = "";
    } catch (error) {
      if (serverKey === selectedServerKey.value) {
        delete playersByServer.value[serverKey];
        selectedPlayerUuid.value = "";
      }
      setError(error, "加载玩家列表失败。", true);
    } finally {
      isPlayerLoading.value = false;
    }
  };

  const loadAllPlayers = async (forceRequest = false) => {
    const targetServers = servers.value.slice();
    if (!targetServers.length) {
      playersByServer.value = {};
      return;
    }

    isPlayerLoading.value = true;
    try {
      const results = await Promise.allSettled(
        targetServers.map((server) => loadPlayersForServer(forceRequest, getGmServerKey(server)))
      );

      const failed = results.find(
        (item): item is PromiseRejectedResult => item.status === "rejected"
      );
      if (failed) {
        setError(failed.reason, "加载玩家列表失败。", true);
        return;
      }

      latestError.value = "";
    } finally {
      isPlayerLoading.value = false;
    }
  };

  const loadPlayerDetails = async (
    forceRequest = false,
    serverKey = selectedServerKey.value,
    playerUuid = selectedPlayerUuid.value
  ) => {
    const server = servers.value.find((item) => getGmServerKey(item) === serverKey);
    if (!server || !playerUuid) {
      resetPlayerDetails();
      return;
    }

    isDetailLoading.value = true;
    try {
      const [balancesResult, luckPermsResult, moderationResult, auditResult] = await Promise.all([
        balancesRequest.execute({
          forceRequest,
          url: `/api/gm/${server.daemonId}/${server.instanceId}/players/${playerUuid}/balances`,
          params: {
            daemonId: server.daemonId,
            instanceId: server.instanceId,
            playerUuid
          }
        }),
        luckPermsRequest.execute({
          forceRequest,
          url: `/api/gm/${server.daemonId}/${server.instanceId}/players/${playerUuid}/luckperms`,
          params: {
            daemonId: server.daemonId,
            instanceId: server.instanceId,
            playerUuid
          }
        }),
        moderationRequest.execute({
          forceRequest,
          url: `/api/gm/${server.daemonId}/${server.instanceId}/players/${playerUuid}/moderation`,
          params: {
            daemonId: server.daemonId,
            instanceId: server.instanceId,
            playerUuid
          }
        }),
        auditRequest.execute({
          forceRequest,
          params: {
            daemonId: server.daemonId,
            instanceId: server.instanceId,
            playerUuid,
            limit: GM_AUDIT_PAGE_SIZE
          }
        })
      ]);

      if (serverKey !== selectedServerKey.value || playerUuid !== selectedPlayerUuid.value) return;

      balances.value = balancesResult.value;
      luckPerms.value = luckPermsResult.value;
      moderation.value = moderationResult.value;
      auditRecords.value = auditResult.value || [];
      latestError.value = "";
    } catch (error) {
      if (serverKey === selectedServerKey.value && playerUuid === selectedPlayerUuid.value) {
        setError(error, "加载玩家详情失败。", true);
      }
    } finally {
      if (serverKey === selectedServerKey.value && playerUuid === selectedPlayerUuid.value) {
        isDetailLoading.value = false;
      }
    }
  };

  const loadChatForServer = async (
    options: {
      forceRequest?: boolean;
      reset?: boolean;
      serverKey: string;
    }
  ) => {
    const { serverKey } = options;
    const server = servers.value.find((item) => getGmServerKey(item) === serverKey);
    if (!server) {
      delete messagesByServer.value[serverKey];
      delete nextChatCursorByServer.value[serverKey];
      return;
    }

    const request = gmChatApi();
    const cursor = options.reset ? undefined : nextChatCursorByServer.value[serverKey];
    const result = await request.execute({
      forceRequest: options.forceRequest,
      url: `/api/gm/${server.daemonId}/${server.instanceId}/chat`,
      params: {
        daemonId: server.daemonId,
        instanceId: server.instanceId,
        cursor,
        limit: GM_CHAT_PAGE_SIZE
      }
    });

    const nextItems = result.value?.items || [];
    messagesByServer.value[serverKey] = options.reset
      ? nextItems
      : mergeChatMessages(messagesByServer.value[serverKey] || [], nextItems);
    nextChatCursorByServer.value[serverKey] =
      result.value?.nextCursor ||
      messagesByServer.value[serverKey]?.[messagesByServer.value[serverKey].length - 1]?.id ||
      undefined;
  };

  const loadAllChats = async (
    options: {
      forceRequest?: boolean;
      reset?: boolean;
    } = {}
  ) => {
    const targetServers = servers.value.slice();
    if (!targetServers.length) {
      messagesByServer.value = {};
      nextChatCursorByServer.value = {};
      return;
    }

    isChatLoading.value = true;
    try {
      const results = await Promise.allSettled(
        targetServers.map(async (server) => {
          const serverKey = getGmServerKey(server);
          await loadChatForServer({
            forceRequest: options.forceRequest,
            reset: options.reset,
            serverKey
          });
        })
      );

      const failed = results.find(
        (item): item is PromiseRejectedResult => item.status === "rejected"
      );
      if (failed) {
        setError(failed.reason, "加载聊天记录失败。");
        return;
      }

      latestError.value = "";
    } finally {
      isChatLoading.value = false;
    }
  };

  const refreshCurrent = async (forceRequest = true) => {
    isRefreshing.value = true;
    latestError.value = "";
    try {
      await loadServers(forceRequest);
      if (!selectedServerKey.value) {
        playersByServer.value = {};
        messagesByServer.value = {};
        nextChatCursorByServer.value = {};
        resetPlayerDetails();
        return;
      }

      await Promise.all([
        loadAllPlayers(forceRequest),
        loadAllChats({
          forceRequest,
          reset: true
        })
      ]);

      if (selectedPlayerUuid.value) {
        await loadPlayerDetails(forceRequest, selectedServerKey.value, selectedPlayerUuid.value);
      } else {
        resetPlayerDetails();
      }
    } catch (error) {
      setError(error, "刷新 GM 数据失败。", true);
    } finally {
      isRefreshing.value = false;
    }
  };

  const startPollers = () => {
    clearTimers();
    if (!selectedServerKey.value || !isDocumentVisible.value) return;

    playerPollTimer = window.setInterval(() => {
      void loadAllPlayers(false);
    }, GM_PLAYER_POLL_INTERVAL_MS);

    chatPollTimer = window.setInterval(() => {
      void loadAllChats({
        forceRequest: false,
        reset: false
      });
    }, GM_CHAT_POLL_INTERVAL_MS);
  };

  const selectServer = (serverKey: string) => {
    if (serverKey === selectedServerKey.value) return;
    selectedServerKey.value = serverKey;
  };

  const selectPlayer = (playerUuid: string) => {
    if (!playerUuid) {
      selectedPlayerUuid.value = "";
      pendingSelectedPlayerUuid.value = "";
      return;
    }
    selectedPlayerUuid.value = selectedPlayerUuid.value === playerUuid ? "" : playerUuid;
  };

  const selectPlayerFromServer = (playerUuid: string, serverKey = selectedServerKey.value) => {
    if (serverKey === selectedServerKey.value) {
      selectPlayer(playerUuid);
      return;
    }

    pendingSelectedPlayerUuid.value = playerUuid;
    selectedServerKey.value = serverKey;
  };

  const executeAction = async (payload: GmPanelActionPayload) => {
    const server = currentServer.value;
    const player = currentPlayer.value;
    if (!server || !player) return false;

    isExecutingAction.value = true;
    latestError.value = "";

    try {
      const result = await executeActionRequest.execute({
        data: {
          ...payload,
          daemonId: server.daemonId,
          instanceId: server.instanceId,
          playerUuid: player.playerUuid
        } as IMcsmGmActionRequest
      });

      const actionResult = result.value;
      if (!actionResult) {
        throw new Error("GM 操作返回了空响应。");
      }

      lastActionResult.value = actionResult;

      if (actionResult.balances && player.playerUuid === selectedPlayerUuid.value) {
        balances.value = actionResult.balances;
      }
      if (actionResult.luckPerms && player.playerUuid === selectedPlayerUuid.value) {
        luckPerms.value = actionResult.luckPerms;
      }
      if (actionResult.moderation && player.playerUuid === selectedPlayerUuid.value) {
        moderation.value = actionResult.moderation;
      }

      await Promise.all([
        loadPlayers(true, selectedServerKey.value),
        loadPlayerDetails(true, selectedServerKey.value, selectedPlayerUuid.value)
      ]);

      if (!actionResult.success) {
        setError(new Error(actionResult.message), actionResult.message, true);
        return false;
      }

      latestError.value = "";
      return true;
    } catch (error) {
      setError(error, "GM 操作执行失败。", true);
      return false;
    } finally {
      isExecutingAction.value = false;
    }
  };

  watch(
    selectedServerKey,
    async (serverKey) => {
      clearTimers();
      resetPlayerDetails();

      if (!serverKey) {
        selectedPlayerUuid.value = "";
        return;
      }

      await loadPlayers(true, serverKey);

      const nextPlayerUuid = pendingSelectedPlayerUuid.value;
      pendingSelectedPlayerUuid.value = "";
      const hasSelectedPlayer = playersByServer.value[serverKey]?.some(
        (item) => item.playerUuid === nextPlayerUuid
      );

      if (nextPlayerUuid && hasSelectedPlayer) {
        selectedPlayerUuid.value = nextPlayerUuid;
      } else if (!playersByServer.value[serverKey]?.some((item) => item.playerUuid === selectedPlayerUuid.value)) {
        selectedPlayerUuid.value = "";
      }

      if (selectedPlayerUuid.value) {
        await loadPlayerDetails(true, serverKey, selectedPlayerUuid.value);
      }
      startPollers();
    },
    { flush: "post" }
  );

  watch(
    selectedPlayerUuid,
    async (playerUuid) => {
      if (!selectedServerKey.value || !playerUuid) {
        resetPlayerDetails();
        return;
      }
      await loadPlayerDetails(true, selectedServerKey.value, playerUuid);
    },
    { flush: "post" }
  );

  onMounted(async () => {
    await refreshCurrent(true);
    startPollers();
  });

  watch(isDocumentVisible, (visible) => {
    if (!visible) {
      clearTimers();
      return;
    }

    void refreshCurrent(true).finally(() => {
      startPollers();
    });
  });

  onUnmounted(() => {
    clearTimers();
  });

  return {
    nodes,
    servers,
    players,
    allPlayers,
    messages,
    balances,
    luckPerms,
    moderation,
    auditRecords,
    lastActionResult,
    selectedServerKey,
    selectedPlayerUuid,
    currentServer,
    currentNode,
    currentPlayer,
    onlinePlayerCount,
    dependencyState,
    isRefreshing,
    isPlayerLoading,
    isChatLoading,
    isDetailLoading,
    isExecutingAction,
    latestError,
    selectServer,
    selectPlayer: selectPlayerFromServer,
    refreshCurrent,
    executeAction
  };
}
