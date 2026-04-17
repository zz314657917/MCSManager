import { useDocumentVisibility } from "@/hooks/useDocumentVisibility";
import type { GmPanelActionPayload } from "@/hooks/useGmConsoleState";
import {
  gmAuditApi,
  gmBalancesApi,
  gmExecuteActionApi,
  gmInventoryApi,
  gmLuckPermsApi,
  gmModerationApi,
  gmPlayersApi
} from "@/services/apis";
import { createControlTargetKey } from "@/tools/control";
import { reportErrorMsg } from "@/tools/validator";
import { GM_AUDIT_PAGE_SIZE, GM_PLAYER_POLL_INTERVAL_MS, sortPlayersByPresence } from "@/types/gm";
import type { ControlTarget } from "@/types/control";
import { computed, onUnmounted, ref, watch, type Ref } from "vue";

const parseErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error ?? "");
};

const resolveErrorText = (error: unknown, fallbackText: string) => {
  const message = parseErrorMessage(error).trim();
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("403")) return "没有权限访问当前实例玩家信息。";
  if (lowerMessage.includes("404")) return "当前实例未接入 GM 玩家能力。";
  if (lowerMessage.includes("500")) return "玩家管理服务内部错误，请检查 panel、daemon 与插件日志。";
  if (
    lowerMessage.includes("network error") ||
    lowerMessage.includes("failed to fetch") ||
    lowerMessage.includes("econnrefused") ||
    lowerMessage.includes("timeout")
  ) {
    return "玩家信息请求失败，请检查面板与远程节点连接。";
  }

  return message || fallbackText;
};

const buildFallbackServer = (
  target: ControlTarget,
  players: IMcsmGmPlayerPresence[],
  balances?: IMcsmGmPlayerBalances,
  luckPerms?: IMcsmLuckPermsSnapshot,
  moderation?: IMcsmGmModerationStatus
): IMcsmGmOverviewServer => ({
  daemonId: target.daemonId,
  daemonDisplayName: target.daemonDisplayName,
  daemonAvailable: target.daemonAvailable,
  daemonEndpoint: target.description || target.daemonId,
  instanceId: target.instanceId,
  instanceDisplayName: target.displayName,
  instanceStatus: Number(target.status ?? 0),
  playerCount: players.filter((item) => item.online).length,
  chatMessagesToday: 0,
  dependencies: {
    economyAvailable: Boolean(balances?.economyAvailable),
    pointsAvailable: Boolean(balances?.pointsAvailable),
    luckPermsAvailable: Boolean(luckPerms?.available),
    chatPluginAvailable: Boolean(moderation?.chatPluginAvailable),
    chatPluginType: moderation?.chatPluginType || "native",
    updatedAt: balances?.updatedAt || luckPerms?.updatedAt || moderation?.updatedAt
  }
});

