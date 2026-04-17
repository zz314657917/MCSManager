<script setup lang="ts">
import type { GmPanelActionPayload } from "@/hooks/useGmConsoleState";
import { GM_MUTE_PRESETS, formatGmDateTime, formatGmRelativeSeconds } from "@/types/gm";
import { Modal } from "ant-design-vue";
import { computed, ref, watch } from "vue";

type ExecuteHandler = (payload: GmPanelActionPayload) => boolean | Promise<boolean>;
type ActionConfirmConfig = {
  title: string;
  content: string;
  danger?: boolean;
};

const props = withDefaults(
  defineProps<{
    player?: IMcsmGmPlayerPresence;
    server?: IMcsmGmOverviewServer;
    balances?: IMcsmGmPlayerBalances;
    luckPerms?: IMcsmLuckPermsSnapshot;
    moderation?: IMcsmGmModerationStatus;
    inventory?: IMcsmGmPlayerInventorySnapshot;
    auditRecords?: IMcsmGmAuditRecord[];
    lastActionResult?: IMcsmGmActionResult;
    busy?: boolean;
    showInventory?: boolean;
    inventoryLoading?: boolean;
    onExecute?: ExecuteHandler;
    onRefreshInventory?: () => void | Promise<void>;
  }>(),
  {
    auditRecords: () => [],
    busy: false,
    showInventory: false,
    inventoryLoading: false,
    onExecute: undefined,
    onRefreshInventory: undefined
  }
);

const moneyAmount = ref<number | undefined>(1000);
const pointsAmount = ref<number | undefined>(10);
const selectedGroup = ref("");
const temporaryGroup = ref("");
const temporaryGroupDuration = ref("7d");
const permissionNode = ref("");
const temporaryPermissionNode = ref("");
const temporaryPermissionDuration = ref("7d");
const muteReason = ref("违规发言");
const customMuteMinutes = ref<number | undefined>(60);

const numberFormatter = new Intl.NumberFormat("zh-CN");
const createEmptyInventorySlot = (
  section: IMcsmGmInventorySlot["section"],
  slot: number
): IMcsmGmInventorySlot => ({
  section,
  slot,
  empty: true
});

const summaryItems = computed(() => {
  if (!props.player || !props.server) return [];
  return [
    { label: "UUID", value: props.player.playerUuid, mono: true },
    {
      label: "节点 / 实例",
      value: `${props.server.daemonDisplayName} / ${props.server.instanceDisplayName}`
    },
    {
      label: "最近活跃",
      value: formatGmDateTime(props.player.lastSeenAt)
    }
  ];
});

const availableGroupOptions = computed(() => {
  const values = new Set<string>();
  for (const item of props.luckPerms?.availableGroups || []) {
    const value = String(item || "").trim();
    if (value) values.add(value);
  }
  if (props.luckPerms?.primaryGroup) {
    values.add(props.luckPerms.primaryGroup);
  }
  for (const item of props.luckPerms?.groups || []) {
    if (item.name) values.add(item.name);
  }
  return Array.from(values).sort((left, right) => left.localeCompare(right, "zh-CN"));
});

const availableGroupSelectOptions = computed(() =>
  availableGroupOptions.value.map((value) => ({
    label: value,
    value
  }))
);

const currentGroups = computed(() => {
  const primaryGroup = props.luckPerms?.primaryGroup || "";
  return (props.luckPerms?.groups || []).slice().sort((left, right) => {
    const leftPrimary = !left.temporary && left.name === primaryGroup ? -1 : 0;
    const rightPrimary = !right.temporary && right.name === primaryGroup ? -1 : 0;
    if (leftPrimary !== rightPrimary) return leftPrimary - rightPrimary;
    if (left.temporary !== right.temporary) return left.temporary ? 1 : -1;
    return left.name.localeCompare(right.name, "zh-CN");
  });
});

const permissions = computed(() =>
  (props.luckPerms?.permissions || []).slice().sort((left, right) => {
    if (left.temporary !== right.temporary) return left.temporary ? 1 : -1;
    return left.node.localeCompare(right.node, "en");
  })
);

const assetAuditRecords = computed(() =>
  props.auditRecords.filter(
    (item) =>
      item.actionKind.startsWith("economy_") ||
      item.actionKind.startsWith("points_")
  )
);

const recentAuditRecords = computed(() => props.auditRecords.slice(0, 20));
const inventorySideSlots = computed(() => {
  const source = props.inventory?.slots || [];
  const findSlot = (section: IMcsmGmInventorySlot["section"], slot: number) =>
    source.find((item) => item.section === section && item.slot === slot) || createEmptyInventorySlot(section, slot);

  return [
    { label: "头盔", slot: findSlot("armor", 0) },
    { label: "胸甲", slot: findSlot("armor", 1) },
    { label: "护腿", slot: findSlot("armor", 2) },
    { label: "靴子", slot: findSlot("armor", 3) },
    { label: "副手", slot: findSlot("offhand", 0) }
  ];
});
const inventoryMainSlots = computed(() => {
  const source = props.inventory?.slots || [];
  return Array.from({ length: 27 }, (_, slot) =>
    source.find((item) => item.section === "main" && item.slot === slot) || createEmptyInventorySlot("main", slot)
  );
});
const inventoryHotbarSlots = computed(() => {
  const source = props.inventory?.slots || [];
  return Array.from({ length: 9 }, (_, slot) =>
    source.find((item) => item.section === "hotbar" && item.slot === slot) || createEmptyInventorySlot("hotbar", slot)
  );
});

