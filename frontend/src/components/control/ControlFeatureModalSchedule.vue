<script setup lang="ts">
import { useLayoutCardTools } from "@/hooks/useCardTools";
import { t } from "@/lang/i18n";
import { getControlFeaturePreviewSchedules } from "@/tools/controlFeaturePreview";
import type { LayoutCard, Schedule } from "@/types";
import type { ScheduleActionTypeEnum } from "@/types/const";
import { ScheduleActionType, ScheduleType } from "@/types/const";
import SchedulePanel from "@/widgets/instance/Schedule.vue";
import { DeleteOutlined, EditOutlined, FieldTimeOutlined } from "@ant-design/icons-vue";
import { message } from "ant-design-vue";
import { computed, ref, watch } from "vue";

const props = defineProps<{
  card: LayoutCard;
  preview?: boolean;
}>();

const { getMetaOrRouteValue } = useLayoutCardTools(props.card);
const instanceId = getMetaOrRouteValue("instanceId", false);
const schedules = ref<Schedule[]>([]);

const loadPreviewSchedules = () => {
  schedules.value = getControlFeaturePreviewSchedules(instanceId);
};

watch(
  () => [props.preview, instanceId],
  () => {
    if (props.preview) {
      loadPreviewSchedules();
    }
  },
  { immediate: true }
);

const previewRows = computed(() =>
  schedules.value.map((schedule) => ({
    ...schedule,
    payload: schedule.actions.map((item) => item.payload || "-").join(" / "),
    actionText: schedule.actions
      .map((item) => ScheduleActionType[item.type as ScheduleActionTypeEnum] || item.type)
      .join(" / "),
    typeText: ScheduleType[schedule.type] || String(schedule.type)
  }))
);

const handleRefresh = () => {
  loadPreviewSchedules();
  message.success(t("TXT_CODE_fbde647e"));
};

const handleAdd = () => {
  message.info("本地预览下仅展示计划任务结构，新增不会提交到后端。");
};

const handleEdit = (record: Schedule) => {
  message.info(`本地预览下仅展示结构，未进入 ${record.name} 的实际编辑流程。`);
};

const handleDelete = (record: Schedule) => {
  schedules.value = schedules.value.filter((item) => item.name !== record.name);
  message.success(`已从本地预览列表移除 ${record.name}。`);
};
</script>

<template>
  <SchedulePanel v-if="!preview" :card="card" />

  <section v-else class="control-feature-preview" data-testid="control-feature-schedule-preview">
    <a-alert
      type="info"
      show-icon
      class="control-feature-preview__alert"
      message="本地预览模式"
      description="这里展示的是计划任务弹窗结构和典型数据，不会请求 Panel API，也不会真实提交新增或编辑操作。"
    />

    <div class="control-feature-preview__toolbar">
      <div class="control-feature-preview__title">
        <FieldTimeOutlined />
        <span>{{ t("TXT_CODE_b7d026f8") }}</span>
      </div>
      <div class="control-feature-preview__toolbar-actions">
        <a-button @click="handleRefresh">{{ t("TXT_CODE_b76d94e0") }}</a-button>
        <a-button type="primary" @click="handleAdd">{{ t("TXT_CODE_1644b775") }}</a-button>
      </div>
    </div>

    <a-table
      :data-source="previewRows"
      :pagination="{ pageSize: 8 }"
      :scroll="{ x: 'max-content' }"
      row-key="name"
    >
      <a-table-column :title="t('TXT_CODE_2d542e4c')" data-index="name" key="name" />
      <a-table-column :title="t('TXT_CODE_1544562')" data-index="payload" key="payload" />
      <a-table-column :title="t('TXT_CODE_485e2d41')" data-index="count" key="count" />
      <a-table-column :title="t('TXT_CODE_82fbc5ad')" data-index="actionText" key="actionText" />
      <a-table-column :title="t('TXT_CODE_67d68dd1')" data-index="typeText" key="typeText" />
      <a-table-column :title="t('TXT_CODE_3554dac0')" data-index="time" key="time" />
      <a-table-column :title="t('TXT_CODE_fe731dfc')" key="actions" :width="180">
        <template #default="{ record }">
          <a-button class="mr-8" @click="handleEdit(record)">
            {{ t("TXT_CODE_ad207008") }}
            <EditOutlined />
          </a-button>
          <a-popconfirm :title="t('TXT_CODE_6ff0668f')" @confirm="handleDelete(record)">
            <a-button danger>
              {{ t("TXT_CODE_ecbd7449") }}
              <DeleteOutlined />
            </a-button>
          </a-popconfirm>
        </template>
      </a-table-column>
    </a-table>
  </section>
</template>

<style scoped lang="scss">
.control-feature-preview {
  height: 100%;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  gap: 14px;
}

.control-feature-preview__alert {
  margin-bottom: 4px;
}

.control-feature-preview__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.control-feature-preview__title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 700;
}

.control-feature-preview__toolbar-actions {
  display: inline-flex;
  gap: 8px;
}
</style>
