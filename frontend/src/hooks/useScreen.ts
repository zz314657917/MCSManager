import { onMounted, onUnmounted, ref } from "vue";

const mediaQuery = window.matchMedia("(max-width: 992px)");

export function useScreen() {
  const isPhone = ref(mediaQuery.matches);

  const fn = (e: MediaQueryListEvent) => (isPhone.value = e.matches);

  onMounted(() => {
    mediaQuery.addEventListener("change", fn);
  });

  onUnmounted(() => {
    mediaQuery.removeEventListener("change", fn);
  });

  return { isPhone };
}
