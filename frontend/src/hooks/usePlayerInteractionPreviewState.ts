import type { PlayerBindingState, PlayerChatMessage, PlayerPresence } from "@/types/player-interaction";
import { computed, ref } from "vue";

export interface PlayerInteractionPreviewPresence extends PlayerPresence {
  daemonDisplayName: string;
  instanceDisplayName: string;
  accessMode: "admin" | "external";
  roleCode?: string;
  bindingState: PlayerBindingState;
}

const PREVIEW_PLAYERS: PlayerInteractionPreviewPresence[] = [
  {
    daemonId: "daemon-bj-01",
    daemonDisplayName: "B 节点 / 生存机",
    instanceId: "survival-1",
    instanceDisplayName: "落叶大陆-生存一区",
    playerUuid: "0a7b98ae-93df-4ef1-a91c-ef93d8264c11",
    playerName: "爱马仕",
    online: true,
    lastSeenAt: "21:08",
    accessMode: "external",
    roleCode: "LEAF-2048",
    bindingState: {
      status: "bound",
      qq: "314657917",
      playerUuid: "0a7b98ae-93df-4ef1-a91c-ef93d8264c11",
      playerName: "爱马仕",
      expiresAt: "2026-04-16 22:00"
    }
  },
  {
    daemonId: "daemon-hz-02",
    daemonDisplayName: "C 节点 / 副本机",
    instanceId: "dungeon-lobby",
    instanceDisplayName: "副本大厅",
    playerUuid: "8e72853d-3080-4f80-9ec5-3d021db2db29",
    playerName: "何方妖孽",
    online: true,
    lastSeenAt: "21:05",
    accessMode: "external",
    roleCode: "DGN-1137",
    bindingState: {
      status: "pending",
      qq: "26540321",
      playerUuid: "8e72853d-3080-4f80-9ec5-3d021db2db29",
      playerName: "何方妖孽",
      expiresAt: "2026-04-15 21:30"
    }
  },
  {
    daemonId: "daemon-panel-a",
    daemonDisplayName: "A 面板机 / 管理服",
    instanceId: "ops-world",
    instanceDisplayName: "运维测试服",
    playerUuid: "admin-preview-user",
    playerName: "管理员",
    online: true,
    lastSeenAt: "21:11",
    accessMode: "admin",
    bindingState: {
      status: "bound",
      qq: "",
      playerUuid: "admin-preview-user",
      playerName: "管理员"
    }
  }
];

const PREVIEW_MESSAGES: Record<string, PlayerChatMessage[]> = {
  "0a7b98ae-93df-4ef1-a91c-ef93d8264c11": [
    {
      id: "msg-1",
      daemonId: "daemon-bj-01",
      instanceId: "survival-1",
      senderType: "system",
      senderId: "system",
      senderName: "System",
      text: "网页互动页一期将通过插件桥接聊天，不再解析控制台日志。",
      time: "20:56"
    },
    {
      id: "msg-2",
      daemonId: "daemon-bj-01",
      instanceId: "survival-1",
      senderType: "player",
      senderId: "0a7b98ae-93df-4ef1-a91c-ef93d8264c11",
      senderName: "爱马仕",
      text: "今晚副本队几点开？",
      time: "20:58"
    },
    {
      id: "msg-3",
      daemonId: "daemon-bj-01",
      instanceId: "survival-1",
      senderType: "web",
      senderId: "panel-admin",
      senderName: "Web Admin",
      text: "这个区域现在只是占位页，后续会开放网页发言。",
      time: "21:00"
    },
    {
      id: "msg-4",
      daemonId: "daemon-bj-01",
      instanceId: "survival-1",
      senderType: "player",
      senderId: "0a7b98ae-93df-4ef1-a91c-ef93d8264c11",
      senderName: "爱马仕",
      text: "收到，我这边先绑定角色码再测外网页面。",
      time: "21:02"
    }
  ],
  "8e72853d-3080-4f80-9ec5-3d021db2db29": [
    {
      id: "msg-5",
      daemonId: "daemon-hz-02",
      instanceId: "dungeon-lobby",
      senderType: "player",
      senderId: "8e72853d-3080-4f80-9ec5-3d021db2db29",
      senderName: "何方妖孽",
      text: "我已经申请了角色码，等会去服里确认。",
      time: "20:49"
    },
    {
      id: "msg-6",
      daemonId: "daemon-hz-02",
      instanceId: "dungeon-lobby",
      senderType: "system",
      senderId: "system",
      senderName: "System",
      text: "待确认状态下只展示绑定引导，不允许从网页端发送消息。",
      time: "20:50"
    },
    {
      id: "msg-7",
      daemonId: "daemon-hz-02",
      instanceId: "dungeon-lobby",
      senderType: "player",
      senderId: "8e72853d-3080-4f80-9ec5-3d021db2db29",
      senderName: "何方妖孽",
      text: "可以，先把页面结构定下来就行。",
      time: "20:53"
    }
  ],
  "admin-preview-user": [
    {
      id: "msg-8",
      daemonId: "daemon-panel-a",
      instanceId: "ops-world",
      senderType: "system",
      senderId: "system",
      senderName: "System",
      text: "管理员进入互动页时可直接查看玩家列表和聊天时间线。",
      time: "21:04"
    },
    {
      id: "msg-9",
      daemonId: "daemon-panel-a",
      instanceId: "ops-world",
      senderType: "web",
      senderId: "panel-admin",
      senderName: "Web Admin",
      text: "这里预留的是后续玩家互动的一期入口，不和 /control 终端混用。",
      time: "21:06"
    },
    {
      id: "msg-10",
      daemonId: "daemon-panel-a",
      instanceId: "ops-world",
      senderType: "player",
      senderId: "admin-preview-user",
      senderName: "管理员",
      text: "后面把 QQ 绑定、角色码和插件桥接分别接进来。",
      time: "21:08"
    }
  ]
};

export const usePlayerInteractionPreviewState = () => {
  const players = ref<PlayerInteractionPreviewPresence[]>(PREVIEW_PLAYERS);
  const selectedPlayerUuid = ref(players.value[0]?.playerUuid ?? "");

  const currentPlayer = computed(
    () => players.value.find((player) => player.playerUuid === selectedPlayerUuid.value) || players.value[0]
  );

  const currentMessages = computed<PlayerChatMessage[]>(() => {
    const playerUuid = currentPlayer.value?.playerUuid;
    if (!playerUuid) return [];
    return PREVIEW_MESSAGES[playerUuid] || [];
  });

  const selectPlayer = (playerUuid: string) => {
    selectedPlayerUuid.value = playerUuid;
  };

  return {
    players,
    selectedPlayerUuid,
    currentPlayer,
    currentMessages,
    selectPlayer
  };
};
