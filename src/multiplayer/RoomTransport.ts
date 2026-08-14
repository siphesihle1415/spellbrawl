import type { Gesture, PlayerId } from "../game/types";

export type SemanticRoomEvent =
  | { type: "PLAYER_READY"; playerId: PlayerId }
  | { type: "GESTURE"; playerId: PlayerId; gesture: Gesture; at: number }
  | { type: "AIM"; playerId: PlayerId; x: number; y: number }
  | { type: "SPELL_CAST"; playerId: PlayerId; spell: "FIREBOLT" | "SHIELD" | "STARFALL"; at: number };

export interface RoomTransport {
  connect(roomCode: string): Promise<void>;
  publish(event: SemanticRoomEvent): void;
  subscribe(listener: (event: SemanticRoomEvent) => void): () => void;
  disconnect(): void;
}

// The production adapter will implement this contract using the selected room provider.
// Keeping this interface semantic prevents video frames and landmarks entering transport code.
