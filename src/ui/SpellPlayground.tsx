import { useEffect, useRef, useState, type Dispatch } from "react";
import { encounters } from "../game/config";
import { gameReducer, initialGameState } from "../game/engine";
import type { CombatEffectKind, GameAction, GameState, Gesture, Phase, RoundId } from "../game/types";
import { WebcamPreview } from "../hand/WebcamPreview";
import { GestureGlyph, gestureLabel } from "./GestureGlyph";
import { MoveMenu } from "./MoveMenu";

type PlaygroundSpell = {
  id: string;
  name: string;
  effect: CombatEffectKind;
  gestures: Gesture[];
  round: RoundId;
  phase: Phase;
  message: string;
};

const playgroundSpells: PlaygroundSpell[] = [
  { id: "firebolt", name: "Firebolt", effect: "FIREBOLT", gestures: ["FIST", "OPEN_PALM"], round: "EMBERMAW", phase: "ACTIVE", message: "Firebolt launched!" },
  { id: "shield", name: "Arcane Shield", effect: "SHIELD", gestures: ["OPEN_PALM"], round: "EMBERMAW", phase: "ACTIVE", message: "Arcane shield raised." },
  { id: "starfall", name: "Starfall", effect: "STARFALL", gestures: ["FIST", "PINCH", "OPEN_PALM"], round: "HEXWYRM", phase: "FUSION_FINISHER", message: "Starfall called down!" },
  { id: "breath", name: "Breath Barrier", effect: "BARRIER", gestures: ["OPEN_PALM", "OPEN_PALM"], round: "HEXWYRM", phase: "BREATH_ATTACK", message: "Co-op breath barrier formed!" },
  { id: "armor", name: "Armor Phase", effect: "ARMOR_BREAK", gestures: ["POINT", "PINCH", "POINT", "PINCH"], round: "HEXWYRM", phase: "ARMOR_PHASE", message: "Armor shattered!" },
  { id: "core", name: "Core Phase", effect: "FIREBOLT", gestures: ["FIST", "OPEN_PALM"], round: "HEXWYRM", phase: "CORE_PHASE", message: "Firebolt struck the exposed core!" },
  { id: "fusion", name: "Fusion Finisher", effect: "STARFALL", gestures: ["FIST", "PINCH", "OPEN_PALM"], round: "HEXWYRM", phase: "FUSION_FINISHER", message: "Fusion Finisher unleashed!" },
];

const keyGestures: Record<string, Gesture> = { "1": "FIST", "2": "OPEN_PALM", "3": "POINT", "4": "PINCH" };

function stateForSpell(spell: PlaygroundSpell): GameState {
  const state = gameReducer(initialGameState(), { type: "START" });
  const encounter = encounters[spell.round];
  return {
    ...state,
    round: spell.round,
    roundNumber: spell.round === "EMBERMAW" ? 1 : spell.round === "SHARD_WARDEN" ? 2 : 3,
    phase: spell.phase,
    enemyHp: encounter.hp,
    enemyMaxHp: encounter.hp,
    message: `Selected ${spell.name}. Perform the gesture sequence below.`,
  };
}

export function SpellPlayground({ state, now, dispatch, onExit, testMode }: { state: GameState; now: number; dispatch: Dispatch<GameAction>; onExit: () => void; testMode: boolean }) {
  const [selectedId, setSelectedId] = useState(playgroundSpells[0].id);
  const [step, setStep] = useState(0);
  const stateRef = useRef(state);
  const selectedRef = useRef(playgroundSpells[0]);
  const stepRef = useRef(0);
  const effectIdRef = useRef(0);
  stateRef.current = state;

  const selectSpell = (spell: PlaygroundSpell) => {
    selectedRef.current = spell;
    stepRef.current = 0;
    setSelectedId(spell.id);
    setStep(0);
    dispatch({ type: "SYNC", state: stateForSpell(spell) });
  };

  const handleGesture = (gesture: Gesture) => {
    const spell = selectedRef.current;
    const expected = spell.gestures[stepRef.current];
    const nextStep = gesture === expected ? stepRef.current + 1 : gesture === spell.gestures[0] ? 1 : 0;
    stepRef.current = nextStep;
    setStep(nextStep);

    const current = stateRef.current;
    const withGesture: GameState = {
      ...current,
      players: {
        ...current.players,
        PLAYER_A: { ...current.players.PLAYER_A, lastGesture: gesture },
      },
      message: nextStep === spell.gestures.length
        ? spell.message
        : nextStep > 0
          ? `${gestureLabel(gesture)} accepted · ${nextStep} / ${spell.gestures.length}`
          : `Expected ${gestureLabel(expected)}. Sequence reset.`,
    };

    if (nextStep === spell.gestures.length) {
      effectIdRef.current += 1;
      const shieldedUntil = spell.effect === "SHIELD" ? performance.now() + 1_200 : current.players.PLAYER_A.shieldedUntil;
      dispatch({
        type: "SYNC",
        state: {
          ...withGesture,
          players: { ...withGesture.players, PLAYER_A: { ...withGesture.players.PLAYER_A, shieldedUntil } },
          effect: { id: effectIdRef.current, kind: spell.effect, playerId: "PLAYER_A" },
        },
      });
      stepRef.current = 0;
      setStep(0);
      return;
    }

    dispatch({ type: "SYNC", state: withGesture });
  };

  const clearGesture = () => dispatch({ type: "GESTURE_END", playerId: "PLAYER_A" });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const gesture = keyGestures[event.key];
      if (gesture && !event.repeat) handleGesture(gesture);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (keyGestures[event.key]) clearGesture();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  const selected = playgroundSpells.find((spell) => spell.id === selectedId) ?? playgroundSpells[0];

  return (
    <div className="spell-playground-ui">
      <div className="playground-heading">
        <div><small>Temporary practice arena · All spells</small><h2>Spell Playground</h2><p>Select a spell, then perform its gestures with your tracked hand.</p></div>
        <button type="button" onClick={onExit}>Exit playground</button>
      </div>

      <div className="playground-spell-picker" aria-label="Choose a spell to test">
        {playgroundSpells.map((spell) => (
          <button key={spell.id} type="button" className={spell.id === selected.id ? "is-selected" : ""} onClick={() => selectSpell(spell)}>{spell.name}</button>
        ))}
        <div className="playground-recipe" aria-live="polite">
          <strong>{selected.name}</strong>
          <span>{selected.gestures.map((gesture, index) => <i key={`${gesture}-${index}`} className={index < step ? "is-complete" : index === step ? "is-next" : ""}><GestureGlyph gesture={gesture} /> {gestureLabel(gesture)}</i>)}</span>
          <small>Co-op roles are simulated so one player can complete every move.</small>
        </div>
      </div>

      <div className="combat-message">{state.message}</div>
      <MoveMenu state={state} playerId="PLAYER_A" now={now} />
      <div className="playground-camera">
        <WebcamPreview
          playerLabel="Player 1"
          active
          castingEnabled
          testMode={testMode}
          onGesture={handleGesture}
          onGestureEnd={clearGesture}
          onReadyChange={() => undefined}
        />
      </div>
    </div>
  );
}
