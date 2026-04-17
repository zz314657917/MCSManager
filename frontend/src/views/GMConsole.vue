<script setup lang="ts">
import GmOperationsPanel from "@/components/gm/GmOperationsPanel.vue";
import GmServerPlayerSidebar from "@/components/gm/GmServerPlayerSidebar.vue";
import { OPERATIONS_MOBILE_NAV_ITEMS } from "@/components/operations/mobileNav";
import OperationsPageShell from "@/components/operations/OperationsPageShell.vue";
import { useGmConsoleState } from "@/hooks/useGmConsoleState";
import { useGmConsolePreviewState } from "@/hooks/useGmConsolePreviewState";
import { useScreen } from "@/hooks/useScreen";
import { useAppStateStore } from "@/stores/useAppStateStore";
import { createGmServerKey, formatGmDateTime } from "@/types/gm";
import {
  CloudServerOutlined,
  MessageOutlined,
  TeamOutlined,
  ReloadOutlined
} from "@ant-design/icons-vue";
import { computed, nextTick, ref, watch } from "vue";
import { useRoute } from "vue-router";

const { isPhone } = useScreen();
const route = useRoute();
const { state: appState } = useAppStateStore();
const chatBodyRef = ref<HTMLDivElement>();
const operationsDrawerOpen = ref(false);

const isLocalPreviewMode = appState.userInfo?.token === "local-preview-token";
const gmState = isLocalPreviewMode ? useGmConsolePreviewState() : useGmConsoleState();

const {
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
  currentServer,
  currentPlayer,
  onlinePlayerCount,
  dependencyState,
  isRefreshing,
  isPlayerLoading,
  isChatLoading,
  isDetailLoading,
  isExecutingAction,
  latestError,
  selectedServerKey,
  selectedPlayerUuid,
  selectServer,
  selectPlayer,
  refreshCurrent,
  executeAction
} = gmState;

const isChatPage = computed(() => route.path === "/gm/chat");
const pageTitle = computed(() => (isChatPage.value ? "聊天" : "玩家管理"));
const fallbackBackTo = computed(() => (isChatPage.value ? "/gm" : "/control"));
const backLabel = computed(() => (isChatPage.value ? "玩家管理" : "Control"));
const pageEyebrow = computed(() =>
  isLocalPreviewMode ? "本地预览 / 仅管理员 / 结构化 GM 操作" : "仅管理员 / 结构化 GM 操作"
);

const currentChatMode = computed(() => {
  if (!currentServer.value) return "--";
  if (!dependencyState.value.chatPluginAvailable) return "聊天不可用";
  return dependencyState.value.chatPluginType === "playerchat" ? "PlayerChat" : "原生回退";
});

const currentControlEndpoint = computed(() => {
  const controller = currentServer.value?.dependencies.controller;
  if (!controller) return "未启用";
  return `${controller.host}:${controller.port}`;
});

const summaryMetrics = computed(() => [
  {
    label: "在线玩家",
    value: String(onlinePlayerCount.value)
  },
  {
    label: "今日聊天",
    value: String(currentServer.value?.chatMessagesToday ?? 0)
  },
  {
    label: "聊天桥接",
    value: currentChatMode.value
  },
  {
    label: "本地控制",
    value: currentControlEndpoint.value
  }
]);

const getMessageClass = (message: IMcsmGmChatMessage) => `gm-console__message--${message.senderType}`;
const getMessageKey = (message: IMcsmGmChatMessage) =>
  `${message.daemonId}:${message.instanceId}:${message.id}`;

const serverLabelMap = computed<Record<string, string>>(() =>
  Object.fromEntries(
    servers.value.map((server) => [
      createGmServerKey(server.daemonId, server.instanceId),
      server.instanceDisplayName
    ])
  )
);

const chatTimelineMeta = computed(() => {
  const playerLabel = currentPlayer.value?.playerName || "未选择玩家";
  return `所有实例汇总 / 当前操作玩家 ${playerLabel}`;
});

const resolveMessageSource = (message: IMcsmGmChatMessage) =>
  serverLabelMap.value[createGmServerKey(message.daemonId, message.instanceId)] ||
  message.instanceId;

const resolveMessageAuthor = (message: IMcsmGmChatMessage) =>
  message.playerName || (message.senderType === "gm" ? "GM" : "系统");

const handleSelectPlayer = (payload: { playerUuid: string; serverKey: string }) => {
  const shouldOpenDrawer =
    selectedPlayerUuid.value !== payload.playerUuid || selectedServerKey.value !== payload.serverKey;
  selectPlayer(payload.playerUuid, payload.serverKey);
  if (isPhone.value && shouldOpenDrawer) {
    operationsDrawerOpen.value = true;
  }
};

