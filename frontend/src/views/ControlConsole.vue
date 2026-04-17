<script setup lang="ts">
import ControlActionButtons from "@/components/control/ControlActionButtons.vue";
import GmOperationsPanel from "@/components/gm/GmOperationsPanel.vue";
import { OPERATIONS_MOBILE_NAV_ITEMS } from "@/components/operations/mobileNav";
import ControlTargetSelector from "@/components/control/ControlTargetSelector.vue";
import OperationsPageShell from "@/components/operations/OperationsPageShell.vue";
import { useControlDashboard } from "@/hooks/useControlDashboard";
import { useControlPanelState } from "@/hooks/useControlPanelState";
import { useControlPlayerPanelPreviewState } from "@/hooks/useControlPlayerPanelPreviewState";
import { useControlPlayerPanelState } from "@/hooks/useControlPlayerPanelState";
import { useControlPreviewState } from "@/hooks/useControlPreviewState";
import { useControlTargetFavorites } from "@/hooks/useControlTargetFavorites";
import { useScreen } from "@/hooks/useScreen";
import { t } from "@/lang/i18n";
import { useAppStateStore } from "@/stores/useAppStateStore";
import { useAppToolsStore } from "@/stores/useAppToolsStore";
import { getControlTargetIdentity, getControlTargetStatusColor, getControlTargetStatusText } from "@/tools/controlStatus";
import type { ControlLogLine, ControlTarget } from "@/types/control";
import { Modal } from "ant-design-vue";
import {
  CloudServerOutlined,
  DesktopOutlined,
  MenuUnfoldOutlined,
  ReloadOutlined,
  SendOutlined,
  TeamOutlined
} from "@ant-design/icons-vue";
import { computed, nextTick, ref, watch } from "vue";
import { useRouter } from "vue-router";

const router = useRouter();
const { isPhone } = useScreen();
const { state: appState } = useAppStateStore();
const { openInputDialog } = useAppToolsStore();
const logBodyRef = ref<HTMLDivElement>();
const isMobileSelectorOpen = ref(false);
const ALL_CONTROL_TARGETS_FILTER = "__all_control_targets__";
const targetFilterDaemonId = ref(ALL_CONTROL_TARGETS_FILTER);

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
  const favoriteTargets: ControlTarget[] = [];
  const groupedTargets: ControlTarget[] = [];

  for (const node of filteredTargetNodes.value) {
    const nodeGlobals: ControlTarget[] = [];
    const nodeInstances: ControlTarget[] = [];

    for (const target of node.targets) {
      if (target.mode === "instance" && isFavoriteTarget(target)) {
        favoriteTargets.push(target);
        continue;
      }

      if (target.mode === "global") {
        nodeGlobals.push(target);
        continue;
      }

      nodeInstances.push(target);
    }

    groupedTargets.push(...nodeGlobals, ...nodeInstances);
  }

  return [...favoriteTargets, ...groupedTargets];
});

const getLogClass = (line: ControlLogLine) => `terminal-line--${line.level}`;

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

const openPlayersPage = () => {
  router.push("/gm");
};

const currentOnlinePlayerCountText = computed(() => `${onlinePlayers.value.length}`);