const hasPlayer = computed(() => Boolean(props.player && props.server));
const currentPrimaryGroup = computed(() => props.luckPerms?.primaryGroup || "--");
const mutedStatusText = computed(() => {
  if (!props.moderation?.chatPluginAvailable) return "聊天管理不可用";
  if (!props.moderation.muted) return "当前未禁言";
  const remaining = formatGmRelativeSeconds(props.moderation.remainingSeconds);
  return `已禁言 / 剩余 ${remaining}`;
});

watch(
  [() => props.player?.playerUuid, availableGroupOptions, () => props.luckPerms?.primaryGroup],
  () => {
    const primaryGroup = props.luckPerms?.primaryGroup || "";
    if (primaryGroup && availableGroupOptions.value.includes(primaryGroup)) {
      selectedGroup.value = primaryGroup;
      return;
    }
    if (!selectedGroup.value || !availableGroupOptions.value.includes(selectedGroup.value)) {
      selectedGroup.value = availableGroupOptions.value[0] || "";
    }
  },
  { immediate: true }
);

watch(
  () => props.player?.playerUuid,
  () => {
    moneyAmount.value = 1000;
    pointsAmount.value = 10;
    temporaryGroup.value = "";
    temporaryGroupDuration.value = "7d";
    permissionNode.value = "";
    temporaryPermissionNode.value = "";
    temporaryPermissionDuration.value = "7d";
    muteReason.value = "违规发言";
    customMuteMinutes.value = 60;
  }
);

const formatAmount = (value?: number) =>
  value == null || !Number.isFinite(value) ? "--" : numberFormatter.format(value);

const formatGrantState = (expiresAt?: string, temporary?: boolean) => {
  if (!temporary) return "永久";
  return expiresAt ? `临时至 ${formatGmDateTime(expiresAt)}` : "临时";
};

const resolveInventorySlotTitle = (slot: IMcsmGmInventorySlot) =>
  slot.displayName || slot.rawTypeName || slot.material || "空槽位";

const resolveInventorySlotMeta = (slot: IMcsmGmInventorySlot) => {
  if (slot.empty) return "空槽位";
  const parts: string[] = [];
  if (slot.rawTypeName && slot.rawTypeName !== slot.material) {
    parts.push(slot.rawTypeName);
  } else if (slot.material) {
    parts.push(slot.material);
  }
  if (slot.maxDurability != null && slot.durability != null) {
    parts.push(`耐久 ${Math.max(0, slot.maxDurability - slot.durability)} / ${slot.maxDurability}`);
  }
  return parts.join(" · ");
};

const resolveInventorySlotAccent = (slot: IMcsmGmInventorySlot) => {
  if (slot.empty) return "";
  const material = String(slot.material || slot.rawTypeName || "").toUpperCase();
  if (material.includes("SWORD") || material.includes("AXE") || material.includes("BOW")) return "is-weapon";
  if (
    material.includes("HELMET") ||
    material.includes("CHESTPLATE") ||
    material.includes("LEGGINGS") ||
    material.includes("BOOTS")
  ) {
    return "is-armor";
  }
  if (
    material.includes("APPLE") ||
    material.includes("BEEF") ||
    material.includes("BREAD") ||
    material.includes("CARROT")
  ) {
    return "is-food";
  }
  if (material.includes("TOTEM") || material.includes("SHIELD")) return "is-special";
  return "is-item";
};

const resolveInventorySlotGlyph = (slot: IMcsmGmInventorySlot) => {
  const source = resolveInventorySlotTitle(slot).replace(/§./g, "").trim();
  if (!source || slot.empty) return "--";
  return source.slice(0, 2).toUpperCase();
};

const formatInventoryEnchants = (slot: IMcsmGmInventorySlot) =>
  (slot.enchants || []).map((item) => `${item.key} ${item.level}`).join(" / ");

const formatInventoryLore = (slot: IMcsmGmInventorySlot) => (slot.lore || []).join(" / ");

const refreshInventory = async () => {
  if (!props.onRefreshInventory || props.inventoryLoading) return;
  await props.onRefreshInventory();
};

const getActionLabel = (kind: string) => {
  switch (kind) {
    case "economy_deposit":
      return "加金币";
    case "economy_withdraw":
      return "扣金币";
    case "points_give":
      return "加点券";
    case "points_take":
      return "扣点券";
    case "lp_group_add":
      return "加组";
    case "lp_group_switch":
      return "切组";
    case "lp_group_remove":
      return "移除组";
    case "lp_permission_set":
      return "添加权限";
    case "lp_permission_unset":
      return "移除权限";
    case "lp_temp_group_add":
      return "添加临时组";
    case "lp_temp_group_remove":
      return "移除临时组";
    case "lp_temp_permission_set":
      return "添加临时权限";
    case "lp_temp_permission_unset":
      return "移除临时权限";
    case "chat_mute":
      return "禁言";
    case "chat_unmute":
      return "解除禁言";
    default:
      return kind;
  }
};

