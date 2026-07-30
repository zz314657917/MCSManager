<script setup lang="ts">
import OperationsPageShell from "@/components/operations/OperationsPageShell.vue";
import {
  type PlayerInteractionPreviewPresence,
  usePlayerInteractionPreviewState
} from "@/hooks/usePlayerInteractionPreviewState";
import { t } from "@/lang/i18n";
import type { PlayerBindingStatus, PlayerChatMessage } from "@/types/player-interaction";
import {
  CloudServerOutlined,
  LockOutlined,
  MessageOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  UserOutlined
} from "@ant-design/icons-vue";
import { computed } from "vue";

const { players, selectedPlayerUuid, currentPlayer, currentMessages, selectPlayer } =
  usePlayerInteractionPreviewState();

const bindingSteps = computed(() => [
  t("TXT_CODE_PLAYERS_STEP_QQ"),
  t("TXT_CODE_PLAYERS_STEP_CODE"),
  t("TXT_CODE_PLAYERS_STEP_CONFIRM")
]);

const currentRoleCode = computed(() => currentPlayer.value?.roleCode || "--");

const getBindingColor = (player: PlayerInteractionPreviewPresence) => {
  if (player.accessMode === "admin") return "blue";
  if (player.bindingState.status === "bound") return "green";
  if (player.bindingState.status === "pending") return "gold";
  return "default";
};

const getBindingText = (player: PlayerInteractionPreviewPresence) => {
  if (player.accessMode === "admin") return t("TXT_CODE_PLAYERS_ADMIN");
  if (player.bindingState.status === "bound") return t("TXT_CODE_PLAYERS_BIND_BOUND");
  if (player.bindingState.status === "pending") return t("TXT_CODE_PLAYERS_BIND_PENDING");
  return t("TXT_CODE_PLAYERS_BIND_REQUIRED");
};

const getAccessText = (player: PlayerInteractionPreviewPresence) => {
  return player.accessMode === "admin"
    ? t("TXT_CODE_PLAYERS_ADMIN_DIRECT")
    : t("TXT_CODE_PLAYERS_COMPOSER_LOCKED");
};

const getMessageClass = (message: PlayerChatMessage) => `players-console__message--${message.senderType}`;

const isSelected = (playerUuid: string) => selectedPlayerUuid.value === playerUuid;

const handleSelectPlayer = (playerUuid: string) => {
  selectPlayer(playerUuid);
};

const getBindingToneClass = (status: PlayerBindingStatus) => {
  if (status === "bound") return "is-success";
  if (status === "pending") return "is-warning";
  return "is-muted";
};
</script>

