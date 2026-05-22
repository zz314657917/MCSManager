<script setup lang="ts">
import ControlActionButtons, {
  type ControlFeatureShortcut
} from "@/components/control/ControlActionButtons.vue";
import GmOperationsPanel from "@/components/gm/GmOperationsPanel.vue";
import { OPERATIONS_MOBILE_NAV_ITEMS } from "@/components/operations/mobileNav";
import OperationsMobileNav from "@/components/operations/OperationsMobileNav.vue";
import ControlTargetSelector from "@/components/control/ControlTargetSelector.vue";
import ControlFeatureModalSchedule from "@/components/control/ControlFeatureModalSchedule.vue";
import ControlFeatureModalServerConfig from "@/components/control/ControlFeatureModalServerConfig.vue";
import OperationsPageShell from "@/components/operations/OperationsPageShell.vue";
import { useControlDashboard } from "@/hooks/useControlDashboard";
import { useControlPanelState } from "@/hooks/useControlPanelState";
import { useControlPlayerPanelPreviewState } from "@/hooks/useControlPlayerPanelPreviewState";
import { useControlPlayerPanelState } from "@/hooks/useControlPlayerPanelState";
import { useControlPreviewState } from "@/hooks/useControlPreviewState";
import { useControlSummaryFocus } from "@/hooks/useControlSummaryFocus";
import { useControlTargetFavorites } from "@/hooks/useControlTargetFavorites";
import {
  TYPE_MINECRAFT_JAVA,
  TYPE_STEAM_SERVER_UNIVERSAL
} from "@/hooks/useInstance";
import { useServerConfig } from "@/hooks/useServerConfig";
import { useScreen } from "@/hooks/useScreen";
import { t } from "@/lang/i18n";
import { getInstanceInfo as getInstanceInfoApi } from "@/services/apis/instance";
import { useAppStateStore } from "@/stores/useAppStateStore";
import { useAppToolsStore } from "@/stores/useAppToolsStore";
import { getControlTargetIdentity, getControlTargetStatusColor, getControlTargetStatusText } from "@/tools/controlStatus";
import {
  createControlFeatureModalCard,
  shouldOpenControlFeatureModal,
  type ControlDesktopModalFeatureKey
} from "@/tools/controlFeatureModal";
import { getPreviewServerConfigFiles } from "@/tools/controlFeaturePreview";
import { createControlTargetKey } from "@/tools/control";
import { reportErrorMsg } from "@/tools/validator";
import type { ControlBatchAction, ControlLogLine, ControlTarget } from "@/types/control";
import type { InstanceDetail, LayoutCard } from "@/types";
import EventConfig from "@/widgets/instance/dialogs/EventConfig.vue";
import InstanceDetailDialog from "@/widgets/instance/dialogs/InstanceDetail.vue";
import InstanceFundamentalDetail from "@/widgets/instance/dialogs/InstanceFundamentalDetail.vue";
import JavaManager from "@/widgets/instance/dialogs/JavaManager.vue";
import McPingSettings from "@/widgets/instance/dialogs/McPingSettings.vue";
import RconSettings from "@/widgets/instance/dialogs/RconSettings.vue";
import TermConfig from "@/widgets/instance/dialogs/TermConfig.vue";
import { Modal } from "ant-design-vue";
import {
  AppstoreAddOutlined,
  AppstoreOutlined,
  BuildOutlined,
  CloudServerOutlined,
  CodeOutlined,
  ControlOutlined,
  DashboardOutlined,
  DesktopOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  FieldTimeOutlined,
  FolderOpenOutlined,
  MenuUnfoldOutlined,
  ReloadOutlined,
  SearchOutlined,
  SendOutlined,
  TeamOutlined,
  UsergroupDeleteOutlined,
  UsbOutlined
} from "@ant-design/icons-vue";
import { computed, h, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useRouter } from "vue-router";

const router = useRouter();
const { isPhone } = useScreen();
const { isSummaryCollapsed, hideSummary, showSummary } = useControlSummaryFocus(isPhone);
const { state: appState, isAdmin } = useAppStateStore();
const { openInputDialog } = useAppToolsStore();
const { refresh: refreshServerConfig, serverConfigFiles } = useServerConfig();
const { execute: executeInstanceInfo } = getInstanceInfoApi();
const logBodyRef = ref<HTMLDivElement>();
const commandInputRef = ref<InstanceType<typeof import("ant-design-vue").Input>>();
const shellRef = ref<InstanceType<typeof OperationsPageShell>>();
const isMobileSelectorOpen = ref(false);
const terminalConfigDialog = ref<InstanceType<typeof TermConfig>>();
const eventConfigDialog = ref<InstanceType<typeof EventConfig>>();
const javaManagerDialog = ref<InstanceType<typeof JavaManager>>();
const rconSettingsDialog = ref<InstanceType<typeof RconSettings>>();
const mcPingSettingsDialog = ref<InstanceType<typeof McPingSettings>>();
const instanceDetailDialog = ref<InstanceType<typeof InstanceDetailDialog>>();
const instanceFundamentalDetailDialog = ref<InstanceType<typeof InstanceFundamentalDetail>>();
const ALL_CONTROL_TARGETS_FILTER = "__all_control_targets__";
const BATCH_OPERATION_DANGER_ACTIONS = new Set<ControlBatchAction>(["stop", "kill"]);
const targetFilterDaemonId = ref(ALL_CONTROL_TARGETS_FILTER);
const currentInstanceDetail = ref<InstanceDetail>();
const batchSelectedTargetKeys = ref<string[]>([]);
const isBatchOperating = ref(false);
const activeFeatureModal = ref<{
  key: ControlDesktopModalFeatureKey;
  title: string;
  card: LayoutCard;
}>();

// Command history state
const commandHistory = ref<string[]>([]);
const commandHistoryIndex = ref(-1);
const savedCommandInput = ref("");

// Log filter state
const logSearchQuery = ref("");
const logLevelFilter = ref<"all" | "error" | "warn" | "command">("all");

const isLocalPreviewMode = appState.userInfo?.token === "local-preview-token";
const controlState = isLocalPreviewMode ? useControlPreviewState() : useControlPanelState();
const {
  favoriteTargetKeys,
  targetNotes,
  toggleFavoriteTarget,
  isFavoriteTarget,
  getTargetNote,
  setTargetNote
} = useControlTargetFavorites();

const {
  nodes,
  pollIntervalMs,
  stateSource,
  commandInput,
  currentLogs,
  currentNode,
  currentTarget,
  currentTargetKey,
  currentTargets,
  isPollingPaused,
  isRefreshing,
  selectTarget,
  refreshCurrentTarget,
  togglePolling,
  clearCurrentLogs,
  startCurrentTarget,
  stopCurrentTarget,
  restartCurrentTarget,
  terminateCurrentTarget,
  batchOperateTargets,
  sendCommand
} = controlState;
const controlPlayerState = isLocalPreviewMode
  ? useControlPlayerPanelPreviewState(currentTarget)
  : useControlPlayerPanelState(currentTarget);

const {
  dashboardMeta,
  dashboardMetrics,
  dashboardSource,
  dashboardSourceText,
  isDashboardRefreshing,
  refreshDashboard
} = useControlDashboard(currentTarget);
const {
  onlinePlayers,
  currentServer: currentPlayerServer,
  currentPlayer,
  balances,
  luckPerms,
  moderation,
  inventory,
  auditRecords,
  lastActionResult,
  latestError: playerPanelError,
  isPlayersLoading,
  isDetailLoading,
  isInventoryLoading,
  isExecutingAction,
  isPlayerModalOpen,
  openPlayerModal,
  closePlayerModal,
  loadPlayers,
  loadInventory,
  executeAction: executePlayerAction
} = controlPlayerState;

const currentTargetModeText = computed(() =>
  currentTarget.value?.mode === "global" ? t("TXT_CODE_CONTROL_HOST_MODE") : t("TXT_CODE_4ccdd3a0")
);

const currentTargetContext = computed(() => {
  if (!currentTarget.value) return "--";
  return `${currentTargetModeText.value} / ${currentTarget.value.daemonDisplayName}`;
});

const commandPlaceholder = computed(() => t("TXT_CODE_555e2c1b"));

const primaryActionLabel = computed(() =>
  currentTarget.value?.mode === "global"
    ? t("TXT_CODE_CONTROL_OPEN_HOST")
    : t("TXT_CODE_8c7318b3")
);

const terminalTitle = computed(() =>
  currentTarget.value?.mode === "global" ? t("TXT_CODE_5bdaf23d") : t("TXT_CODE_4ccdd3a0")
);

const dashboardSourceTagColor = computed(() =>
  dashboardSource.value === "live" ? "blue" : "default"
);

const currentTargetDescription = computed(
  () => currentTarget.value?.description || currentNode.value?.description || ""
);

