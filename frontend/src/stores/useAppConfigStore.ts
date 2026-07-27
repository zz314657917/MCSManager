/* eslint-disable no-unused-vars */
import logo from "@/assets/logo.png";
import { getCurrentLang, setLanguage } from "@/lang/i18n";
import { AppTheme, THEME_KEY } from "@/types/const";
import { createGlobalState, useBreakpoints, useLocalStorage, usePreferredDark } from "@vueuse/core";
import { theme as antTheme } from "ant-design-vue";
import type { ThemeConfig } from "ant-design-vue/es/config-provider/context";
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useLayoutConfigStore } from "./useLayoutConfig";

export const useAppConfigStore = createGlobalState(() => {
  const isPreferredDark = usePreferredDark();
  const { getSettingsConfig } = useLayoutConfigStore();

  const theme: ThemeConfig = reactive({
    algorithm: antTheme.defaultAlgorithm,
    token: {
      colorBgBase: "#f7f7f4",
      colorBgContainer: "#ffffff",
      colorBgElevated: "#ffffff",
      colorBorder: "#e6e5e0",
      colorBorderSecondary: "#efeee8",
      colorError: "#cf2d56",
      colorInfo: "#807d72",
      colorPrimary: "#f54e00",
      colorSuccess: "#1f8a65",
      colorText: "#26251e",
      colorTextSecondary: "#5a5852",
      colorTextTertiary: "#807d72",
      colorWarning: "#c08532",
      borderRadius: 8,
      borderRadiusLG: 12,
      boxShadow: "none",
      boxShadowSecondary: "none",
      controlHeight: 40,
      fontFamily:
        'Inter, "Segoe UI", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
      fontFamilyCode:
        '"JetBrains Mono", "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Monaco, monospace',
      fontSize: 14,
      fontSizeLG: 14,
      fontSizeSM: 12,
      fontSizeXL: 18
    }
  });
  const appConfig = reactive({
    logoImage: logo as string
  });

  const logoImage = computed(() => appConfig.logoImage);

  const currentTheme = useLocalStorage<AppTheme>(THEME_KEY, AppTheme.LIGHT);

  const isDarkTheme = computed(() => {
    if (currentTheme.value === AppTheme.DARK) return true;
    if (currentTheme.value === AppTheme.AUTO) return isPreferredDark.value;
    return false;
  });

  const hasBgImage = ref(false);

  /** Main app nav layout: "left" = sidebar, "right" = top header only. Filled by initAppTheme(). */
  const sidebarPosition = ref<"left" | "right">("left");

  /** Whether to show the left sidebar; when false, only top header (AppHeader) is used. */
  const breakpoints = useBreakpoints({ sidebar: 1400 });
  const isWideEnoughForSidebar = breakpoints.greaterOrEqual("sidebar");
  const useSidebarLayout = computed(
    () => sidebarPosition.value === "left" && isWideEnoughForSidebar.value
  );

  const setBackgroundImage = (url: string) => {
    const body = document.querySelector("body");
    if (body) {
      body.style.backgroundSize = "cover";
      body.style.backgroundPosition = "center";
      body.style.backgroundRepeat = "no-repeat";
      if (isDarkTheme.value) {
        body.style.backgroundImage = `linear-gradient(135deg, rgba(0,0,0,0.65), rgba(0,0,0,0.65) 100%), url(${url})`;
        body.classList.remove("app-light-extend-theme");
        body.classList.add("app-dark-extend-theme");
      } else {
        body.style.backgroundImage = `linear-gradient(135deg, rgba(220,220,220,0.3), rgba(53,53,53,0.3) 100%), url(${url})`;
        body.classList.remove("app-dark-extend-theme");
        body.classList.add("app-light-extend-theme");
      }

      hasBgImage.value = true;
    }
  };

  const setLight = () => {
    theme.algorithm = antTheme.defaultAlgorithm;
    Object.assign(theme.token || {}, {
      colorBgBase: "#f7f7f4",
      colorBgContainer: "#ffffff",
      colorBgElevated: "#ffffff",
      colorBorder: "#e6e5e0",
      colorBorderSecondary: "#efeee8",
      colorText: "#26251e",
      colorTextSecondary: "#5a5852",
      colorTextTertiary: "#807d72"
    });
    document.body.classList.add("app-light-theme");
    document.body.classList.remove("app-dark-theme");
  };

  const setDark = () => {
    theme.algorithm = antTheme.darkAlgorithm;
    Object.assign(theme.token || {}, {
      colorBgBase: "#171610",
      colorBgContainer: "#24231d",
      colorBgElevated: "#24231d",
      colorBorder: "rgba(230, 229, 224, 0.16)",
      colorBorderSecondary: "rgba(230, 229, 224, 0.1)",
      colorText: "#f7f7f4",
      colorTextSecondary: "#d7d4ca",
      colorTextTertiary: "#a09c92"
    });
    document.body.classList.add("app-dark-theme");
    document.body.classList.remove("app-light-theme");
  };

  const resetTheme = () => (currentTheme.value = AppTheme.LIGHT);

  const initAppTheme = async () => {
    if (
      isNaN(currentTheme.value) ||
      currentTheme.value < AppTheme.AUTO ||
      currentTheme.value > AppTheme.DARK
    ) {
      resetTheme();
    }
    const fn = {
      [AppTheme.AUTO]: () => (isPreferredDark.value ? setDark() : setLight()),
      [AppTheme.LIGHT]: () => setLight(),
      [AppTheme.DARK]: () => setDark()
    };
    fn[currentTheme.value]?.();

    const frontendSettings = await getSettingsConfig();
    if (frontendSettings?.theme?.backgroundImage)
      setBackgroundImage(frontendSettings.theme.backgroundImage);
    const pos = frontendSettings?.theme?.sidebarPosition;
    sidebarPosition.value = pos === "left" || pos === "right" ? pos : "left";
  };

  const setTheme = (t: AppTheme) => {
    currentTheme.value = t;
    initAppTheme();
  };

  const changeLanguage = (lang: string) => {
    setLanguage(lang);
  };

  const getCurrentLanguage = () => {
    return getCurrentLang() ?? "en_us";
  };

  const setLogoImage = (url: string) => {
    if (url) {
      appConfig.logoImage = url;
    }
  };

  watch(isPreferredDark, () => {
    if (currentTheme.value === AppTheme.AUTO) {
      initAppTheme();
    }
  });

  onMounted(async () => {
    try {
      const settingsConfig = await getSettingsConfig();
      if (settingsConfig?.theme?.logoImage) {
        setLogoImage(settingsConfig.theme.logoImage);
      }
    } catch (error) {
      console.error("Failed to load settings config:", error);
    }
  });

  return {
    appConfig,
    logoImage,
    hasBgImage,
    sidebarPosition,
    useSidebarLayout,
    setLogoImage,
    changeLanguage,
    getCurrentLanguage,
    isDarkTheme,
    initAppTheme,
    setTheme,
    setBackgroundImage,
    currentTheme,
    themeConfig: theme
  };
});
