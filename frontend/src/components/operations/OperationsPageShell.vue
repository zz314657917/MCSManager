<script setup lang="ts">
import OperationsMobileNav from "@/components/operations/OperationsMobileNav.vue";
import type { OperationsMobileNavItem } from "@/components/operations/mobileNav";
import { useScreen } from "@/hooks/useScreen";
import { ArrowLeftOutlined } from "@ant-design/icons-vue";
import { computed, useSlots } from "vue";
import { useRouter } from "vue-router";

const props = withDefaults(
  defineProps<{
    title: string;
    eyebrow?: string;
    backLabel?: string;
    fallbackBackTo?: string;
    sidebarWidth?: string;
    showSidebarOnMobile?: boolean;
    mobileBodyPaddingBottom?: string;
    mobileNavItems?: OperationsMobileNavItem[];
  }>(),
  {
    eyebrow: "",
    backLabel: "Back",
    fallbackBackTo: "/",
    sidebarWidth: "320px",
    showSidebarOnMobile: true,
    mobileBodyPaddingBottom: "12px",
    mobileNavItems: () => []
  }
);

const router = useRouter();
const { isPhone } = useScreen();
const slots = useSlots();

const hasSidebar = computed(() => !!slots.sidebar);

const shellStyle = computed(() => {
  const style: Record<string, string> = {};

  if (isPhone.value) {
    style.paddingBottom = props.mobileBodyPaddingBottom;
  } else if (hasSidebar.value) {
    style["--ops-page-shell-sidebar-width"] = props.sidebarWidth;
  }

  return style;
});

const goBack = () => {
  if (window.history.length > 1) {
    router.back();
    return;
  }

  router.push(props.fallbackBackTo);
};
</script>

<template>
  <div class="ops-page-shell">
    <header class="ops-page-shell__header" :class="{ 'ops-page-shell__header--mobile': isPhone }">
      <div class="ops-page-shell__header-left">
        <a-button class="ops-page-shell__back-btn" @click="goBack">
          <template #icon>
            <ArrowLeftOutlined />
          </template>
          <span v-if="!isPhone">{{ backLabel }}</span>
        </a-button>

        <div class="ops-page-shell__title-wrap">
          <div v-if="eyebrow" class="ops-page-shell__eyebrow">{{ eyebrow }}</div>
          <h1 class="ops-page-shell__title">{{ title }}</h1>
        </div>
      </div>

      <div class="ops-page-shell__header-right">
        <slot name="header-actions" :is-phone="isPhone" />
      </div>
    </header>

    <section v-if="isPhone">
      <slot name="mobile-prelude" />
    </section>

    <div
      class="ops-page-shell__shell"
      :class="{
        'ops-page-shell__shell--mobile': isPhone,
        'ops-page-shell__shell--single': !hasSidebar
      }"
      :style="shellStyle"
    >
      <section
        v-if="isPhone && hasSidebar && showSidebarOnMobile"
        class="ops-page-shell__mobile-sidebar"
      >
        <slot name="sidebar" />
      </section>

      <aside v-else-if="!isPhone && hasSidebar" class="ops-page-shell__sidebar">
        <slot name="sidebar" />
      </aside>

      <main class="ops-page-shell__workspace" :class="{ 'ops-page-shell__workspace--mobile': isPhone }">
        <slot />
      </main>
    </div>

    <OperationsMobileNav
      v-if="isPhone && mobileNavItems.length"
      :items="mobileNavItems"
    />
  </div>
</template>

<style lang="scss" scoped>
.ops-page-shell {
  height: 100svh;
  overflow: hidden;
  width: 100%;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  background: var(--background-color);
  color: var(--text-color);
}

.ops-page-shell__header {
  position: sticky;
  top: 0;
  z-index: 6;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 24px;
  background: linear-gradient(135deg, rgba(7, 16, 31, 0.95), rgba(17, 34, 62, 0.9));
  color: var(--color-always-white);
  box-shadow: 0 14px 40px rgba(15, 23, 42, 0.16);
}

.ops-page-shell__header-left,
.ops-page-shell__header-right {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.ops-page-shell__header-right {
  justify-content: flex-end;
  flex-wrap: wrap;
}

.ops-page-shell__title-wrap {
  min-width: 0;
}

.ops-page-shell__back-btn {
  flex-shrink: 0;
}

.ops-page-shell__eyebrow {
  opacity: 0.78;
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.ops-page-shell__title {
  margin: 4px 0 0;
  font-size: 28px;
  line-height: 1.1;
  color: var(--color-always-white);
}

.ops-page-shell__shell {
  flex: 1;
  min-height: 0;
  min-width: 0;
  width: 100%;
  max-width: 100%;
  display: grid;
  grid-template-columns: var(--ops-page-shell-sidebar-width, 320px) minmax(0, 1fr);
  gap: 20px;
  padding: 20px 24px 24px;
  overflow: hidden;
  box-sizing: border-box;
}

.ops-page-shell__shell--single {
  grid-template-columns: minmax(0, 1fr);
}

.ops-page-shell__sidebar,
.ops-page-shell__workspace {
  min-height: 0;
  min-width: 0;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

.ops-page-shell__sidebar {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.ops-page-shell__workspace {
  overflow: hidden;
}

.ops-page-shell__header--mobile {
  padding: 12px;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.ops-page-shell__header--mobile .ops-page-shell__header-left {
  flex: 1;
  min-width: 0;
}

.ops-page-shell__header--mobile .ops-page-shell__header-right {
  flex-shrink: 0;
  margin-left: 12px;
}

.ops-page-shell__header--mobile .ops-page-shell__title {
  font-size: 22px;
}

.ops-page-shell__shell--mobile {
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior-y: auto;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-y;
  padding: 12px;
  min-width: 0;
}

.ops-page-shell__workspace--mobile {
  overflow: visible;
  min-width: 0;
  width: 100%;
  max-width: 100%;
}

.ops-page-shell__shell--mobile > * {
  min-width: 0;
  width: 100%;
  max-width: 100%;
}

@media (max-width: 992px) {
  .ops-page-shell__header:not(.ops-page-shell__header--mobile) {
    padding: 14px 12px;
    flex-direction: column;
    align-items: stretch;
  }

  .ops-page-shell__header:not(.ops-page-shell__header--mobile) .ops-page-shell__header-left,
  .ops-page-shell__header:not(.ops-page-shell__header--mobile) .ops-page-shell__header-right {
    justify-content: space-between;
  }

  .ops-page-shell__header:not(.ops-page-shell__header--mobile) .ops-page-shell__title {
    font-size: 24px;
  }

  .ops-page-shell__header--mobile {
    padding: 12px;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }

  .ops-page-shell__header--mobile .ops-page-shell__header-left {
    flex: 1 1 auto;
    min-width: 0;
  }

  .ops-page-shell__header--mobile .ops-page-shell__header-right {
    flex: 0 0 auto;
    min-width: auto;
    margin-left: 12px;
    justify-content: flex-end;
    flex-wrap: nowrap;
  }

  .ops-page-shell__header--mobile .ops-page-shell__title {
    font-size: 22px;
  }

  .ops-page-shell__shell {
    grid-template-columns: 1fr;
    gap: 12px;
    padding: 12px;
  }
}
</style>