const isRefreshBusy = computed(() => isRefreshing.value || isDashboardRefreshing.value);
const controlEyebrow = computed(() =>
  t(stateSource === "preview" ? "TXT_CODE_CONTROL_RELAY_PREVIEW" : "TXT_CODE_CONTROL_RELAY_LIVE")
);
const mobileSelectorTitle = computed(() => `${t("TXT_CODE_20509fa0")} / ${t("TXT_CODE_d655beec")}`);
const mobileSelectorNodeText = computed(() => currentNode.value?.daemonDisplayName || t("TXT_CODE_20509fa0"));
const mobileSelectorTargetText = computed(
  () => getTargetNote(currentTarget.value) || currentTarget.value?.displayName || t("TXT_CODE_CONTROL_TARGET")
);
const mobileSelectorTargetId = computed(() => {
  return getControlTargetIdentity(currentTarget.value);
});
const currentTargetTitle = computed(
  () => getTargetNote(currentTarget.value) || currentTarget.value?.displayName || "--"
);
const filteredTargetNodes = computed(() => {
  if (targetFilterDaemonId.value === ALL_CONTROL_TARGETS_FILTER) {
    return nodes.value;
  }

  return nodes.value.filter((node) => node.daemonId === targetFilterDaemonId.value);
});

const orderedCurrentTargets = computed(() => {
  const globalTargets: ControlTarget[] = [];
  const favoriteTargets: ControlTarget[] = [];
  const groupedTargets: ControlTarget[] = [];

  for (const node of filteredTargetNodes.value) {
    const nodeInstances: ControlTarget[] = [];

    for (const target of node.targets) {
      if (target.mode === "global") {
        globalTargets.push(target);
        continue;
      }

      if (isFavoriteTarget(target)) {
        favoriteTargets.push(target);
        continue;
      }

      nodeInstances.push(target);
    }

    groupedTargets.push(...nodeInstances);
  }

  return [...globalTargets, ...favoriteTargets, ...groupedTargets];
});

const batchSelectedTargetKeySet = computed(() => new Set(batchSelectedTargetKeys.value));
const allTargets = computed(() => nodes.value.flatMap((node) => node.targets));
const selectableBatchTargets = computed(() =>
  allTargets.value.filter((target) => target.mode === "instance")
);
const batchSelectedTargets = computed(() => {
  const selectedKeys = batchSelectedTargetKeySet.value;
  return selectableBatchTargets.value.filter((target) => selectedKeys.has(createControlTargetKey(target)));
});
const batchOperationLabels: Record<ControlBatchAction, string> = {
  start: t("TXT_CODE_8c7318b3"),
  stop: t("TXT_CODE_148d6467"),
  restart: t("TXT_CODE_77cc12da"),
  kill: t("TXT_CODE_1c36c8f2")
};

const getLogClass = (line: ControlLogLine) => `terminal-line--${line.level}`;

// Filtered logs based on search and level
const filteredLogs = computed(() => {
  let logs = currentLogs.value;

  // Level filter
  if (logLevelFilter.value !== "all") {
    if (logLevelFilter.value === "error") {
      logs = logs.filter((log) => log.level === "error");
    } else if (logLevelFilter.value === "warn") {
      logs = logs.filter((log) => log.level === "warn");
    } else if (logLevelFilter.value === "command") {
      logs = logs.filter((log) => log.level === "command");
    }
  }

  // Search filter
  if (logSearchQuery.value.trim()) {
    const query = logSearchQuery.value.toLowerCase();
    logs = logs.filter((log) => log.text.toLowerCase().includes(query));
  }

  return logs;
});

const handleRefresh = () => {
  refreshCurrentTarget();
  void refreshDashboard(true);
  void loadPlayers(true);
};

const openMobileSelector = () => {
  isMobileSelectorOpen.value = true;
};

const closeMobileSelector = () => {
  isMobileSelectorOpen.value = false;
};

const handleSelectTarget = (target: ControlTarget) => {
  selectTarget(target);
  if (isPhone.value) {
    closeMobileSelector();
  }
};

const handleToggleBatchSelection = (target: ControlTarget) => {
  if (!isAdmin.value) return;
  if (target.mode !== "instance") return;

  const targetKey = createControlTargetKey(target);
  if (batchSelectedTargetKeySet.value.has(targetKey)) {
    batchSelectedTargetKeys.value = batchSelectedTargetKeys.value.filter((key) => key !== targetKey);
    return;
  }

  batchSelectedTargetKeys.value = [...batchSelectedTargetKeys.value, targetKey];
};

const handleToggleVisibleBatchSelection = (targets: ControlTarget[]) => {
  if (!isAdmin.value) return;
  const selectableTargets = targets.filter((target) => target.mode === "instance");
  if (!selectableTargets.length) return;

  const selectedKeys = new Set(batchSelectedTargetKeys.value);
  const visibleKeys = selectableTargets.map((target) => createControlTargetKey(target));
  const allVisibleSelected = visibleKeys.every((key) => selectedKeys.has(key));

  if (allVisibleSelected) {
    for (const key of visibleKeys) selectedKeys.delete(key);
  } else {
    for (const key of visibleKeys) selectedKeys.add(key);
  }

  batchSelectedTargetKeys.value = [...selectedKeys];
};

const clearBatchSelection = () => {
  batchSelectedTargetKeys.value = [];
};

const handleToggleFavoriteTarget = (target: ControlTarget) => {
  toggleFavoriteTarget(target);
};

const handleChangeTargetFilter = (daemonId: string) => {
  targetFilterDaemonId.value = daemonId;

  if (daemonId === ALL_CONTROL_TARGETS_FILTER) return;
  if (currentTarget.value?.daemonId === daemonId) return;

  const nextTarget = nodes.value.find((node) => node.daemonId === daemonId)?.targets[0];
  if (nextTarget) {
    selectTarget(nextTarget);
  }
};

const handleEditTargetNote = async (target: ControlTarget) => {
  if (target.mode !== "instance") return;

  const currentNote = getTargetNote(target);
  const dialogTitle = currentNote
    ? `${t("TXT_CODE_CONTROL_EDIT_TARGET_NOTE")} (${currentNote})`
    : `${t("TXT_CODE_CONTROL_EDIT_TARGET_NOTE")} (${target.displayName})`;

  try {
    const nextNote = String((await openInputDialog(dialogTitle)) || "");
    setTargetNote(target, nextNote);
  } catch {
    // ignore canceled input dialog
  }
};

// Command history handlers
const handleCommandHistoryUp = () => {
  if (commandHistory.value.length === 0) return;

  if (commandHistoryIndex.value === -1) {
    savedCommandInput.value = commandInput.value;
    commandHistoryIndex.value = commandHistory.value.length - 1;
  } else if (commandHistoryIndex.value > 0) {
    commandHistoryIndex.value -= 1;
  }

  commandInput.value = commandHistory.value[commandHistoryIndex.value];
};

const handleCommandHistoryDown = () => {
  if (commandHistory.value.length === 0 || commandHistoryIndex.value === -1) return;

  if (commandHistoryIndex.value < commandHistory.value.length - 1) {
    commandHistoryIndex.value += 1;
    commandInput.value = commandHistory.value[commandHistoryIndex.value];
  } else {
    commandHistoryIndex.value = -1;
    commandInput.value = savedCommandInput.value;
  }
};

const handleSendCommandWithHistory = async () => {
  const trimmedCommand = commandInput.value.trim();
  if (!trimmedCommand) return;

  // Add to history if not duplicate of last command
  if (commandHistory.value[commandHistory.value.length - 1] !== trimmedCommand) {
    commandHistory.value.push(trimmedCommand);
    // Keep only last 100 commands
    if (commandHistory.value.length > 100) {
      commandHistory.value.shift();
    }
  }

  // Reset history navigation
  commandHistoryIndex.value = -1;
  savedCommandInput.value = "";

  // Execute the actual send command
  await sendCommand();
};

const openPlayersPage = () => {
  router.push("/gm");
};

const canFileManager = computed(() => appState.settings.canFileManager || isAdmin.value);

const openLegacyInstancePage = () => {
  if (!currentTarget.value) return;
  router.push({
    path: "/instances/terminal",
    query: {
      daemonId: currentTarget.value.daemonId,
      instanceId: currentTarget.value.instanceId
    }
  });
};

const refreshCurrentInstanceDetail = async (forceRequest = false) => {
  const target = currentTarget.value;
  if (!target || target.mode !== "instance") {
    currentInstanceDetail.value = undefined;
    return undefined;
  }

  const response = await executeInstanceInfo({
    params: {
      uuid: target.instanceId,
      daemonId: target.daemonId
    },
    forceRequest
  });

  currentInstanceDetail.value = response.value;
  if (response.value?.config?.type) {
    await refreshServerConfig(response.value.config.type, target.instanceId, target.daemonId);
  }
  return response.value;
};

const ensureCurrentInstanceDetail = async () => {
  if (currentInstanceDetail.value?.instanceUuid === currentTarget.value?.instanceId) {
    return currentInstanceDetail.value;
  }
  return refreshCurrentInstanceDetail(true);
};

