export type PlayerBindingStatus = "unbound" | "pending" | "bound";

export interface PlayerPresence {
  daemonId: string;
  instanceId: string;
  playerUuid: string;
  playerName: string;
  online: boolean;
  lastSeenAt: string;
}

export interface PlayerChatMessage {
  id: string;
  daemonId: string;
  instanceId: string;
  senderType: "player" | "web" | "system";
  senderId: string;
  senderName: string;
  text: string;
  time: string;
}

export interface PlayerBindingState {
  status: PlayerBindingStatus;
  qq: string;
  playerUuid?: string;
  playerName?: string;
  expiresAt?: string;
}
