<script setup lang="ts">
import { t } from "@/lang/i18n";
import { createControlTargetKey } from "@/tools/control";
import { getControlTargetIdentity, getControlTargetStatusColor, getControlTargetStatusText } from "@/tools/controlStatus";
import type { ControlPreviewNode, ControlTarget } from "@/types/control";
import { AppstoreOutlined, DatabaseOutlined, EditOutlined, StarFilled, StarOutlined } from "@ant-design/icons-vue";
import { computed } from "vue";

const NODE_TINT_PALETTE = [
  {
    chipBg: "var(--color-blue-1)",
    chipColor: "var(--color-blue-7)"
  },
  {
    chipBg: "var(--color-green-1)",
    chipColor: "var(--color-green-7)"
  },
  {
    chipBg: "var(--color-gold-1)",
    chipColor: "var(--color-gold-7)"
  },
  {
    chipBg: "var(--color-magenta-1)",
    chipColor: "var(--color-magenta-7)"
  },
  {
    chipBg: "var(--color-purple-1)",
    chipColor: "var(--color-purple-7)"
  },
  {
    chipBg: "var(--color-cyan-1)",
    chipColor: "var(--color-cyan-7)"
  }
];

const props = withDefaults(
  defineProps<{
    nodes: ControlPreviewNode[];
    currentNodeId?: string;
    currentTargets: ControlTarget[];
    currentTargetKey: string;
    favoriteTargetKeys?: string[];
    selectedTargetKeys?: string[];
    targetNotes?: Record<string, string>;
    targetFilterDaemonId?: string;
    allTargetsFilterValue?: string;
    batchSelectionEnabled?: boolean;
    drawer?: boolean;
  }>(),
  {
    currentNodeId: undefined,
    favoriteTargetKeys: () => [],
    selectedTargetKeys: () => [],
    targetNotes: () => ({}),
    targetFilterDaemonId: undefined,
    allTargetsFilterValue: "__all_control_targets__",
    batchSelectionEnabled: false,
    drawer: false
  }
);

const emit = defineEmits<{
  selectTarget: [target: ControlTarget];
  toggleBatchSelection: [target: ControlTarget];
  toggleVisibleBatchSelection: [targets: ControlTarget[]];
  toggleFavorite: [target: ControlTarget];
  changeTargetFilter: [daemonId: string];
  editTargetNote: [target: ControlTarget];
}>();

const handleSelectTarget = (target: ControlTarget) => {
  emit("selectTarget", target);
};

const handleToggleFavorite = (target: ControlTarget) => {
  emit("toggleFavorite", target);
};

const handleToggleBatchSelection = (target: ControlTarget) => {
  if (target.mode !== "instance") return;
  emit("toggleBatchSelection", target);
};

const handleToggleVisibleBatchSelection = () => {
  emit("toggleVisibleBatchSelection", visibleInstanceTargets.value);
};

const handleChangeTargetFilter = (daemonId: string) => {
  emit("changeTargetFilter", daemonId);
};

const handleTargetFilterUpdate = (value: unknown) => {
  if (typeof value !== "string") return;
  handleChangeTargetFilter(value);
};

const handleEditTargetNote = (target: ControlTarget) => {
  emit("editTargetNote", target);
};

const normalizeTestKey = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, "-");
const favoriteTargetKeySet = computed(() => new Set(props.favoriteTargetKeys));
const selectedTargetKeySet = computed(() => new Set(props.selectedTargetKeys));
const getTargetKey = (target: ControlTarget) => createControlTargetKey(target);
const isTargetFavorited = (target: ControlTarget) =>
  target.mode === "instance" && favoriteTargetKeySet.value.has(getTargetKey(target));
const isTargetBatchSelected = (target: ControlTarget) =>
  target.mode === "instance" && selectedTargetKeySet.value.has(getTargetKey(target));
const visibleInstanceTargets = computed(() =>
  props.currentTargets.filter((target) => target.mode === "instance")
);
const areVisibleInstanceTargetsSelected = computed(
  () =>
    visibleInstanceTargets.value.length > 0 &&
    visibleInstanceTargets.value.every((target) => selectedTargetKeySet.value.has(getTargetKey(target)))
);