watch(
  () => messages.value.length,
  async () => {
    await nextTick();
    if (!chatBodyRef.value) return;
    chatBodyRef.value.scrollTop = chatBodyRef.value.scrollHeight;
  },
  { flush: "post" }
);

watch(
  () => isPhone.value,
  (phone) => {
    if (!phone) {
      operationsDrawerOpen.value = false;
    }
  }
);
</script>

<template>
  <div
    class="gm-console-page"
    data-testid="gm-console"
    :data-page-mode="isChatPage ? 'chat' : 'manage'"
  >
    <OperationsPageShell
      :title="pageTitle"
      :eyebrow="pageEyebrow"
      :back-label="backLabel"
      :fallback-back-to="fallbackBackTo"
      sidebar-width="280px"
      :show-sidebar-on-mobile="false"
      mobile-body-padding-bottom="12px"
      :mobile-nav-items="OPERATIONS_MOBILE_NAV_ITEMS"
    >
      <template #header-actions="{ isPhone: shellIsPhone }">
        <template v-if="!shellIsPhone">
          <template v-if="currentServer">
            <div class="gm-console-page__header-pill">
              <CloudServerOutlined />
              <span>{{ currentServer.daemonDisplayName }}</span>
            </div>
            <div class="gm-console-page__header-pill gm-console-page__header-pill--accent">
              <TeamOutlined />
              <span>{{ currentServer.instanceDisplayName }}</span>
            </div>
          </template>

          <a-button :loading="isRefreshing" @click="refreshCurrent(true)">
            <template #icon>
              <ReloadOutlined />
            </template>
            <span>刷新</span>
          </a-button>
        </template>
        <a-button v-else :loading="isRefreshing" @click="refreshCurrent(true)">
          <template #icon>
            <ReloadOutlined />
          </template>
        </a-button>
      </template>

      <template #sidebar>
        <GmServerPlayerSidebar
          :nodes="nodes"
          :servers="servers"
          :players="players"
          :all-players="allPlayers"
          :selected-server-key="selectedServerKey"
          :selected-player-uuid="selectedPlayerUuid"
          :player-loading="isPlayerLoading"
          @select-server="selectServer"
          @select-player="handleSelectPlayer"
        />
      </template>

      <div class="gm-console">
        <a-alert
          v-if="latestError"
          class="gm-console__alert"
          type="error"
          show-icon
          :message="latestError"
          data-testid="gm-error-alert"
        />

        <section v-if="currentServer && !isPhone" class="gm-console__summary-card">
          <div class="gm-console__summary-top">
            <div class="gm-console__summary-copy">
              <div class="gm-console__summary-kicker">
                {{ currentServer.daemonDisplayName }} / {{ currentServer.daemonEndpoint }}
              </div>
              <div class="gm-console__summary-title">{{ currentServer.instanceDisplayName }}</div>
              <p class="gm-console__summary-desc">
                当前节点 {{ currentServer.daemonAvailable ? "在线" : "离线" }}，
                聊天模式 {{ currentChatMode }}。
              </p>
            </div>

            <div class="gm-console__summary-tags">
              <a-tag :color="currentServer.daemonAvailable ? 'green' : 'default'">
                {{ currentServer.daemonAvailable ? "节点在线" : "节点离线" }}
              </a-tag>
              <a-tag :color="dependencyState.chatPluginAvailable ? 'blue' : 'default'">
                {{ currentChatMode }}
              </a-tag>
              <a-tag :color="dependencyState.luckPermsAvailable ? 'green' : 'default'">LP</a-tag>
            </div>
          </div>

          <div class="gm-console__summary-metrics">
            <article
              v-for="item in summaryMetrics"
              :key="item.label"
              class="gm-console__metric"
            >
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
            </article>
          </div>
        </section>
        <section v-else-if="!isPhone" class="gm-console__summary-card gm-console__summary-card--empty">
          <a-empty :image="false" description="当前没有可用实例，请先选择在线节点。" />
        </section>

        <div
          v-if="!isPhone || isChatPage"
          class="gm-console__workspace"
          :class="{
            'gm-console__workspace--mobile': isPhone,
            'gm-console__workspace--chat-focus': isChatPage && !isPhone
          }"
        >
          <section v-if="!isPhone" class="gm-console__operations">
            <GmOperationsPanel
              :player="currentPlayer"
              :server="currentServer"
              :balances="balances"
              :luck-perms="luckPerms"
              :moderation="moderation"
              :audit-records="auditRecords"
              :last-action-result="lastActionResult"
              :busy="isExecutingAction || isDetailLoading"
              :on-execute="executeAction"
            />
          </section>

          <section class="gm-console__chat-panel" data-testid="gm-chat-panel">
            <div class="gm-console__chat-toolbar">
              <div class="gm-console__chat-toolbar-copy">
                <div class="gm-console__chat-title">全服聊天时间线</div>
                <div class="gm-console__chat-meta">{{ chatTimelineMeta }}</div>
              </div>

              <div class="gm-console__chat-toolbar-actions">
                <a-tag color="blue">全服汇总</a-tag>
                <a-tag>{{ messages.length }} 条</a-tag>
              </div>
            </div>

            <a-spin :spinning="isChatLoading">
              <div ref="chatBodyRef" class="gm-console__chat-body" data-testid="gm-chat-body">
                <template v-if="messages.length">
                  <article
                    v-for="message in messages"
                    :key="getMessageKey(message)"
                    class="gm-console__message"
                    :class="getMessageClass(message)"
                    data-testid="gm-chat-message"
                  >
                    <div class="gm-console__message-meta">
                      <span class="gm-console__message-author">
                        {{ resolveMessageAuthor(message) }}@{{ resolveMessageSource(message) }}
                      </span>
                      <span>{{ formatGmDateTime(message.time) }}</span>
                    </div>
                    <div class="gm-console__message-bubble">
                      <MessageOutlined class="gm-console__message-icon" />
                      <span class="gm-console__message-text">{{ message.text }}</span>
                    </div>
                  </article>
                </template>
                <a-empty v-else :image="false" description="当前还没有聊天记录。" />
              </div>
            </a-spin>
          </section>
        </div>

        <section
          v-if="isPhone && !isChatPage"
          class="gm-console__mobile-player-panel"
          data-testid="gm-mobile-player-panel"
        >
          <GmServerPlayerSidebar
            :nodes="nodes"
            :servers="servers"
            :players="players"
            :all-players="allPlayers"
            mobile-mode
            :selected-server-key="selectedServerKey"
            :selected-player-uuid="selectedPlayerUuid"
            :player-loading="isPlayerLoading"
            @select-server="selectServer"
            @select-player="handleSelectPlayer"
          />
        </section>
      </div>
    </OperationsPageShell>

    <a-drawer
      v-if="isPhone"
      v-model:open="operationsDrawerOpen"
      placement="bottom"
      height="82svh"
      :title="currentPlayer ? `GM 操作 / ${currentPlayer.playerName}` : 'GM 操作'"
    >
      <GmOperationsPanel
        :player="currentPlayer"
        :server="currentServer"
        :balances="balances"
        :luck-perms="luckPerms"
        :moderation="moderation"
        :audit-records="auditRecords"
        :last-action-result="lastActionResult"
        :busy="isExecutingAction || isDetailLoading"
        :on-execute="executeAction"
      />
    </a-drawer>
  </div>
