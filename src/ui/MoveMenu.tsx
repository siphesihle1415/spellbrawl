import { useEffect, useState, type CSSProperties } from "react";
import type { GameState, Gesture, PlayerId } from "../game/types";
import { GestureGlyph, gestureLabel } from "./GestureGlyph";

type RecipeStep = { gesture: Gesture; role?: "P1" | "P2"; label?: string };
type Move = {
  id: string; name: string; icon: string; category: "Damage" | "Defense" | "Special move";
  tone: string; recipe: RecipeStep[]; timer?: string; description: string;
  available: (state: GameState) => boolean;
};

const moves: Move[] = [
  { id: "firebolt", name: "Firebolt", icon: "☄", category: "Damage", tone: "#ff710c", recipe: [{ gesture: "FIST" }, { gesture: "OPEN_PALM" }], timer: "≤ 1.5s\ncombo window", description: "Deals 1 damage to the current enemy.", available: (s) => s.round !== "HEXWYRM" || s.phase === "CORE_PHASE" },
  { id: "shield", name: "Arcane Shield", icon: "♢", category: "Defense", tone: "#43a5ff", recipe: [{ gesture: "OPEN_PALM" }], timer: "1.2s\nshield window", description: "Blocks the next enemy attack. Any one player shielding protects the shared HP pool.", available: (s) => s.round !== "HEXWYRM" },
  { id: "starfall", name: "Starfall", icon: "✦", category: "Special move", tone: "#e957f2", recipe: [{ gesture: "FIST", role: "P1", label: "Hold fist" }, { gesture: "PINCH", role: "P2" }, { gesture: "OPEN_PALM", role: "P1" }], description: "Player 1 holds FIST, Player 2 performs PINCH, then Player 1 performs OPEN_PALM.", available: (s) => s.phase === "FUSION_FINISHER" },
  { id: "breath", name: "Breath Attack", icon: "≋", category: "Special move", tone: "#27d8e7", recipe: [{ gesture: "OPEN_PALM", role: "P1" }, { gesture: "OPEN_PALM", role: "P2" }], timer: "≤ 1s\ntogether", description: "Both players use OPEN_PALM within ~1s to create a co-op barrier.", available: (s) => s.phase === "BREATH_ATTACK" },
  { id: "armor", name: "Armor Phase", icon: "⬡", category: "Special move", tone: "#f3a913", recipe: [{ gesture: "POINT" }, { gesture: "PINCH" }, { gesture: "POINT" }, { gesture: "PINCH" }], timer: "×2\nwithin 1.5s", description: "Alternate POINT + PINCH, paired within 1.5s, twice to shatter armor.", available: (s) => s.phase === "ARMOR_PHASE" },
  { id: "core", name: "Core Phase", icon: "⌾", category: "Special move", tone: "#ff553d", recipe: [{ gesture: "FIST", label: "Firebolt" }, { gesture: "OPEN_PALM" }], description: "Land one Firebolt to expose the core.", available: (s) => s.phase === "CORE_PHASE" },
  { id: "fusion", name: "Fusion Finisher", icon: "∞", category: "Special move", tone: "#f04ac7", recipe: [{ gesture: "FIST", role: "P1", label: "Hold fist" }, { gesture: "PINCH", role: "P2" }, { gesture: "OPEN_PALM", role: "P1" }], description: "Player 1 holds FIST, Player 2 does PINCH, then Player 1 casts OPEN_PALM — Starfall, instant victory!", available: (s) => s.phase === "FUSION_FINISHER" },
];

function moveProgress(move: Move, state: GameState, playerId: PlayerId, now: number) {
  if (move.id === "firebolt" || move.id === "core") return Math.max(0, Math.min(1, (state.players[playerId].fistPrimedUntil - now) / 1_500));
  if (move.id === "shield") return Math.max(0, Math.min(1, (state.players[playerId].shieldedUntil - now) / 1_200));
  if (move.id === "armor") return state.armorBreaks / 2;
  return Math.min(1, state.recentGestures.filter((item) => now - item.at <= 2_000).length / move.recipe.length);
}

function isActive(move: Move, state: GameState, progress: number) {
  if (progress > 0) return true;
  const effect = state.effect?.kind;
  return ((move.id === "firebolt" || move.id === "core") && effect === "FIREBOLT")
    || (move.id === "shield" && effect === "SHIELD") || (move.id === "breath" && effect === "BARRIER")
    || (move.id === "armor" && effect === "ARMOR_BREAK")
    || ((move.id === "starfall" || move.id === "fusion") && effect === "STARFALL");
}