const getTargetNote = (target: ControlTarget) =>
  target.mode === "instance" ? String(props.targetNotes[getTargetKey(target)] || "").trim() : "";

const getTargetDisplayTitle = (target: ControlTarget) => getTargetNote(target) || target.displayName;

const getTargetMetaText = (target: ControlTarget) => {
  if (target.mode !== "instance") return getControlTargetIdentity(target);
  if (target.onlinePlayers == null) return "人数 --";
  return target.maxPlayers == null
    ? `人数 ${target.onlinePlayers}`
    : `人数 ${target.onlinePlayers} / ${target.maxPlayers}`;
};

const targetFilterOptions = computed(() => [
  {
    label: t("TXT_CODE_CONTROL_ALL_TARGETS"),
    value: props.allTargetsFilterValue
  },
  ...props.nodes.map((node) => ({
    label: node.daemonDisplayName,
    value: node.daemonId
  }))
]);

const getNodeTintStyle = (target: ControlTarget) => {
  let hash = 0;
  for (let index = 0; index < target.daemonId.length; index += 1) {
    hash = (hash + target.daemonId.charCodeAt(index) * (index + 1)) % NODE_TINT_PALETTE.length;
  }

  const tint = NODE_TINT_PALETTE[hash];
  return {
    "--control-target-node-chip-bg": tint.chipBg,
    "--control-target-node-chip-color": tint.chipColor
  };
};
</script>