const buildActionConfirmConfig = (payload: GmPanelActionPayload): ActionConfirmConfig | undefined => {
  const playerName = props.player?.playerName || "当前玩家";

  switch (payload.kind) {
    case "economy_withdraw":
      return {
        title: "确认扣金币",
        content: `将从 ${playerName} 扣除 ${formatAmount(payload.amount)} 金币。`,
        danger: true
      };
    case "points_take":
      return {
        title: "确认扣点券",
        content: `将从 ${playerName} 扣除 ${formatAmount(payload.amount)} 点券。`,
        danger: true
      };
    case "lp_group_switch":
      return {
        title: "确认切换主组",
        content: `将把 ${playerName} 的主组从 ${currentPrimaryGroup.value} 切换到 ${payload.group}。`,
        danger: true
      };
    case "lp_group_remove":
      return {
        title: "确认移除权限组",
        content: `将从 ${playerName} 移除权限组 ${payload.group}。`,
        danger: true
      };
    case "lp_temp_group_remove":
      return {
        title: "确认移除临时组",
        content: `将从 ${playerName} 移除临时组 ${payload.group}。`,
        danger: true
      };
    case "lp_permission_unset":
      return {
        title: "确认移除权限节点",
        content: `将从 ${playerName} 移除权限节点 ${payload.node}。`,
        danger: true
      };
    case "lp_temp_permission_unset":
      return {
        title: "确认移除临时权限",
        content: `将从 ${playerName} 移除临时权限 ${payload.node}。`,
        danger: true
      };
    case "chat_mute":
      return {
        title: "确认禁言玩家",
        content: `将禁言 ${playerName} ${formatGmRelativeSeconds(payload.durationSeconds)}，原因：${payload.reason || "违规发言"}。`,
        danger: true
      };
    case "chat_unmute":
      return {
        title: "确认解除禁言",
        content: `将解除 ${playerName} 的禁言状态。`,
        danger: true
      };
    default:
      return undefined;
  }
};

const executeAction = async (payload: GmPanelActionPayload, onSuccess?: () => void) => {
  if (!hasPlayer.value || props.busy || !props.onExecute) return false;
  const result = await props.onExecute(payload);
  if (result) {
    onSuccess?.();
  }
  return Boolean(result);
};

const runAction = async (payload: GmPanelActionPayload, onSuccess?: () => void) => {
  const confirmConfig = buildActionConfirmConfig(payload);
  if (!confirmConfig) {
    return executeAction(payload, onSuccess);
  }

  Modal.confirm({
    title: confirmConfig.title,
    content: confirmConfig.content,
    okText: "确认执行",
    cancelText: "取消",
    okButtonProps: confirmConfig.danger ? { danger: true } : undefined,
    async onOk() {
      return executeAction(payload, onSuccess);
    }
  });

  return true;
};

