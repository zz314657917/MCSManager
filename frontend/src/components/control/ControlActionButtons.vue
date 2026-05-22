<script setup lang="ts">
import { t } from "@/lang/i18n";
import type { ControlBatchAction, ControlTarget } from "@/types/control";
import { CloseOutlined, PauseCircleOutlined, PlayCircleOutlined, ReloadOutlined } from "@ant-design/icons-vue";

export type ControlFeatureShortcut = {
  key: string;
  title: string;
  icon: any;
  click: () => void;
  disabled?: boolean;
};

withDefaults(
  defineProps<{
    target: ControlTarget;
    primaryActionLabel: string;
    modeText: string;
    features?: ControlFeatureShortcut[];
    batchSelectedCount?: number;
    batchBusy?: boolean;
    mobile?: boolean;
  }>(),
  {
    features: () => [],
    batchSelectedCount: 0,
    batchBusy: false,
    mobile: false
  }
);

const emit = defineEmits<{
  start: [];
  stop: [];
  restart: [];
  terminate: [];
  batchOperation: [action: ControlBatchAction];
  clearBatchSelection: [];
}>();
</script>

<template>
  <div
    v-if="mobile"
    class="control-action-buttons__mobile-dock"
    data-testid="control-actions-mobile"
  >
    <div
      v-if="target.mode === 'instance'"
      class="control-action-buttons__main-grid"
    >
      <a-button
        class="control-action-buttons__mobile-button"
        type="primary"
        :disabled="!target.daemonAvailable"
        data-testid="control-action-start"
        @click="emit('start')"
      >
        <template #icon>
          <PlayCircleOutlined />
        </template>
        {{ primaryActionLabel }}
      </a-button>
      <a-button
        class="control-action-buttons__mobile-button"
        danger
        ghost
        :disabled="!target.daemonAvailable"
        data-testid="control-action-stop"
        @click="emit('stop')"
      >
        <template #icon>
          <PauseCircleOutlined />
        </template>
        {{ t("TXT_CODE_148d6467") }}
      </a-button>
      <a-button
        class="control-action-buttons__mobile-button"
        :disabled="!target.daemonAvailable"
        data-testid="control-action-restart"
        @click="emit('restart')"
      >
        <template #icon>
          <ReloadOutlined />
        </template>
        {{ t("TXT_CODE_77cc12da") }}
      </a-button>
      <a-button
        class="control-action-buttons__mobile-button"
        danger
        :disabled="!target.daemonAvailable || target.status === 0"
        data-testid="control-action-terminate"
        @click="emit('terminate')"
      >
        <template #icon>
          <CloseOutlined />
        </template>
        {{ t("TXT_CODE_1c36c8f2") }}
      </a-button>
    </div>

    <template v-else>
      <a-button
        class="control-action-buttons__mobile-button"
        type="primary"
        :disabled="!target.daemonAvailable"
        data-testid="control-action-start"
        @click="emit('start')"
      >
        <template #icon>
          <PlayCircleOutlined />
        </template>
        {{ primaryActionLabel }}
      </a-button>
      <a-button
        class="control-action-buttons__mobile-button"
        danger
        ghost
        :disabled="!target.daemonAvailable"
        data-testid="control-action-stop"
        @click="emit('stop')"
      >
        <template #icon>
          <PauseCircleOutlined />
        </template>
        {{ t("TXT_CODE_148d6467") }}
      </a-button>
    </template>

    <div
      v-if="features.length"
      class="control-action-buttons__feature-grid control-action-buttons__feature-grid--mobile"
    >
      <a-button
        v-for="item in features"
        :key="item.key"
        class="control-action-buttons__feature-button"
        :disabled="item.disabled"
        @click="item.click"
      >
        <template #icon>
          <component :is="item.icon" />
        </template>
        {{ item.title }}
      </a-button>
    </div>

    <div
      v-if="batchSelectedCount > 0"
      class="control-action-buttons__batch-dock"
      data-testid="control-batch-actions-mobile"
    >
      <div class="control-action-buttons__batch-header">
        <span>{{ t("TXT_CODE_CONTROL_BATCH_SELECTED", { count: batchSelectedCount }) }}</span>
        <a-button type="link" size="small" @click="emit('clearBatchSelection')">
          {{ t("TXT_CODE_df87c46d") }}
        </a-button>
      </div>
      <div class="control-action-buttons__batch-grid">
        <a-button :loading="batchBusy" @click="emit('batchOperation', 'start')">
          <template #icon>
            <PlayCircleOutlined />
          </template>
          {{ t("TXT_CODE_8c7318b3") }}
        </a-button>
        <a-button danger ghost :loading="batchBusy" @click="emit('batchOperation', 'stop')">
          <template #icon>
            <PauseCircleOutlined />
          </template>
          {{ t("TXT_CODE_148d6467") }}
        </a-button>
        <a-button :loading="batchBusy" @click="emit('batchOperation', 'restart')">
          <template #icon>
            <ReloadOutlined />
          </template>
          {{ t("TXT_CODE_77cc12da") }}
        </a-button>
        <a-button danger :loading="batchBusy" @click="emit('batchOperation', 'kill')">
          <template #icon>
            <CloseOutlined />
          </template>
          {{ t("TXT_CODE_1c36c8f2") }}
        </a-button>
      </div>
    </div>
  </div>

  <section v-else class="control-panel control-panel--actions" data-testid="control-actions-desktop">
    <div class="control-panel__header">
      <span>{{ t("TXT_CODE_OPERATE") }}</span>
      <a-tag :bordered="false">{{ modeText }}</a-tag>
    </div>
    <div class="control-action-buttons__row">
      <a-button
        class="control-action-buttons__button"
        type="primary"
        :disabled="!target.daemonAvailable"
        data-testid="control-action-start"
        @click="emit('start')"
      >
        <template #icon>
          <PlayCircleOutlined />
        </template>
        {{ primaryActionLabel }}
      </a-button>
      <a-button
        class="control-action-buttons__button"
        danger
        ghost
        :disabled="!target.daemonAvailable"
        data-testid="control-action-stop"
        @click="emit('stop')"
      >
        <template #icon>
          <PauseCircleOutlined />
        </template>
        {{ t("TXT_CODE_148d6467") }}
      </a-button>
      <a-button
        v-if="target.mode === 'instance'"
        class="control-action-buttons__button"
        :disabled="!target.daemonAvailable"
        data-testid="control-action-restart"
        @click="emit('restart')"
      >
        <template #icon>
          <ReloadOutlined />
        </template>
        {{ t("TXT_CODE_77cc12da") }}
      </a-button>
      <a-button
        v-if="target.mode === 'instance'"
        class="control-action-buttons__button"
        danger
        :disabled="!target.daemonAvailable || target.status === 0"
        data-testid="control-action-terminate"
        @click="emit('terminate')"
      >
        <template #icon>
          <CloseOutlined />
        </template>
        {{ t("TXT_CODE_1c36c8f2") }}
      </a-button>
    </div>

    <div v-if="features.length" class="control-action-buttons__feature-section">
      <div class="control-action-buttons__feature-title">{{ t("TXT_CODE_d2bbb2f1") }}</div>
      <div class="control-action-buttons__feature-grid">
        <a-button
          v-for="item in features"
          :key="item.key"
          class="control-action-buttons__feature-button"
          :disabled="item.disabled"
          @click="item.click"
        >
          <template #icon>
            <component :is="item.icon" />
          </template>
          {{ item.title }}
        </a-button>
      </div>
    </div>

    <div
      v-if="batchSelectedCount > 0"
      class="control-action-buttons__batch-section"
      data-testid="control-batch-actions-desktop"
    >
      <div class="control-action-buttons__batch-header">
        <span>{{ t("TXT_CODE_CONTROL_BATCH_SELECTED", { count: batchSelectedCount }) }}</span>
        <a-button type="link" size="small" @click="emit('clearBatchSelection')">
          {{ t("TXT_CODE_df87c46d") }}
        </a-button>
      </div>
      <div class="control-action-buttons__batch-grid">
        <a-button :loading="batchBusy" @click="emit('batchOperation', 'start')">
          <template #icon>
            <PlayCircleOutlined />
          </template>
          {{ t("TXT_CODE_8c7318b3") }}
        </a-button>
        <a-button danger ghost :loading="batchBusy" @click="emit('batchOperation', 'stop')">
          <template #icon>
            <PauseCircleOutlined />
          </template>
          {{ t("TXT_CODE_148d6467") }}
        </a-button>
        <a-button :loading="batchBusy" @click="emit('batchOperation', 'restart')">
          <template #icon>
            <ReloadOutlined />
          </template>
          {{ t("TXT_CODE_77cc12da") }}
        </a-button>
        <a-button danger :loading="batchBusy" @click="emit('batchOperation', 'kill')">
          <template #icon>
            <CloseOutlined />
          </template>
          {{ t("TXT_CODE_1c36c8f2") }}
        </a-button>
      </div>
    </div>
  </section>
