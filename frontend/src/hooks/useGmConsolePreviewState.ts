import type { GmPanelActionPayload } from "@/hooks/useGmConsoleState";
import { createGmServerKey, sortPlayersAcrossServers, sortPlayersByPresence } from "@/types/gm";
import { computed, ref, watch } from "vue";

type PreviewPlayerRecord = IMcsmGmPlayerSnapshot & {
  auditRecords: IMcsmGmAuditRecord[];
};

type PreviewServerRecord = {
  server: IMcsmGmOverviewServer;
  players: PreviewPlayerRecord[];
  messages: IMcsmGmChatMessage[];
};

const PREVIEW_OPERATOR = "local-preview-admin";

const delay = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

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

const futureIso = (seconds: number) => new Date(Date.now() + seconds * 1000).toISOString();

const createPreviewData = (): PreviewServerRecord[] => {
  const survival: IMcsmGmOverviewServer = {
    daemonId: "relay-home-a",
    daemonDisplayName: "家庭节点 A",
    daemonAvailable: true,
    daemonEndpoint: "Panel Relay / relay-home-a",
    instanceId: "survival-main",
    instanceDisplayName: "生存一区",
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
  };

  const lobby: IMcsmGmOverviewServer = {
    daemonId: "relay-home-a",
    daemonDisplayName: "家庭节点 A",
    daemonAvailable: true,
    daemonEndpoint: "Panel Relay / relay-home-a",
    instanceId: "lobby-hub",
    instanceDisplayName: "大厅服",
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
  };

  const skyblock: IMcsmGmOverviewServer = {
    daemonId: "relay-vps-b",
    daemonDisplayName: "异地节点 B",
    daemonAvailable: true,
    daemonEndpoint: "Panel Relay / relay-vps-b",
    instanceId: "skyblock-02",
    instanceDisplayName: "空岛二区",
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
  };

  const archive: IMcsmGmOverviewServer = {
    daemonId: "relay-backup-c",
    daemonDisplayName: "备份节点 C",
    daemonAvailable: false,
    daemonEndpoint: "Panel Relay / relay-backup-c",
    instanceId: "archive-test",
    instanceDisplayName: "归档服",
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
  };

  return [
    {
      server: survival,
      players: [
        {
          presence: {
            daemonId: survival.daemonId,
            daemonDisplayName: survival.daemonDisplayName,
            instanceId: survival.instanceId,
            instanceDisplayName: survival.instanceDisplayName,
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
              id: "audit-preview-1",
              operatorName: "GM-Blue",
              daemonId: survival.daemonId,
              instanceId: survival.instanceId,
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
            daemonId: survival.daemonId,
            daemonDisplayName: survival.daemonDisplayName,
            instanceId: survival.instanceId,
            instanceDisplayName: survival.instanceDisplayName,
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
              id: "audit-preview-2",
              operatorName: "GM-Blue",
              daemonId: survival.daemonId,
              instanceId: survival.instanceId,
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
            daemonId: survival.daemonId,
            daemonDisplayName: survival.daemonDisplayName,
            instanceId: survival.instanceId,
            instanceDisplayName: survival.instanceDisplayName,
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
      ],
      messages: [
        {
          id: "survival-msg-1",
          daemonId: survival.daemonId,
          instanceId: survival.instanceId,
          playerUuid: "preview-player-1",
          playerName: "爱马仕",
          senderType: "player",
          channel: "global",
          text: "有人组队打末影龙吗？",
          time: minutesAgo(7)
        },
        {
          id: "survival-msg-2",
          daemonId: survival.daemonId,
          instanceId: survival.instanceId,
          playerUuid: "preview-player-2",
          playerName: "何方妖孽",
          senderType: "player",
          channel: "trade",
          mentionedPlayers: ["爱马仕"],
          text: "高价收下界合金锭，支持点券交易。",
          time: minutesAgo(5)
        },
        {
          id: "survival-msg-3",
          daemonId: survival.daemonId,
          instanceId: survival.instanceId,
          senderType: "system",
          text: "系统：晚高峰在线奖励已发放。",
          time: minutesAgo(3)
        },
        {
          id: "survival-msg-4",
          daemonId: survival.daemonId,
          instanceId: survival.instanceId,
          senderType: "gm",
          text: "GM 已处理刷屏玩家，请继续正常交流。",
          time: minutesAgo(2)
        }
      ]
    },
    {
      server: lobby,
      players: [
        {
          presence: {
            daemonId: lobby.daemonId,
            daemonDisplayName: lobby.daemonDisplayName,
            instanceId: lobby.instanceId,
            instanceDisplayName: lobby.instanceDisplayName,
            playerUuid: "preview-player-4",
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
      ],
      messages: [
        {
          id: "lobby-msg-1",
          daemonId: lobby.daemonId,
          instanceId: lobby.instanceId,
          senderType: "system",
          text: "大厅服当前使用原生聊天回退模式。",
          time: minutesAgo(10)
        },
        {
          id: "lobby-msg-2",
          daemonId: lobby.daemonId,
          instanceId: lobby.instanceId,
          playerUuid: "preview-player-4",
          playerName: "纸鸢",
          senderType: "player",
          channel: "global",
          text: "新人求问生存服怎么进？",
          time: minutesAgo(4)
        }
      ]
    },
    {
      server: skyblock,
      players: [
        {
          presence: {
            daemonId: skyblock.daemonId,
            daemonDisplayName: skyblock.daemonDisplayName,
            instanceId: skyblock.instanceId,
            instanceDisplayName: skyblock.instanceDisplayName,
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
            daemonId: skyblock.daemonId,
            daemonDisplayName: skyblock.daemonDisplayName,
            instanceId: skyblock.instanceId,
            instanceDisplayName: skyblock.instanceDisplayName,
            playerUuid: "preview-player-6",
            playerName: "司南",
            online: true,
            lastSeenAt: minutesAgo(5)
          },
          balances: {
            economyAvailable: true,
            economyBalance: 36_000,
            pointsAvailable: true,
            pointsBalance: 520,
            updatedAt: minutesAgo(5)
          },
          luckPerms: {
            available: true,
            primaryGroup: "default",
            availableGroups: ["default", "builder", "vip"],
            groups: [{ name: "default", temporary: false }],
            permissions: [],
            updatedAt: minutesAgo(5)
          },
          moderation: {
            chatPluginAvailable: true,
            chatPluginType: "playerchat",
            muted: false,
            updatedAt: minutesAgo(5)
          },
          auditRecords: []
        }
      ],
      messages: [
        {
          id: "skyblock-msg-1",
          daemonId: skyblock.daemonId,
          instanceId: skyblock.instanceId,
          playerUuid: "preview-player-5",
          playerName: "星河",
          senderType: "player",
          channel: "island",
          text: "今天刷矿机收益还不错。",
          time: minutesAgo(9)
        },
        {
          id: "skyblock-msg-2",
          daemonId: skyblock.daemonId,
          instanceId: skyblock.instanceId,
          playerUuid: "preview-player-6",
          playerName: "司南",
          senderType: "player",
          tellPlayerName: "星河",
          channel: "tell",
          text: "晚点一起打虚空副本。",
          time: minutesAgo(7)
        },
        {
          id: "skyblock-msg-3",
          daemonId: skyblock.daemonId,
          instanceId: skyblock.instanceId,
          senderType: "system",
          text: "系统：空岛重置倒计时 2 小时。",
          time: minutesAgo(1)
        }
      ]
    },
    {
      server: archive,
      players: [],
      messages: [
        {
          id: "archive-msg-1",
          daemonId: archive.daemonId,
          instanceId: archive.instanceId,
          senderType: "system",
          text: "节点离线，当前仅显示预览结构。",
          time: minutesAgo(20)
        }
      ]
    }
  ];
};

export function useGmConsolePreviewState() {
  const previewRecords = createPreviewData();
  const servers = ref<IMcsmGmOverviewServer[]>(previewRecords.map((item) => item.server));
  const nodes = ref<IMcsmGmOverviewNode[]>(
    Array.from(new Set(servers.value.map((item) => item.daemonId))).map((daemonId) => {
      const daemonServers = servers.value.filter((item) => item.daemonId === daemonId);
      const firstServer = daemonServers[0];
      return {
        daemonId,
        daemonDisplayName: firstServer?.daemonDisplayName || daemonId,
        daemonAvailable: daemonServers.some((item) => item.daemonAvailable),
        daemonEndpoint: firstServer?.daemonEndpoint || "",
        instances: daemonServers
      };
    })
  );

  const previewState = ref<Record<string, PreviewServerRecord>>(
    Object.fromEntries(previewRecords.map((item) => [createGmServerKey(item.server.daemonId, item.server.instanceId), item]))
  );

  const players = computed(() =>
    (previewState.value[selectedServerKey.value]?.players || [])
      .map((item) => ({ ...item.presence }))
      .sort(sortPlayersByPresence)
  );
  const allPlayers = computed(() =>
    Object.values(previewState.value)
      .flatMap((item) => item.players.map((player) => ({ ...player.presence })))
      .filter((item) => item.online)
      .sort(sortPlayersAcrossServers)
  );
  const messages = computed(() =>
    Object.values(previewState.value)
      .flatMap((item) => item.messages.map((message) => ({ ...message })))
      .sort((a, b) => a.time.localeCompare(b.time))
  );
  const balances = ref<IMcsmGmPlayerBalances>();
  const luckPerms = ref<IMcsmLuckPermsSnapshot>();
  const moderation = ref<IMcsmGmModerationStatus>();
  const auditRecords = ref<IMcsmGmAuditRecord[]>([]);
  const lastActionResult = ref<IMcsmGmActionResult>();

  const isRefreshing = ref(false);
  const isPlayerLoading = ref(false);
  const isChatLoading = ref(false);
  const isDetailLoading = ref(false);
  const isExecutingAction = ref(false);
  const latestError = ref("");

  const selectedServerKey = ref(
    servers.value.length ? createGmServerKey(servers.value[0].daemonId, servers.value[0].instanceId) : ""
  );
  const selectedPlayerUuid = ref("");

  const currentServer = computed(() =>
    servers.value.find((item) => createGmServerKey(item.daemonId, item.instanceId) === selectedServerKey.value)
  );

  const currentNode = computed(() =>
    nodes.value.find((item) => item.daemonId === currentServer.value?.daemonId)
  );

  const currentPlayerRecord = computed(() => {
    const serverState = previewState.value[selectedServerKey.value];
    if (!serverState || !selectedPlayerUuid.value) return undefined;
    return serverState.players.find((item) => item.presence.playerUuid === selectedPlayerUuid.value);
  });

  const currentPlayer = computed(() => currentPlayerRecord.value?.presence);

  const onlinePlayerCount = computed(() => players.value.filter((item) => item.online).length);

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

  const updatePlayerRefs = () => {
    const record = currentPlayerRecord.value;
    if (!record) {
      balances.value = undefined;
      luckPerms.value = undefined;
      moderation.value = undefined;
      auditRecords.value = [];
      lastActionResult.value = undefined;
      return;
    }

    balances.value = { ...record.balances };
    luckPerms.value = {
      ...record.luckPerms,
      groups: record.luckPerms.groups.map((item) => ({ ...item })),
      permissions: record.luckPerms.permissions.map((item) => ({ ...item }))
    };
    moderation.value = { ...record.moderation };
    auditRecords.value = record.auditRecords.slice().sort((a, b) => b.time.localeCompare(a.time));
    lastActionResult.value = undefined;
  };

  const syncServerState = () => {
    if (!players.value.length) {
      selectedPlayerUuid.value = "";
      updatePlayerRefs();
      return;
    }

    const stillSelected = players.value.some((item) => item.playerUuid === selectedPlayerUuid.value);
    if (!stillSelected) {
      selectedPlayerUuid.value = "";
      updatePlayerRefs();
      return;
    }

    updatePlayerRefs();
  };

  const createAuditRecord = (
    player: IMcsmGmPlayerPresence,
    payload: {
      actionKind: string;
      success: boolean;
      message: string;
      beforeValue?: number;
      afterValue?: number;
    }
  ): IMcsmGmAuditRecord => ({
    id: `preview-audit-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    operatorName: PREVIEW_OPERATOR,
    daemonId: player.daemonId,
    instanceId: player.instanceId,
    playerUuid: player.playerUuid,
    playerName: player.playerName,
    actionKind: payload.actionKind,
    success: payload.success,
    message: payload.message,
    beforeValue: payload.beforeValue,
    afterValue: payload.afterValue,
    time: new Date().toISOString()
  });

  const appendMessage = (
    serverKey: string,
    payload: Omit<IMcsmGmChatMessage, "id" | "daemonId" | "instanceId" | "time"> & {
      time?: string;
    }
  ) => {
    const serverState = previewState.value[serverKey];
    const server = serverState?.server;
    if (!serverState || !server) return;

    serverState.messages.push({
      id: `preview-msg-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      daemonId: server.daemonId,
      instanceId: server.instanceId,
      time: payload.time || new Date().toISOString(),
      ...payload
    });
    server.chatMessagesToday += 1;
  };

  const buildActionResult = (
    player: IMcsmGmPlayerPresence,
    kind: GmPanelActionPayload["kind"],
    message: string,
    options: {
      success?: boolean;
      beforeValue?: number;
      afterValue?: number;
    } = {}
  ): IMcsmGmActionResult => ({
    success: options.success ?? true,
    kind,
    daemonId: player.daemonId,
    instanceId: player.instanceId,
    playerUuid: player.playerUuid,
    playerName: player.playerName,
    message,
    beforeValue: options.beforeValue,
    afterValue: options.afterValue,
    balances: balances.value ? { ...balances.value } : undefined,
    luckPerms: luckPerms.value
      ? {
          ...luckPerms.value,
          groups: luckPerms.value.groups.map((item) => ({ ...item })),
          permissions: luckPerms.value.permissions.map((item) => ({ ...item }))
        }
      : undefined,
    moderation: moderation.value ? { ...moderation.value } : undefined,
    updatedAt: new Date().toISOString()
  });

  const updateSelectedPlayerActivity = () => {
    if (!currentPlayerRecord.value) return;
    currentPlayerRecord.value.presence.lastSeenAt = new Date().toISOString();
  };

  const selectServer = (serverKey: string) => {
    if (serverKey === selectedServerKey.value) return;
    selectedServerKey.value = serverKey;
  };

  const selectPlayer = (playerUuid: string, serverKey = selectedServerKey.value) => {
    if (serverKey !== selectedServerKey.value) {
      selectedServerKey.value = serverKey;
      selectedPlayerUuid.value = playerUuid;
      return;
    }
    selectedPlayerUuid.value = selectedPlayerUuid.value === playerUuid ? "" : playerUuid;
  };

  const refreshCurrent = async (_forceRequest = true) => {
    isRefreshing.value = true;
    isPlayerLoading.value = true;
    isChatLoading.value = true;
    isDetailLoading.value = true;
    latestError.value = "";

    try {
      await delay(180);
      if (selectedServerKey.value && currentServer.value?.daemonAvailable) {
        appendMessage(selectedServerKey.value, {
          senderType: "system",
          text: "本地预览：已刷新玩家快照、聊天缓存和 GM 详情。"
        });
      }
      syncServerState();
    } finally {
      isRefreshing.value = false;
      isPlayerLoading.value = false;
      isChatLoading.value = false;
      isDetailLoading.value = false;
    }
  };

  const executeAction = async (payload: GmPanelActionPayload) => {
    const player = currentPlayer.value;
    const record = currentPlayerRecord.value;
    const serverKey = selectedServerKey.value;
    const server = currentServer.value;

    if (!player || !record || !serverKey || !server) return false;

    isExecutingAction.value = true;
    latestError.value = "";

    try {
      await delay(120);

      const fail = (message: string) => {
        record.auditRecords.unshift(
          createAuditRecord(player, {
            actionKind: payload.kind,
            success: false,
            message
          })
        );
        updatePlayerRefs();
        lastActionResult.value = buildActionResult(player, payload.kind, message, { success: false });
        latestError.value = message;
        return false;
      };

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

      let message = "操作已执行。";
      let beforeValue: number | undefined;
      let afterValue: number | undefined;

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
        appendMessage(serverKey, {
          senderType: "gm",
          text: message
        });
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
        appendMessage(serverKey, {
          senderType: "gm",
          text: message
        });
      }

      if (
        payload.kind === "lp_group_add" ||
        payload.kind === "lp_group_switch" ||
        payload.kind === "lp_group_remove"
      ) {
        const previousPrimaryGroup = record.luckPerms.primaryGroup;
        const exists = record.luckPerms.groups.some((item) => item.name === payload.group && !item.temporary);

        if (payload.kind === "lp_group_add" && !exists) {
          record.luckPerms.groups.push({
            name: payload.group,
            temporary: false
          });
          record.luckPerms.primaryGroup = payload.group;
        }

        if (payload.kind === "lp_group_switch") {
          if (!exists) {
            record.luckPerms.groups.push({
              name: payload.group,
              temporary: false
            });
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
        appendMessage(serverKey, {
          senderType: "system",
          text: `${player.playerName} 已被 GM 禁言：${record.moderation.reason}`
        });
      }

      if (payload.kind === "chat_unmute") {
        record.moderation.muted = false;
        record.moderation.remainingSeconds = undefined;
        record.moderation.expireAt = undefined;
        record.moderation.reason = undefined;
        record.moderation.operatorName = PREVIEW_OPERATOR;
        record.moderation.updatedAt = new Date().toISOString();
        message = `已解除 ${player.playerName} 的禁言。`;
        appendMessage(serverKey, {
          senderType: "system",
          text: `${player.playerName} 的禁言已被 GM 解除。`
        });
      }

      updateSelectedPlayerActivity();
      record.auditRecords.unshift(
        createAuditRecord(player, {
          actionKind: payload.kind,
          success: true,
          message,
          beforeValue,
          afterValue
        })
      );

      updatePlayerRefs();
      syncServerState();

      const result = buildActionResult(player, payload.kind, message, {
        beforeValue,
        afterValue
      });
      lastActionResult.value = result;
      latestError.value = "";
      return true;
    } finally {
      isExecutingAction.value = false;
    }
  };

  watch(
    selectedServerKey,
    () => {
      syncServerState();
    },
    { immediate: true }
  );

  watch(
    selectedPlayerUuid,
    () => {
      updatePlayerRefs();
    },
    { immediate: true }
  );

  return {
    stateSource: "preview" as const,
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
    selectPlayer,
    refreshCurrent,
    executeAction
  };
}