const executeEconomyAction = (kind: "economy_deposit" | "economy_withdraw") => {
  const amount = Number(moneyAmount.value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return false;
  return runAction({ kind, amount });
};

const executePointsAction = (kind: "points_give" | "points_take") => {
  const amount = Number(pointsAmount.value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return false;
  return runAction({ kind, amount });
};

const executeGroupAdd = () => {
  const group = selectedGroup.value.trim();
  if (!group) return false;
  return runAction({ kind: "lp_group_add", group });
};

const executeGroupSwitch = () => {
  const group = selectedGroup.value.trim();
  if (!group) return false;
  return runAction({ kind: "lp_group_switch", group });
};

const executeTempGroupAdd = () => {
  const group = temporaryGroup.value.trim();
  const duration = temporaryGroupDuration.value.trim();
  if (!group || !duration) return false;
  return runAction(
    {
      kind: "lp_temp_group_add",
      group,
      duration
    },
    () => {
      temporaryGroup.value = "";
    }
  );
};

const removeGroup = (group: IMcsmLuckPermsGroupGrant) =>
  runAction(
    group.temporary
      ? {
          kind: "lp_temp_group_remove",
          group: group.name,
          duration: ""
        }
      : {
          kind: "lp_group_remove",
          group: group.name
        }
  );

const executePermissionAdd = () => {
  const node = permissionNode.value.trim();
  if (!node) return false;
  return runAction(
    {
      kind: "lp_permission_set",
      node
    },
    () => {
      permissionNode.value = "";
    }
  );
};

const executeTempPermissionAdd = () => {
  const node = temporaryPermissionNode.value.trim();
  const duration = temporaryPermissionDuration.value.trim();
  if (!node || !duration) return false;
  return runAction(
    {
      kind: "lp_temp_permission_set",
      node,
      duration
    },
    () => {
      temporaryPermissionNode.value = "";
    }
  );
};

const removePermission = (permission: IMcsmLuckPermsPermissionGrant) =>
  runAction(
    permission.temporary
      ? {
          kind: "lp_temp_permission_unset",
          node: permission.node,
          duration: ""
        }
      : {
          kind: "lp_permission_unset",
          node: permission.node
        }
  );

const executeMutePreset = (seconds: number) =>
  runAction({
    kind: "chat_mute",
    durationSeconds: seconds,
    reason: muteReason.value.trim() || "违规发言"
  });

const executeCustomMute = () => {
  const minutes = Number(customMuteMinutes.value || 0);
  if (!Number.isFinite(minutes) || minutes <= 0) return false;
  return runAction({
    kind: "chat_mute",
    durationSeconds: Math.round(minutes * 60),
    reason: muteReason.value.trim() || "违规发言"
  });
};

const executeUnmute = () =>
  runAction({
    kind: "chat_unmute"
  });
</script>

<template>
  <div class="gm-operations-panel" data-testid="gm-operations-panel">
    <a-empty
      v-if="!hasPlayer"
      :image="false"
      description="先从左侧选择一名在线玩家，再进行 GM 操作。"
    />

    <template v-else>
      <section class="gm-operations-panel__card gm-operations-panel__summary">
        <div class="gm-operations-panel__summary-strip">
          <article
            v-for="item in summaryItems"
            :key="item.label"
            class="gm-operations-panel__summary-item"
          >
            <span>{{ item.label }}</span>
            <strong :class="{ 'is-mono': item.mono }">{{ item.value }}</strong>
          </article>
        </div>

        <div class="gm-operations-panel__summary-meta">
          <a-tag v-if="player?.online" color="green">在线</a-tag>
          <a-tag v-else>离线</a-tag>
          <a-tag :color="server?.daemonAvailable ? 'blue' : 'default'">
            {{ server?.daemonAvailable ? "节点在线" : "节点离线" }}
          </a-tag>
          <a-tag :color="moderation?.muted ? 'red' : 'default'">
            {{ moderation?.muted ? "已禁言" : "可发言" }}
          </a-tag>
        </div>

        <div
          v-if="lastActionResult"
          class="gm-operations-panel__result"
          :class="{ 'is-failed': !lastActionResult.success }"
          data-testid="gm-last-action-result"
        >
          <strong>{{ getActionLabel(lastActionResult.kind) }}</strong>
          <span>{{ lastActionResult.message }}</span>
        </div>
      </section>

      <section v-if="showInventory" class="gm-operations-panel__card" data-testid="gm-inventory-section">
        <div class="gm-operations-panel__section-head">
          <div>
            <h3>玩家背包</h3>
            <span>{{ inventory?.updatedAt ? `最近刷新：${formatGmDateTime(inventory.updatedAt)}` : "按需读取当前在线玩家背包" }}</span>
          </div>
          <a-button
            size="small"
            :loading="inventoryLoading"
            :disabled="busy || inventoryLoading || !player?.online"
            data-testid="gm-inventory-refresh"
            @click="refreshInventory"
          >
            刷新背包
          </a-button>
        </div>

        <a-empty
          v-if="!inventory?.available"
          :image="false"
          description="当前未获取到背包快照。"
        />

        <div v-else class="gm-operations-panel__inventory-layout">
          <div class="gm-operations-panel__inventory-cluster">
            <div class="gm-operations-panel__inventory-subhead">装备栏</div>
            <div class="gm-operations-panel__inventory-side">
              <div
                v-for="entry in inventorySideSlots"
                :key="`${entry.label}:${entry.slot.slot}`"
                class="gm-operations-panel__inventory-side-entry"
              >
                <span>{{ entry.label }}</span>
                <a-popover :trigger="['hover', 'click']" placement="top">
                  <template #content>
                    <div class="gm-operations-panel__inventory-popover">
                      <strong>{{ resolveInventorySlotTitle(entry.slot) }}</strong>
                      <div>{{ resolveInventorySlotMeta(entry.slot) }}</div>
                      <div v-if="entry.slot.enchants?.length">附魔：{{ formatInventoryEnchants(entry.slot) }}</div>
                      <div v-if="entry.slot.lore?.length">Lore：{{ formatInventoryLore(entry.slot) }}</div>
                    </div>
                  </template>

                  <button
                    type="button"
                    class="gm-operations-panel__inventory-slot"
                    :class="[resolveInventorySlotAccent(entry.slot), { 'is-empty': entry.slot.empty }]"
                  >
                    <strong>{{ resolveInventorySlotGlyph(entry.slot) }}</strong>
                    <span
                      v-if="entry.slot.amount && entry.slot.amount > 1"
                      class="gm-operations-panel__inventory-amount"
                    >
                      {{ entry.slot.amount }}
                    </span>
                  </button>
                </a-popover>
              </div>
            </div>
          </div>

          <div class="gm-operations-panel__inventory-cluster gm-operations-panel__inventory-main">
            <div class="gm-operations-panel__inventory-subhead">主背包</div>
            <div class="gm-operations-panel__inventory-grid" data-testid="gm-inventory-main-grid">
              <a-popover
                v-for="slot in inventoryMainSlots"
                :key="`main:${slot.slot}`"
                :trigger="['hover', 'click']"
                placement="top"
              >
                <template #content>
                  <div class="gm-operations-panel__inventory-popover">
                    <strong>{{ resolveInventorySlotTitle(slot) }}</strong>
                    <div>{{ resolveInventorySlotMeta(slot) }}</div>
                    <div v-if="slot.enchants?.length">附魔：{{ formatInventoryEnchants(slot) }}</div>
                    <div v-if="slot.lore?.length">Lore：{{ formatInventoryLore(slot) }}</div>
                  </div>
                </template>

                <button
                  type="button"
                  class="gm-operations-panel__inventory-slot"
                  :class="[resolveInventorySlotAccent(slot), { 'is-empty': slot.empty }]"
                >
                  <strong>{{ resolveInventorySlotGlyph(slot) }}</strong>
                  <span v-if="slot.amount && slot.amount > 1" class="gm-operations-panel__inventory-amount">
                    {{ slot.amount }}
                  </span>
                </button>
              </a-popover>
            </div>

            <div class="gm-operations-panel__inventory-hotbar-label">快捷栏</div>
            <div class="gm-operations-panel__inventory-grid gm-operations-panel__inventory-grid--hotbar">
              <a-popover
                v-for="slot in inventoryHotbarSlots"
                :key="`hotbar:${slot.slot}`"
                :trigger="['hover', 'click']"
                placement="top"
              >
                <template #content>
                  <div class="gm-operations-panel__inventory-popover">
                    <strong>{{ resolveInventorySlotTitle(slot) }}</strong>
                    <div>{{ resolveInventorySlotMeta(slot) }}</div>
                    <div v-if="slot.enchants?.length">附魔：{{ formatInventoryEnchants(slot) }}</div>
                    <div v-if="slot.lore?.length">Lore：{{ formatInventoryLore(slot) }}</div>
                  </div>
                </template>

                <button
                  type="button"
                  class="gm-operations-panel__inventory-slot"
                  :class="[resolveInventorySlotAccent(slot), { 'is-empty': slot.empty }]"
                >
                  <strong>{{ resolveInventorySlotGlyph(slot) }}</strong>
                  <span v-if="slot.amount && slot.amount > 1" class="gm-operations-panel__inventory-amount">
                    {{ slot.amount }}
                  </span>
                </button>
              </a-popover>
            </div>
          </div>
        </div>
      </section>

      <section class="gm-operations-panel__grid">
        <article class="gm-operations-panel__card gm-operations-panel__finance-card">
          <div class="gm-operations-panel__section-head">
            <div>
              <h3>金币</h3>
              <span>Vault Economy</span>
            </div>
            <strong data-testid="gm-economy-balance">
              {{ balances?.economyAvailable ? formatAmount(balances?.economyBalance) : "--" }}
            </strong>
          </div>

          <div class="gm-operations-panel__action-row">
            <a-input-number
              v-model:value="moneyAmount"
              class="gm-operations-panel__number-input"
              :min="1"
              :precision="0"
              :disabled="busy || !balances?.economyAvailable"
              data-testid="gm-economy-amount"
            />
            <a-button
              type="primary"
              :loading="busy"
              :disabled="!balances?.economyAvailable"
              data-testid="gm-economy-deposit"
              @click="executeEconomyAction('economy_deposit')"
            >
              加钱
            </a-button>
            <a-button
              :loading="busy"
              :disabled="!balances?.economyAvailable"
              data-testid="gm-economy-withdraw"
              @click="executeEconomyAction('economy_withdraw')"
            >
              扣钱
            </a-button>
          </div>
        </article>

        <article class="gm-operations-panel__card gm-operations-panel__finance-card">
          <div class="gm-operations-panel__section-head">
            <div>
              <h3>点券</h3>
              <span>PlayerPoints</span>
            </div>
            <strong data-testid="gm-points-balance">
              {{ balances?.pointsAvailable ? formatAmount(balances?.pointsBalance) : "--" }}
            </strong>
          </div>

          <div class="gm-operations-panel__action-row">
            <a-input-number
              v-model:value="pointsAmount"
              class="gm-operations-panel__number-input"
              :min="1"
              :precision="0"
              :disabled="busy || !balances?.pointsAvailable"
              data-testid="gm-points-amount"
            />
            <a-button
              type="primary"
              :loading="busy"
              :disabled="!balances?.pointsAvailable"
              data-testid="gm-points-give"
              @click="executePointsAction('points_give')"
            >
              加点
            </a-button>
            <a-button
              :loading="busy"
              :disabled="!balances?.pointsAvailable"
              data-testid="gm-points-take"
              @click="executePointsAction('points_take')"
            >
              扣点
            </a-button>
          </div>
        </article>
      </section>

      <section class="gm-operations-panel__card">
        <div class="gm-operations-panel__section-head">
          <div>
            <h3>聊天管理</h3>
            <span>{{ mutedStatusText }}</span>
          </div>
          <strong>{{ moderation?.muted ? formatGmRelativeSeconds(moderation?.remainingSeconds) : "--" }}</strong>
        </div>

        <div class="gm-operations-panel__mute-presets">
          <a-button
            v-for="preset in GM_MUTE_PRESETS"
            :key="preset.label"
            size="small"
            :disabled="busy || !moderation?.chatPluginAvailable"
            @click="executeMutePreset(preset.seconds)"
          >
            {{ preset.label }}
          </a-button>
        </div>

        <div class="gm-operations-panel__action-grid">
          <a-input
            v-model:value="muteReason"
            placeholder="禁言原因"
            :disabled="busy || !moderation?.chatPluginAvailable"
          />
          <a-input-number
            v-model:value="customMuteMinutes"
            :min="1"
            :precision="0"
            :disabled="busy || !moderation?.chatPluginAvailable"
          />
          <a-button
            type="primary"
            :loading="busy"
            :disabled="!moderation?.chatPluginAvailable"
            @click="executeCustomMute"
          >
            禁言
          </a-button>
          <a-button
            danger
            :loading="busy"
            :disabled="!moderation?.chatPluginAvailable || !moderation?.muted"
            @click="executeUnmute"
          >
            解除禁言
          </a-button>
        </div>

        <div class="gm-operations-panel__inline-meta">
          <span>原因：{{ moderation?.reason || "未设置" }}</span>
          <span>到期：{{ moderation?.expireAt ? formatGmDateTime(moderation.expireAt) : "--" }}</span>
          <span>操作人：{{ moderation?.operatorName || "--" }}</span>
        </div>
      </section>

      <section class="gm-operations-panel__card">
        <div class="gm-operations-panel__lp-grid">
          <article class="gm-operations-panel__lp-block">
            <div class="gm-operations-panel__section-head">
              <div>
                <h3>组操作</h3>
                <span>主组：{{ currentPrimaryGroup }}</span>
              </div>
              <strong>{{ luckPerms?.available ? "LuckPerms" : "不可用" }}</strong>
            </div>

            <div class="gm-operations-panel__action-row">
              <a-select
                v-model:value="selectedGroup"
                class="gm-operations-panel__select"
                :options="availableGroupSelectOptions"
                :disabled="busy || !luckPerms?.available"
                placeholder="选择权限组"
                show-search
              />
              <a-button
                type="primary"
                :loading="busy"
                :disabled="!luckPerms?.available || !selectedGroup"
                @click="executeGroupAdd"
              >
                加组
              </a-button>
              <a-button
                :loading="busy"
                :disabled="!luckPerms?.available || !selectedGroup"
                @click="executeGroupSwitch"
              >
                切组
              </a-button>
            </div>

            <div class="gm-operations-panel__action-grid">
              <a-input
                v-model:value="temporaryGroup"
                placeholder="临时组名"
                :disabled="busy || !luckPerms?.available"
              />
              <a-input
                v-model:value="temporaryGroupDuration"
                placeholder="时长，如 7d"
                :disabled="busy || !luckPerms?.available"
              />
              <a-button
                type="primary"
                :loading="busy"
                :disabled="!luckPerms?.available"
                @click="executeTempGroupAdd"
              >
                添加临时组
              </a-button>
            </div>

            <div class="gm-operations-panel__list">
              <div
                v-for="group in currentGroups"
                :key="`${group.name}:${group.expiresAt || 'permanent'}`"
                class="gm-operations-panel__list-row"
              >
                <div class="gm-operations-panel__list-main">
                  <strong>{{ group.name }}</strong>
                  <span>{{ formatGrantState(group.expiresAt, group.temporary) }}</span>
                </div>
                <div class="gm-operations-panel__list-actions">
                  <a-tag v-if="group.name === luckPerms?.primaryGroup && !group.temporary" color="blue">
                    主组
                  </a-tag>
                  <a-button
                    size="small"
                    :loading="busy"
                    :disabled="!luckPerms?.available"
                    @click="removeGroup(group)"
                  >
                    移除
                  </a-button>
                </div>
              </div>

              <a-empty
                v-if="!currentGroups.length"
                :image="false"
                description="当前没有权限组记录。"
              />
            </div>
          </article>

          <article class="gm-operations-panel__lp-block">
            <div class="gm-operations-panel__section-head">
              <div>
                <h3>权限操作</h3>
                <span>添加区固定，列表独立滚动</span>
              </div>
              <strong>{{ permissions.length }}</strong>
            </div>

            <div class="gm-operations-panel__action-grid">
              <a-input
                v-model:value="permissionNode"
                placeholder="权限节点"
                :disabled="busy || !luckPerms?.available"
              />
              <a-button
                type="primary"
                :loading="busy"
                :disabled="!luckPerms?.available"
                @click="executePermissionAdd"
              >
                添加权限
              </a-button>
            </div>

            <div class="gm-operations-panel__action-grid">
              <a-input
                v-model:value="temporaryPermissionNode"
                placeholder="临时权限节点"
                :disabled="busy || !luckPerms?.available"
                data-testid="gm-temp-permission-node"
              />
              <a-input
                v-model:value="temporaryPermissionDuration"
                placeholder="时长，如 7d"
                :disabled="busy || !luckPerms?.available"
                data-testid="gm-temp-permission-duration"
              />
              <a-button
                type="primary"
                :loading="busy"
                :disabled="!luckPerms?.available"
                data-testid="gm-temp-permission-add"
                @click="executeTempPermissionAdd"
              >
                添加临时权限
              </a-button>
            </div>

            <div class="gm-operations-panel__list gm-operations-panel__list--permissions">
              <div
                v-for="permission in permissions"
                :key="`${permission.node}:${permission.expiresAt || 'permanent'}`"
                class="gm-operations-panel__list-row gm-operations-panel__list-row--permission"
              >
                <div class="gm-operations-panel__permission-main">
                  <strong>{{ permission.node }}</strong>
                  <span>{{ formatGrantState(permission.expiresAt, permission.temporary) }}</span>
                </div>
                <a-button
                  size="small"
                  :loading="busy"
                  :disabled="!luckPerms?.available"
                  @click="removePermission(permission)"
                >
                  移除
                </a-button>
              </div>

              <a-empty
                v-if="!permissions.length"
                :image="false"
                description="当前没有权限节点。"
              />
            </div>
          </article>
        </div>
      </section>

      <section class="gm-operations-panel__history-grid">
        <article class="gm-operations-panel__card">
          <div class="gm-operations-panel__section-head">
            <div>
              <h3>最近资产变动</h3>
              <span>金币与点券相关操作</span>
            </div>
            <strong>{{ assetAuditRecords.length }}</strong>
          </div>

          <div class="gm-operations-panel__list gm-operations-panel__list--history">
            <div
              v-for="record in assetAuditRecords"
              :key="record.id"
              class="gm-operations-panel__history-row"
            >
              <div class="gm-operations-panel__history-top">
                <strong>{{ getActionLabel(record.actionKind) }}</strong>
                <span>{{ formatGmDateTime(record.time) }}</span>
              </div>
              <div class="gm-operations-panel__history-bottom">
                <span>{{ record.message }}</span>
                <a-tag :color="record.success ? 'green' : 'red'">
                  {{ record.success ? "成功" : "失败" }}
                </a-tag>
              </div>
            </div>

            <a-empty
              v-if="!assetAuditRecords.length"
              :image="false"
              description="当前没有资产变动记录。"
            />
          </div>
        </article>

        <article class="gm-operations-panel__card">
          <div class="gm-operations-panel__section-head">
            <div>
              <h3>最近操作</h3>
              <span>时间 / 行为 / 结果</span>
            </div>
            <strong>{{ recentAuditRecords.length }}</strong>
          </div>

          <div class="gm-operations-panel__list gm-operations-panel__list--history">
            <div
              v-for="record in recentAuditRecords"
              :key="record.id"
              class="gm-operations-panel__history-row"
            >
              <div class="gm-operations-panel__history-top">
                <strong>{{ getActionLabel(record.actionKind) }}</strong>
                <span>{{ formatGmDateTime(record.time) }}</span>
              </div>
              <div class="gm-operations-panel__history-bottom">
                <span>{{ record.message }}</span>
                <a-tag :color="record.success ? 'green' : 'red'">
                  {{ record.success ? "成功" : "失败" }}
                </a-tag>
              </div>
            </div>

            <a-empty
              v-if="!recentAuditRecords.length"
              :image="false"
              description="当前没有最近操作。"
            />
          </div>
        </article>
      </section>
    </template>
  </div>
</template>

<style scoped lang="scss">
.gm-operations-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

.gm-operations-panel__card {
  padding: 14px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow:
    0 12px 28px rgba(15, 23, 42, 0.06),
    0 2px 6px rgba(15, 23, 42, 0.03);
  min-width: 0;
}

.gm-operations-panel__summary {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.gm-operations-panel__summary-strip {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding-bottom: 2px;
}

.gm-operations-panel__summary-item {
  min-width: 180px;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(241, 245, 249, 0.92);
  border: 1px solid rgba(148, 163, 184, 0.14);
}

.gm-operations-panel__summary-item span,
.gm-operations-panel__section-head span,
.gm-operations-panel__list-main span,
.gm-operations-panel__permission-main span,
.gm-operations-panel__history-bottom span,
.gm-operations-panel__inline-meta span {
  color: var(--color-gray-7);
}

.gm-operations-panel__summary-item span {
  display: block;
  font-size: 12px;
}

.gm-operations-panel__summary-item strong {
  display: block;
  margin-top: 4px;
  line-height: 1.5;
  word-break: break-word;
}

.gm-operations-panel__summary-item strong.is-mono {
  font-family: "Cascadia Mono", "Consolas", monospace;
  font-size: 12px;
}

.gm-operations-panel__summary-meta,
.gm-operations-panel__inline-meta,
.gm-operations-panel__mute-presets,
.gm-operations-panel__action-row,
.gm-operations-panel__history-top,
.gm-operations-panel__history-bottom,
.gm-operations-panel__section-head,
.gm-operations-panel__list-row,
.gm-operations-panel__list-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.gm-operations-panel__summary-meta,
.gm-operations-panel__inline-meta,
.gm-operations-panel__mute-presets {
  flex-wrap: wrap;
}

.gm-operations-panel__section-head,
.gm-operations-panel__history-top,
.gm-operations-panel__history-bottom,
.gm-operations-panel__list-row {
  justify-content: space-between;
}

.gm-operations-panel__section-head {
  margin-bottom: 12px;
}

.gm-operations-panel__section-head h3 {
  margin: 0;
  font-size: 16px;
}

.gm-operations-panel__section-head strong {
  font-size: 18px;
}

.gm-operations-panel__result {
  display: grid;
  gap: 4px;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(220, 252, 231, 0.72);
  color: #166534;
}

.gm-operations-panel__result.is-failed {
  background: rgba(254, 226, 226, 0.8);
  color: #991b1b;
}

.gm-operations-panel__inventory-layout {
  display: grid;
  gap: 16px;
  min-width: 0;
}

.gm-operations-panel__inventory-cluster {
  display: grid;
  gap: 10px;
  min-width: 0;
}

.gm-operations-panel__inventory-subhead,
.gm-operations-panel__inventory-hotbar-label {
  color: var(--color-gray-7);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.gm-operations-panel__inventory-side {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, var(--gm-inventory-slot-size, 64px)));
  gap: 10px;
  justify-content: start;
}

.gm-operations-panel__inventory-side-entry {
  display: grid;
  gap: 6px;
  justify-items: center;
  min-width: 0;
}

.gm-operations-panel__inventory-side-entry span,
.gm-operations-panel__inventory-popover div {
  color: var(--color-gray-7);
  font-size: 12px;
}

.gm-operations-panel__inventory-main {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.gm-operations-panel__inventory-grid {
  display: grid;
  grid-template-columns: repeat(9, minmax(0, var(--gm-inventory-slot-size, 64px)));
  gap: 8px;
  justify-content: start;
  min-width: 0;
}

.gm-operations-panel__inventory-slot {
  position: relative;
  display: grid;
  place-items: center;
  min-width: 0;
  aspect-ratio: 1;
  padding: 0;
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.96), rgba(226, 232, 240, 0.92));
  color: var(--color-gray-9);
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
}

.gm-operations-panel__inventory-slot strong {
  font-size: 12px;
  letter-spacing: 0.04em;
}

.gm-operations-panel__inventory-slot.is-empty {
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.72), rgba(226, 232, 240, 0.52));
  color: var(--color-gray-6);
  cursor: default;
}

