import type { GameState, Gesture, PlayerId, RoundId } from "../game/types";
import type { DirectorSource } from "../director/DirectorClient";
import type { RunConfiguration } from "../director/schema";

export type SemanticRoomEvent =
  | { type: "ROLE_ASSIGNED"; playerId: PlayerId; isHost: boolean }
  | { type: "PLAYER_READY"; playerId: PlayerId }
  | { type: "GESTURE"; playerId: PlayerId; gesture: Gesture; at: number }
  | { type: "STATE_SYNC"; state: GameState }
  | { type: "DIRECTOR_SYNC"; configuration: RunConfiguration; source: DirectorSource }
  | { type: "ROUND_READY"; playerId: PlayerId; round: RoundId }
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

// The production adapter (CloudflareRoomTransport) implements this contract. Keeping this
// interface semantic prevents video frames and landmarks entering transport code.
