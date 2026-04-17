<script setup lang="ts">
import { getGmServerKey, groupPlayersByServer } from "@/types/gm";
import { computed, ref } from "vue";

type PlayerSelection = {
  playerUuid: string;
  serverKey: string;
};

const props = withDefaults(
  defineProps<{
    nodes: IMcsmGmOverviewNode[];
    servers: IMcsmGmOverviewServer[];
    players: IMcsmGmPlayerPresence[];
    allPlayers?: IMcsmGmPlayerPresence[];
    selectedServerKey?: string;
    selectedPlayerUuid?: string;
    playerLoading?: boolean;
    mobileMode?: boolean;
  }>(),
  {
    allPlayers: () => [],
    selectedServerKey: "",
    selectedPlayerUuid: "",
    playerLoading: false,
    mobileMode: false
  }
);

const emit = defineEmits<{
  (event: "select-server", serverKey: string): void;
  (event: "select-player", payload: PlayerSelection): void;
}>();

const searchKeyword = ref("");

const isServerActive = (server: IMcsmGmOverviewServer) =>
  getGmServerKey(server) === props.selectedServerKey;

const isPlayerActive = (playerUuid: string) => playerUuid === props.selectedPlayerUuid;

const getStatusText = (status: number) => {
  if (status === 3) return "运行中";
  if (status === 2) return "启动中";
  if (status === 1) return "停止中";
  if (status === -1) return "忙碌";
  return "已停止";
};

const getStatusColor = (status: number) => {
  if (status === 3) return "green";
  if (status === 2) return "blue";
  if (status === 1) return "orange";
  if (status === -1) return "gold";
  return "default";
};

const getPlayerServerKey = (player: IMcsmGmPlayerPresence) => getGmServerKey(player);
const sourcePlayers = computed(() => props.allPlayers);

const filteredPlayers = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase();
  if (!keyword) return sourcePlayers.value;

  return sourcePlayers.value.filter((player) =>
    [player.playerName, player.instanceDisplayName, player.daemonDisplayName]
      .join(" ")
      .toLowerCase()
      .includes(keyword)
  );
});

const playerGroups = computed(() => groupPlayersByServer(filteredPlayers.value));

const playerCountText = computed(() => {
  const total = sourcePlayers.value.length;
  if (!searchKeyword.value.trim()) return String(total);
  return `${filteredPlayers.value.length}/${total}`;
});

const playerEmptyText = computed(() => {
  if (searchKeyword.value.trim()) return "没有匹配的在线玩家";
  return "当前没有在线玩家";
});

const selectPlayer = (player: IMcsmGmPlayerPresence) => {
  emit("select-player", {
    playerUuid: player.playerUuid,
    serverKey: getPlayerServerKey(player)
  });
};

const normalizeTestKey = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, "-");
</script>

<template>
  <div
    class="gm-sidebar"
    :class="{ 'gm-sidebar--mobile': mobileMode }"
    :data-testid="mobileMode ? 'gm-sidebar-mobile' : 'gm-sidebar'"
  >
    <template v-if="mobileMode">
      <section class="gm-sidebar__section gm-sidebar__section--players">
        <div class="gm-sidebar__section-header">
          <span>全服在线玩家</span>
          <a-tag>{{ playerCountText }}</a-tag>
        </div>

        <a-input
          v-model:value="searchKeyword"
          class="gm-sidebar__search"
          allow-clear
          placeholder="搜索玩家名 / 服务器"
        />

        <a-spin :spinning="playerLoading">
          <div v-if="playerGroups.length" class="gm-sidebar__player-list gm-sidebar__player-list--mobile">
            <section
              v-for="group in playerGroups"
              :key="group.serverKey"
              class="gm-sidebar__player-group"
            >
              <div class="gm-sidebar__group-header">
                <div class="gm-sidebar__group-copy">
                  <strong>{{ group.instanceDisplayName }}</strong>
                  <span>{{ group.daemonDisplayName }}</span>
                </div>
                <a-tag>{{ group.players.length }}</a-tag>
              </div>

              <button
                v-for="player in group.players"
                :key="`${getPlayerServerKey(player)}:${player.playerUuid}`"
                type="button"
                class="gm-sidebar__player-card"
                :class="{ 'is-active': isPlayerActive(player.playerUuid) }"
                :data-testid="
                  `gm-player-card-${normalizeTestKey(getPlayerServerKey(player))}-${normalizeTestKey(player.playerUuid)}`
                "
                @click="selectPlayer(player)"
              >
                <div class="gm-sidebar__player-line">
                  <strong>{{ player.playerName }}</strong>
                  <span class="gm-sidebar__player-meta">{{ player.instanceDisplayName }}</span>
                  <a-badge class="gm-sidebar__player-badge" :status="player.online ? 'success' : 'default'" />
                </div>
              </button>
            </section>
          </div>
          <a-empty v-else :image="false" :description="playerEmptyText" />
        </a-spin>
      </section>
    </template>

    <template v-else>
      <section class="gm-sidebar__section">
        <div class="gm-sidebar__section-header">
          <span>实例筛选</span>
          <a-tag>{{ servers.length }}</a-tag>
        </div>

        <div class="gm-sidebar__server-list gm-sidebar__server-list--compact">
          <button
            v-for="server in servers"
            :key="getGmServerKey(server)"
            type="button"
            class="gm-sidebar__server-card gm-sidebar__server-card--compact"
            :class="{ 'is-active': isServerActive(server) }"
            :data-testid="`gm-server-card-${normalizeTestKey(getGmServerKey(server))}`"
            @click="emit('select-server', getGmServerKey(server))"
          >
            <strong>{{ server.instanceDisplayName }}</strong>
            <a-tag :color="getStatusColor(server.instanceStatus)">
              {{ getStatusText(server.instanceStatus) }}
            </a-tag>
          </button>
        </div>
      </section>

      <section class="gm-sidebar__section gm-sidebar__section--players">
        <div class="gm-sidebar__section-header">
          <span>全服在线玩家</span>
          <a-tag>{{ playerCountText }}</a-tag>
        </div>

        <a-input
          v-model:value="searchKeyword"
          class="gm-sidebar__search"
          allow-clear
          placeholder="搜索玩家名 / 服务器"
        />

        <a-spin :spinning="playerLoading">
          <div v-if="playerGroups.length" class="gm-sidebar__player-list">
            <section
              v-for="group in playerGroups"
              :key="group.serverKey"
              class="gm-sidebar__player-group"
            >
              <div class="gm-sidebar__group-header">
                <div class="gm-sidebar__group-copy">
                  <strong>{{ group.instanceDisplayName }}</strong>
                  <span>{{ group.daemonDisplayName }}</span>
                </div>
                <a-tag>{{ group.players.length }}</a-tag>
              </div>

              <button
                v-for="player in group.players"
                :key="`${getPlayerServerKey(player)}:${player.playerUuid}`"
                type="button"
                class="gm-sidebar__player-card"
                :class="{ 'is-active': isPlayerActive(player.playerUuid) }"
                :data-testid="
                  `gm-player-card-${normalizeTestKey(getPlayerServerKey(player))}-${normalizeTestKey(player.playerUuid)}`
                "
                @click="selectPlayer(player)"
              >
                <div class="gm-sidebar__player-line">
                  <strong>{{ player.playerName }}</strong>
                  <span class="gm-sidebar__player-meta">{{ player.instanceDisplayName }}</span>
                  <a-badge class="gm-sidebar__player-badge" :status="player.online ? 'success' : 'default'" />
                </div>
              </button>
            </section>
          </div>
          <a-empty v-else :image="false" :description="playerEmptyText" />
        </a-spin>
      </section>
    </template>
  </div>
