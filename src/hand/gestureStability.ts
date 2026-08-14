import type { Gesture } from "../game/types";

const HOLD_MS = 120;

type Candidate = { gesture: Gesture; confidence: number } | null;
type Confirmed = { gesture: Gesture; confidence: number; at: number };

export class GestureStabilizer {
  private candidateGesture: Gesture | null = null;
  private candidateSince = 0;
  private firedGesture: Gesture | null = null;

  observe(candidate: Candidate, at: number): Confirmed | null {
    const gesture = candidate?.gesture ?? null;

    if (gesture !== this.candidateGesture) {
      this.candidateGesture = gesture;
      this.candidateSince = at;
    }

    if (gesture === null) {
      this.firedGesture = null;
      return null;
    }

    if (gesture === this.firedGesture) return null;

    if (at - this.candidateSince >= HOLD_MS) {
      this.firedGesture = gesture;
      return { gesture, confidence: candidate!.confidence, at };
    }

    return null;
  }
}
