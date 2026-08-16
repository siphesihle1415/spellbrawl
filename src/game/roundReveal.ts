import { useEffect, useRef, useState } from "react";
import { DEFEAT_HOLD_MS, HEXWYRM_VICTORY_HOLD_MS } from "./monsters";
import type { GameState, RoundId } from "./types";

export const ROUND_NUMBER: Record<RoundId, number> = {
  EMBERMAW: 1,
  SHARD_WARDEN: 2,
  HEXWYRM: 3,
};

export type RoundDisplayState = {
  round: RoundId;
  roundNumber: number;
  status: GameState["status"];
  enemyHp: number;
  enemyMaxHp: number;
  phase: GameState["phase"];
  message: string;
};

export function liveRoundDisplay(state: GameState): RoundDisplayState {
  return {
    round: state.round,
    roundNumber: ROUND_NUMBER[state.round],
    status: state.status,
    enemyHp: state.enemyHp,
    enemyMaxHp: state.enemyMaxHp,
    phase: state.phase,
    message: state.message,
  };
}

// Decides whether a state transition should hold the HUD on the pre-transition info before
// revealing what's next, and for how long. Pure and separate from useRoundDisplay below so it's
// unit-testable without rendering anything (this codebase's tests are all pure-function tests —
// see game/engine.test.ts, game/monsters.test.ts).
export function resolveRoundReveal(
  previous: GameState,
  next: GameState,
): { holdMs: number; frozen: RoundDisplayState } | null {
  const roundChanged = previous.round !== next.round;
  const enteredVictory = previous.status !== "VICTORY" && next.status === "VICTORY";

  const holdMs = roundChanged ? DEFEAT_HOLD_MS[previous.round] : enteredVictory ? HEXWYRM_VICTORY_HOLD_MS : undefined;
  if (holdMs === undefined) return null;

  return {
    holdMs,
    frozen: {
      round: previous.round,
      roundNumber: ROUND_NUMBER[previous.round],
      status: previous.status,
      enemyHp: 0,
      enemyMaxHp: previous.enemyMaxHp,
      phase: previous.phase,
      message: previous.message,
    },
  };
}

// The reveal-hold counterpart to Arena.tsx's `visibleRound`, for App.tsx's HUD and Victory
// overlay. Each client (host and guest) runs this independently off the state it has, the same
// way Arena.tsx's model-swap hold already does — no new cross-client synchronization.
export function useRoundDisplay(state: GameState): RoundDisplayState {
  const [display, setDisplay] = useState<RoundDisplayState>(() => liveRoundDisplay(state));
  const previousRef = useRef(state);
  const latestStateRef = useRef(state);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    latestStateRef.current = state;

    // A hold is already in flight: `state` changing again here is some unrelated dispatch (a
    // gesture, an enemy attack windup, ...) that happened to land mid-hold, not a new reveal.
    // Leave the timer below running — it reads latestStateRef when it fires, so it still reveals
    // whatever's freshest once the hold elapses, instead of the stale state from when it started.
    if (timerRef.current !== undefined) return;

    const previous = previousRef.current;
    previousRef.current = state;

    const reveal = resolveRoundReveal(previous, state);
    if (!reveal) {
      setDisplay(liveRoundDisplay(state));
      return;
    }

    setDisplay(reveal.frozen);
    timerRef.current = setTimeout(() => {
      timerRef.current = undefined;
      previousRef.current = latestStateRef.current;
      setDisplay(liveRoundDisplay(latestStateRef.current));
    }, reveal.holdMs);
  }, [state]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return display;
}