const openControlFeatureRoute = (path: string, extraQuery: Record<string, any> = {}) => {
  if (!currentTarget.value || currentTarget.value.mode !== "instance") return;
  router.push({
    path,
    query: {
      daemonId: currentTarget.value.daemonId,
      instanceId: currentTarget.value.instanceId,
      ...extraQuery
    }
  });
};

const openControlFeatureModal = (key: ControlDesktopModalFeatureKey, title: string) => {
  if (!currentTarget.value || currentTarget.value.mode !== "instance") return;

  activeFeatureModal.value = {
    key,
    title,
    card: createControlFeatureModalCard({
      featureKey: key,
      title,
      daemonId: currentTarget.value.daemonId,
      instanceId: currentTarget.value.instanceId,
      instanceType: currentTarget.value.instanceType
    })
  };
};

const closeControlFeatureModal = () => {
  activeFeatureModal.value = undefined;
};

const currentFeatureModalComponent = computed(() => {
  if (activeFeatureModal.value?.key === "schedule") return ControlFeatureModalSchedule;
  if (activeFeatureModal.value?.key === "server-config") return ControlFeatureModalServerConfig;
  return undefined;
});

const openControlDialog = async (
  dialog:
    | InstanceType<typeof TermConfig>
    | InstanceType<typeof EventConfig>
    | InstanceType<typeof JavaManager>
    | InstanceType<typeof RconSettings>
    | InstanceType<typeof McPingSettings>
    | InstanceType<typeof InstanceDetailDialog>
    | InstanceType<typeof InstanceFundamentalDetail>
    | undefined
) => {
  if (!dialog || !currentTarget.value || currentTarget.value.mode !== "instance") return;
  await ensureCurrentInstanceDetail();
  await nextTick();
  dialog.openDialog();
};

const controlFeatureItems = computed<ControlFeatureShortcut[]>(() => {
  const target = currentTarget.value;
  if (!target || target.mode !== "instance") return [];

  const items: ControlFeatureShortcut[] = [
    {
      key: "legacy-terminal",
      title: t("TXT_CODE_CONTROL_ADVANCED_TERMINAL"),
      icon: CodeOutlined,
      click: openLegacyInstancePage
    },
    {
      key: "server-config",
      title: t("TXT_CODE_d07742fe"),
      icon: ControlOutlined,
      disabled: isLocalPreviewMode
        ? getPreviewServerConfigFiles(target.instanceType).length === 0
        : !serverConfigFiles.value?.length,
      click: () => {
        if (shouldOpenControlFeatureModal("server-config", isPhone.value)) {
          openControlFeatureModal("server-config", t("TXT_CODE_d07742fe"));
          return;
        }

        openControlFeatureRoute("/instances/terminal/serverConfig", {
          type: target.instanceType
        });
      }
    },
    {
      key: "schedule",
      title: t("TXT_CODE_b7d026f8"),
      icon: FieldTimeOutlined,
      click: () => {
        if (shouldOpenControlFeatureModal("schedule", isPhone.value)) {
          openControlFeatureModal("schedule", t("TXT_CODE_b7d026f8"));
          return;
        }

        openControlFeatureRoute("/instances/schedule");
      }
    },
    {
      key: "term-config",
      title: t("TXT_CODE_d23631cb"),
      icon: CodeOutlined,
      click: () => void openControlDialog(terminalConfigDialog.value)
    },
    {
      key: "event-config",
      title: t("TXT_CODE_10150756"),
      icon: DashboardOutlined,
      click: () => void openControlDialog(eventConfigDialog.value)
    }
  ];

  if (canFileManager.value) {
    items.splice(1, 0, {
      key: "file-manager",
      title: t("TXT_CODE_ae533703"),
      icon: FolderOpenOutlined,
      click: () => openControlFeatureRoute("/instances/terminal/files")
    });
  }

  const isMinecraftType =
    target.instanceType?.startsWith("minecraft/java") ||
    target.instanceType?.startsWith("minecraft/bedrock");

  if (isMinecraftType && canFileManager.value) {
    items.splice(canFileManager.value ? 3 : 2, 0, {
      key: "mod-manager",
      title: t("TXT_CODE_MOD_MANAGER"),
      icon: UsbOutlined,
      click: () => openControlFeatureRoute("/instances/terminal/mods")
    });
  }

  if (target.instanceType?.includes(TYPE_MINECRAFT_JAVA)) {
    items.push({
      key: "mc-ping",
      title: t("TXT_CODE_40241d8e"),
      icon: UsergroupDeleteOutlined,
      click: () => void openControlDialog(mcPingSettingsDialog.value)
    });
  }

  if (
    target.instanceType?.includes(TYPE_MINECRAFT_JAVA) &&
    currentInstanceDetail.value?.config.processType === "general"
  ) {
    items.push({
      key: "java-manager",
      title: t("TXT_CODE_3fee13ed"),
      icon: BuildOutlined,
      click: () => void openControlDialog(javaManagerDialog.value)
    });
  }

  if (target.instanceType?.includes(TYPE_STEAM_SERVER_UNIVERSAL)) {
    items.push({
      key: "rcon-settings",
      title: t("TXT_CODE_282b0721"),
      icon: BuildOutlined,
      click: () => void openControlDialog(rconSettingsDialog.value)
    });
  }

  if (isAdmin.value) {
    items.push({
      key: "instance-detail",
      title: t("TXT_CODE_4f34fc28"),
      icon: AppstoreAddOutlined,
      click: () => void openControlDialog(instanceDetailDialog.value)
    });
  } else if (
    currentInstanceDetail.value?.config.processType === "docker" &&
    appState.settings.allowChangeCmd
  ) {
    items.push({
      key: "instance-basic-detail",
      title: t("TXT_CODE_4f34fc28"),
      icon: AppstoreAddOutlined,
      click: () => void openControlDialog(instanceFundamentalDetailDialog.value)
    });
  }

  return items;
});

const currentOnlinePlayerCountText = computed(() => `${onlinePlayers.value.length}`);

const handleStopCurrentTarget = () => {
  if (!currentTarget.value) return;

  Modal.confirm({
    title: t("TXT_CODE_CONTROL_CONFIRM_STOP"),
    content:
      currentTarget.value.mode === "global"
        ? t("TXT_CODE_CONTROL_CONFIRM_CLOSE_HOST")
        : t("TXT_CODE_CONTROL_CONFIRM_STOP_INSTANCE"),
    okText: t("TXT_CODE_148d6467"),
    cancelText: t("TXT_CODE_a0451c97"),
    okButtonProps: {
      danger: true
    },
    async onOk() {
      await stopCurrentTarget();
    }
  });
};

const handleRestartCurrentTarget = () => {
  if (currentTarget.value?.mode !== "instance") return;

  Modal.confirm({
    title: t("TXT_CODE_77cc12da"),
    content: h("div", { style: "display:flex;flex-direction:column;gap:8px;" }, [
      h("div", t("TXT_CODE_CONTROL_CONFIRM_RESTART_INSTANCE")),
      h("div", { style: "display:flex;flex-wrap:wrap;gap:6px;align-items:center;" }, [
        h("span", "实例："),
        h(
          "strong",
          {
            style: "color:#ff4d4f;font-weight:700;word-break:break-all;"
          },
          currentTargetTitle.value
        )
      ])
    ]),
    okText: t("TXT_CODE_77cc12da"),
    cancelText: t("TXT_CODE_a0451c97"),
    async onOk() {
      await restartCurrentTarget();
    }
  });
};

const runBatchOperation = async (action: ControlBatchAction, targets: ControlTarget[]) => {
  if (!isAdmin.value) return;
  if (isBatchOperating.value) return;
  if (!targets.length) {
    reportErrorMsg(new Error(t("TXT_CODE_CONTROL_BATCH_NO_SELECTION")));
    return;
  }

  isBatchOperating.value = true;
  try {
    const ok = await batchOperateTargets(action, targets);
    if (ok) {
      clearBatchSelection();
      void refreshDashboard(true);
      void loadPlayers(true);
    }
  } finally {
    isBatchOperating.value = false;
  }
};

const handleBatchOperation = (action: ControlBatchAction) => {
  if (!isAdmin.value) return;
  const targets = batchSelectedTargets.value;
  if (!targets.length) {
    reportErrorMsg(new Error(t("TXT_CODE_CONTROL_BATCH_NO_SELECTION")));
    return;
  }

  Modal.confirm({
    title: t("TXT_CODE_CONTROL_BATCH_CONFIRM_TITLE", {
      action: batchOperationLabels[action]
    }),
    content: h("div", { class: "control-console__batch-confirm" }, [
      h(
        "div",
        t("TXT_CODE_CONTROL_BATCH_CONFIRM_CONTENT", {
          action: batchOperationLabels[action],
          count: targets.length
        })
      ),
      h(
        "div",
        { class: "control-console__batch-confirm-list" },
        targets.slice(0, 8).map((target) =>
          h("span", { class: "control-console__batch-confirm-item" }, [
            h("strong", getTargetNote(target) || target.displayName),
            h("span", ` / ${target.daemonDisplayName}`)
          ])
        )
      ),
      targets.length > 8
        ? h("div", { class: "control-console__batch-confirm-more" }, `+ ${targets.length - 8}`)
        : null
    ]),
    okText: batchOperationLabels[action],
    cancelText: t("TXT_CODE_a0451c97"),
    okButtonProps: {
      danger: BATCH_OPERATION_DANGER_ACTIONS.has(action)
    },
    async onOk() {
      await runBatchOperation(action, targets);
    }
  });
};

