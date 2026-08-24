import { t } from "@/lang/i18n";

export type OperationsMobileNavIcon = "control" | "players" | "economy";

export type OperationsMobileNavItem = {
  key: string;
  label: string;
  path: string;
  icon: OperationsMobileNavIcon;
};

export const OPERATIONS_MOBILE_NAV_ITEMS: OperationsMobileNavItem[] = [
  {
    key: "control",
    label: t("TXT_CODE_CONTROL_TITLE"),
    path: "/control",
    icon: "control"
  },
  {
    key: "players",
    label: t("TXT_CODE_GM_NAV_PLAYERS"),
    path: "/gm",
    icon: "players"
  },
  {
    key: "economy",
    label: t("TXT_CODE_ECONOMY_TITLE"),
    path: "/economy",
    icon: "economy"
  }
];
