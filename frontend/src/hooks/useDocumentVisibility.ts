import { onMounted, onUnmounted, ref } from "vue";

const getInitialVisibility = () => {
  if (typeof document === "undefined") return true;
  return document.visibilityState !== "hidden";
};

export function useDocumentVisibility() {
  const isDocumentVisible = ref(getInitialVisibility());

  const syncVisibility = () => {
    isDocumentVisible.value = getInitialVisibility();
  };

  onMounted(() => {
    syncVisibility();
    document.addEventListener("visibilitychange", syncVisibility);
  });

  onUnmounted(() => {
    document.removeEventListener("visibilitychange", syncVisibility);
  });

  return {
    isDocumentVisible
  };
}
