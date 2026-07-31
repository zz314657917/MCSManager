<script setup lang="ts">
import GmOperationsPanel from "@/components/gm/GmOperationsPanel.vue";
import GmServerPlayerSidebar from "@/components/gm/GmServerPlayerSidebar.vue";
import { OPERATIONS_MOBILE_NAV_ITEMS } from "@/components/operations/mobileNav";
import OperationsMobileNav from "@/components/operations/OperationsMobileNav.vue";
import OperationsPageShell from "@/components/operations/OperationsPageShell.vue";
import { useGmConsoleState } from "@/hooks/useGmConsoleState";
import { useGmConsolePreviewState } from "@/hooks/useGmConsolePreviewState";
import { useScreen } from "@/hooks/useScreen";
import { useAppStateStore } from "@/stores/useAppStateStore";
import { createGmServerKey, formatGmDateTime } from "@/types/gm";
import {
  AppstoreOutlined,
  CloudServerOutlined,
  MessageOutlined,
  TeamOutlined,
  ReloadOutlined
} from "@ant-design/icons-vue";
import { Segmented as ASegmented } from "ant-design-vue";
import { computed, nextTick, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

const { isPhone } = useScreen();
const route = useRoute();
const router = useRouter();
const { state: appState } = useAppStateStore();
const chatBodyRef = ref<HTMLDivElement>();
const operationsDrawerOpen = ref(false);
const shellRef = ref<InstanceType<typeof OperationsPageShell>>();

const isPreviewQueryEnabled = (value: unknown) => {
  const normalized = Array.isArray(value) ? value[0] : value;
  return ["1", "true", "local", "mock"].includes(String(normalized || "").toLowerCase());
};

const isLocalPreviewMode =
  appState.userInfo?.token === "local-preview-token" ||
  isPreviewQueryEnabled(route.query.preview) ||
  isPreviewQueryEnabled(route.query.localPreview);
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
  isSendingChat,
  latestError,
  selectedServerKey,
  selectedPlayerUuid,
  selectServer,
  selectPlayer,
  refreshCurrent,
  executeAction,
  sendChat
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
const chatMessage = ref("");
const chatTarget = ref<IMcsmGmChatSendRequest["target"]>("broadcast");
const chatTargetOptions = computed(() => [
  { label: "全服", value: "broadcast" },
  {
    label: currentPlayer.value?.online ? `私聊 ${currentPlayer.value.playerName}` : "私聊",
    value: "private",
    disabled: !currentPlayer.value?.online
  }
]);
const canSendChat = computed(
  () =>
    Boolean(currentServer.value?.daemonAvailable) &&
    Boolean(chatMessage.value.trim()) &&
    (chatTarget.value === "broadcast" || Boolean(currentPlayer.value?.online))
);
const chatRecipientText = computed(() =>
  chatTarget.value === "private" && currentPlayer.value?.online
    ? `发送给 ${currentPlayer.value.playerName}`
    : `发送到 ${currentServer.value?.instanceDisplayName || "当前实例"}`
);

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

const openControlPage = () => {
  router.push("/control");
};

const openManagePage = () => {
  router.push("/gm");
};

const handleSendChat = async () => {
  const sent = await sendChat({
    target: chatTarget.value,
    message: chatMessage.value
  });
  if (sent) {
    chatMessage.value = "";
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

watch(
  () => currentPlayer.value?.online,
  (online) => {
    if (!online && chatTarget.value === "private") {
      chatTarget.value = "broadcast";
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
      ref="shellRef"
      :title="pageTitle"
      :eyebrow="pageEyebrow"
      :back-label="backLabel"
      :fallback-back-to="fallbackBackTo"
      sidebar-width="280px"
      :show-sidebar-on-mobile="false"
      mobile-body-padding-bottom="12px"
      :mobile-nav-items="OPERATIONS_MOBILE_NAV_ITEMS"
      :hide-desktop-header="true"
      :hide-mobile-header="true"
      :hide-eyebrow-on-mobile="true"
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

          <a-button :loading="isRefreshing" @click="refreshCurrent(true, true)">
            <template #icon>
              <ReloadOutlined />
            </template>
            <span>刷新</span>
          </a-button>
        </template>
        <a-button v-else :loading="isRefreshing" @click="refreshCurrent(true, true)">
          <template #icon>
            <ReloadOutlined />
          </template>
        </a-button>
      </template>

      <section v-if="!isPhone" class="gm-console-page__desktop-toolbar">
        <div class="gm-console-page__desktop-toolbar-main">
          <div class="gm-console-page__desktop-toolbar-title-wrap">
            <div class="gm-console-page__desktop-toolbar-eyebrow">{{ pageEyebrow }}</div>
            <div class="gm-console-page__desktop-toolbar-title">{{ pageTitle }}</div>
          </div>

          <div v-if="currentServer" class="gm-console-page__desktop-toolbar-pills">
            <div class="gm-console-page__header-pill">
              <CloudServerOutlined />
              <span>{{ currentServer.daemonDisplayName }}</span>
            </div>
            <div class="gm-console-page__header-pill gm-console-page__header-pill--accent">
              <TeamOutlined />
              <span>{{ currentServer.instanceDisplayName }}</span>
            </div>
          </div>
        </div>

        <div class="gm-console-page__desktop-toolbar-actions">
          <a-button v-if="isChatPage" @click="openManagePage">
            <template #icon>
              <TeamOutlined />
            </template>
            <span>玩家管理</span>
          </a-button>
          <a-button v-else @click="openControlPage">
            <template #icon>
              <AppstoreOutlined />
            </template>
            <span>Control</span>
          </a-button>
          <a-button :loading="isRefreshing" @click="refreshCurrent(true, true)">
            <template #icon>
              <ReloadOutlined />
            </template>
            <span>刷新</span>
          </a-button>
        </div>
      </section>

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

            <div class="gm-console__chat-composer">
              <div class="gm-console__chat-composer-controls">
                <ASegmented
                  v-model:value="chatTarget"
                  size="small"
                  :options="chatTargetOptions"
                  data-testid="gm-chat-target"
                />
                <span class="gm-console__chat-recipient">{{ chatRecipientText }}</span>
              </div>
              <a-textarea
                v-model:value="chatMessage"
                class="gm-console__chat-input"
                :auto-size="{ minRows: 1, maxRows: 3 }"
                :maxlength="500"
                placeholder="输入消息"
                :disabled="!currentServer?.daemonAvailable"
                data-testid="gm-chat-input"
                @keydown.ctrl.enter.prevent="handleSendChat"
              />
              <a-button
                type="primary"
                class="gm-console__chat-send"
                :loading="isSendingChat"
                :disabled="!canSendChat"
                data-testid="gm-chat-send"
                @click="handleSendChat"
              >
                <template #icon>
                  <MessageOutlined />
                </template>
                <span>发送</span>
              </a-button>
            </div>
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

    <OperationsMobileNav
      v-if="shellRef?.isPhone && OPERATIONS_MOBILE_NAV_ITEMS.length"
      :items="OPERATIONS_MOBILE_NAV_ITEMS"
      class="gm-console__mobile-nav"
    />

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
    background: var(--design-canvas);
  }
}

.gm-console-page__header-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 10px 12px;
  border-radius: 999px;
  background: var(--design-surface-strong);
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
  background: var(--color-green-1);
}

.gm-console-page__desktop-toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 0 0 4px;
}

.gm-console-page__desktop-toolbar-main,
.gm-console-page__desktop-toolbar-actions,
.gm-console-page__desktop-toolbar-pills {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.gm-console-page__desktop-toolbar-main {
  flex: 1;
  justify-content: space-between;
}

.gm-console-page__desktop-toolbar-title-wrap {
  min-width: 0;
}

.gm-console-page__desktop-toolbar-eyebrow {
  color: var(--design-muted);
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.gm-console-page__desktop-toolbar-title {
  margin-top: 4px;
  font-size: 28px;
  font-weight: 700;
  line-height: 1.1;
  color: var(--design-ink);
}

.gm-console-page__desktop-toolbar .gm-console-page__header-pill {
  background: var(--design-surface-card);
  border: 1px solid var(--design-hairline);
  color: var(--design-ink);
  box-shadow: none;
}

.gm-console-page__desktop-toolbar .gm-console-page__header-pill--accent {
  background: var(--color-green-1);
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
  border: 1px solid var(--design-hairline);
  border-radius: 20px;
  background: var(--design-surface-card);
  box-shadow: none;
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
  color: var(--design-muted);
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
  background: var(--design-canvas-soft);
  border: 1px solid var(--design-hairline-soft);
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
  grid-template-rows: auto minmax(0, 1fr) auto;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
  box-sizing: border-box;
}

.gm-console__chat-panel :deep(.ant-spin) {
  width: 100%;
  max-width: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
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
  border-bottom: 1px solid var(--design-hairline-soft);
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

.gm-console__chat-composer {
  display: grid;
  grid-template-columns: minmax(180px, auto) minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 12px 18px;
  border-top: 1px solid var(--design-hairline-soft);
  background: var(--design-surface-card);
}

.gm-console__chat-composer-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.gm-console__chat-recipient {
  min-width: 0;
  overflow: hidden;
  color: var(--design-muted);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gm-console__chat-input {
  min-width: 0;
  resize: none;
}

.gm-console__chat-send {
  flex: 0 0 auto;
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
  --bubble-bg: var(--color-blue-1);
}

.gm-console__message--gm {
  --bubble-bg: var(--color-green-1);
}

.gm-console__message--system {
  --bubble-bg: var(--design-canvas-soft);
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
  background: var(--bubble-bg, var(--design-canvas-soft));
  border: 1px solid var(--design-hairline-soft);
  line-height: 1.6;
  min-width: 0;
  word-break: break-word;
  overflow-wrap: anywhere;
  box-sizing: border-box;
}

.gm-console__message-icon {
  margin-top: 4px;
  color: var(--design-muted);
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

  .gm-console__chat-composer {
    grid-template-columns: minmax(0, 1fr) auto;
    padding: 12px;
  }

  .gm-console__chat-composer-controls {
    grid-column: 1 / -1;
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

.gm-console__mobile-nav {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 100;
}
</style>