.gm-operations-panel__inventory-slot.is-weapon {
  background: linear-gradient(180deg, rgba(254, 242, 242, 0.98), rgba(254, 226, 226, 0.94));
  color: #b91c1c;
}

.gm-operations-panel__inventory-slot.is-armor {
  background: linear-gradient(180deg, rgba(239, 246, 255, 0.98), rgba(219, 234, 254, 0.94));
  color: #1d4ed8;
}

.gm-operations-panel__inventory-slot.is-food {
  background: linear-gradient(180deg, rgba(254, 249, 195, 0.98), rgba(254, 240, 138, 0.94));
  color: #a16207;
}

.gm-operations-panel__inventory-slot.is-special {
  background: linear-gradient(180deg, rgba(240, 253, 250, 0.98), rgba(204, 251, 241, 0.94));
  color: #0f766e;
}

.gm-operations-panel__inventory-slot.is-item {
  background: linear-gradient(180deg, rgba(243, 244, 246, 0.98), rgba(229, 231, 235, 0.94));
  color: #374151;
}

.gm-operations-panel__inventory-amount {
  position: absolute;
  right: 6px;
  bottom: 5px;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
}

.gm-operations-panel__inventory-popover {
  display: grid;
  gap: 6px;
  max-width: 280px;
  word-break: break-word;
}

