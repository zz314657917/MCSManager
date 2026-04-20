<script setup lang="ts">
import { useLayoutCardTools } from "@/hooks/useCardTools";
import { t } from "@/lang/i18n";
import { getPreviewServerConfigFiles } from "@/tools/controlFeaturePreview";
import type { LayoutCard } from "@/types";
import ServerConfigOverview from "@/widgets/instance/ServerConfigOverview.vue";
import { FileExclamationOutlined } from "@ant-design/icons-vue";
import { message } from "ant-design-vue";
import { computed, ref, watch } from "vue";

const props = defineProps<{
  card: LayoutCard;
  preview?: boolean;
}>();

const { getMetaOrRouteValue } = useLayoutCardTools(props.card);
const instanceType = getMetaOrRouteValue("type", false);
const previewFiles = ref(getPreviewServerConfigFiles(instanceType));

watch(
  () => [props.preview, instanceType],
  () => {
    if (props.preview) {
      previewFiles.value = getPreviewServerConfigFiles(instanceType);
    }
  },
  { immediate: true }
);

const hasPreviewFiles = computed(() => previewFiles.value.length > 0);

const handleRefresh = () => {
  previewFiles.value = getPreviewServerConfigFiles(instanceType);
  message.success(t("TXT_CODE_fbde647e"));
};

const handleEdit = (fileName: string) => {
  message.info(`本地预览下仅展示配置文件概览，未进入 ${fileName} 的真实编辑页面。`);
};
</script>

<template>
  <ServerConfigOverview v-if="!preview" :card="card" />

  <section v-else class="control-feature-preview" data-testid="control-feature-server-config-preview">
    <a-alert
      type="info"
      show-icon
      class="control-feature-preview__alert"
      message="本地预览模式"
      description="这里展示的是服务端配置弹窗结构和示例配置文件列表，不会请求 Panel API。"
    />

    <div class="control-feature-preview__toolbar">
      <div class="control-feature-preview__title">
        <span>{{ t("TXT_CODE_d07742fe") }}</span>
      </div>
      <div class="control-feature-preview__toolbar-actions">
        <a-button @click="handleRefresh">{{ t("TXT_CODE_b76d94e0") }}</a-button>
      </div>
    </div>

    <a-list
      v-if="hasPreviewFiles"
      item-layout="horizontal"
      :data-source="previewFiles"
      class="control-feature-preview__list"
    >
      <template #renderItem="{ item }">
        <a-list-item>
          <a-list-item-meta>
            <template #title>
              <a-typography-title :level="5">{{ item.fileName }}</a-typography-title>
            </template>
            <template #description>
              {{ item.info }}
              <br />
              <a-typography-text type="secondary">{{ item.path }}</a-typography-text>
            </template>
          </a-list-item-meta>
          <template #actions>
            <a-button @click="handleEdit(item.fileName)">{{ t("TXT_CODE_ad207008") }}</a-button>
          </template>
        </a-list-item>
      </template>
    </a-list>

    <a-empty v-else class="control-feature-preview__empty">
      <template #description>
        <p style="font-size: 16px; margin-top: 32px">
          <FileExclamationOutlined class="mr-4" />{{ t("TXT_CODE_37a4c14a") }}
        </p>
        <p style="font-size: 14px; margin-bottom: 10px">
          {{ t("TXT_CODE_4c0fda9") }}
        </p>
      </template>
    </a-empty>
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
  font-size: 18px;
  font-weight: 700;
}

.control-feature-preview__toolbar-actions {
  display: inline-flex;
  gap: 8px;
}

.control-feature-preview__list {
  overflow: auto;
}

.control-feature-preview__empty {
  align-self: center;
}
</style>