<template>
  <div class="players-console" data-testid="players-console">
    <OperationsPageShell
      :title="t('TXT_CODE_PLAYERS_TITLE')"
      :eyebrow="t('TXT_CODE_PLAYERS_EYEBROW')"
      :back-label="t('TXT_CODE_CONTROL_TITLE')"
      fallback-back-to="/control"
    >
      <template #header-actions="{ isPhone }">
        <template v-if="currentPlayer && !isPhone">
          <div class="players-console__header-pill">
            <CloudServerOutlined />
            <span>{{ currentPlayer.daemonDisplayName }}</span>
          </div>
          <div class="players-console__header-pill players-console__header-pill--accent">
            <UserOutlined />
            <span>{{ currentPlayer.playerName }}</span>
          </div>
          <a-tag class="players-console__mode-tag" :bordered="false">
            {{ t("TXT_CODE_CONTROL_SOURCE_PREVIEW") }}
          </a-tag>
        </template>

        <a-tag v-else class="players-console__mode-tag" :bordered="false">
          {{ t("TXT_CODE_CONTROL_SOURCE_PREVIEW") }}
        </a-tag>
      </template>

      <template #sidebar>
        <section class="player-panel player-panel--list">
          <div class="player-panel__header">
            <span>{{ t("TXT_CODE_PLAYERS_ONLINE") }}</span>
            <a-tag>{{ players.length }}</a-tag>
          </div>

          <div class="players-console__player-list">
            <button
              v-for="player in players"
              :key="player.playerUuid"
              type="button"
              class="players-console__player-card"
              :class="{ 'is-active': isSelected(player.playerUuid) }"
              @click="handleSelectPlayer(player.playerUuid)"
            >
              <div class="players-console__player-main">
                <div class="players-console__player-avatar">
                  {{ player.playerName.slice(0, 1) }}
                </div>
                <div class="players-console__player-copy">
                  <div class="players-console__player-title-row">
                    <strong class="players-console__player-name">{{ player.playerName }}</strong>
                    <a-badge :status="player.online ? 'success' : 'default'" />
                  </div>
                  <div class="players-console__player-subtitle">
                    {{ player.instanceDisplayName }}
                  </div>
                </div>
              </div>

              <div class="players-console__player-tags">
                <a-tag :color="getBindingColor(player)">
                  {{ getBindingText(player) }}
                </a-tag>
              </div>

              <div class="players-console__player-meta">
                <span>{{ player.daemonDisplayName }}</span>
                <span>{{ t("TXT_CODE_PLAYERS_LAST_SEEN") }} {{ player.lastSeenAt }}</span>
              </div>
            </button>
          </div>
        </section>
      </template>

      <div class="players-console__workspace">
        <section v-if="currentPlayer" class="player-panel player-panel--summary">
          <div class="player-panel__header">
            <span>{{ t("TXT_CODE_CONTROL_SUMMARY") }}</span>
            <div class="players-console__summary-tags">
              <a-tag :color="getBindingColor(currentPlayer)">
                {{ getBindingText(currentPlayer) }}
              </a-tag>
              <a-tag :bordered="false">
                {{ t("TXT_CODE_PLAYERS_RESERVED") }}
              </a-tag>
            </div>
          </div>

          <div class="players-console__summary-top">
            <div class="players-console__summary-copy">
              <div class="players-console__summary-kicker">
                {{ currentPlayer.daemonDisplayName }} / {{ currentPlayer.instanceDisplayName }}
              </div>
              <div class="players-console__summary-title">{{ currentPlayer.playerName }}</div>
              <p class="players-console__summary-desc">{{ getAccessText(currentPlayer) }}</p>
            </div>

            <div class="players-console__summary-grid">
              <article class="players-console__summary-card">
                <span class="players-console__summary-label">{{ t("TXT_CODE_PLAYERS_TARGET") }}</span>
                <strong class="players-console__summary-value">{{ currentPlayer.instanceDisplayName }}</strong>
              </article>
              <article class="players-console__summary-card">
                <span class="players-console__summary-label">{{ t("TXT_CODE_PLAYERS_ROLE_CODE") }}</span>
                <strong class="players-console__summary-value">{{ currentRoleCode }}</strong>
              </article>
              <article
                class="players-console__summary-card"
                :class="getBindingToneClass(currentPlayer.bindingState.status)"
              >
                <span class="players-console__summary-label">{{ t("TXT_CODE_PLAYERS_BIND_GATE") }}</span>
                <strong class="players-console__summary-value">{{ getBindingText(currentPlayer) }}</strong>
              </article>
            </div>
          </div>
        </section>

        <section class="player-panel player-panel--chat">
          <div class="players-console__chat-toolbar">
            <div>
              <div class="players-console__chat-title">{{ t("TXT_CODE_PLAYERS_TIMELINE") }}</div>
              <div class="players-console__chat-meta">
                {{ currentPlayer?.instanceDisplayName }} / {{ currentPlayer?.daemonId }}
              </div>
            </div>

            <div class="players-console__chat-toolbar-tags">
              <a-tag color="blue">{{ t("TXT_CODE_PLAYERS_BRIDGE_PLUGIN") }}</a-tag>
              <a-tag>{{ t("TXT_CODE_PLAYERS_CHAT") }}</a-tag>
            </div>
          </div>

          <div class="players-console__chat-body">
            <div
              v-for="message in currentMessages"
              :key="message.id"
              class="players-console__message"
              :class="getMessageClass(message)"
            >
              <div class="players-console__message-meta">
                <span>{{ message.senderName }}</span>
                <span>{{ message.time }}</span>
              </div>
              <div class="players-console__message-bubble">{{ message.text }}</div>
            </div>
          </div>

          <div class="players-console__composer">
            <div class="players-console__composer-note">
              <LockOutlined />
              <span>{{ t("TXT_CODE_PLAYERS_COMPOSER_LOCKED") }}</span>
            </div>
            <div class="players-console__composer-row">
              <a-input :value="''" disabled :placeholder="t('TXT_CODE_PLAYERS_COMPOSER_LOCKED')" />
              <a-button disabled type="primary">{{ t("TXT_CODE_b7cab91d") }}</a-button>
            </div>
          </div>
        </section>

        <section class="player-panel player-panel--bind">
          <div class="player-panel__header">
            <span>{{ t("TXT_CODE_PLAYERS_BIND_GATE") }}</span>
            <a-tag>{{ t("TXT_CODE_PLAYERS_RESERVED") }}</a-tag>
          </div>

          <div class="players-console__bind-grid">
            <article class="players-console__bind-card">
              <div class="players-console__bind-icon">
                <SafetyCertificateOutlined />
              </div>
              <strong>{{ t("TXT_CODE_PLAYERS_ACCESS") }}</strong>
              <p>{{ t("TXT_CODE_PLAYERS_ADMIN_DIRECT") }}</p>
            </article>

            <article
              v-for="step in bindingSteps"
              :key="step"
              class="players-console__bind-card players-console__bind-card--step"
            >
              <div class="players-console__bind-icon">
                <TeamOutlined />
              </div>
              <strong>{{ step }}</strong>
            </article>

            <article class="players-console__bind-card">
              <div class="players-console__bind-icon">
                <MessageOutlined />
              </div>
              <strong>{{ t("TXT_CODE_PLAYERS_BRIDGE_PLUGIN") }}</strong>
              <p>{{ t("TXT_CODE_PLAYERS_BIND_REQUIRED_DESC") }}</p>
            </article>
          </div>
        </section>
      </div>
    </OperationsPageShell>
  </div>