.gm-operations-panel__inventory-popover strong {
  color: var(--color-gray-9);
}

.gm-operations-panel__inventory-grid--hotbar {
  padding-top: 4px;
  border-top: 1px dashed rgba(148, 163, 184, 0.22);
}

.gm-operations-panel__grid,
.gm-operations-panel__history-grid,
.gm-operations-panel__lp-grid {
  display: grid;
  gap: 14px;
  min-width: 0;
}

.gm-operations-panel__grid,
.gm-operations-panel__history-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.gm-operations-panel__lp-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.gm-operations-panel__lp-block,
.gm-operations-panel__finance-card {
  min-width: 0;
}

.gm-operations-panel__action-row,
.gm-operations-panel__action-grid {
  min-width: 0;
}

.gm-operations-panel__action-row {
  flex-wrap: wrap;
}

.gm-operations-panel__action-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-top: 10px;
}

.gm-operations-panel__number-input,
.gm-operations-panel__select {
  min-width: 0;
  flex: 1 1 160px;
}

.gm-operations-panel__list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 220px;
  overflow-y: auto;
  min-width: 0;
}

.gm-operations-panel__list--permissions {
  max-height: 260px;
}

.gm-operations-panel__list--history {
  max-height: 210px;
}

.gm-operations-panel__list-row {
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(248, 250, 252, 0.92);
  border: 1px solid rgba(148, 163, 184, 0.14);
  min-width: 0;
}

