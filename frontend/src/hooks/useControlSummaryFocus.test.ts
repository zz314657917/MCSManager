// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { nextTick, ref } from "vue";

import {
  CONTROL_SUMMARY_COLLAPSED_KEY,
  useControlSummaryFocus
} from "./useControlSummaryFocus";

describe("useControlSummaryFocus", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("restores the saved collapsed preference on desktop", () => {
    localStorage.setItem(CONTROL_SUMMARY_COLLAPSED_KEY, "true");

    const { isSummaryCollapsed } = useControlSummaryFocus(ref(false));

    expect(isSummaryCollapsed.value).toBe(true);
  });

  it("ignores the saved collapsed preference on mobile", () => {
    localStorage.setItem(CONTROL_SUMMARY_COLLAPSED_KEY, "true");

    const { isSummaryCollapsed } = useControlSummaryFocus(ref(true));

    expect(isSummaryCollapsed.value).toBe(false);
  });

  it("persists hide and show actions in local storage", async () => {
    const { isSummaryCollapsed, hideSummary, showSummary } = useControlSummaryFocus(ref(false));

    expect(isSummaryCollapsed.value).toBe(false);

    hideSummary();
    await nextTick();
    expect(isSummaryCollapsed.value).toBe(true);
    expect(localStorage.getItem(CONTROL_SUMMARY_COLLAPSED_KEY)).toBe("true");

    showSummary();
    await nextTick();
    expect(isSummaryCollapsed.value).toBe(false);
    expect(localStorage.getItem(CONTROL_SUMMARY_COLLAPSED_KEY)).toBe("false");
  });
});
