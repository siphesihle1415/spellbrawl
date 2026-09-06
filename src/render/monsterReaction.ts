import type { GameState, RoundId } from "../game/types";

type ReactionState = Pick<GameState, "status" | "round" | "enemyHp">;

// Whether an enemy HP drop is a spell landing (play the hit reaction) rather than a fresh
// encounter arriving with its own HP. Only a live fight can damage a monster — applyDamage in
// engine.ts is unreachable unless `status` is already "PLAYING" — while every other HP change
// belongs to enterRound seeding the next fight. That distinction matters at the very first
// entrance: START drops Embermaw from the lobby's 3 HP to the tutorial's 2 (see enterRound),
// which without the status check reads as a hit and hijacks the walk-in with a 2.83s scream
// clip, over the whole 3s approach.
export function tookNonFatalHit(previous: ReactionState, current: ReactionState, round: RoundId): boolean {
  return previous.status === "PLAYING"
    && current.round === round
    && previous.round === round
    && current.enemyHp < previous.enemyHp
    && current.enemyHp > 0;
}
