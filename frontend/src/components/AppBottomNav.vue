<script setup lang="ts">
import { isMenuRouteActive, useHeaderMenus } from "@/hooks/useHeaderMenus";
import {
  ApartmentOutlined,
  AppstoreOutlined,
  AreaChartOutlined,
  CloseOutlined,
  DesktopOutlined,
  DollarCircleOutlined,
  LinkOutlined,
  LoginOutlined,
  MenuOutlined,
  MessageOutlined,
  SettingOutlined,
  ShopOutlined,
  ShoppingOutlined,
  TeamOutlined,
  UserOutlined
} from "@ant-design/icons-vue";
import type { Component } from "vue";
import { ref } from "vue";
import { useRoute } from "vue-router";

const route = useRoute();
const { menus, handleToPage } = useHeaderMenus();
const isExpanded = ref(false);

const routePathIcons: Record<string, Component> = {
  "/control": DesktopOutlined,
  "/gm": TeamOutlined,
  "/gm/chat": MessageOutlined,
  "/economy": DollarCircleOutlined,
  "/players": UserOutlined,
  "/instances": AppstoreOutlined,
  "/market": ShopOutlined,
  "/overview": AreaChartOutlined,
  "/users": TeamOutlined,
  "/node": ApartmentOutlined,
  "/settings": SettingOutlined,
  "/customer": UserOutlined,
  "/login": LoginOutlined,
  "/shop": ShoppingOutlined,
  "/_open_page": LinkOutlined
};

const getRouteIcon = (path: string): Component => routePathIcons[path] ?? MenuOutlined;

const isActive = (path: string): boolean => {
  return isMenuRouteActive(
    route.path,
    path,
    menus.value.map((item) => item.path)
  );
};

const toggleMenu = () => {
  isExpanded.value = !isExpanded.value;
};

const handleMenuItemClick = (path: string) => {
  handleToPage(path);
  isExpanded.value = false;
};
</script>

<template>
  <Transition name="fab-backdrop">
    <div v-if="isExpanded" class="fab-backdrop" @click="isExpanded = false" />
  </Transition>

  <div class="fab-container">
    <Transition name="fab-panel">
      <div v-if="isExpanded" class="fab-menu-panel">
        <button
          v-for="item in menus"
          :key="item.path"
          class="fab-menu-item"
          :class="{ 'fab-menu-item--active': isActive(item.path) }"
          @click="handleMenuItemClick(item.path)"
        >
          <span class="fab-menu-icon-wrap">
            <component :is="getRouteIcon(item.path)" class="fab-menu-icon" />
          </span>
        </button>
      </div>
    </Transition>

    <button
      aria-label="Toggle navigation menu"
      class="fab-ball"
      :class="{ 'fab-ball--expanded': isExpanded }"
      @click="toggleMenu"
    >
      <Transition name="fab-icon" mode="out-in">
        <CloseOutlined v-if="isExpanded" class="fab-ball-icon" />
        <MenuOutlined v-else class="fab-ball-icon" />
      </Transition>
    </button>
  </div>
</template>

<style lang="scss" scoped>
.fab-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1001;
  background: rgba(38, 37, 30, 0.24);
  backdrop-filter: blur(2px);
}

.fab-container {
  position: fixed;
  bottom: 30%;
  right: -30px;
  z-index: 1002;
  display: flex;
  align-items: center;
  gap: 10px;
  pointer-events: none;

  > * {
    pointer-events: auto;
  }
}

// ---- Menu Panel ----

.fab-menu-panel {
  display: flex;
  flex-wrap: wrap;
  flex-direction: row;
  justify-content: start;
  // align-items: center;
  gap: 6px;
  padding: 10px;
  max-width: 196px;
  border: 1px solid var(--design-hairline);
  border-radius: var(--design-radius-lg);
  background: var(--bottom-nav-background-color);
  backdrop-filter: blur(12px);
  box-shadow: none;
  transform-origin: bottom right;
}

.fab-menu-item {
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  outline: none;
  -webkit-tap-highlight-color: transparent;
}

.fab-menu-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: var(--design-radius-md);
  transition: all 0.2s ease;

  .fab-menu-icon {
    font-size: 20px;
    color: var(--design-muted);
    transition: all 0.2s ease;
  }
}

.fab-menu-item--active .fab-menu-icon-wrap {
  background: var(--bottom-nav-background-color-hover);

  .fab-menu-icon {
    font-size: 22px;
    color: var(--design-primary);
  }
}

.fab-menu-item:not(.fab-menu-item--active):hover .fab-menu-icon-wrap {
  background: var(--bottom-nav-background-color-hover);
  opacity: 0.7;
}

.fab-menu-item:active .fab-menu-icon-wrap {
  transform: scale(0.88);
}

// ---- Floating Ball ----

.fab-ball {
  width: 56px;
  height: 70px;
  border-radius: var(--design-radius-md);
  border: 1px solid var(--design-hairline);
  cursor: pointer;
  outline: none;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bottom-nav-background-color);
  backdrop-filter: blur(12px);
  box-shadow: none;
  transition:
    transform 0.22s ease,
    box-shadow 0.22s ease;
  -webkit-tap-highlight-color: transparent;
}

.fab-ball:hover {
  transform: scale(1.08);
  border-color: var(--design-hairline-strong);
  box-shadow: none;
}

.fab-ball:active {
  transform: scale(0.92);
}

.fab-ball--expanded {
  border-color: rgba(245, 78, 0, 0.38);
  box-shadow: none;
}

.fab-ball-icon {
  font-size: 20px;
  color: var(--design-ink);
}

// ---- Transitions ----

.fab-backdrop-enter-active,
.fab-backdrop-leave-active {
  transition: opacity 0.25s ease;
}
.fab-backdrop-enter-from,
.fab-backdrop-leave-to {
  opacity: 0;
}

.fab-panel-enter-active {
  transition:
    opacity 0.22s ease,
    transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.fab-panel-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}
.fab-panel-enter-from,
.fab-panel-leave-to {
  opacity: 0;
  transform: scale(0.8) translateY(12px);
}

.fab-icon-enter-active,
.fab-icon-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}
.fab-icon-enter-from {
  opacity: 0;
  transform: rotate(-90deg) scale(0.6);
}
.fab-icon-leave-to {
  opacity: 0;
  transform: rotate(90deg) scale(0.6);
}
</style>