const handleTerminateCurrentTarget = () => {
  if (currentTarget.value?.mode !== "instance") return;

  Modal.confirm({
    title: t("TXT_CODE_893567ac"),
    content: t("TXT_CODE_ec08484"),
    okText: t("TXT_CODE_7b67813a"),
    cancelText: t("TXT_CODE_a0451c97"),
    okButtonProps: {
      danger: true
    },
    async onOk() {
      await terminateCurrentTarget();
    }
  });
};

watch(
  () => [currentTargetKey.value, currentLogs.value.length],
  async () => {
    await nextTick();
    if (!logBodyRef.value) return;
    logBodyRef.value.scrollTop = logBodyRef.value.scrollHeight;
  },
  {
    flush: "post"
  }
);

watch(
  () => isPhone.value,
  (phone) => {
    if (!phone) {
      closeMobileSelector();
    }
  }
);

watch(
  nodes,
  (nextNodes) => {
    if (targetFilterDaemonId.value === ALL_CONTROL_TARGETS_FILTER) return;
    if (nextNodes.some((node) => node.daemonId === targetFilterDaemonId.value)) return;
    targetFilterDaemonId.value = ALL_CONTROL_TARGETS_FILTER;
  },
  { deep: true }
);

watch(
  selectableBatchTargets,
  (targets) => {
    if (!isAdmin.value) {
      batchSelectedTargetKeys.value = [];
      return;
    }

    const validKeys = new Set(targets.map((target) => createControlTargetKey(target)));
    batchSelectedTargetKeys.value = batchSelectedTargetKeys.value.filter((key) => validKeys.has(key));
  },
  { deep: true }
);

watch(isAdmin, (admin) => {
  if (!admin) clearBatchSelection();
});

watch(
  () => currentTargetKey.value,
  async () => {
    if (currentTarget.value?.mode !== "instance") {
      currentInstanceDetail.value = undefined;
      return;
    }

    try {
      await refreshCurrentInstanceDetail(true);
    } catch {
      currentInstanceDetail.value = undefined;
    }
  },
  { immediate: true }
);

// Keyboard shortcuts
const handleGlobalKeydown = (event: KeyboardEvent) => {
  // Ctrl+R: Refresh
  if (event.ctrlKey && event.key === "r") {
    event.preventDefault();
    handleRefresh();
    return;
  }

  // Ctrl+Enter: Send command (when not focused on input)
  if (event.ctrlKey && event.key === "Enter") {
    const target = event.target as HTMLElement;
    if (target.tagName !== "INPUT" && target.tagName !== "TEXTAREA") {
      event.preventDefault();
      if (commandInput.value.trim()) {
        void handleSendCommandWithHistory();
      }
    }
  }
};

onMounted(() => {
  window.addEventListener("keydown", handleGlobalKeydown);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleGlobalKeydown);
});
</script>