</template>

<style lang="scss" scoped>
.players-console {
  :deep(.ops-page-shell) {
    background: var(--design-canvas);
  }
}

.players-console__header-pill {
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

.players-console__header-pill span {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.players-console__header-pill--accent {
  background: var(--color-blue-1);
}

.players-console__mode-tag {
  padding: 6px 10px;
  border-radius: 999px;
  background: var(--design-surface-strong);
  color: var(--design-ink);
}

.players-console__workspace {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  min-height: 0;
}

.player-panel {
  min-height: 0;
  border: 1px solid var(--design-hairline);
  border-radius: 20px;
  background: var(--design-surface-card);
  box-shadow: none;
  backdrop-filter: blur(10px);
}

.player-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 18px 12px;
  font-weight: 700;
}

.player-panel--list {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.players-console__player-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  padding: 0 14px 16px;
  overflow-y: auto;
}

.players-console__player-card {
  border: 1px solid var(--design-hairline);
  border-radius: 16px;
  padding: 14px;
  background: var(--design-canvas-soft);
  text-align: left;
  cursor: pointer;
  transition:
    transform 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease;
  color: inherit;
}

.players-console__player-card:hover {
  transform: translateY(-1px);
  border-color: var(--color-blue-7);
  box-shadow: none;
}

.players-console__player-card.is-active {
  border-color: var(--color-blue-7);
  box-shadow: inset 0 0 0 1px var(--color-blue-7);
}

.players-console__player-main {
  display: flex;
  align-items: center;
  gap: 12px;
}

.players-console__player-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 14px;
  background: var(--color-blue-1);
  color: var(--color-blue-8);
  font-size: 18px;
  font-weight: 700;
  flex-shrink: 0;
}

.players-console__player-copy {
  min-width: 0;
  flex: 1;
}

.players-console__player-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.players-console__player-name {
  min-width: 0;
  font-size: 15px;
  line-height: 1.25;
}

.players-console__player-subtitle,
.players-console__player-meta,
.players-console__summary-kicker,
.players-console__summary-desc,
.players-console__summary-label,
.players-console__chat-meta,
.players-console__composer-note,
.players-console__bind-card p {
  color: var(--design-muted);
}

.players-console__player-subtitle {
  margin-top: 6px;
  font-size: 12px;
}

.players-console__player-tags {
  margin-top: 12px;
}

.players-console__player-meta {
  margin-top: 10px;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
}

.players-console__summary-tags {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 8px;
}

.players-console__summary-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  padding: 0 18px 18px;
}

.players-console__summary-copy {
  min-width: 0;
  flex: 1;
}

.players-console__summary-kicker {
  font-size: 12px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.players-console__summary-title {
  margin-top: 8px;
  font-size: 24px;
  font-weight: 700;
  line-height: 1.08;
}

.players-console__summary-desc {
  margin: 10px 0 0;
}

.players-console__summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  min-width: min(100%, 520px);
}