</template>

<style lang="scss" scoped>
.control-panel {
  min-height: 0;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 20px;
  background: var(--background-color-white);
  box-shadow:
    0 16px 36px rgba(15, 23, 42, 0.08),
    0 2px 8px rgba(15, 23, 42, 0.04);
}

.control-panel--actions {
  padding-bottom: 14px;
  flex-shrink: 0;
}

.control-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 18px 12px;
  font-weight: 700;
}

.control-action-buttons__row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 0 18px;
}

.control-action-buttons__feature-section {
  display: grid;
  gap: 10px;
  padding: 14px 18px 0;
}

.control-action-buttons__batch-section {
  display: grid;
  gap: 10px;
  margin: 14px 18px 0;
  padding: 12px;
  border: 1px solid rgba(37, 99, 235, 0.18);
  border-radius: 14px;
  background: rgba(59, 130, 246, 0.08);
}

.control-action-buttons__feature-title {
  color: var(--color-gray-7);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.control-action-buttons__feature-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.control-action-buttons__feature-button {
  min-width: 0;
}

.control-action-buttons__batch-dock {
  display: grid;
  gap: 10px;
  width: 100%;
  padding: 12px;
  border: 1px solid rgba(37, 99, 235, 0.18);
  border-radius: 14px;
  background: rgba(59, 130, 246, 0.08);
}

.control-action-buttons__batch-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-weight: 700;
}

.control-action-buttons__batch-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.control-action-buttons__mobile-dock {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 20px;
  background: var(--background-color-white);
  box-shadow:
    0 16px 36px rgba(15, 23, 42, 0.08),
    0 2px 8px rgba(15, 23, 42, 0.04);
}

.control-action-buttons__main-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.control-action-buttons__mobile-button {
  min-width: 0;
  height: 42px;
  font-size: 13px;
}

.control-action-buttons__feature-grid--mobile {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

@media (max-width: 640px) {
  .control-action-buttons__batch-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
