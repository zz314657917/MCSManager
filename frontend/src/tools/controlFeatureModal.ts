import type { LayoutCard } from "@/types";

export const CONTROL_DESKTOP_MODAL_FEATURE_KEYS = ["schedule", "server-config"] as const;

export type ControlDesktopModalFeatureKey = typeof CONTROL_DESKTOP_MODAL_FEATURE_KEYS[number];

export const shouldOpenControlFeatureModal = (featureKey: string, isPhone: boolean) =>
  !isPhone &&
  CONTROL_DESKTOP_MODAL_FEATURE_KEYS.includes(featureKey as ControlDesktopModalFeatureKey);

export const createControlFeatureModalCard = (options: {
  featureKey: ControlDesktopModalFeatureKey;
  title: string;
  daemonId: string;
  instanceId: string;
  instanceType?: string;
}): LayoutCard => ({
  id: `control-feature-modal:${options.featureKey}:${options.daemonId}:${options.instanceId}`,
  type: "component",
  title: options.title,
  width: 12,
  height: "100%",
  meta: {
    daemonId: options.daemonId,
    instanceId: options.instanceId,
    ...(options.featureKey === "server-config" && options.instanceType
      ? {
          type: options.instanceType
        }
      : {})
  }
});