function Recipe({ move }: { move: Move }) {
  return (
    <div className="spell-recipe">
      <div className="recipe-steps">
        {move.recipe.map((step, index) => (
          <div className="recipe-fragment" key={`${step.gesture}-${index}`}>
            {index > 0 && <span className="recipe-operator">{move.id === "breath" ? "+" : "→"}</span>}
            <div className="recipe-step">{step.role && <b>{step.role}</b>}<GestureGlyph gesture={step.gesture} /><small>{step.label ?? gestureLabel(step.gesture)}</small></div>
          </div>
        ))}
      </div>
      {move.timer && <span className="recipe-timer">{move.timer}</span>}
    </div>
  );
}

function DetailedSpell({ move, index, available, active, progress }: { move: Move; index: number; available: boolean; active: boolean; progress: number }) {
  return (
    <article className={`spell-card ${available ? "is-available" : "is-disabled"} ${active ? "is-active" : ""}`} style={{ "--move-color": move.tone, "--move-progress": `${progress * 100}%` } as CSSProperties}>
      <header className="spell-title"><span className="spell-symbol">{move.icon}</span><div><strong>{index + 1}. {move.name}</strong><small>{move.category}</small></div></header>
      <Recipe move={move} />
      <div className="spell-states">
        <div className="spell-state is-ready"><div className="spell-orb"><span>{move.icon}</span><i /></div><b>{active ? "Casting" : "Available"}</b></div>
        <div className="spell-state is-locked"><div className="spell-orb"><span>{move.icon}</span></div><b>Not available</b></div>
      </div>
      <p>{move.description}</p>
    </article>
  );
}

export function MoveMenu({ state, playerId, now }: { state: GameState; playerId: PlayerId; now: number }) {
  const [helpOpen, setHelpOpen] = useState(false);
  const moveStates = moves.map((move) => {
    const available = state.status === "PLAYING" && move.available(state);
    const progress = available ? moveProgress(move, state, playerId, now) : 0;
    return { move, available, progress, active: available && isActive(move, state, progress) };
  });

  useEffect(() => {
    if (!helpOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setHelpOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [helpOpen]);

  return (
    <>
      <aside className="move-menu" aria-label="Spell moves">
        <header className="compact-menu-heading"><div><small>Spellbook</small><strong>Moves</strong></div><button type="button" onClick={() => setHelpOpen(true)} aria-label="Open move help">? Help</button></header>
        <div className="compact-moves">
          {moveStates.map(({ move, available, active, progress }, index) => (
            <article key={move.id} className={`compact-spell ${available ? "is-available" : "is-disabled"} ${active ? "is-active" : ""}`} style={{ "--move-color": move.tone, "--move-progress": `${progress * 100}%` } as CSSProperties}>
              <i className="compact-progress" /><span className="compact-symbol">{move.icon}</span>
              <div className="compact-copy"><strong>{index + 1}. {move.name}</strong><small>{move.category}</small></div>
              <div className="compact-recipe">{move.recipe.map((step, recipeIndex) => <GestureGlyph key={`${step.gesture}-${recipeIndex}`} gesture={step.gesture} />)}</div>
              <b className="compact-status">{active ? "Casting" : available ? "Ready" : "Locked"}</b>
            </article>
          ))}
        </div>
      </aside>

      {helpOpen && (
        <div className="spell-help-overlay" role="dialog" aria-modal="true" aria-label="Move help">
          <section className="spell-help-panel">
            <header className="spell-help-heading"><div><small>SpellBrawl field guide</small><h2>Move help</h2></div><button type="button" onClick={() => setHelpOpen(false)} aria-label="Close move help">Close ×</button></header>
            <div className="help-spell-grid">{moveStates.map((moveState, index) => <DetailedSpell key={moveState.move.id} index={index} {...moveState} />)}</div>
            <footer className="spell-legend">
              {(["FIST", "OPEN_PALM", "PINCH", "POINT"] as Gesture[]).map((gesture) => <span key={gesture}><GestureGlyph gesture={gesture} /> {gestureLabel(gesture)}</span>)}
              <span><b>P1</b> = Player 1</span><span><b>P2</b> = Player 2</span>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
