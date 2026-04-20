import { t } from "@/lang/i18n";
import { INSTANCE_STATUS, INSTANCE_STATUS_CODE } from "@/types/const";
import type { ControlTarget } from "@/types/control";

export const getControlTargetStatusColor = (target?: ControlTarget) => {
  if (!target?.daemonAvailable) return "default";
  if (target.status === INSTANCE_STATUS_CODE.RUNNING) return "success";
  if (
    target.status === INSTANCE_STATUS_CODE.STARTING ||
    target.status === INSTANCE_STATUS_CODE.STOPPING ||
    target.status === INSTANCE_STATUS_CODE.BUSY
  ) {
    return "processing";
  }
  return "default";
};

export const getControlTargetStatusText = (target?: ControlTarget) => {
  if (!target) return "--";
  if (!target.daemonAvailable) return t("TXT_CODE_66ce073e");
  if (target.status == null) return "--";
  return INSTANCE_STATUS[target.status] || "--";
};

export const getControlTargetIdentity = (target?: ControlTarget) => {
  if (!target) return "--";
  return target.mode === "global" ? "global0001" : target.instanceId;
};