<template>
  <div
    class="control-target-selector"
    :class="{ 'control-target-selector--drawer': drawer }"
    :data-testid="drawer ? 'control-target-selector-drawer' : 'control-target-selector'"
  >
    <section class="control-panel control-panel--targets" :class="{ 'control-panel--drawer-section': drawer }">
      <div class="control-panel__header">
        <div class="control-target-selector__header-copy">
          <span>{{ t("TXT_CODE_d655beec") }}</span>
          <a-tag>{{ currentTargets.length }}</a-tag>
          <a-tag v-if="selectedTargetKeys.length" color="blue">
            {{ t("TXT_CODE_432cbc38") }} {{ selectedTargetKeys.length }} {{ t("TXT_CODE_5cd3b4bd") }}
          </a-tag>
          <a-button
            v-if="batchSelectionEnabled && visibleInstanceTargets.length"
            type="link"
            size="small"
            class="control-target-selector__batch-toggle"
            @click="handleToggleVisibleBatchSelection"
          >
            {{ areVisibleInstanceTargetsSelected ? t("TXT_CODE_df87c46d") : t("TXT_CODE_f466d7a") }}
          </a-button>
        </div>
        <a-select
          class="control-target-selector__filter-select"
          :value="targetFilterDaemonId"
          :options="targetFilterOptions"
          size="small"
          :bordered="false"
          :dropdown-match-select-width="false"
          data-testid="control-target-filter"
          @update:value="handleTargetFilterUpdate"
        />
      </div>
      <div
        class="control-target-selector__list control-target-selector__list--targets"
        :class="{ 'control-target-selector__list--drawer': drawer }"
      >
        <div
          v-for="target in currentTargets"
          :key="getTargetKey(target)"
          class="control-target-selector__card"
          :class="{
            'is-active': currentTargetKey === getTargetKey(target),
            'is-batch-selected': isTargetBatchSelected(target)
          }"
          role="button"
          tabindex="0"
          :style="getNodeTintStyle(target)"
          :data-testid="
            `control-target-card-${normalizeTestKey(target.daemonId)}-${target.mode}-${normalizeTestKey(target.instanceId)}`
          "
          :title="`${target.daemonDisplayName} / ${target.displayName} (${target.instanceId})`"
          @click="handleSelectTarget(target)"
          @keydown.enter.prevent="handleSelectTarget(target)"
          @keydown.space.prevent="handleSelectTarget(target)"
        >
          <div class="control-target-selector__target-row">
            <div class="control-target-selector__target-title-group">
              <span
                v-if="batchSelectionEnabled && target.mode === 'instance'"
                class="control-target-selector__batch-checkbox"
                @click.stop
                @keydown.stop
              >
                <a-checkbox
                  :checked="isTargetBatchSelected(target)"
                  :aria-label="t('TXT_CODE_CONTROL_BATCH_SELECT_TARGET')"
                  @change="handleToggleBatchSelection(target)"
                />
              </span>
              <component
                :is="target.mode === 'global' ? DatabaseOutlined : AppstoreOutlined"
                class="control-target-selector__target-icon"
              />
              <span class="control-target-selector__card-title control-target-selector__card-title--target">
                {{ getTargetDisplayTitle(target) }}
              </span>
            </div>
            <div class="control-target-selector__target-actions">
              <a-button
                v-if="target.mode === 'instance'"
                type="text"
                size="small"
                class="control-target-selector__favorite-button"
                :title="
                  isTargetFavorited(target)
                    ? t('TXT_CODE_CONTROL_UNFAVORITE_TARGET')
                    : t('TXT_CODE_CONTROL_FAVORITE_TARGET')
                "
                :aria-label="
                  isTargetFavorited(target)
                    ? t('TXT_CODE_CONTROL_UNFAVORITE_TARGET')
                    : t('TXT_CODE_CONTROL_FAVORITE_TARGET')
                "
                :data-testid="
                  `control-target-favorite-${normalizeTestKey(target.daemonId)}-${target.mode}-${normalizeTestKey(target.instanceId)}`
                "
                @click.stop="handleToggleFavorite(target)"
              >
                <template #icon>
                  <component
                    :is="isTargetFavorited(target) ? StarFilled : StarOutlined"
                    :class="{ 'is-favorited': isTargetFavorited(target) }"
                  />
                </template>
              </a-button>
              <a-button
                v-if="target.mode === 'instance'"
                type="text"
                size="small"
                class="control-target-selector__edit-button"
                :title="t('TXT_CODE_CONTROL_EDIT_TARGET_NOTE')"
                :aria-label="t('TXT_CODE_CONTROL_EDIT_TARGET_NOTE')"
                :data-testid="
                  `control-target-note-${normalizeTestKey(target.daemonId)}-${target.mode}-${normalizeTestKey(target.instanceId)}`
                "
                @click.stop="handleEditTargetNote(target)"
              >
                <template #icon>
                  <EditOutlined />
                </template>
              </a-button>
              <a-tag
                class="m-0 control-target-selector__status-tag"
                size="small"
                :color="getControlTargetStatusColor(target)"
                :data-status-tone="getControlTargetStatusColor(target)"
                :data-testid="
                  `control-target-status-${normalizeTestKey(target.daemonId)}-${target.mode}-${normalizeTestKey(target.instanceId)}`
                "
              >
                {{ getControlTargetStatusText(target) }}
              </a-tag>
            </div>
          </div>

          <div class="control-target-selector__target-meta-row">
            <a-tag class="control-target-selector__node-chip" size="small" :bordered="false">
              {{ target.daemonDisplayName }}
            </a-tag>
            <span class="control-target-selector__target-identity">
              {{ getTargetMetaText(target) }}
            </span>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style lang="scss" scoped>
.control-target-selector {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 0;
}

.control-target-selector--drawer {
  gap: 12px;
}

.control-panel {
  min-height: 0;
  border: 1px solid var(--card-border-color);
  border-radius: 20px;
  background: var(--background-color-white);
  box-shadow: none;
}

.control-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 18px 12px;
  font-weight: 700;
}

.control-panel--targets,
.control-panel--drawer-section {
  display: flex;
  flex-direction: column;
}

.control-panel--targets {
  flex: 1 1 auto;
}

.control-target-selector__header-copy {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.control-target-selector__filter-select {
  min-width: 148px;
  flex: 0 0 auto;
  background: var(--design-canvas-soft);
  border-radius: 999px;
}

.control-target-selector__batch-toggle {
  padding-inline: 0;
}

.control-target-selector__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
  padding: 0 14px 16px;
  overflow-y: auto;
}

.control-target-selector__list--targets {
  flex: 1 1 auto;
}

.control-target-selector__list--drawer {
  max-height: 52vh;
}

.control-target-selector__list--drawer::-webkit-scrollbar {
  width: 8px;
}

