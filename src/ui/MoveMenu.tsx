import type { GameState, Gesture, PlayerId } from "../game/types";
import type { CSSProperties } from "react";
import { GestureGlyph } from "./GestureGlyph";

type Move = {
  id: string;
  name: string;
  tone: string;
  recipe: Gesture[];
  detail: string;
  available: (state: GameState) => boolean;
};

const moves: Move[] = [
  { id: "firebolt", name: "Firebolt", tone: "#ff6a28", recipe: ["FIST", "OPEN_PALM"], detail: "1.5s combo", available: (s) => s.round !== "HEXWYRM" || s.phase === "CORE_PHASE" },
  { id: "shield", name: "Arcane Shield", tone: "#46a8ff", recipe: ["OPEN_PALM"], detail: "1.2s guard", available: (s) => s.round !== "HEXWYRM" },
  { id: "starfall", name: "Starfall", tone: "#e65cff", recipe: ["FIST", "PINCH", "OPEN_PALM"], detail: "co-op chain", available: (s) => s.phase === "FUSION_FINISHER" },
  { id: "breath", name: "Breath Barrier", tone: "#29ddea", recipe: ["OPEN_PALM", "OPEN_PALM"], detail: "together ≤1s", available: (s) => s.phase === "BREATH_ATTACK" },
  { id: "armor", name: "Armor Break", tone: "#ffb21f", recipe: ["POINT", "PINCH"], detail: "2 paired casts", available: (s) => s.phase === "ARMOR_PHASE" },
  { id: "core", name: "Core Strike", tone: "#ff533b", recipe: ["FIST", "OPEN_PALM"], detail: "expose core", available: (s) => s.phase === "CORE_PHASE" },
  { id: "fusion", name: "Fusion Finisher", tone: "#ff48bf", recipe: ["FIST", "PINCH", "OPEN_PALM"], detail: "P1 · P2 · P1", available: (s) => s.phase === "FUSION_FINISHER" },
];

function moveProgress(move: Move, state: GameState, playerId: PlayerId, now: number) {
  if (move.id === "firebolt" || move.id === "core") {
    return Math.max(0, Math.min(1, (state.players[playerId].fistPrimedUntil - now) / 1_500));
  }
  if (move.id === "shield") return Math.max(0, Math.min(1, (state.players[playerId].shieldedUntil - now) / 1_200));
  if (move.id === "armor") return state.armorBreaks / 2;
  const relevant = state.recentGestures.filter((item) => now - item.at <= 2_000).length;
  return Math.min(1, relevant / move.recipe.length);
}

function isActive(move: Move, state: GameState, progress: number) {
  if (progress > 0) return true;
  const effect = state.effect?.kind;
  return (move.id === "firebolt" || move.id === "core") && effect === "FIREBOLT"
    || move.id === "shield" && effect === "SHIELD"
    || move.id === "breath" && effect === "BARRIER"
    || move.id === "armor" && effect === "ARMOR_BREAK"
    || (move.id === "starfall" || move.id === "fusion") && effect === "STARFALL";
}

export function MoveMenu({ state, playerId, now }: { state: GameState; playerId: PlayerId; now: number }) {
  return (
    <aside className="move-menu" aria-label="Spell moves">
      <div className="move-menu-heading">
        <div><span>Spellbook</span><strong>Available moves</strong></div>
        <small>Round {state.roundNumber}</small>
      </div>
      <div className="move-grid">
        {moves.map((move, index) => {
          const available = state.status === "PLAYING" && move.available(state);
          const progress = available ? moveProgress(move, state, playerId, now) : 0;
          const active = available && isActive(move, state, progress);
          return (
            <article
              key={move.id}
              className={`move-item ${available ? "is-available" : "is-disabled"} ${active ? "is-active" : ""}`}
              style={{ "--move-color": move.tone, "--move-progress": `${progress * 100}%` } as CSSProperties}
            >
              <div className="move-progress" />
              <span className="move-number">{index + 1}</span>
              <div className="move-copy"><strong>{move.name}</strong><small>{move.detail}</small></div>
              <div className="move-recipe">
                {move.recipe.map((gesture, recipeIndex) => <GestureGlyph key={`${gesture}-${recipeIndex}`} gesture={gesture} />)}
              </div>
            </article>
          );
        })}
      </div>
    </aside>
  );
}
