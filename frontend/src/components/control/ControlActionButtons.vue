<script setup lang="ts">
import { t } from "@/lang/i18n";
import type { ControlTarget } from "@/types/control";
import { CloseOutlined, PauseCircleOutlined, PlayCircleOutlined, ReloadOutlined } from "@ant-design/icons-vue";

withDefaults(
  defineProps<{
    target: ControlTarget;
    primaryActionLabel: string;
    modeText: string;
    mobile?: boolean;
  }>(),
  {
    mobile: false
  }
);

const emit = defineEmits<{
  start: [];
  stop: [];
  restart: [];
  terminate: [];
}>();
</script>

<template>
  <div
    v-if="mobile"
    class="control-action-buttons__mobile-dock"
    :class="{
      'control-action-buttons__mobile-dock--global': target.mode === 'global',
      'control-action-buttons__mobile-dock--instance': target.mode === 'instance'
    }"
    data-testid="control-actions-mobile"
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
      v-if="target.mode === 'instance'"
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
      v-if="target.mode === 'instance'"
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

.control-action-buttons__mobile-dock {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  padding: 14px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 20px;
  background: var(--background-color-white);
  box-shadow:
    0 16px 36px rgba(15, 23, 42, 0.08),
    0 2px 8px rgba(15, 23, 42, 0.04);
}

.control-action-buttons__mobile-dock--global {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.control-action-buttons__mobile-dock--instance {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.control-action-buttons__mobile-button {
  min-width: 0;
  height: 42px;
  font-size: 13px;
}
</style>