export function useControlPlayerPanelState(currentTarget: Readonly<Ref<ControlTarget | undefined>>) {
  const { isDocumentVisible } = useDocumentVisibility();
  const playersRequest = gmPlayersApi();
  const balancesRequest = gmBalancesApi();
  const luckPermsRequest = gmLuckPermsApi();
  const moderationRequest = gmModerationApi();
  const inventoryRequest = gmInventoryApi();
  const auditRequest = gmAuditApi();
  const executeActionRequest = gmExecuteActionApi();

  const onlinePlayers = ref<IMcsmGmPlayerPresence[]>([]);
  const balances = ref<IMcsmGmPlayerBalances>();
  const luckPerms = ref<IMcsmLuckPermsSnapshot>();
  const moderation = ref<IMcsmGmModerationStatus>();
  const inventory = ref<IMcsmGmPlayerInventorySnapshot>();
  const auditRecords = ref<IMcsmGmAuditRecord[]>([]);
  const lastActionResult = ref<IMcsmGmActionResult>();
  const latestError = ref("");

  const selectedPlayerUuid = ref("");
  const isPlayerModalOpen = ref(false);
  const isPlayersLoading = ref(false);
  const isDetailLoading = ref(false);
  const isInventoryLoading = ref(false);
  const isExecutingAction = ref(false);

  let playerPollTimer: number | undefined;

  const clearPlayerPollTimer = () => {
    if (playerPollTimer != null) {
      window.clearInterval(playerPollTimer);
      playerPollTimer = undefined;
    }
  };

  const resetPlayerDetails = () => {
    balances.value = undefined;
    luckPerms.value = undefined;
    moderation.value = undefined;
    inventory.value = undefined;
    auditRecords.value = [];
    lastActionResult.value = undefined;
    latestError.value = "";
  };

  const clearPlayerState = () => {
    clearPlayerPollTimer();
    onlinePlayers.value = [];
    selectedPlayerUuid.value = "";
    isPlayerModalOpen.value = false;
    resetPlayerDetails();
  };

  const currentPlayer = computed(() =>
    onlinePlayers.value.find((item) => item.playerUuid === selectedPlayerUuid.value)
  );

  const currentServer = computed<IMcsmGmOverviewServer | undefined>(() => {
    const target = currentTarget.value;
    if (!target || target.mode !== "instance") return undefined;
    return buildFallbackServer(target, onlinePlayers.value, balances.value, luckPerms.value, moderation.value);
  });

  const loadPlayers = async (forceRequest = false) => {
    const target = currentTarget.value;
    if (!target || target.mode !== "instance" || !target.daemonAvailable) {
      onlinePlayers.value = [];
      return;
    }

    isPlayersLoading.value = true;
    try {
      const result = await playersRequest.execute({
        forceRequest,
        url: `/api/gm/${target.daemonId}/${target.instanceId}/players`,
        params: {
          daemonId: target.daemonId,
          instanceId: target.instanceId
        }
      });

      onlinePlayers.value = (result.value || []).slice().sort(sortPlayersByPresence);
      latestError.value = "";

      if (
        selectedPlayerUuid.value &&
        !onlinePlayers.value.some((item) => item.playerUuid === selectedPlayerUuid.value)
      ) {
        selectedPlayerUuid.value = "";
        isPlayerModalOpen.value = false;
        resetPlayerDetails();
      }
    } catch (error) {
      latestError.value = resolveErrorText(error, "加载当前实例在线玩家失败。");
      onlinePlayers.value = [];
    } finally {
      isPlayersLoading.value = false;
    }
  };

  const loadPlayerDetails = async (forceRequest = false) => {
    const target = currentTarget.value;
    const playerUuid = selectedPlayerUuid.value;
    if (!target || target.mode !== "instance" || !playerUuid) {
      resetPlayerDetails();
      return;
    }

    isDetailLoading.value = true;
    try {
      const [balancesResult, luckPermsResult, moderationResult, auditResult] = await Promise.all([
        balancesRequest.execute({
          forceRequest,
          url: `/api/gm/${target.daemonId}/${target.instanceId}/players/${playerUuid}/balances`,
          params: {
            daemonId: target.daemonId,
            instanceId: target.instanceId,
            playerUuid
          }
        }),
        luckPermsRequest.execute({
          forceRequest,
          url: `/api/gm/${target.daemonId}/${target.instanceId}/players/${playerUuid}/luckperms`,
          params: {
            daemonId: target.daemonId,
            instanceId: target.instanceId,
            playerUuid
          }
        }),
        moderationRequest.execute({
          forceRequest,
          url: `/api/gm/${target.daemonId}/${target.instanceId}/players/${playerUuid}/moderation`,
          params: {
            daemonId: target.daemonId,
            instanceId: target.instanceId,
            playerUuid
          }
        }),
        auditRequest.execute({
          forceRequest,
          params: {
            daemonId: target.daemonId,
            instanceId: target.instanceId,
            playerUuid,
            limit: GM_AUDIT_PAGE_SIZE
          }
        })
      ]);

      balances.value = balancesResult.value;
      luckPerms.value = luckPermsResult.value;
      moderation.value = moderationResult.value;
      auditRecords.value = auditResult.value || [];
      latestError.value = "";
    } catch (error) {
      latestError.value = resolveErrorText(error, "加载玩家操作详情失败。");
      reportErrorMsg(new Error(latestError.value));
    } finally {
      isDetailLoading.value = false;
    }
  };

  const loadInventory = async (forceRequest = false) => {
    const target = currentTarget.value;
    const playerUuid = selectedPlayerUuid.value;
    if (!target || target.mode !== "instance" || !playerUuid) {
      inventory.value = undefined;
      return;
    }

    isInventoryLoading.value = true;
    try {
      const result = await inventoryRequest.execute({
        forceRequest,
        url: `/api/gm/${target.daemonId}/${target.instanceId}/players/${playerUuid}/inventory`,
        params: {
          daemonId: target.daemonId,
          instanceId: target.instanceId,
          playerUuid
        }
      });

      inventory.value = result.value;
      latestError.value = "";
    } catch (error) {
      inventory.value = undefined;
      latestError.value = resolveErrorText(error, "加载玩家背包失败。");
      reportErrorMsg(new Error(latestError.value));
    } finally {
      isInventoryLoading.value = false;
    }
  };

  const openPlayerModal = async (player: IMcsmGmPlayerPresence) => {
    selectedPlayerUuid.value = player.playerUuid;
    isPlayerModalOpen.value = true;
    await Promise.all([loadPlayerDetails(true), loadInventory(true)]);
  };

  const closePlayerModal = () => {
    isPlayerModalOpen.value = false;
    selectedPlayerUuid.value = "";
    resetPlayerDetails();
  };

  const executeAction = async (payload: GmPanelActionPayload) => {
    const target = currentTarget.value;
    const player = currentPlayer.value;
    if (!target || target.mode !== "instance" || !player) return false;

    isExecutingAction.value = true;
    latestError.value = "";

    try {
      const result = await executeActionRequest.execute({
        data: {
          ...payload,
          daemonId: target.daemonId,
          instanceId: target.instanceId,
          playerUuid: player.playerUuid
        } as IMcsmGmActionRequest
      });

      const actionResult = result.value;
      if (!actionResult) {
        throw new Error("GM 操作返回了空响应。");
      }

      lastActionResult.value = actionResult;

      if (actionResult.balances) {
        balances.value = actionResult.balances;
      }
      if (actionResult.luckPerms) {
        luckPerms.value = actionResult.luckPerms;
      }
      if (actionResult.moderation) {
        moderation.value = actionResult.moderation;
      }

      await Promise.all([loadPlayers(true), loadPlayerDetails(true)]);

      if (!actionResult.success) {
        latestError.value = actionResult.message;
        reportErrorMsg(new Error(actionResult.message));
        return false;
      }

      latestError.value = "";
      return true;
    } catch (error) {
      latestError.value = resolveErrorText(error, "GM 操作执行失败。");
      reportErrorMsg(new Error(latestError.value));
      return false;
    } finally {
      isExecutingAction.value = false;
    }
  };

  const startPlayerPoller = () => {
    clearPlayerPollTimer();
    const target = currentTarget.value;
    if (!isDocumentVisible.value || !target || target.mode !== "instance" || !target.daemonAvailable) return;

    playerPollTimer = window.setInterval(() => {
      void loadPlayers(false);
      if (isPlayerModalOpen.value && selectedPlayerUuid.value) {
        void loadPlayerDetails(false);
      }
    }, GM_PLAYER_POLL_INTERVAL_MS);
  };

  watch(
    () => (currentTarget.value ? createControlTargetKey(currentTarget.value) : ""),
    async () => {
      clearPlayerState();

      const target = currentTarget.value;
      if (!target || target.mode !== "instance" || !target.daemonAvailable) return;

      await loadPlayers(true);
      startPlayerPoller();
    },
    { immediate: true }
  );

  watch(isDocumentVisible, (visible) => {
    if (!visible) {
      clearPlayerPollTimer();
      return;
    }

    void loadPlayers(true).finally(() => {
      startPlayerPoller();
      if (isPlayerModalOpen.value && selectedPlayerUuid.value) {
        void loadPlayerDetails(true);
      }
    });
  });

  onUnmounted(() => {
    clearPlayerPollTimer();
  });

  return {
    onlinePlayers,
    currentServer,
    currentPlayer,
    balances,
    luckPerms,
    moderation,
    inventory,
    auditRecords,
    lastActionResult,
    latestError,
    isPlayersLoading,
    isDetailLoading,
    isInventoryLoading,
    isExecutingAction,
    isPlayerModalOpen,
    openPlayerModal,
    closePlayerModal,
    loadPlayers,
    loadPlayerDetails,
    loadInventory,
    executeAction
  };
}