const handleTerminateCurrentTarget = () => {
  if (currentTarget.value?.mode !== "instance") return;

  Modal.confirm({
    title: t("TXT_CODE_893567ac"),
    content: t("TXT_CODE_ec08484"),
    okText: t("TXT_CODE_7b67813a"),
    cancelText: t("TXT_CODE_5366af54"),
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
</script>

<template>
  <div class="control-console" data-testid="control-console">
    <OperationsPageShell
      :title="t('TXT_CODE_CONTROL_TITLE')"
      :eyebrow="controlEyebrow"
      :back-label="t('TXT_CODE_e21473bc')"
      fallback-back-to="/instances"
      :show-sidebar-on-mobile="false"
      mobile-body-padding-bottom="12px"
      :mobile-nav-items="OPERATIONS_MOBILE_NAV_ITEMS"
    >
      <template #header-actions="{ isPhone: shellIsPhone }">
        <a-button v-if="!shellIsPhone" @click="openPlayersPage">
          <template #icon>
            <TeamOutlined />
          </template>
          <span>GM 管理</span>
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
          :target-notes="targetNotes"
          :target-filter-daemon-id="targetFilterDaemonId"
          :all-targets-filter-value="ALL_CONTROL_TARGETS_FILTER"
          @select-target="handleSelectTarget"
          @toggle-favorite="handleToggleFavoriteTarget"
          @change-target-filter="handleChangeTargetFilter"
          @edit-target-note="handleEditTargetNote"
        />
      </template>

      <div
        v-if="currentTarget"
        class="control-console__workspace"
        :class="{ 'control-console__workspace--mobile': isPhone }"
      >
        <section
          class="control-panel control-panel--summary control-panel--summary-orderable"
          :class="{ 'control-panel--summary-mobile': isPhone }"
          data-testid="control-summary-panel"
        >
          <div class="control-panel__header">
            <span>{{ t("TXT_CODE_CONTROL_SUMMARY") }}</span>
            <div class="control-console__summary-tags">
              <a-tag :color="getControlTargetStatusColor(currentTarget)">
                {{ getControlTargetStatusText(currentTarget) }}
              </a-tag>
              <a-tag :color="dashboardSourceTagColor">
                {{ dashboardSourceText }}
              </a-tag>
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
                outputlog / {{ pollIntervalMs }}ms
              </div>
            </div>
            <div v-if="!isPhone" class="control-console__terminal-actions">
              <a-button size="small" @click="togglePolling">
                {{ isPollingPaused ? t("TXT_CODE_ed3fc23") : t("TXT_CODE_CONTROL_PAUSE") }}
              </a-button>
              <a-button size="small" @click="clearCurrentLogs">{{ t("TXT_CODE_7333c7f7") }}</a-button>
              <a-button size="small" :loading="isRefreshBusy" @click="handleRefresh">
                {{ t("TXT_CODE_REFRESH") }}
              </a-button>
            </div>
          </div>

          <div
            ref="logBodyRef"
            class="control-console__terminal-body"
            :class="{ 'control-console__terminal-body--mobile': isPhone }"
            data-testid="control-terminal-body"
          >
            <template v-if="currentLogs.length > 0">
              <div
                v-for="line in currentLogs"
                :key="line.id"
                class="terminal-line"
                :class="getLogClass(line)"
              >
                <span class="terminal-line__time">{{ line.time }}</span>
                <span class="terminal-line__text">{{ line.text }}</span>
              </div>
            </template>
            <a-empty v-else class="control-console__terminal-empty" :description="t('TXT_CODE_5415f009')" />
          </div>

          <div class="control-console__terminal-input" data-testid="control-terminal-input-row">
            <a-input
              v-model:value="commandInput"
              :disabled="!currentTarget.daemonAvailable"
              :placeholder="commandPlaceholder"
              data-testid="control-command-input"
              @press-enter="sendCommand"
            />
            <a-button
              type="primary"
              :disabled="!commandInput.trim()"
              data-testid="control-command-send"
              @click="sendCommand"
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
            @start="startCurrentTarget"
            @stop="stopCurrentTarget"
            @restart="restartCurrentTarget"
            @terminate="handleTerminateCurrentTarget"
          />
        </div>
      </div>

      <section v-else class="control-panel control-console__empty-panel">
        <a-empty :description="t('TXT_CODE_CONTROL_NO_NODES')" />
      </section>
    </OperationsPageShell>

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
        :target-notes="targetNotes"
        :target-filter-daemon-id="targetFilterDaemonId"
        :all-targets-filter-value="ALL_CONTROL_TARGETS_FILTER"
        @select-target="handleSelectTarget"
        @toggle-favorite="handleToggleFavoriteTarget"
        @change-target-filter="handleChangeTargetFilter"
        @edit-target-note="handleEditTargetNote"
      />
    </a-drawer>

    <a-modal
      v-model:open="isPlayerModalOpen"
      :title="currentPlayer ? `${currentPlayer.playerName} / GM 管理` : 'GM 管理'"
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
  .control-console__workspace {
    display: grid;
    grid-template-columns: minmax(0, 3fr) minmax(420px, 1fr);
    grid-template-rows: minmax(0, 1fr) auto;
    grid-template-areas:
      "terminal summary"
      "actions summary";
    align-items: stretch;
  }

  .control-panel--summary-orderable {
    grid-area: summary;
    height: 100%;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
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
  gap: 10px;
  padding: 0 18px;
}

.control-console__metric-card {
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 104px;
  padding: 12px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 16px;
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.9), rgba(255, 255, 255, 0.98));
  --metric-accent: rgba(59, 130, 246, 0.38);
}

.control-console__metric-card::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 3px;
  background: var(--metric-accent);
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

.control-panel--terminal {
  flex: 1 1 auto;
  min-height: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
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
  justify-content: flex-end;
  gap: 8px;
}

.control-console__terminal-body {
  min-height: 0;
  overflow-y: auto;
  padding: 16px 18px;
  background:
    radial-gradient(circle at top right, rgba(37, 99, 235, 0.12), transparent 32%),
    linear-gradient(180deg, #081120 0%, #0b1526 100%);
  color: #dbeafe;
  font-family:
    Consolas, "SFMono-Regular", Menlo, Monaco, "Liberation Mono", "Courier New", monospace;
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
  color: rgba(191, 219, 254, 0.62);
}

.terminal-line__text {
  word-break: break-word;
  white-space: pre-wrap;
}

.terminal-line--warn .terminal-line__text {
  color: #fde68a;
}

.terminal-line--error .terminal-line__text {
  color: #fca5a5;
}

.terminal-line--command .terminal-line__text {
  color: #86efac;
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
</style>