<template>
  <div class="control-console" data-testid="control-console">
    <OperationsPageShell
      ref="shellRef"
      :title="t('TXT_CODE_CONTROL_TITLE')"
      :eyebrow="controlEyebrow"
      :back-label="t('TXT_CODE_e21473bc')"
      fallback-back-to="/instances"
      :show-sidebar-on-mobile="false"
      mobile-body-padding-bottom="12px"
      :mobile-nav-items="OPERATIONS_MOBILE_NAV_ITEMS"
      :hide-desktop-header="true"
      :hide-mobile-header="true"
      :hide-eyebrow-on-mobile="true"
    >
      <template #header-actions="{ isPhone: shellIsPhone }">
        <a-button v-if="!shellIsPhone" @click="openPlayersPage">
          <template #icon>
            <TeamOutlined />
          </template>
          <span>{{ t("TXT_CODE_GM_MANAGEMENT") }}</span>
        </a-button>

        <a-button v-if="currentTarget && !shellIsPhone" @click="openLegacyInstancePage">
          <template #icon>
            <AppstoreOutlined />
          </template>
          <span>{{ t("TXT_CODE_CONTROL_INSTANCE_PAGE") }}</span>
        </a-button>

        <template v-if="currentTarget && !shellIsPhone">
          <div class="control-console__header-pill">
            <CloudServerOutlined />
            <span>{{ currentNode?.daemonDisplayName }}</span>
          </div>
          <div class="control-console__header-pill control-console__header-pill--accent">
            <DesktopOutlined />
            <span>{{ currentTargetTitle }}</span>
          </div>
          <a-tag class="control-console__mode-tag" :bordered="false">
            {{ currentTargetModeText }}
          </a-tag>
        </template>

        <a-button :loading="isRefreshBusy" @click="handleRefresh">
          <template #icon>
            <ReloadOutlined />
          </template>
          <span v-if="!shellIsPhone">{{ t("TXT_CODE_REFRESH") }}</span>
        </a-button>
      </template>

      <section v-if="!isPhone && currentTarget" class="control-console__desktop-toolbar">
        <div class="control-console__desktop-toolbar-main">
          <div class="control-console__desktop-toolbar-title-wrap">
            <div class="control-console__desktop-toolbar-eyebrow">{{ controlEyebrow }}</div>
            <div class="control-console__desktop-toolbar-title">{{ t("TXT_CODE_CONTROL_TITLE") }}</div>
          </div>
          <div class="control-console__desktop-toolbar-pills">
            <div class="control-console__header-pill">
              <CloudServerOutlined />
              <span>{{ currentNode?.daemonDisplayName }}</span>
            </div>
            <div class="control-console__header-pill control-console__header-pill--accent">
              <DesktopOutlined />
              <span>{{ currentTargetTitle }}</span>
            </div>
            <a-tag class="control-console__mode-tag" :bordered="false">
              {{ currentTargetModeText }}
            </a-tag>
          </div>
        </div>

        <div class="control-console__desktop-toolbar-actions">
          <a-button @click="openPlayersPage">
            <template #icon>
              <TeamOutlined />
            </template>
            <span>{{ t("TXT_CODE_GM_MANAGEMENT") }}</span>
          </a-button>
          <a-button @click="openLegacyInstancePage">
            <template #icon>
              <AppstoreOutlined />
            </template>
            <span>{{ t("TXT_CODE_CONTROL_INSTANCE_PAGE") }}</span>
          </a-button>
          <a-button :loading="isRefreshBusy" @click="handleRefresh">
            <template #icon>
              <ReloadOutlined />
            </template>
            <span>{{ t("TXT_CODE_REFRESH") }}</span>
          </a-button>
        </div>
      </section>

      <template #mobile-prelude>
        <section v-if="isPhone && currentTarget" class="control-console__mobile-switcher">
          <button
            type="button"
            class="control-console__mobile-switcher-card"
            data-testid="control-mobile-switcher"
            @click="openMobileSelector"
          >
            <div class="control-console__mobile-switcher-main">
              <div class="control-console__mobile-switcher-copy">
                <div class="control-console__mobile-switcher-eyebrow">{{ mobileSelectorTitle }}</div>
                <div class="control-console__mobile-switcher-value">{{ mobileSelectorTargetText }}</div>
                <div class="control-console__mobile-switcher-desc">
                  {{ mobileSelectorNodeText }} / {{ mobileSelectorTargetId }}
                </div>
              </div>
              <span class="control-console__mobile-switcher-action">
                <MenuUnfoldOutlined />
              </span>
            </div>
            <div class="control-console__mobile-switcher-tags">
              <a-tag :color="getControlTargetStatusColor(currentTarget)">
                {{ getControlTargetStatusText(currentTarget) }}
              </a-tag>
              <a-tag :color="dashboardSourceTagColor">
                {{ dashboardSourceText }}
              </a-tag>
              <a-tag :bordered="false">
                {{ currentTargetModeText }}
              </a-tag>
            </div>
          </button>
        </section>
      </template>

      <template #sidebar>
        <ControlTargetSelector
          :nodes="nodes"
          :current-node-id="currentNode?.daemonId"
          :current-targets="orderedCurrentTargets"
          :current-target-key="currentTargetKey"
          :favorite-target-keys="favoriteTargetKeys"
          :selected-target-keys="batchSelectedTargetKeys"
          :target-notes="targetNotes"
          :target-filter-daemon-id="targetFilterDaemonId"
          :all-targets-filter-value="ALL_CONTROL_TARGETS_FILTER"
          :batch-selection-enabled="isAdmin"
          @select-target="handleSelectTarget"
          @toggle-batch-selection="handleToggleBatchSelection"
          @toggle-visible-batch-selection="handleToggleVisibleBatchSelection"
          @toggle-favorite="handleToggleFavoriteTarget"
          @change-target-filter="handleChangeTargetFilter"
          @edit-target-note="handleEditTargetNote"
        />
      </template>

      <div
        v-if="currentTarget"
        class="control-console__workspace"
        :class="{
          'control-console__workspace--mobile': isPhone,
          'control-console__workspace--summary-collapsed': isSummaryCollapsed
        }"
      >
        <section
          class="control-panel control-panel--summary control-panel--summary-orderable"
          :class="{
            'control-panel--summary-mobile': isPhone,
            'control-panel--summary-collapsed': isSummaryCollapsed
          }"
          data-testid="control-summary-panel"
        >
          <div class="control-panel__header">
            <span>{{ t("TXT_CODE_CONTROL_SUMMARY") }}</span>
            <div class="control-console__summary-header-actions">
              <div class="control-console__summary-tags">
                <a-tag :color="getControlTargetStatusColor(currentTarget)">
                  {{ getControlTargetStatusText(currentTarget) }}
                </a-tag>
                <a-tag :color="dashboardSourceTagColor">
                  {{ dashboardSourceText }}
                </a-tag>
              </div>
              <a-button
                v-if="!isPhone"
                size="small"
                class="control-console__summary-toggle-button"
                :title="t('TXT_CODE_CONTROL_HIDE_SUMMARY')"
                :aria-label="t('TXT_CODE_CONTROL_HIDE_SUMMARY')"
                @click="hideSummary"
              >
                <template #icon>
                  <EyeInvisibleOutlined />
                </template>
                {{ t("TXT_CODE_CONTROL_HIDE_SUMMARY") }}
              </a-button>
            </div>
          </div>
          <div
            class="control-console__summary-top"
            :class="{ 'control-console__summary-top--mobile': isPhone }"
          >
            <div class="control-console__summary-copy">
              <div v-if="!isPhone" class="control-console__summary-kicker">{{ currentTargetContext }}</div>
              <div class="control-console__summary-title" data-testid="control-summary-title">
                {{ currentTargetTitle }}
              </div>
              <p v-if="currentTargetDescription && !isPhone" class="control-console__summary-desc">
                {{ currentTargetDescription }}
              </p>
            </div>
            <div
              v-if="!isPhone"
              class="control-console__summary-meta"
              :class="{ 'control-console__summary-meta--mobile': isPhone }"
            >
              <div
                v-for="item in dashboardMeta"
                :key="item.key"
                class="control-console__summary-meta-item"
              >
                <span class="control-console__summary-meta-label">{{ item.label }}</span>
                <strong class="control-console__summary-meta-value">{{ item.value }}</strong>
              </div>
            </div>
          </div>
          <div
            class="control-console__metrics-grid"
            :class="[
              `control-console__metrics-grid--${currentTarget.mode}`,
              { 'control-console__metrics-grid--mobile': isPhone }
            ]"
          >
            <article
              v-for="metric in dashboardMetrics"
              :key="metric.key"
              class="control-console__metric-card"
              :class="[
                `control-console__metric-card--${metric.key}`,
                `is-${metric.tone}`,
                { 'control-console__metric-card--segmented': !!metric.segments?.length }
              ]"
            >
              <span class="control-console__metric-label">{{ metric.label }}</span>
              <strong v-if="!metric.segments?.length" class="control-console__metric-value">
                {{ metric.value }}
              </strong>
              <div v-else class="control-console__metric-segments">
                <div
                  v-for="segment in metric.segments"
                  :key="`${metric.key}:${segment.key}`"
                  class="control-console__metric-segment"
                >
                  <span class="control-console__metric-segment-label">{{ segment.label }}</span>
                  <strong class="control-console__metric-segment-value">{{ segment.value }}</strong>
                </div>
              </div>
              <span class="control-console__metric-detail">{{ metric.detail }}</span>
            </article>
          </div>

          <section
            v-if="currentTarget.mode === 'instance'"
            class="control-console__players-section"
            data-testid="control-online-players"
          >
            <div class="control-console__players-header">
              <span>{{ t("TXT_CODE_PLAYERS_ONLINE") }}</span>
              <a-tag>{{ currentOnlinePlayerCountText }}</a-tag>
            </div>
            <a-spin :spinning="isPlayersLoading">
              <div v-if="onlinePlayers.length" class="control-console__players-list">
                <button
                  v-for="player in onlinePlayers"
                  :key="player.playerUuid"
                  type="button"
                  class="control-console__player-chip"
                  :data-testid="`control-online-player-${player.playerUuid}`"
                  @click="openPlayerModal(player)"
                >
                  <span class="control-console__player-name">{{ player.playerName }}</span>
                  <span class="control-console__player-meta">
                    {{ player.instanceDisplayName }}
                  </span>
                </button>
              </div>
              <a-empty v-else :image="false" :description="t('TXT_CODE_CONTROL_NO_ONLINE_PLAYERS')" />
            </a-spin>
          </section>
        </section>

        <section
          class="control-panel control-panel--terminal control-panel--terminal-orderable"
          :class="{ 'control-panel--terminal-mobile': isPhone }"
          data-testid="control-terminal-panel"
        >
          <div class="control-console__terminal-toolbar">
            <div class="control-console__terminal-heading">
              <div class="control-console__terminal-title">{{ terminalTitle }}</div>
              <div class="control-console__terminal-meta">
                {{ t("TXT_CODE_CONTROL_TERMINAL_POLL_INTERVAL", { interval: pollIntervalMs }) }}
              </div>
            </div>
            <div v-if="!isPhone" class="control-console__terminal-actions">
              <a-input
                v-model:value="logSearchQuery"
                :placeholder="t('TXT_CODE_CONTROL_SEARCH_LOGS')"
                allow-clear
                size="small"
                class="control-console__terminal-search"
              >
                <template #prefix>
                  <SearchOutlined style="color: rgba(0, 0, 0, 0.25)" />
                </template>
              </a-input>
              <a-button size="small" @click="togglePolling">
                {{ isPollingPaused ? t("TXT_CODE_ed3fc23") : t("TXT_CODE_CONTROL_PAUSE") }}
              </a-button>
              <a-button size="small" @click="clearCurrentLogs">{{ t("TXT_CODE_7333c7f7") }}</a-button>
              <a-button size="small" :loading="isRefreshBusy" @click="handleRefresh">
                {{ t("TXT_CODE_REFRESH") }}
              </a-button>
            </div>
          </div>

          <!-- Log level filter bar -->
          <div class="control-console__log-level-filters">
            <a-segmented
              v-model:value="logLevelFilter"
              :options="[
                { label: t('TXT_CODE_CONTROL_FILTER_ALL'), value: 'all' },
                { label: t('TXT_CODE_CONTROL_FILTER_ERROR'), value: 'error' },
                { label: t('TXT_CODE_CONTROL_FILTER_WARN'), value: 'warn' },
                { label: t('TXT_CODE_CONTROL_FILTER_COMMAND'), value: 'command' }
              ]"
              size="small"
              class="control-console__log-level-filter"
            />
          </div>

          <div class="control-console__terminal-body-wrap">
            <div
              ref="logBodyRef"
              class="control-console__terminal-body"
              :class="{ 'control-console__terminal-body--mobile': isPhone }"
              data-testid="control-terminal-body"
            >
              <template v-if="filteredLogs.length > 0">
                <div
                  v-for="line in filteredLogs"
                  :key="line.id"
                  class="terminal-line"
                  :class="getLogClass(line)"
                >
                  <span class="terminal-line__time">{{ line.time }}</span>
                  <span class="terminal-line__text">{{ line.text }}</span>
                </div>
              </template>
              <a-empty v-else-if="currentLogs.length > 0 && filteredLogs.length === 0" class="control-console__terminal-empty" :description="t('TXT_CODE_CONTROL_SEARCH_LOGS')" />
              <a-empty v-else class="control-console__terminal-empty" :description="t('TXT_CODE_5415f009')" />
            </div>
          </div>

          <div class="control-console__terminal-input" data-testid="control-terminal-input-row">
            <a-input
              ref="commandInputRef"
              v-model:value="commandInput"
              :disabled="!currentTarget.daemonAvailable"
              :placeholder="commandPlaceholder"
              data-testid="control-command-input"
              @press-enter="handleSendCommandWithHistory"
              @keydown.up.prevent="handleCommandHistoryUp"
              @keydown.down.prevent="handleCommandHistoryDown"
            />
            <a-button
              type="primary"
              :disabled="!commandInput.trim()"
              data-testid="control-command-send"
              @click="handleSendCommandWithHistory"
            >
              <template #icon>
                <SendOutlined />
              </template>
              {{ t("TXT_CODE_b7cab91d") }}
            </a-button>
          </div>

          <div
            v-if="isPhone"
            class="control-console__terminal-actions control-console__terminal-actions--mobile"
          >
            <a-button size="small" @click="togglePolling">
              {{ isPollingPaused ? t("TXT_CODE_ed3fc23") : t("TXT_CODE_CONTROL_PAUSE") }}
            </a-button>
            <a-button size="small" @click="clearCurrentLogs">{{ t("TXT_CODE_7333c7f7") }}</a-button>
            <a-button size="small" :loading="isRefreshBusy" @click="handleRefresh">
              {{ t("TXT_CODE_REFRESH") }}
            </a-button>
          </div>
        </section>

        <div
          class="control-console__actions-slot"
          :class="{ 'control-console__actions-slot--mobile': isPhone }"
          data-testid="control-actions-slot"
        >
          <ControlActionButtons
            :target="currentTarget"
            :mobile="isPhone"
            :primary-action-label="primaryActionLabel"
            :mode-text="currentTargetModeText"
            :features="controlFeatureItems"
            :batch-selected-count="batchSelectedTargets.length"
            :batch-busy="isBatchOperating"
            @start="startCurrentTarget"
            @stop="handleStopCurrentTarget"
            @restart="handleRestartCurrentTarget"
            @terminate="handleTerminateCurrentTarget"
            @batch-operation="handleBatchOperation"
            @clear-batch-selection="clearBatchSelection"
          />
        </div>
      </div>

      <section v-else class="control-panel control-console__empty-panel">
        <a-empty :description="t('TXT_CODE_CONTROL_NO_NODES')" />
      </section>
    </OperationsPageShell>

    <button
      v-if="currentTarget && isSummaryCollapsed"
      type="button"
      class="control-console__summary-restore-rail"
      data-testid="control-summary-restore-rail"
      :title="t('TXT_CODE_CONTROL_SHOW_SUMMARY')"
      :aria-label="t('TXT_CODE_CONTROL_SHOW_SUMMARY')"
      @click="showSummary"
    >
      <EyeOutlined />
    </button>

    <OperationsMobileNav
      v-if="shellRef?.isPhone && OPERATIONS_MOBILE_NAV_ITEMS.length"
      :items="OPERATIONS_MOBILE_NAV_ITEMS"
      class="control-console__mobile-nav"
    />

    <a-drawer
      v-if="isPhone"
      placement="bottom"
      :height="'78vh'"
      :open="isMobileSelectorOpen"
      :title="mobileSelectorTitle"
      data-testid="control-mobile-drawer"
      @close="closeMobileSelector"
    >
      <ControlTargetSelector
        drawer
        :nodes="nodes"
        :current-node-id="currentNode?.daemonId"
        :current-targets="orderedCurrentTargets"
        :current-target-key="currentTargetKey"
        :favorite-target-keys="favoriteTargetKeys"
        :selected-target-keys="batchSelectedTargetKeys"
        :target-notes="targetNotes"
        :target-filter-daemon-id="targetFilterDaemonId"
        :all-targets-filter-value="ALL_CONTROL_TARGETS_FILTER"
        :batch-selection-enabled="isAdmin"
        @select-target="handleSelectTarget"
        @toggle-batch-selection="handleToggleBatchSelection"
        @toggle-visible-batch-selection="handleToggleVisibleBatchSelection"
        @toggle-favorite="handleToggleFavoriteTarget"
        @change-target-filter="handleChangeTargetFilter"
        @edit-target-note="handleEditTargetNote"
      />
    </a-drawer>

    <a-modal
      v-model:open="isPlayerModalOpen"
      :title="currentPlayer ? `${currentPlayer.playerName} / ${t('TXT_CODE_GM_MANAGEMENT')}` : t('TXT_CODE_GM_MANAGEMENT')"
      :footer="null"
      :width="isPhone ? 'calc(100vw - 16px)' : 960"
      destroy-on-close
      centered
      :body-style="{ maxHeight: isPhone ? '78svh' : '80vh', overflowY: 'auto', padding: isPhone ? '12px' : '20px' }"
      @cancel="closePlayerModal"
    >
      <div data-testid="control-player-modal">
        <a-alert
          v-if="playerPanelError"
          class="control-console__player-modal-alert"
          type="error"
          show-icon
          :message="playerPanelError"
        />

        <GmOperationsPanel
          :player="currentPlayer"
          :server="currentPlayerServer"
          :balances="balances"
          :luck-perms="luckPerms"
          :moderation="moderation"
          :inventory="inventory"
          :audit-records="auditRecords"
          :last-action-result="lastActionResult"
          :show-inventory="true"
          :inventory-loading="isInventoryLoading"
          :busy="isExecutingAction || isDetailLoading"
          :on-execute="executePlayerAction"
          :on-refresh-inventory="() => loadInventory(true)"
        />
      </div>
    </a-modal>

    <a-modal
      :open="Boolean(activeFeatureModal)"
      :title="activeFeatureModal?.title"
      :footer="null"
      :width="1200"
      destroy-on-close
      centered
      :body-style="{ padding: '12px 16px 16px', overflow: 'hidden' }"
      @cancel="closeControlFeatureModal"
    >
      <div class="control-console__feature-modal-body">
        <component
          :is="currentFeatureModalComponent"
          v-if="activeFeatureModal && currentFeatureModalComponent"
          :key="activeFeatureModal.card.id"
          :card="activeFeatureModal.card"
          :preview="isLocalPreviewMode"
        />
      </div>
    </a-modal>

    <TermConfig
      ref="terminalConfigDialog"
      :instance-info="currentInstanceDetail"
      :instance-id="currentTarget?.mode === 'instance' ? currentTarget.instanceId : ''"
      :daemon-id="currentTarget?.mode === 'instance' ? currentTarget.daemonId : ''"
      @update="() => void refreshCurrentInstanceDetail(true)"
    />

    <EventConfig
      ref="eventConfigDialog"
      :instance-info="currentInstanceDetail"
      :instance-id="currentTarget?.mode === 'instance' ? currentTarget.instanceId : ''"
      :daemon-id="currentTarget?.mode === 'instance' ? currentTarget.daemonId : ''"
      @update="() => void refreshCurrentInstanceDetail(true)"
    />

    <JavaManager
      ref="javaManagerDialog"
      :instance-info="currentInstanceDetail"
      :instance-id="currentTarget?.mode === 'instance' ? currentTarget.instanceId : ''"
      :daemon-id="currentTarget?.mode === 'instance' ? currentTarget.daemonId : ''"
    />

    <RconSettings
      ref="rconSettingsDialog"
      :instance-info="currentInstanceDetail"
      :instance-id="currentTarget?.mode === 'instance' ? currentTarget.instanceId : ''"
      :daemon-id="currentTarget?.mode === 'instance' ? currentTarget.daemonId : ''"
      @update="() => void refreshCurrentInstanceDetail(true)"
    />

    <McPingSettings
      ref="mcPingSettingsDialog"
      :instance-info="currentInstanceDetail"
      :instance-id="currentTarget?.mode === 'instance' ? currentTarget.instanceId : ''"
      :daemon-id="currentTarget?.mode === 'instance' ? currentTarget.daemonId : ''"
      @update="() => void refreshCurrentInstanceDetail(true)"
    />

    <InstanceDetailDialog
      ref="instanceDetailDialog"
      :instance-info="currentInstanceDetail"
      :instance-id="currentTarget?.mode === 'instance' ? currentTarget.instanceId : ''"
      :daemon-id="currentTarget?.mode === 'instance' ? currentTarget.daemonId : ''"
      @update="() => void refreshCurrentInstanceDetail(true)"
    />

    <InstanceFundamentalDetail
      ref="instanceFundamentalDetailDialog"
      :instance-info="currentInstanceDetail"
      :instance-id="currentTarget?.mode === 'instance' ? currentTarget.instanceId : ''"
      :daemon-id="currentTarget?.mode === 'instance' ? currentTarget.daemonId : ''"
      @update="() => void refreshCurrentInstanceDetail(true)"
    />
  </div>
