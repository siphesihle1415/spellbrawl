import type { Gesture, PlayerId } from "../game/types";

export type ConfirmedGesture = {
  playerId: PlayerId;
  gesture: Gesture;
  confidence: number;
  at: number;
};

export interface GestureSource {
  start(onGesture: (gesture: ConfirmedGesture) => void): Promise<void>;
  stop(): void;
}

// MediaPipe and keyboard debugging both implement this boundary. The game engine only
// receives temporally confirmed semantic gestures.
