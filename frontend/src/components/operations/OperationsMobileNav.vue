<script setup lang="ts">
import type { OperationsMobileNavItem } from "@/components/operations/mobileNav";
import {
  ControlOutlined,
  MessageOutlined,
  TeamOutlined
} from "@ant-design/icons-vue";
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";

const props = defineProps<{
  items: OperationsMobileNavItem[];
}>();

const route = useRoute();
const router = useRouter();

const currentPath = computed(() => route.path);

const iconMap = {
  control: ControlOutlined,
  players: TeamOutlined,
  chat: MessageOutlined
} as const;

const isActive = (item: OperationsMobileNavItem) => currentPath.value === item.path;

const navigateTo = (item: OperationsMobileNavItem) => {
  if (isActive(item)) return;
  router.push(item.path);
};
</script>

<template>
  <nav class="operations-mobile-nav" aria-label="Operations navigation">
    <button
      v-for="item in items"
      :key="item.key"
      type="button"
      class="operations-mobile-nav__item"
      :class="{ 'is-active': isActive(item) }"
      @click="navigateTo(item)"
    >
      <component :is="iconMap[item.icon]" class="operations-mobile-nav__icon" />
      <span>{{ item.label }}</span>
    </button>
  </nav>
</template>

<style scoped lang="scss">
.operations-mobile-nav {
  position: sticky;
  bottom: 0;
  z-index: 7;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  padding: 10px 12px calc(10px + env(safe-area-inset-bottom));
  border-top: 1px solid rgba(148, 163, 184, 0.16);
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(14px);
  box-shadow: 0 -16px 36px rgba(15, 23, 42, 0.12);
}

.operations-mobile-nav__item {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: 54px;
  border: 1px solid transparent;
  border-radius: 16px;
  background: rgba(248, 250, 252, 0.88);
  color: var(--color-gray-7);
  font-size: 12px;
  font-weight: 700;
  transition:
    border-color 0.18s ease,
    color 0.18s ease,
    background 0.18s ease,
    box-shadow 0.18s ease;
}

.operations-mobile-nav__item.is-active {
  border-color: rgba(37, 99, 235, 0.28);
  background: rgba(219, 234, 254, 0.94);
  color: var(--color-blue-8);
  box-shadow:
    0 10px 24px rgba(37, 99, 235, 0.12),
    inset 0 0 0 1px rgba(37, 99, 235, 0.12);
}

.operations-mobile-nav__icon {
  font-size: 18px;
}
</style>