.players-console__summary-card {
  padding: 12px;
  border-radius: 16px;
  background: var(--design-canvas-soft);
  border: 1px solid var(--design-hairline-soft);
}

.players-console__summary-card.is-success {
  background: var(--color-green-1);
}

.players-console__summary-card.is-warning {
  background: var(--color-gold-1);
}

.players-console__summary-card.is-muted {
  background: var(--design-canvas-soft);
}

.players-console__summary-label {
  display: block;
  font-size: 11px;
}

.players-console__summary-value {
  display: block;
  margin-top: 8px;
  line-height: 1.3;
}

.player-panel--chat {
  flex: 1 1 auto;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  overflow: hidden;
}

.players-console__chat-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 18px;
  border-bottom: 1px solid var(--design-hairline);
}

.players-console__chat-title {
  font-weight: 700;
}

.players-console__chat-meta {
  margin-top: 4px;
  font-size: 12px;
}

.players-console__chat-toolbar-tags {
  display: inline-flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.players-console__chat-body {
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px;
  background: var(--design-canvas-soft);
}

.players-console__message {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-width: min(72%, 720px);
}

.players-console__message--player {
  align-self: flex-start;
}

.players-console__message--web {
  align-self: flex-end;
}

.players-console__message--system {
  align-self: center;
  width: min(100%, 720px);
  max-width: 100%;
}

.players-console__message-meta {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
  color: var(--design-muted);
}

.players-console__message-bubble {
  padding: 12px 14px;
  border-radius: 16px;
  background: var(--design-surface-strong);
  line-height: 1.55;
  word-break: break-word;
}

.players-console__message--player .players-console__message-bubble {
  background: var(--color-blue-1);
}

.players-console__message--web .players-console__message-bubble {
  background: var(--color-green-1);
}

.players-console__message--system .players-console__message-bubble {
  background: var(--design-canvas-soft);
  border: 1px dashed var(--design-hairline-strong);
  text-align: center;
}

.players-console__composer {
  padding: 16px 18px 18px;
  border-top: 1px solid var(--design-hairline);
}

.players-console__composer-note {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-size: 12px;
}

.players-console__composer-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
}

.players-console__bind-grid {
  display: grid;
  grid-template-columns: 1.2fr repeat(3, minmax(0, 1fr)) 1.2fr;
  gap: 10px;
  padding: 0 18px 18px;
}

.players-console__bind-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 112px;
  padding: 14px;
  border-radius: 16px;
  border: 1px solid var(--design-hairline);
  background: var(--design-canvas-soft);
}

.players-console__bind-card strong {
  line-height: 1.35;
}

.players-console__bind-card p {
  margin: 0;
  line-height: 1.5;
}

.players-console__bind-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 12px;
  background: var(--color-blue-1);
  color: var(--color-blue-8);
  font-size: 16px;
}

@media (max-width: 992px) {
  .players-console__summary-top {
    flex-direction: column;
  }

  .players-console__summary-grid {
    width: 100%;
    min-width: 0;
  }

  .players-console__message {
    max-width: 88%;
  }

  .players-console__bind-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .players-console__workspace {
    gap: 12px;
  }

  .player-panel__header,
  .players-console__chat-toolbar,
  .players-console__composer {
    padding-right: 14px;
    padding-left: 14px;
  }

  .players-console__player-list,
  .players-console__bind-grid,
  .players-console__chat-body,
  .players-console__summary-top {
    padding-right: 14px;
    padding-left: 14px;
  }

  .players-console__summary-title {
    font-size: 20px;
  }

  .players-console__summary-grid {
    grid-template-columns: 1fr;
  }

  .player-panel--chat {
    min-height: clamp(360px, 46svh, 520px);
  }

  .players-console__chat-toolbar {
    flex-direction: column;
    align-items: flex-start;
  }

  .players-console__chat-toolbar-tags {
    justify-content: flex-start;
  }

  .players-console__message,
  .players-console__message--system {
    max-width: 100%;
    width: 100%;
  }

  .players-console__composer-row {
    grid-template-columns: 1fr;
  }

  .players-console__bind-grid {
    grid-template-columns: 1fr;
  }

  .players-console__player-meta {
    flex-direction: column;
    gap: 4px;
  }
}
</style>
