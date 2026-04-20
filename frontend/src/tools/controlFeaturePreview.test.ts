// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import {
  getControlFeaturePreviewSchedules,
  getPreviewServerConfigFiles
} from "./controlFeaturePreview";

describe("control feature preview data", () => {
  it("provides server config entries for minecraft java instances in local preview", () => {
    const files = getPreviewServerConfigFiles("minecraft/java");

    expect(files.length).toBeGreaterThan(0);
    expect(files.some((item) => item.path === "server.properties")).toBe(true);
  });

  it("returns preview schedules for known control preview instances", () => {
    const schedules = getControlFeaturePreviewSchedules("paper-lobby");

    expect(schedules.length).toBeGreaterThan(0);
    expect(schedules[0]).toMatchObject({
      name: expect.any(String),
      actions: expect.any(Array),
      time: expect.any(String)
    });
  });

  it("returns an empty schedule list for unknown preview instances", () => {
    expect(getControlFeaturePreviewSchedules("unknown-instance")).toEqual([]);
  });
});
