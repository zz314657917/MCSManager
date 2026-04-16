export type OperationsMobileNavIcon = "control" | "players" | "chat";

export type OperationsMobileNavItem = {
  key: string;
  label: string;
  path: string;
  icon: OperationsMobileNavIcon;
};

export const OPERATIONS_MOBILE_NAV_ITEMS: OperationsMobileNavItem[] = [
  {
    key: "control",
    label: "Control",
    path: "/control",
    icon: "control"
  },
  {
    key: "players",
    label: "玩家",
    path: "/gm",
    icon: "players"
  },
  {
    key: "chat",
    label: "聊天",
    path: "/gm/chat",
    icon: "chat"
  }
];
