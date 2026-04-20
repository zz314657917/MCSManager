import type { GmPanelActionPayload } from "@/hooks/useGmConsoleState";
import { createControlTargetKey } from "@/tools/control";
import type { ControlTarget } from "@/types/control";
import { computed, ref, watch, type Ref } from "vue";

type PreviewPlayerRecord = IMcsmGmPlayerSnapshot & {
  auditRecords: IMcsmGmAuditRecord[];
};

type PreviewServerRecord = {
  server: IMcsmGmOverviewServer;
  players: PreviewPlayerRecord[];
};

const PREVIEW_OPERATOR = "local-preview-admin";

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const futureIso = (seconds: number) => new Date(Date.now() + seconds * 1000).toISOString();

const createInventorySlot = (
  section: IMcsmGmInventorySlot["section"],
  slot: number,
  data: Partial<IMcsmGmInventorySlot> = {}
): IMcsmGmInventorySlot => ({
  section,
  slot,
  empty: data.empty ?? !data.material,
  material: data.material,
  rawTypeName: data.rawTypeName,
  amount: data.amount,
  durability: data.durability,
  maxDurability: data.maxDurability,
  displayName: data.displayName,
  lore: data.lore,
  enchants: data.enchants,
  itemFlags: data.itemFlags
});

const createInventorySnapshot = (
  playerUuid: string,
  playerName: string,
  items: Partial<IMcsmGmInventorySlot>[] = []
): IMcsmGmPlayerInventorySnapshot => {
  const hotbar = Array.from({ length: 9 }, (_, slot) => createInventorySlot("hotbar", slot));
  const main = Array.from({ length: 27 }, (_, slot) => createInventorySlot("main", slot));
  const armor = Array.from({ length: 4 }, (_, slot) => createInventorySlot("armor", slot));
  const offhand = [createInventorySlot("offhand", 0)];
  const slots = [...hotbar, ...main, ...armor, ...offhand];

  for (const item of items) {
    const section = item.section;
    const slot = Number(item.slot);
    if (!section || !Number.isInteger(slot)) continue;
    const index = slots.findIndex((entry) => entry.section === section && entry.slot === slot);
    if (index < 0) continue;
    slots[index] = createInventorySlot(section, slot, item);
  }

  return {
    available: true,
    playerUuid,
    playerName,
    online: true,
    source: "bukkit",
    updatedAt: new Date().toISOString(),
    slots
  };
};