</template>

<style scoped lang="scss">
.gm-sidebar {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
  height: 100%;
}

.gm-sidebar--mobile {
  gap: 12px;
}

.gm-sidebar__section {
  min-height: 0;
  padding: 14px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow:
    0 16px 32px rgba(15, 23, 42, 0.08),
    0 2px 8px rgba(15, 23, 42, 0.04);
}

.gm-sidebar__section--players {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
}

.gm-sidebar__section-header,
.gm-sidebar__group-header,
.gm-sidebar__server-top,
.gm-sidebar__player-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.gm-sidebar__section-header {
  margin-bottom: 12px;
  font-weight: 700;
}

.gm-sidebar__search {
  width: 100%;
  margin-bottom: 10px;
}

.gm-sidebar__server-list,
.gm-sidebar__player-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.gm-sidebar__player-list {
  min-height: 0;
  overflow-y: auto;
}

.gm-sidebar__player-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.gm-sidebar__group-copy {
  min-width: 0;
}

.gm-sidebar__group-copy strong,
.gm-sidebar__group-copy span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gm-sidebar__group-copy span {
  margin-top: 2px;
  font-size: 12px;
  color: var(--color-gray-7);
}

.gm-sidebar__server-card strong,
.gm-sidebar__player-card strong {
  line-height: 1.35;
}

.gm-sidebar__server-meta,
.gm-sidebar__player-meta {
  color: var(--color-gray-7);
  font-size: 12px;
}

.gm-sidebar__server-card,
.gm-sidebar__player-card {
  width: 100%;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 14px;
  padding: 10px 12px;
  text-align: left;
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.92), rgba(255, 255, 255, 0.98));
  color: inherit;
  cursor: pointer;
  transition:
    transform 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}

.gm-sidebar__server-card:hover,
.gm-sidebar__player-card:hover {
  transform: translateY(-1px);
  border-color: rgba(37, 99, 235, 0.34);
  box-shadow: 0 12px 24px rgba(37, 99, 235, 0.08);
}

.gm-sidebar__server-card.is-active,
.gm-sidebar__player-card.is-active {
  border-color: rgba(37, 99, 235, 0.5);
  box-shadow:
    0 14px 26px rgba(37, 99, 235, 0.12),
    inset 0 0 0 1px rgba(37, 99, 235, 0.16);
}

.gm-sidebar__server-card--compact {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
}

.gm-sidebar__server-card--compact strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gm-sidebar__server-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  overflow: hidden;
  white-space: nowrap;
}

.gm-sidebar__server-list--compact {
  gap: 8px;
}

.gm-sidebar__player-line {
  min-width: 0;
}

.gm-sidebar__player-line strong,
.gm-sidebar__player-meta {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gm-sidebar__player-line strong {
  flex: 0 1 auto;
}

.gm-sidebar__player-meta {
  flex: 1 1 auto;
}

.gm-sidebar__player-badge {
  flex-shrink: 0;
}

.gm-sidebar__player-list--mobile .gm-sidebar__player-card {
  padding: 11px 12px;
}

@media (max-width: 768px) {
  .gm-sidebar__section {
    padding: 12px;
    border-radius: 16px;
  }

  .gm-sidebar__search {
    margin-bottom: 12px;
  }

  .gm-sidebar__player-list {
    max-height: 58vh;
  }
}
</style>
