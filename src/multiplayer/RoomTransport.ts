import type { GameState, Gesture, PlayerId } from "../game/types";

export type SemanticRoomEvent =
  | { type: "ROLE_ASSIGNED"; playerId: PlayerId; isHost: boolean }
  | { type: "PLAYER_READY"; playerId: PlayerId }
  | { type: "GESTURE"; playerId: PlayerId; gesture: Gesture; at: number }
  | { type: "STATE_SYNC"; state: GameState }
  | { type: "PEER_LEFT" };

export type ConnectionState =
  | { status: "IDLE" }
  | { status: "CONNECTING"; code: string }
  | { status: "WAITING_FOR_PEER"; code: string; myPlayerId: PlayerId; isHost: boolean }
  | { status: "CONNECTED"; code: string; myPlayerId: PlayerId; isHost: boolean }
  | { status: "PEER_LEFT"; code: string; myPlayerId: PlayerId; isHost: boolean };

export interface RoomTransport {
  connect(roomCode: string): Promise<void>;
  publish(event: SemanticRoomEvent): void;
  subscribe(listener: (event: SemanticRoomEvent) => void): () => void;
  disconnect(): void;
}

// The production adapter (PartyKitRoomTransport) implements this contract. Keeping this
// interface semantic prevents video frames and landmarks entering transport code.