const buildPreviewInventory = (player?: IMcsmGmPlayerPresence): IMcsmGmPlayerInventorySnapshot | undefined => {
  if (!player) return undefined;

  switch (player.playerUuid) {
    case "preview-lobby-player-1":
      return createInventorySnapshot(player.playerUuid, player.playerName, [
        { section: "hotbar", slot: 0, material: "COMPASS", amount: 1, displayName: "服务器导航" },
        { section: "hotbar", slot: 1, material: "CLOCK", amount: 1, displayName: "活动时钟" },
        { section: "armor", slot: 0, material: "GOLD_HELMET", amount: 1 },
        { section: "offhand", slot: 0, material: "MAP", amount: 1, displayName: "大厅地图" }
      ]);
    case "preview-player-1":
      return createInventorySnapshot(player.playerUuid, player.playerName, [
        { section: "hotbar", slot: 0, material: "DIAMOND_SWORD", amount: 1, enchants: [{ key: "DAMAGE_ALL", level: 5 }] },
        { section: "hotbar", slot: 1, material: "GOLDEN_APPLE", amount: 12, displayName: "活动金苹果" },
        {
          section: "hotbar",
          slot: 2,
          material: "CHEST",
          rawTypeName: "mod:portable_crate",
          amount: 1,
          displayName: "便携储物箱",
          lore: ["混合服示例物品", "贴图缺失时显示文本卡片"]
        },
        { section: "main", slot: 0, material: "STONE", amount: 64 },
        { section: "main", slot: 1, material: "TORCH", amount: 48 },
        { section: "armor", slot: 0, material: "DIAMOND_HELMET", amount: 1, durability: 14, maxDurability: 363 },
        { section: "armor", slot: 1, material: "DIAMOND_CHESTPLATE", amount: 1, durability: 28, maxDurability: 528 },
        { section: "armor", slot: 2, material: "DIAMOND_LEGGINGS", amount: 1, durability: 21, maxDurability: 495 },
        { section: "armor", slot: 3, material: "DIAMOND_BOOTS", amount: 1, durability: 9, maxDurability: 429 },
        { section: "offhand", slot: 0, material: "TOTEM", rawTypeName: "TOTEM_OF_UNDYING", amount: 1, displayName: "不死图腾" }
      ]);
    case "preview-player-2":
      return createInventorySnapshot(player.playerUuid, player.playerName, [
        { section: "hotbar", slot: 0, material: "BOW", amount: 1, enchants: [{ key: "ARROW_DAMAGE", level: 4 }] },
        { section: "hotbar", slot: 1, material: "ARROW", amount: 32 },
        { section: "main", slot: 0, material: "COOKED_BEEF", amount: 16 },
        { section: "offhand", slot: 0, material: "SHIELD", amount: 1, durability: 47, maxDurability: 336 }
      ]);
    case "preview-player-3":
      return createInventorySnapshot(player.playerUuid, player.playerName, [
        { section: "hotbar", slot: 0, material: "STONE_PICKAXE", amount: 1, durability: 22, maxDurability: 131 },
        { section: "main", slot: 0, material: "COBBLESTONE", amount: 64 },
        { section: "main", slot: 1, material: "OAK_LOG", amount: 32 }
      ]);
    case "preview-player-5":
      return createInventorySnapshot(player.playerUuid, player.playerName, [
        { section: "hotbar", slot: 0, material: "GRASS", amount: 64 },
        { section: "hotbar", slot: 1, material: "QUARTZ_BLOCK", amount: 48 },
        { section: "hotbar", slot: 2, material: "SEA_LANTERN", amount: 32 },
        { section: "offhand", slot: 0, material: "TOTEM", rawTypeName: "TOTEM_OF_UNDYING", amount: 1 }
      ]);
    case "preview-player-6":
      return createInventorySnapshot(player.playerUuid, player.playerName, [
        { section: "hotbar", slot: 0, material: "BOOK", amount: 1, displayName: "建筑参考" },
        { section: "main", slot: 0, material: "STONE", amount: 64 },
        { section: "main", slot: 1, material: "GLASS", amount: 64 }
      ]);
    default:
      return createInventorySnapshot(player.playerUuid, player.playerName);
  }
};

const parseDurationToSeconds = (value: string) => {
  const matched = value.trim().match(/^(\d+)\s*([smhd])$/i);
  if (!matched) return undefined;

  const amount = Number(matched[1]);
  const unit = matched[2].toLowerCase();
  if (!Number.isFinite(amount) || amount <= 0) return undefined;

  if (unit === "s") return amount;
  if (unit === "m") return amount * 60;
  if (unit === "h") return amount * 60 * 60;
  if (unit === "d") return amount * 24 * 60 * 60;
  return undefined;
};

