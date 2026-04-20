import { useLocalStorage } from "@vueuse/core";
import { computed, type Ref } from "vue";

export const CONTROL_SUMMARY_COLLAPSED_KEY = "mcsm_control_summary_collapsed";

export function useControlSummaryFocus(isPhone: Ref<boolean>) {
  const summaryCollapsedPreference = useLocalStorage<boolean>(
    CONTROL_SUMMARY_COLLAPSED_KEY,
    false
  );

  const isSummaryCollapsed = computed(
    () => !isPhone.value && Boolean(summaryCollapsedPreference.value)
  );

  const hideSummary = () => {
    if (isPhone.value) return;
    summaryCollapsedPreference.value = true;
  };

  const showSummary = () => {
    summaryCollapsedPreference.value = false;
  };

  return {
    isSummaryCollapsed,
    hideSummary,
    showSummary
  };
}