</template>

<style lang="scss" scoped>
.control-console {
  :deep(.ops-page-shell) {
    background:
      radial-gradient(circle at top left, rgba(64, 150, 255, 0.18), transparent 34%),
      radial-gradient(circle at top right, rgba(22, 163, 74, 0.12), transparent 28%),
      var(--background-color);
  }
}

.control-console__mobile-nav {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 100;
}

.control-console__desktop-toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 0 0 4px;
}

.control-console__desktop-toolbar-main,
.control-console__desktop-toolbar-actions,
.control-console__desktop-toolbar-pills {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.control-console__desktop-toolbar-main {
  flex: 1;
  justify-content: space-between;
}

.control-console__desktop-toolbar-title-wrap {
  min-width: 0;
}

.control-console__desktop-toolbar-eyebrow {
  color: var(--color-gray-7);
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.control-console__desktop-toolbar-title {
  margin-top: 4px;
  font-size: 28px;
  font-weight: 700;
  line-height: 1.1;
  color: var(--color-gray-13);
}

.control-console__header-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 10px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(8px);
  font-size: 13px;
}

.control-console__header-pill span {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.control-console__header-pill--accent {
  background: rgba(59, 130, 246, 0.18);
}

.control-console__mode-tag {
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
  color: var(--color-always-white);
}

.control-console__desktop-toolbar .control-console__header-pill {
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid rgba(148, 163, 184, 0.16);
  color: var(--color-gray-12);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.05);
}

.control-console__desktop-toolbar .control-console__header-pill--accent {
  background: rgba(59, 130, 246, 0.12);
}

.control-console__desktop-toolbar .control-console__mode-tag {
  background: rgba(37, 99, 235, 0.12);
  color: var(--color-primary);
}

.control-console__mobile-switcher {
  padding: 10px 12px 0;
}

.control-console__mobile-switcher-card {
  width: 100%;
  padding: 14px 16px;
  border: 1px solid rgba(59, 130, 246, 0.16);
  border-radius: 18px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(241, 245, 249, 0.94));
  box-shadow:
    0 16px 36px rgba(15, 23, 42, 0.08),
    0 2px 8px rgba(15, 23, 42, 0.04);
  text-align: left;
  color: inherit;
}

