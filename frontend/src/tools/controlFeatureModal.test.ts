import { describe, expect, it } from "vitest";

import {
  createControlFeatureModalCard,
  shouldOpenControlFeatureModal
} from "./controlFeatureModal";

describe("control feature modal presentation", () => {
  it("opens schedule and server config in a desktop modal only", () => {
    expect(shouldOpenControlFeatureModal("schedule", false)).toBe(true);
    expect(shouldOpenControlFeatureModal("server-config", false)).toBe(true);
    expect(shouldOpenControlFeatureModal("file-manager", false)).toBe(false);
    expect(shouldOpenControlFeatureModal("schedule", true)).toBe(false);
  });

  it("creates modal card metadata for server config", () => {
    expect(
      createControlFeatureModalCard({
        featureKey: "server-config",
        title: "服务端配置",
        daemonId: "daemon-a",
        instanceId: "instance-a",
        instanceType: "minecraft/java"
      })
    ).toMatchObject({
      title: "服务端配置",
      meta: {
        daemonId: "daemon-a",
        instanceId: "instance-a",
        type: "minecraft/java"
      }
    });
  });

  it("creates modal card metadata for schedule without injecting instance type", () => {
    expect(
      createControlFeatureModalCard({
        featureKey: "schedule",
        title: "计划任务",
        daemonId: "daemon-a",
        instanceId: "instance-a",
        instanceType: "minecraft/java"
      })
    ).toMatchObject({
      title: "计划任务",
      meta: {
        daemonId: "daemon-a",
        instanceId: "instance-a"
      }
    });

    expect(
      createControlFeatureModalCard({
        featureKey: "schedule",
        title: "计划任务",
        daemonId: "daemon-a",
        instanceId: "instance-a",
        instanceType: "minecraft/java"
      }).meta.type
    ).toBeUndefined();
  });
});