.gm-operations-panel__list-row--permission {
  align-items: flex-start;
}

.gm-operations-panel__list-main,
.gm-operations-panel__permission-main,
.gm-operations-panel__history-row {
  min-width: 0;
}

.gm-operations-panel__list-main strong,
.gm-operations-panel__permission-main strong,
.gm-operations-panel__history-top strong {
  display: block;
  line-height: 1.4;
  word-break: break-word;
}

.gm-operations-panel__list-main span,
.gm-operations-panel__permission-main span {
  display: block;
  margin-top: 2px;
  font-size: 12px;
  line-height: 1.4;
}

.gm-operations-panel__permission-main {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.gm-operations-panel__permission-main strong,
.gm-operations-panel__permission-main span {
  display: inline-block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.gm-operations-panel__permission-main strong {
  flex: 1 1 auto;
}

.gm-operations-panel__permission-main span {
  flex: 0 0 auto;
  max-width: 180px;
}

.gm-operations-panel__history-row {
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(248, 250, 252, 0.92);
  border: 1px solid rgba(148, 163, 184, 0.14);
}

.gm-operations-panel__history-top span,
.gm-operations-panel__history-bottom span {
  font-size: 12px;
}

.gm-operations-panel__history-bottom span {
  flex: 1;
  min-width: 0;
  word-break: break-word;
}

@media (max-width: 900px) {
  .gm-operations-panel__grid,
  .gm-operations-panel__history-grid,
  .gm-operations-panel__lp-grid,
  .gm-operations-panel__action-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .gm-operations-panel__permission-main {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .gm-operations-panel__permission-main span {
    max-width: 100%;
  }

  .gm-operations-panel__inventory-side {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }

  .gm-operations-panel__inventory-grid {
    grid-template-columns: repeat(9, minmax(0, 1fr));
    gap: 6px;
  }

  .gm-operations-panel__inventory-side-entry span,
  .gm-operations-panel__inventory-subhead,
  .gm-operations-panel__inventory-hotbar-label {
    font-size: 11px;
  }
}
</style>