.control-console__mobile-switcher-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.control-console__mobile-switcher-copy {
  min-width: 0;
  flex: 1;
}

.control-console__mobile-switcher-eyebrow {
  color: var(--color-gray-7);
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.control-console__mobile-switcher-value {
  margin-top: 6px;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.2;
  word-break: break-word;
}

.control-console__mobile-switcher-desc {
  margin-top: 4px;
  color: var(--color-gray-7);
  font-size: 12px;
  word-break: break-all;
}

.control-console__mobile-switcher-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 12px;
  background: rgba(59, 130, 246, 0.12);
  color: var(--color-blue-6);
  font-size: 18px;
  flex-shrink: 0;
}

.control-console__mobile-switcher-tags {
  margin-top: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.control-console__workspace {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  overflow: hidden;
}

.control-console__workspace--mobile {
  gap: 12px;
  height: auto;
  overflow: visible;
}

@media (min-width: 993px) {
  .control-console :deep(.ops-page-shell--desktop-embedded .ops-page-shell__shell),
  .control-console :deep(.ops-page-shell--desktop-embedded .ops-page-shell__workspace) {
    overflow: visible;
  }

  .control-console__workspace {
    display: grid;
    grid-template-columns: minmax(0, 3fr) minmax(420px, 1fr);
    grid-template-rows: minmax(520px, calc(100svh - 360px)) auto;
    grid-template-areas:
      "terminal summary"
      "actions summary";
    align-items: stretch;
    height: auto;
    min-height: calc(100svh - 180px);
    overflow: visible;
    transition:
      grid-template-columns 0.24s ease,
      column-gap 0.24s ease;
  }

  .control-console__workspace--summary-collapsed {
    grid-template-columns: minmax(0, 1fr) 0;
    column-gap: 0;
  }

  .control-panel--summary-orderable {
    grid-area: summary;
    height: 100%;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    min-width: 0;
    transition:
      opacity 0.22s ease,
      transform 0.24s ease,
      border-color 0.22s ease,
      box-shadow 0.22s ease;
    transform-origin: right center;
  }

  .control-panel--summary-collapsed {
    width: 0;
    opacity: 0;
    pointer-events: none;
    overflow: hidden;
    transform: translateX(18px);
    border-color: transparent;
    border-width: 0;
    box-shadow: none;
    padding-bottom: 0;
  }

  .control-panel--terminal-orderable {
    grid-area: terminal;
  }

  .control-console__actions-slot {
    grid-area: actions;
  }

  .control-console__summary-meta {
    min-width: 0;
    width: 100%;
  }
}

.control-panel {
  min-height: 0;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 20px;
  background: var(--background-color-white);
  box-shadow:
    0 16px 36px rgba(15, 23, 42, 0.08),
    0 2px 8px rgba(15, 23, 42, 0.04);
}

.control-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 18px 12px;
  font-weight: 700;
}

.control-panel--summary {
  padding-bottom: 14px;
  flex-shrink: 0;
}

.control-console__summary-tags {
  display: inline-flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.control-console__summary-header-actions {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  min-width: 0;
}

.control-console__summary-toggle-button {
  flex-shrink: 0;
}

.control-console__summary-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 0 18px 12px;
}

.control-console__summary-copy {
  min-width: 0;
  flex: 1;
}

.control-console__summary-kicker {
  color: var(--color-gray-7);
  font-size: 12px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.control-console__summary-title {
  margin-top: 6px;
  font-size: 22px;
  font-weight: 700;
  line-height: 1.1;
}

.control-console__summary-desc {
  margin: 10px 0 0;
  color: var(--color-gray-8);
  line-height: 1.55;
  overflow-wrap: anywhere;
}

.control-console__summary-meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  min-width: min(100%, 380px);
}

.control-console__summary-meta-item {
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(241, 245, 249, 0.92);
}

.control-console__summary-meta-label,
.control-console__metric-label,
.control-console__metric-detail {
  color: var(--color-gray-7);
  font-size: 11px;
}

.control-console__summary-meta-label,
.control-console__metric-label {
  display: block;
}

.control-console__summary-meta-value {
  display: block;
  margin-top: 6px;
  word-break: break-all;
}

@media (min-width: 993px) {
  .control-console__summary-top {
    flex-direction: column;
    align-items: stretch;
  }

  .control-console__summary-copy {
    width: 100%;
  }

  .control-console__summary-title {
    font-size: 28px;
  }

  .control-console__summary-desc {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 4;
    overflow: hidden;
  }

  .control-console__summary-meta {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .control-console__metrics-grid.control-console__metrics-grid--instance {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .control-console__metrics-grid.control-console__metrics-grid--global {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .control-console__metric-card {
    min-height: 112px;
    padding: 14px;
  }

  .control-console__metrics-grid.control-console__metrics-grid--instance .control-console__metric-card--segmented {
    grid-column: 1 / -1;
    grid-row: 2;
  }

  .control-console__metrics-grid.control-console__metrics-grid--global .control-console__metric-card {
    min-height: 124px;
  }

  .control-console__metrics-grid.control-console__metrics-grid--global .control-console__metric-value {
    font-size: 22px;
    line-height: 1.12;
  }

  .control-console__metrics-grid.control-console__metrics-grid--global .control-console__metric-detail {
    font-size: 12px;
  }

  .control-console__metrics-grid.control-console__metrics-grid--instance .control-console__metric-card--players {
    grid-column: 3;
    grid-row: 1;
  }

  .control-console__metric-value {
    font-size: 24px;
    line-height: 1.08;
  }

  .control-console__metrics-grid.control-console__metrics-grid--instance .control-console__metric-card--memory .control-console__metric-value {
    font-size: 20px;
    line-height: 1.06;
  }

  .control-console__metrics-grid.control-console__metrics-grid--instance .control-console__metric-card--players .control-console__metric-value {
    font-size: 26px;
  }

  .control-console__metric-detail {
    white-space: normal;
    line-height: 1.4;
  }

  .control-console__metric-segments {
    gap: 8px;
  }

  .control-console__metric-segment {
    padding: 8px 10px;
  }
}

.control-console__metrics-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  padding: 0 18px;
}

.control-console__metric-card {
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 104px;
  padding: 14px;
  border: 1px solid rgba(148, 163, 184, 0.15);
  border-radius: 16px;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.95) 0%,
    rgba(248, 250, 252, 0.92) 100%
  );
  box-shadow:
    0 4px 12px rgba(15, 23, 42, 0.04),
    0 1px 3px rgba(15, 23, 42, 0.02);
  --metric-accent: rgba(59, 130, 246, 0.35);
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.control-console__metric-card:hover {
  transform: translateY(-2px);
  box-shadow:
    0 8px 24px rgba(15, 23, 42, 0.08),
    0 2px 6px rgba(15, 23, 42, 0.04);
}

.control-console__metric-card::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--metric-accent);
  border-radius: 16px 16px 0 0;
}

.control-console__metric-card.is-success {
  --metric-accent: rgba(22, 163, 74, 0.78);
}

.control-console__metric-card.is-warning {
  --metric-accent: rgba(245, 158, 11, 0.82);
}

.control-console__metric-card.is-danger {
  --metric-accent: rgba(239, 68, 68, 0.78);
}

.control-console__metric-card.is-muted {
  --metric-accent: rgba(148, 163, 184, 0.72);
}

.control-console__metric-value {
  margin-top: auto;
  font-size: 22px;
  font-weight: 700;
  line-height: 1;
}

.control-console__metric-card.is-success .control-console__metric-value {
  color: #15803d;
}

.control-console__metric-card.is-warning .control-console__metric-value {
  color: #b45309;
}

.control-console__metric-card.is-danger .control-console__metric-value {
  color: #b91c1c;
}

.control-console__metric-card.is-muted .control-console__metric-value {
  color: var(--color-gray-6);
}