.control-target-selector__list--drawer::-webkit-scrollbar-track {
  background: var(--design-canvas-soft);
  border-radius: 4px;
}

.control-target-selector__list--drawer::-webkit-scrollbar-thumb {
  background: var(--color-blue-4);
  border-radius: 4px;
}

.control-target-selector__list--drawer::-webkit-scrollbar-thumb:hover {
  background: var(--color-blue-5);
}

@media (min-width: 993px) {
  .control-target-selector:not(.control-target-selector--drawer) {
    height: calc(100svh - 180px);
    max-height: calc(100svh - 180px);
  }

  .control-target-selector:not(.control-target-selector--drawer) .control-panel--targets {
    height: 100%;
    max-height: 100%;
    overflow: hidden;
  }

  .control-target-selector:not(.control-target-selector--drawer) .control-target-selector__list--targets {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
  }
}

.control-target-selector__card {
  border: 1px solid var(--card-border-color);
  border-radius: 12px;
  padding: 10px 12px;
  background: var(--design-canvas-soft);
  text-align: left;
  cursor: pointer;
  transition:
    transform 0.18s ease,
    background-color 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease;
  color: var(--design-ink);
}

.control-target-selector__card:hover {
  transform: translateY(-1px);
  border-color: var(--design-hairline-strong);
  background: var(--inner-card-hover-bg);
  box-shadow: none;
}

.control-target-selector__card.is-active {
  border-color: var(--color-blue-5);
  background: var(--color-blue-1);
  box-shadow:
    0 10px 22px rgba(37, 99, 235, 0.08),
    inset 3px 0 0 var(--color-blue-6);
}

.control-target-selector__card.is-batch-selected {
  border-color: var(--color-blue-5);
  background: var(--color-blue-1);
  box-shadow:
    0 12px 26px rgba(37, 99, 235, 0.1),
    inset 0 0 0 2px var(--color-blue-3);
}

.control-target-selector__target-row {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
  min-width: 0;
}

.control-target-selector__target-meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 6px;
  min-width: 0;
}

.control-target-selector__target-title-group {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1 1 auto;
}

.control-target-selector__batch-checkbox {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
}

.control-target-selector__target-actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.control-target-selector__status-tag {
  border-color: var(--card-border-color);
  background: var(--color-gray-2);
  color: var(--design-muted);
  font-weight: 600;
}

.control-target-selector__status-tag[data-status-tone="success"] {
  border-color: var(--color-green-3);
  background: var(--color-green-1);
  color: var(--color-green-7);
}

.control-target-selector__status-tag[data-status-tone="error"] {
  border-color: var(--color-red-3);
  background: var(--color-red-1);
  color: var(--color-red-7);
}

.control-target-selector__status-tag[data-status-tone="processing"] {
  border-color: var(--color-gold-3);
  background: var(--color-gold-1);
  color: var(--color-gold-7);
}

.control-target-selector__card-title {
  font-weight: 700;
  line-height: 1.3;
}

.control-target-selector__card-title--target {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.control-target-selector__node-chip {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--control-target-node-chip-color, var(--color-blue-7));
  background: var(--control-target-node-chip-bg, var(--color-blue-1));
  border: 1px solid var(--card-border-color);
}

.control-target-selector__target-identity {
  min-width: 0;
  color: var(--design-muted);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.control-target-selector__card-subtitle {
  color: var(--design-muted);
  font-size: 12px;
  word-break: break-all;
}

.control-target-selector__card-subtitle--compact {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  word-break: normal;
}

.control-target-selector__favorite-button {
  color: var(--design-muted);
  min-width: 28px;
  padding-inline: 4px;
}

.control-target-selector__edit-button {
  color: var(--design-muted);
  min-width: 28px;
  padding-inline: 4px;
}

.control-target-selector__favorite-button :deep(.is-favorited) {
  color: #f59e0b;
}

@media (max-width: 900px) {
  .control-panel__header {
    flex-wrap: wrap;
    align-items: stretch;
  }

  .control-target-selector__filter-select {
    width: 100%;
  }

  .control-target-selector__node-chip {
    max-width: 96px;
  }
}

.control-target-selector__target-icon {
  color: var(--design-body);
  font-size: 16px;
}
</style>