</template>

<style scoped lang="scss">
.gm-console-page {
  width: 100%;
  max-width: 100%;
  overflow-x: hidden;

  :deep(.ops-page-shell) {
    background:
      radial-gradient(circle at top left, rgba(34, 197, 94, 0.12), transparent 32%),
      radial-gradient(circle at top right, rgba(59, 130, 246, 0.12), transparent 26%),
      linear-gradient(180deg, rgba(248, 250, 252, 0.94), rgba(241, 245, 249, 0.98));
  }
}

.gm-console-page__header-pill {
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

.gm-console-page__header-pill span {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gm-console-page__header-pill--accent {
  background: rgba(34, 197, 94, 0.16);
}

.gm-console {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
  height: 100%;
  min-width: 0;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

.gm-console__alert {
  flex-shrink: 0;
}

.gm-console__summary-card,
.gm-console__chat-panel,
.gm-console__operations {
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow:
    0 16px 36px rgba(15, 23, 42, 0.08),
    0 2px 8px rgba(15, 23, 42, 0.04);
}

.gm-console__summary-card {
  padding: 18px;
}

.gm-console__summary-card--empty {
  display: grid;
  min-height: 180px;
  place-items: center;
}

.gm-console__summary-top,
.gm-console__chat-toolbar,
.gm-console__message-meta {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.gm-console__summary-copy {
  min-width: 0;
}

.gm-console__summary-kicker,
.gm-console__summary-desc,
.gm-console__chat-meta,
.gm-console__metric span,
.gm-console__message-meta {
  color: var(--color-gray-7);
}

.gm-console__summary-kicker {
  font-size: 12px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.gm-console__summary-title {
  margin-top: 6px;
  font-size: clamp(22px, 3vw, 30px);
  font-weight: 700;
  line-height: 1.15;
}

.gm-console__summary-desc {
  margin: 10px 0 0;
  line-height: 1.6;
}

.gm-console__summary-tags {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.gm-console__summary-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-top: 16px;
}

.gm-console__metric {
  padding: 12px 14px;
  border-radius: 16px;
  background: rgba(241, 245, 249, 0.88);
  border: 1px solid rgba(148, 163, 184, 0.14);
}

.gm-console__metric strong {
  display: block;
  margin-top: 6px;
  font-size: 17px;
  line-height: 1.35;
  word-break: break-word;
}

.gm-console__workspace {
  display: grid;
  grid-template-columns: minmax(500px, 1.35fr) minmax(320px, 0.72fr);
  gap: 14px;
  min-height: 0;
  flex: 1;
  min-width: 0;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

.gm-console__workspace--mobile {
  grid-template-columns: 1fr;
  min-width: 0;
  width: 100%;
  max-width: 100%;
}

.gm-console__workspace--chat-focus {
  grid-template-columns: minmax(320px, 0.72fr) minmax(500px, 1.35fr);
}

.gm-console__mobile-player-panel {
  min-height: 0;
}

.gm-console__operations,
.gm-console__chat-panel {
  min-height: 0;
  min-width: 0;
}

.gm-console__operations {
  overflow: auto;
}

.gm-console__chat-panel {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  width: 100%;
  max-width: 100%;
  overflow: hidden;
  box-sizing: border-box;
}

.gm-console__chat-panel :deep(.ant-spin) {
  width: 100%;
  max-width: 100%;
}

.gm-console__chat-panel :deep(.ant-spin-nested-loading),
.gm-console__chat-panel :deep(.ant-spin-container) {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  min-width: 0;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

.gm-console__chat-toolbar {
  padding: 16px 18px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.14);
  min-width: 0;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

.gm-console__chat-toolbar-copy {
  min-width: 0;
}

.gm-console__chat-title {
  font-size: 18px;
  font-weight: 700;
}

.gm-console__chat-meta {
  margin-top: 6px;
}

.gm-console__chat-toolbar-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.gm-console__chat-body {
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
  width: 100%;
  max-width: 100%;
  padding: 16px 18px;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior-y: auto;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-y;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-sizing: border-box;
}

.gm-console__message {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  width: 100%;
  max-width: 100%;
}

.gm-console__message--player {
  --bubble-bg: rgba(219, 234, 254, 0.9);
}

.gm-console__message--gm {
  --bubble-bg: rgba(220, 252, 231, 0.92);
}

.gm-console__message--system {
  --bubble-bg: rgba(241, 245, 249, 0.96);
}

.gm-console__message-meta {
  font-size: 12px;
  flex-wrap: wrap;
  line-height: 1.5;
  min-width: 0;
}

.gm-console__message-meta > :first-child {
  flex: 1 1 220px;
  min-width: 0;
}

.gm-console__message-meta > :last-child {
  flex: 0 0 auto;
  max-width: 100%;
}

.gm-console__message-bubble {
  display: inline-flex;
  align-items: flex-start;
  gap: 8px;
  max-width: 100%;
  width: fit-content;
  padding: 10px 12px;
  border-radius: 16px;
  background: var(--bubble-bg, rgba(241, 245, 249, 0.96));
  border: 1px solid rgba(148, 163, 184, 0.14);
  line-height: 1.6;
  min-width: 0;
  word-break: break-word;
  overflow-wrap: anywhere;
  box-sizing: border-box;
}

.gm-console__message-icon {
  margin-top: 4px;
  color: var(--color-gray-7);
}

.gm-console__message-author,
.gm-console__message-text {
  min-width: 0;
  word-break: break-word;
  overflow-wrap: anywhere;
}

@media (max-width: 1200px) {
  .gm-console__summary-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .gm-console__workspace {
    grid-template-columns: minmax(440px, 1.15fr) minmax(300px, 0.85fr);
  }
}

@media (max-width: 768px) {
  .gm-console {
    gap: 12px;
  }

  .gm-console__workspace--mobile {
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 100%;
    min-height: calc(100svh - 108px - env(safe-area-inset-bottom));
    overflow: hidden;
  }

  .gm-console__summary-card {
    padding: 14px;
  }

  .gm-console__summary-top,
  .gm-console__chat-toolbar {
    flex-direction: column;
  }

  .gm-console__summary-tags,
  .gm-console__chat-toolbar-actions {
    justify-content: flex-start;
  }

  .gm-console__summary-title {
    font-size: 24px;
  }

  .gm-console__summary-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .gm-console__chat-panel {
    min-height: 100%;
    height: 100%;
    width: min(100%, calc(100vw - 24px));
    max-width: min(100%, calc(100vw - 24px));
    margin-inline: auto;
  }

  .gm-console__chat-toolbar,
  .gm-console__chat-body {
    padding: 14px;
    overflow-x: hidden;
  }

  .gm-console__chat-toolbar-actions {
    width: 100%;
  }

  .gm-console__message-bubble {
    width: 100%;
    max-width: 100%;
  }
}
</style>