.control-console__metric-segments {
  margin-top: auto;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.control-console__metric-segment {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 4px;
  min-width: 0;
  padding: 6px 8px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.52);
}

.control-console__metric-segment-label {
  color: var(--color-gray-7);
  font-size: 10px;
  line-height: 1;
}

.control-console__metric-segment-value {
  font-size: 15px;
  font-weight: 700;
  line-height: 1;
}

.control-console__metric-card.is-success .control-console__metric-segment-value {
  color: #15803d;
}

.control-console__metric-card.is-warning .control-console__metric-segment-value {
  color: #b45309;
}

.control-console__metric-card.is-danger .control-console__metric-segment-value {
  color: #b91c1c;
}

.control-console__metric-card.is-muted .control-console__metric-segment-value {
  color: var(--color-gray-6);
}

.control-console__metric-detail {
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.control-console__players-section {
  margin-top: 14px;
  padding: 0 18px;
}

.control-console__players-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
  font-weight: 700;
}

.control-console__players-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.control-console__player-chip {
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 14px;
  background: rgba(248, 250, 252, 0.92);
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    transform 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}

.control-console__player-chip:hover {
  transform: translateY(-1px);
  border-color: rgba(59, 130, 246, 0.26);
  box-shadow: 0 10px 24px rgba(59, 130, 246, 0.08);
}

.control-console__player-name,
.control-console__player-meta {
  display: block;
}

.control-console__player-name {
  font-weight: 700;
  line-height: 1.3;
}

.control-console__player-meta {
  margin-top: 4px;
  color: var(--color-gray-7);
  font-size: 12px;
}

.control-console__player-modal-alert {
  margin-bottom: 14px;
}

.control-console__batch-confirm {
  display: grid;
  gap: 10px;
}

.control-console__batch-confirm-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 220px;
  overflow-y: auto;
}

.control-console__batch-confirm-item {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 6px 8px;
  border-radius: 8px;
  background: rgba(148, 163, 184, 0.1);
}

.control-console__batch-confirm-more {
  color: var(--color-gray-7);
  font-size: 12px;
}

.control-console__feature-modal-body {
  height: 72vh;
  min-height: 620px;
}

.control-panel--terminal {
  flex: 1 1 auto;
  min-height: 0;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto auto;
  overflow: hidden;
}

.control-console__terminal-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 18px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.18);
}

.control-console__terminal-title {
  font-weight: 700;
}

.control-console__terminal-heading {
  display: flex;
  align-items: baseline;
  gap: 10px;
  min-width: 0;
  flex-wrap: wrap;
}

.control-console__terminal-meta {
  color: var(--color-gray-7);
  font-size: 12px;
  line-height: 1.4;
}

.control-console__terminal-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.control-console__terminal-search {
  width: 180px;
}

.control-console__terminal-search :deep(.ant-input) {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(148, 163, 184, 0.18);
  color: #dbeafe;
}

.control-console__terminal-search :deep(.ant-input::placeholder) {
  color: rgba(191, 219, 254, 0.45);
}

.control-console__log-level-filters {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 18px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.12);
  background: rgba(255, 255, 255, 0.02);
}

.control-console__terminal-body-wrap {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  background: linear-gradient(180deg, #0a1628 0%, #0f2137 100%);
  border-radius: 0 0 20px 20px;
}

.control-console__log-level-filter {
  flex-shrink: 0;
}

.control-console__log-level-filter :deep(.ant-segmented-item) {
  color: rgba(191, 219, 254, 0.7);
}

.control-console__log-level-filter :deep(.ant-segmented-item-selected) {
  background: rgba(59, 130, 246, 0.3);
  color: #fff;
}

.control-console__terminal-body {
  position: relative;
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  padding: 16px 18px;
  color: #dbeafe;
  font-family:
    Consolas, "SFMono-Regular", Menlo, Monaco, "Liberation Mono", "Courier New", monospace;
}

.control-console__terminal-body :deep(.ant-empty) {
  padding-top: 48px;
}

.control-console__terminal-body :deep(.ant-empty-description) {
  color: rgba(191, 219, 254, 0.6);
}

.terminal-line {
  display: grid;
  grid-template-columns: 78px minmax(0, 1fr);
  gap: 12px;
  padding: 6px 0;
  font-size: 13px;
  line-height: 1.55;
}

.terminal-line__time {
  color: rgba(148, 163, 184, 0.6);
  font-size: 12px;
}

.terminal-line__text {
  word-break: break-word;
  white-space: pre-wrap;
}

.terminal-line--warn .terminal-line__text {
  color: #fbbf24;
  font-weight: 500;
}

.terminal-line--error .terminal-line__text {
  color: #f87171;
  font-weight: 600;
}

.terminal-line--command .terminal-line__text {
  color: #4ade80;
  font-weight: 500;
}

.control-console__terminal-empty {
  padding-top: 48px;
}

.control-console__terminal-input {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  padding: 16px 18px 18px;
  border-top: 1px solid rgba(148, 163, 184, 0.18);
}

.control-console__empty-panel {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.control-panel--summary-orderable {
  order: 1;
}

.control-panel--terminal-orderable {
  order: 2;
}

.control-console__actions-slot {
  order: 3;
  flex-shrink: 0;
}

@media (max-width: 992px) {
  .control-console__header-pill span {
    max-width: 120px;
  }

  .control-panel__header,
  .control-console__terminal-toolbar,
  .control-console__terminal-input {
    padding-right: 14px;
    padding-left: 14px;
  }

  .control-console__summary-top {
    flex-direction: column;
    padding-right: 14px;
    padding-left: 14px;
  }

  .control-console__metrics-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    padding-right: 14px;
    padding-left: 14px;
  }

  .control-console__players-section {
    padding-right: 14px;
    padding-left: 14px;
  }

  .control-console__summary-meta {
    min-width: 0;
    width: 100%;
  }

  .control-console__metric-card {
    min-height: 96px;
  }

  .control-console__metric-value {
    font-size: 20px;
  }

  .control-console__terminal-toolbar {
    flex-direction: column;
    align-items: flex-start;
  }

  .control-console__terminal-heading {
    width: 100%;
  }

  .control-console__terminal-actions {
    justify-content: flex-start;
  }

  .control-console__terminal-input {
    grid-template-columns: 1fr;
  }

  .terminal-line {
    grid-template-columns: 1fr;
    gap: 2px;
  }
}

.control-panel--summary-mobile {
  padding-bottom: 10px;
  order: 3;
}

.control-console__summary-top--mobile {
  padding-bottom: 10px;
}

.control-console__metrics-grid--mobile {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.control-console__metrics-grid--mobile .control-console__metric-card {
  min-height: 88px;
  padding: 10px;
  gap: 5px;
}

.control-console__metrics-grid--mobile .control-console__metric-value {
  font-size: 18px;
}

.control-console__metrics-grid--mobile .control-console__metric-label,
.control-console__metrics-grid--mobile .control-console__metric-detail,
.control-console__metrics-grid--mobile .control-console__metric-segment-label {
  font-size: 11px;
}

.control-console__metrics-grid--mobile .control-console__metric-segment-value {
  font-size: 13px;
}

.control-console__metrics-grid--mobile .control-console__metric-detail {
  margin-top: 2px;
}

.control-console__summary-top--mobile .control-console__summary-title {
  margin-top: 0;
  font-size: 18px;
}

.control-panel--terminal-mobile {
  order: 1;
  height: clamp(420px, 58svh, 640px);
  min-height: clamp(420px, 58svh, 640px);
  max-height: clamp(420px, 58svh, 640px);
}

.control-console__actions-slot--mobile {
  order: 2;
}

.control-console__terminal-actions--mobile {
  padding: 0 14px 14px;
  justify-content: flex-start;
}

.control-console__terminal-body--mobile {
  min-height: 0;
  height: 100%;
  overscroll-behavior-y: auto;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-y;
}

.control-console__metrics-grid--mobile + .control-console__players-section {
  margin-top: 12px;
}

.control-console__summary-restore-rail {
  position: fixed;
  top: 50%;
  right: 0;
  z-index: 40;
  width: 36px;
  height: 104px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 16px 0 0 16px;
  background: linear-gradient(180deg, rgba(37, 99, 235, 0.92), rgba(29, 78, 216, 0.96));
  color: var(--color-always-white);
  box-shadow:
    0 12px 28px rgba(37, 99, 235, 0.22),
    0 2px 6px rgba(15, 23, 42, 0.08);
  cursor: pointer;
  transform: translateY(-50%);
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    background 0.18s ease;
}

.control-console__summary-restore-rail:hover {
  transform: translate(-4px, -50%);
  box-shadow:
    0 16px 32px rgba(37, 99, 235, 0.28),
    0 4px 10px rgba(15, 23, 42, 0.12);
}

.control-console__summary-restore-rail:focus-visible {
  outline: 2px solid rgba(147, 197, 253, 0.95);
  outline-offset: 2px;
}
</style>
