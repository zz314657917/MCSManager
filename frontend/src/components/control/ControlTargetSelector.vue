<script setup lang="ts">
import { t } from "@/lang/i18n";
import { getControlTargetIdentity, getControlTargetStatusColor, getControlTargetStatusText } from "@/tools/controlStatus";
import type { ControlPreviewNode, ControlTarget } from "@/types/control";
import { AppstoreOutlined, DatabaseOutlined } from "@ant-design/icons-vue";

withDefaults(
  defineProps<{
    nodes: ControlPreviewNode[];
    currentNodeId?: string;
    currentTargets: ControlTarget[];
    currentTargetKey: string;
    drawer?: boolean;
  }>(),
  {
    currentNodeId: undefined,
    drawer: false
  }
);

const emit = defineEmits<{
  selectNode: [daemonId: string];
  selectTarget: [target: ControlTarget];
}>();

const handleSelectNode = (daemonId: string) => {
  emit("selectNode", daemonId);
};

const handleSelectTarget = (target: ControlTarget) => {
  emit("selectTarget", target);
};
</script>

<template>
  <div class="control-target-selector" :class="{ 'control-target-selector--drawer': drawer }">
    <section class="control-panel control-panel--nodes" :class="{ 'control-panel--drawer-section': drawer }">
      <div class="control-panel__header">
        <span>{{ t("TXT_CODE_20509fa0") }}</span>
        <a-tag>{{ nodes.length }}</a-tag>
      </div>
      <div
        class="control-target-selector__list"
        :class="{ 'control-target-selector__list--drawer': drawer }"
      >
        <button
          v-for="node in nodes"
          :key="node.daemonId"
          type="button"
          class="control-target-selector__card control-target-selector__card--node"
          :class="{ 'is-active': currentNodeId === node.daemonId }"
          @click="handleSelectNode(node.daemonId)"
        >
          <div class="control-target-selector__node-title-row">
            <div class="control-target-selector__card-title">{{ node.daemonDisplayName }}</div>
            <a-tag class="m-0" size="small" :color="node.daemonAvailable ? 'green' : 'default'">
              {{ node.daemonAvailable ? t("TXT_CODE_823bfe63") : t("TXT_CODE_66ce073e") }}
            </a-tag>
          </div>
          <div class="control-target-selector__card-subtitle control-target-selector__card-subtitle--compact">
            {{ node.endpoint || node.description }}
          </div>
        </button>
      </div>
    </section>

    <section class="control-panel control-panel--targets" :class="{ 'control-panel--drawer-section': drawer }">
      <div class="control-panel__header">
        <span>{{ t("TXT_CODE_d655beec") }}</span>
        <a-tag>{{ currentTargets.length }}</a-tag>
      </div>
      <div
        class="control-target-selector__list control-target-selector__list--targets"
        :class="{ 'control-target-selector__list--drawer': drawer }"
      >
        <button
          v-for="target in currentTargets"
          :key="`${target.daemonId}:${target.mode}:${target.instanceId}`"
          type="button"
          class="control-target-selector__card"
          :class="{ 'is-active': currentTargetKey === `${target.daemonId}:${target.mode}:${target.instanceId}` }"
          @click="handleSelectTarget(target)"
        >
          <div class="control-target-selector__target-main">
            <div class="control-target-selector__target-title-row">
              <component
                :is="target.mode === 'global' ? DatabaseOutlined : AppstoreOutlined"
                class="control-target-selector__target-icon"
              />
              <span class="control-target-selector__card-title">{{ target.displayName }}</span>
            </div>
            <a-tag class="m-0" :color="getControlTargetStatusColor(target)">
              {{ getControlTargetStatusText(target) }}
            </a-tag>
          </div>
          <div class="control-target-selector__card-subtitle">
            {{ getControlTargetIdentity(target) }}
          </div>
          <div class="control-target-selector__card-footer">
            <span>{{ target.description }}</span>
          </div>
        </button>
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

.control-panel--nodes,
.control-panel--targets,
.control-panel--drawer-section {
  display: flex;
  flex-direction: column;
}

.control-panel--nodes {
  max-height: clamp(260px, 38svh, 360px);
}

.control-panel--targets {
  flex: 1 1 auto;
}

.control-target-selector__list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  padding: 0 14px 16px;
  overflow-y: auto;
}

.control-target-selector__list--targets {
  flex: 1 1 auto;
}

.control-target-selector__list--drawer {
  max-height: 28vh;
}

.control-target-selector__card {
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 16px;
  padding: 14px;
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.82), rgba(255, 255, 255, 0.96));
  text-align: left;
  cursor: pointer;
  transition:
    transform 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease;
  color: inherit;
}

.control-target-selector__card--node {
  padding: 12px 14px;
}

.control-target-selector__card:hover {
  transform: translateY(-1px);
  border-color: rgba(59, 130, 246, 0.26);
  box-shadow: 0 10px 24px rgba(59, 130, 246, 0.08);
}

.control-target-selector__card.is-active {
  border-color: rgba(59, 130, 246, 0.48);
  box-shadow:
    0 14px 28px rgba(59, 130, 246, 0.12),
    inset 0 0 0 1px rgba(59, 130, 246, 0.22);
}

.control-target-selector__node-main,
.control-target-selector__target-main,
.control-target-selector__card-footer {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.control-target-selector__node-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.control-target-selector__node-main {
  align-items: flex-start;
}

.control-target-selector__target-main {
  align-items: center;
}

.control-target-selector__card-footer {
  margin-top: 10px;
  align-items: flex-start;
  color: var(--color-gray-8);
  font-size: 12px;
}

.control-target-selector__card-title {
  font-weight: 700;
  line-height: 1.3;
}

.control-target-selector__card-subtitle {
  margin-top: 6px;
  color: var(--color-gray-7);
  font-size: 12px;
  word-break: break-all;
}

.control-target-selector__card-subtitle--compact {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  word-break: normal;
}

.control-target-selector__target-title-row {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.control-target-selector__target-icon {
  color: var(--color-blue-6);
  font-size: 16px;
}
</style>