const createAuditRecord = (
  player: IMcsmGmPlayerPresence,
  server: IMcsmGmOverviewServer,
  actionKind: string,
  success: boolean,
  message: string,
  beforeValue?: number,
  afterValue?: number
): IMcsmGmAuditRecord => ({
  id: `control-player-audit-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
  operatorName: PREVIEW_OPERATOR,
  daemonId: server.daemonId,
  instanceId: server.instanceId,
  playerUuid: player.playerUuid,
  playerName: player.playerName,
  actionKind,
  success,
  message,
  beforeValue,
  afterValue,
  time: new Date().toISOString()
});

const buildActionResult = (
  player: IMcsmGmPlayerPresence,
  server: IMcsmGmOverviewServer,
  kind: GmPanelActionPayload["kind"],
  message: string,
  options: {
    success?: boolean;
    beforeValue?: number;
    afterValue?: number;
    balances?: IMcsmGmPlayerBalances;
    luckPerms?: IMcsmLuckPermsSnapshot;
    moderation?: IMcsmGmModerationStatus;
  } = {}
): IMcsmGmActionResult => ({
  success: options.success ?? true,
  kind,
  daemonId: server.daemonId,
  instanceId: server.instanceId,
  playerUuid: player.playerUuid,
  playerName: player.playerName,
  message,
  beforeValue: options.beforeValue,
  afterValue: options.afterValue,
  balances: options.balances,
  luckPerms: options.luckPerms,
  moderation: options.moderation,
  updatedAt: new Date().toISOString()
});

const createPreviewRecords = (): Record<string, PreviewServerRecord> => ({
  "paper-lobby": {
    server: {
      daemonId: "home-daemon-a",
      daemonDisplayName: "家庭主机 A",
      daemonAvailable: true,
      daemonEndpoint: "Panel Relay / home-daemon-a",
      instanceId: "paper-lobby",
      instanceDisplayName: "Lobby",
      instanceStatus: 3,
      playerCount: 1,
      chatMessagesToday: 49,
      dependencies: {
        economyAvailable: true,
        pointsAvailable: true,
        luckPermsAvailable: true,
        chatPluginAvailable: false,
        chatPluginType: "native",
        updatedAt: minutesAgo(2)
      }
    },
    players: [
      {
        presence: {
          daemonId: "home-daemon-a",
          daemonDisplayName: "家庭主机 A",
          instanceId: "paper-lobby",
          instanceDisplayName: "Lobby",
          playerUuid: "preview-lobby-player-1",
          playerName: "纸鸢",
          online: true,
          lastSeenAt: minutesAgo(2)
        },
        balances: {
          economyAvailable: true,
          economyBalance: 5_200,
          pointsAvailable: true,
          pointsBalance: 45,
          updatedAt: minutesAgo(2)
        },
        luckPerms: {
          available: true,
          primaryGroup: "default",
          availableGroups: ["default", "greeter", "moderator"],
          groups: [{ name: "default", temporary: false }],
          permissions: [],
          updatedAt: minutesAgo(2)
        },
        moderation: {
          chatPluginAvailable: false,
          chatPluginType: "native",
          muted: false,
          updatedAt: minutesAgo(2)
        },
        auditRecords: []
      }
    ]
  },
  "survival-main": {
    server: {
      daemonId: "home-daemon-a",
      daemonDisplayName: "家庭主机 A",
      daemonAvailable: true,
      daemonEndpoint: "Panel Relay / home-daemon-a",
      instanceId: "survival-main",
      instanceDisplayName: "Survival",
      instanceStatus: 3,
      playerCount: 3,
      chatMessagesToday: 186,
      dependencies: {
        economyAvailable: true,
        pointsAvailable: true,
        luckPermsAvailable: true,
        chatPluginAvailable: true,
        chatPluginType: "playerchat",
        controller: {
          host: "127.0.0.1",
          port: 28080
        },
        updatedAt: minutesAgo(1)
      }
    },
    players: [
      {
        presence: {
          daemonId: "home-daemon-a",
          daemonDisplayName: "家庭主机 A",
          instanceId: "survival-main",
          instanceDisplayName: "Survival",
          playerUuid: "preview-player-1",
          playerName: "爱马仕",
          online: true,
          lastSeenAt: minutesAgo(1)
        },
        balances: {
          economyAvailable: true,
          economyBalance: 128_500,
          pointsAvailable: true,
          pointsBalance: 2_680,
          updatedAt: minutesAgo(1)
        },
        luckPerms: {
          available: true,
          primaryGroup: "vip",
          availableGroups: ["default", "member", "vip", "builder", "event_boost"],
          groups: [
            { name: "default", temporary: false },
            { name: "vip", temporary: false },
            { name: "event_boost", temporary: true, expiresAt: futureIso(3 * 24 * 60 * 60) }
          ],
          permissions: [
            { node: "essentials.sethome.multiple.vip", value: true, temporary: false },
            { node: "chat.color", value: true, temporary: true, expiresAt: futureIso(7 * 24 * 60 * 60) }
          ],
          updatedAt: minutesAgo(2)
        },
        moderation: {
          chatPluginAvailable: true,
          chatPluginType: "playerchat",
          muted: false,
          updatedAt: minutesAgo(2)
        },
        auditRecords: [
          {
            id: "control-player-audit-survival-1",
            operatorName: "GM-Blue",
            daemonId: "home-daemon-a",
            instanceId: "survival-main",
            playerUuid: "preview-player-1",
            playerName: "爱马仕",
            actionKind: "economy_deposit",
            success: true,
            message: "补偿活动奖励 5000 金币",
            beforeValue: 123_500,
            afterValue: 128_500,
            time: minutesAgo(18)
          }
        ]
      },
      {
        presence: {
          daemonId: "home-daemon-a",
          daemonDisplayName: "家庭主机 A",
          instanceId: "survival-main",
          instanceDisplayName: "Survival",
          playerUuid: "preview-player-2",
          playerName: "何方妖孽",
          online: true,
          lastSeenAt: minutesAgo(3)
        },
        balances: {
          economyAvailable: true,
          economyBalance: 82_300,
          pointsAvailable: true,
          pointsBalance: 1_160,
          updatedAt: minutesAgo(3)
        },
        luckPerms: {
          available: true,
          primaryGroup: "default",
          availableGroups: ["default", "member", "vip", "builder", "helper"],
          groups: [{ name: "default", temporary: false }],
          permissions: [{ node: "homes.extra.2", value: true, temporary: false }],
          updatedAt: minutesAgo(4)
        },
        moderation: {
          chatPluginAvailable: true,
          chatPluginType: "playerchat",
          muted: true,
          remainingSeconds: 22 * 60,
          expireAt: futureIso(22 * 60),
          reason: "刷屏广告",
          operatorName: "GM-Blue",
          updatedAt: minutesAgo(8)
        },
        auditRecords: [
          {
            id: "control-player-audit-survival-2",
            operatorName: "GM-Blue",
            daemonId: "home-daemon-a",
            instanceId: "survival-main",
            playerUuid: "preview-player-2",
            playerName: "何方妖孽",
            actionKind: "chat_mute",
            success: true,
            message: "禁言 30 分钟：刷屏广告",
            time: minutesAgo(8)
          }
        ]
      },
      {
        presence: {
          daemonId: "home-daemon-a",
          daemonDisplayName: "家庭主机 A",
          instanceId: "survival-main",
          instanceDisplayName: "Survival",
          playerUuid: "preview-player-3",
          playerName: "落叶",
          online: true,
          lastSeenAt: minutesAgo(6)
        },
        balances: {
          economyAvailable: true,
          economyBalance: 15_800,
          pointsAvailable: true,
          pointsBalance: 360,
          updatedAt: minutesAgo(6)
        },
        luckPerms: {
          available: true,
          primaryGroup: "member",
          availableGroups: ["default", "member", "vip", "builder"],
          groups: [
            { name: "default", temporary: false },
            { name: "member", temporary: false }
          ],
          permissions: [],
          updatedAt: minutesAgo(6)
        },
        moderation: {
          chatPluginAvailable: true,
          chatPluginType: "playerchat",
          muted: false,
          updatedAt: minutesAgo(6)
        },
        auditRecords: []
      }
    ]
  },
  "creative-test": {
    server: {
      daemonId: "nas-daemon-b",
      daemonDisplayName: "客厅 NAS B",
      daemonAvailable: true,
      daemonEndpoint: "Panel Relay / nas-daemon-b",
      instanceId: "creative-test",
      instanceDisplayName: "Creative Test",
      instanceStatus: 3,
      playerCount: 2,
      chatMessagesToday: 97,
      dependencies: {
        economyAvailable: true,
        pointsAvailable: true,
        luckPermsAvailable: true,
        chatPluginAvailable: true,
        chatPluginType: "playerchat",
        controller: {
          host: "127.0.0.1",
          port: 28081
        },
        updatedAt: minutesAgo(1)
      }
    },
    players: [
      {
        presence: {
          daemonId: "nas-daemon-b",
          daemonDisplayName: "客厅 NAS B",
          instanceId: "creative-test",
          instanceDisplayName: "Creative Test",
          playerUuid: "preview-player-5",
          playerName: "星河",
          online: true,
          lastSeenAt: minutesAgo(1)
        },
        balances: {
          economyAvailable: true,
          economyBalance: 246_000,
          pointsAvailable: true,
          pointsBalance: 3_480,
          updatedAt: minutesAgo(1)
        },
        luckPerms: {
          available: true,
          primaryGroup: "builder",
          availableGroups: ["default", "builder", "vip", "architect"],
          groups: [
            { name: "default", temporary: false },
            { name: "builder", temporary: false }
          ],
          permissions: [{ node: "island.biome.change", value: true, temporary: false }],
          updatedAt: minutesAgo(1)
        },
        moderation: {
          chatPluginAvailable: true,
          chatPluginType: "playerchat",
          muted: false,
          updatedAt: minutesAgo(1)
        },
        auditRecords: []
      },
      {
        presence: {
          daemonId: "nas-daemon-b",
          daemonDisplayName: "客厅 NAS B",
          instanceId: "creative-test",
          instanceDisplayName: "Creative Test",
          playerUuid: "preview-player-6",
          playerName: "司南",
          online: true,
          lastSeenAt: minutesAgo(4)
        },
        balances: {
          economyAvailable: true,
          economyBalance: 61_000,
          pointsAvailable: true,
          pointsBalance: 990,
          updatedAt: minutesAgo(4)
        },
        luckPerms: {
          available: true,
          primaryGroup: "default",
          availableGroups: ["default", "builder", "vip", "architect"],
          groups: [{ name: "default", temporary: false }],
          permissions: [],
          updatedAt: minutesAgo(4)
        },
        moderation: {
          chatPluginAvailable: true,
          chatPluginType: "playerchat",
          muted: false,
          updatedAt: minutesAgo(4)
        },
        auditRecords: []
      }
    ]
  },
  "forge-pack": {
    server: {
      daemonId: "nas-daemon-b",
      daemonDisplayName: "客厅 NAS B",
      daemonAvailable: true,
      daemonEndpoint: "Panel Relay / nas-daemon-b",
      instanceId: "forge-pack",
      instanceDisplayName: "Forge Pack",
      instanceStatus: 0,
      playerCount: 0,
      chatMessagesToday: 0,
      dependencies: {
        economyAvailable: false,
        pointsAvailable: false,
        luckPermsAvailable: false,
        chatPluginAvailable: false,
        chatPluginType: "native",
        updatedAt: minutesAgo(5)
      }
    },
    players: []
  },
  "backup-world": {
    server: {
      daemonId: "backup-daemon-c",
      daemonDisplayName: "备份节点 C",
      daemonAvailable: false,
      daemonEndpoint: "Panel Relay / backup-daemon-c",
      instanceId: "backup-world",
      instanceDisplayName: "Backup World",
      instanceStatus: 0,
      playerCount: 0,
      chatMessagesToday: 0,
      dependencies: {
        economyAvailable: false,
        pointsAvailable: false,
        luckPermsAvailable: false,
        chatPluginAvailable: false,
        chatPluginType: "native",
        updatedAt: minutesAgo(5)
      }
    },
    players: []
  }
});

export function useControlPlayerPanelPreviewState(currentTarget: Readonly<Ref<ControlTarget | undefined>>) {
  const previewRecords = ref(createPreviewRecords());
  const selectedPlayerUuid = ref("");
  const isPlayerModalOpen = ref(false);
  const isPlayersLoading = ref(false);
  const isDetailLoading = ref(false);
  const isInventoryLoading = ref(false);
  const isExecutingAction = ref(false);
  const latestError = ref("");
  const lastActionResult = ref<IMcsmGmActionResult>();

  const currentRecord = computed(() => {
    const target = currentTarget.value;
    if (!target || target.mode !== "instance") return undefined;
    return previewRecords.value[target.instanceId];
  });

  const onlinePlayers = computed(() =>
    (currentRecord.value?.players || []).map((item) => item.presence).filter((item) => item.online)
  );

  const currentPlayerRecord = computed(() =>
    (currentRecord.value?.players || []).find((item) => item.presence.playerUuid === selectedPlayerUuid.value)
  );

  const currentServer = computed(() => currentRecord.value?.server);
  const currentPlayer = computed(() => currentPlayerRecord.value?.presence);
  const balances = computed(() => currentPlayerRecord.value?.balances);
  const luckPerms = computed(() => currentPlayerRecord.value?.luckPerms);
  const moderation = computed(() => currentPlayerRecord.value?.moderation);
  const inventory = computed(() => buildPreviewInventory(currentPlayer.value));
  const auditRecords = computed(() => currentPlayerRecord.value?.auditRecords || []);

  const resetModalState = () => {
    selectedPlayerUuid.value = "";
    isPlayerModalOpen.value = false;
    latestError.value = "";
    lastActionResult.value = undefined;
  };

  const openPlayerModal = async (player: IMcsmGmPlayerPresence) => {
    selectedPlayerUuid.value = player.playerUuid;
    isPlayerModalOpen.value = true;
  };

  const closePlayerModal = () => {
    resetModalState();
  };

  const loadPlayers = async (_forceRequest = false) => {
    isPlayersLoading.value = true;
    await Promise.resolve();
    isPlayersLoading.value = false;
  };

  const loadPlayerDetails = async (_forceRequest = false) => {
    isDetailLoading.value = true;
    await Promise.resolve();
    isDetailLoading.value = false;
  };

  const loadInventory = async (_forceRequest = false) => {
    isInventoryLoading.value = true;
    await Promise.resolve();
    isInventoryLoading.value = false;
  };

  const executeAction = async (payload: GmPanelActionPayload) => {
    const player = currentPlayer.value;
    const record = currentPlayerRecord.value;
    const server = currentServer.value;
    if (!player || !record || !server) return false;

    isExecutingAction.value = true;
    latestError.value = "";

    try {
      const fail = (message: string) => {
        record.auditRecords.unshift(createAuditRecord(player, server, payload.kind, false, message));
        lastActionResult.value = buildActionResult(player, server, payload.kind, message, {
          success: false
        });
        latestError.value = message;
        return false;
      };

      let message = "操作已执行。";
      let beforeValue: number | undefined;
      let afterValue: number | undefined;

      if (
        (payload.kind === "economy_deposit" || payload.kind === "economy_withdraw") &&
        !record.balances.economyAvailable
      ) {
        return fail("当前实例未启用经济系统。");
      }

      if ((payload.kind === "points_give" || payload.kind === "points_take") && !record.balances.pointsAvailable) {
        return fail("当前实例未启用点券系统。");
      }

      if (payload.kind.startsWith("lp_") && !record.luckPerms.available) {
        return fail("当前实例未启用 LuckPerms。");
      }

      if (payload.kind.startsWith("chat_") && !record.moderation.chatPluginAvailable) {
        return fail("当前实例未启用聊天管理能力。");
      }

      if (payload.kind === "economy_deposit" || payload.kind === "economy_withdraw") {
        beforeValue = record.balances.economyBalance || 0;
        afterValue =
          payload.kind === "economy_deposit"
            ? beforeValue + payload.amount
            : Math.max(0, beforeValue - payload.amount);
        record.balances.economyBalance = afterValue;
        record.balances.updatedAt = new Date().toISOString();
        message =
          payload.kind === "economy_deposit"
            ? `已给 ${player.playerName} 增加 ${payload.amount} 金币。`
            : `已从 ${player.playerName} 扣除 ${payload.amount} 金币。`;
      }

      if (payload.kind === "points_give" || payload.kind === "points_take") {
        beforeValue = record.balances.pointsBalance || 0;
        afterValue =
          payload.kind === "points_give"
            ? beforeValue + payload.amount
            : Math.max(0, beforeValue - payload.amount);
        record.balances.pointsBalance = afterValue;
        record.balances.updatedAt = new Date().toISOString();
        message =
          payload.kind === "points_give"
            ? `已给 ${player.playerName} 增加 ${payload.amount} 点券。`
            : `已从 ${player.playerName} 扣除 ${payload.amount} 点券。`;
      }

      if (
        payload.kind === "lp_group_add" ||
        payload.kind === "lp_group_switch" ||
        payload.kind === "lp_group_remove"
      ) {
        const previousPrimaryGroup = record.luckPerms.primaryGroup;
        const exists = record.luckPerms.groups.some((item) => item.name === payload.group && !item.temporary);

        if (payload.kind === "lp_group_add" && !exists) {
          record.luckPerms.groups.push({ name: payload.group, temporary: false });
          record.luckPerms.primaryGroup = payload.group;
        }

        if (payload.kind === "lp_group_switch") {
          if (!exists) {
            record.luckPerms.groups.push({ name: payload.group, temporary: false });
          }
          if (previousPrimaryGroup && previousPrimaryGroup !== payload.group) {
            record.luckPerms.groups = record.luckPerms.groups.filter(
              (item) =>
                item.temporary || item.name !== previousPrimaryGroup || item.name === payload.group
            );
          }
          record.luckPerms.primaryGroup = payload.group;
        }

        if (payload.kind === "lp_group_remove") {
          record.luckPerms.groups = record.luckPerms.groups.filter(
            (item) => item.name !== payload.group || item.temporary
          );
          if (record.luckPerms.primaryGroup === payload.group) {
            record.luckPerms.primaryGroup = record.luckPerms.groups[0]?.name || "default";
          }
        }

        record.luckPerms.updatedAt = new Date().toISOString();
        message =
          payload.kind === "lp_group_add"
            ? `已为 ${player.playerName} 添加权限组 ${payload.group}。`
            : payload.kind === "lp_group_switch"
              ? `已将 ${player.playerName} 的主组切换为 ${payload.group}。`
              : `已移除 ${player.playerName} 的权限组 ${payload.group}。`;
      }

      if (payload.kind === "lp_temp_group_add" || payload.kind === "lp_temp_group_remove") {
        if (payload.kind === "lp_temp_group_add") {
          const durationSeconds = parseDurationToSeconds(payload.duration);
          if (!durationSeconds) return fail("临时权限组时长格式无效。");
          record.luckPerms.groups = record.luckPerms.groups.filter(
            (item) => !(item.name === payload.group && item.temporary)
          );
          record.luckPerms.groups.push({
            name: payload.group,
            temporary: true,
            expiresAt: futureIso(durationSeconds)
          });
          message = `已为 ${player.playerName} 添加临时组 ${payload.group}。`;
        } else {
          record.luckPerms.groups = record.luckPerms.groups.filter(
            (item) => !(item.name === payload.group && item.temporary)
          );
          message = `已移除 ${player.playerName} 的临时组 ${payload.group}。`;
        }
        record.luckPerms.updatedAt = new Date().toISOString();
      }

      if (payload.kind === "lp_permission_set" || payload.kind === "lp_permission_unset") {
        if (payload.kind === "lp_permission_set") {
          record.luckPerms.permissions = record.luckPerms.permissions.filter(
            (item) => item.node !== payload.node || item.temporary
          );
          record.luckPerms.permissions.push({
            node: payload.node,
            value: true,
            temporary: false
          });
          message = `已为 ${player.playerName} 添加权限节点 ${payload.node}。`;
        } else {
          record.luckPerms.permissions = record.luckPerms.permissions.filter(
            (item) => item.node !== payload.node || item.temporary
          );
          message = `已删除 ${player.playerName} 的权限节点 ${payload.node}。`;
        }
        record.luckPerms.updatedAt = new Date().toISOString();
      }

      if (payload.kind === "lp_temp_permission_set" || payload.kind === "lp_temp_permission_unset") {
        if (payload.kind === "lp_temp_permission_set") {
          const durationSeconds = parseDurationToSeconds(payload.duration);
          if (!durationSeconds) return fail("临时权限时长格式无效。");
          record.luckPerms.permissions = record.luckPerms.permissions.filter(
            (item) => !(item.node === payload.node && item.temporary)
          );
          record.luckPerms.permissions.push({
            node: payload.node,
            value: true,
            temporary: true,
            expiresAt: futureIso(durationSeconds)
          });
          message = `已为 ${player.playerName} 添加临时权限 ${payload.node}。`;
        } else {
          record.luckPerms.permissions = record.luckPerms.permissions.filter(
            (item) => !(item.node === payload.node && item.temporary)
          );
          message = `已删除 ${player.playerName} 的临时权限 ${payload.node}。`;
        }
        record.luckPerms.updatedAt = new Date().toISOString();
      }

      if (payload.kind === "chat_mute") {
        record.moderation.muted = true;
        record.moderation.remainingSeconds = payload.durationSeconds;
        record.moderation.expireAt = futureIso(payload.durationSeconds);
        record.moderation.reason = payload.reason || "违规发言";
        record.moderation.operatorName = PREVIEW_OPERATOR;
        record.moderation.updatedAt = new Date().toISOString();
        message = `已禁言 ${player.playerName}，时长 ${payload.durationSeconds} 秒。`;
      }

      if (payload.kind === "chat_unmute") {
        record.moderation.muted = false;
        record.moderation.remainingSeconds = undefined;
        record.moderation.expireAt = undefined;
        record.moderation.reason = undefined;
        record.moderation.operatorName = PREVIEW_OPERATOR;
        record.moderation.updatedAt = new Date().toISOString();
        message = `已解除 ${player.playerName} 的禁言。`;
      }

      record.presence.lastSeenAt = new Date().toISOString();
      record.auditRecords.unshift(
        createAuditRecord(player, server, payload.kind, true, message, beforeValue, afterValue)
      );

      lastActionResult.value = buildActionResult(player, server, payload.kind, message, {
        success: true,
        beforeValue,
        afterValue,
        balances: record.balances,
        luckPerms: record.luckPerms,
        moderation: record.moderation
      });
      latestError.value = "";
      return true;
    } finally {
      isExecutingAction.value = false;
    }
  };

  watch(
    () => (currentTarget.value ? createControlTargetKey(currentTarget.value) : ""),
    () => {
      resetModalState();
    },
    { immediate: true }
  );

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
