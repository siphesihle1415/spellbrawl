import { useEffect, useReducer } from "react";
import { encounters } from "./game/config";
import { gameReducer, initialGameState } from "./game/engine";
import type { Gesture, PlayerId } from "./game/types";
import { WebcamPreview } from "./hand/WebcamPreview";
import { Arena } from "./render/Arena";
import { GestureControls } from "./ui/GestureControls";

const keyGestures: Record<string, Gesture> = {
  "1": "FIST",
  "2": "THRUST",
  "3": "OPEN_PALM",
  "4": "POINT",
  "5": "PINCH",
  "6": "HANDS_APART",
};

export function App() {
  const [state, dispatch] = useReducer(gameReducer, undefined, initialGameState);
  const encounter = encounters[state.round];

  const castGesture = (playerId: PlayerId, gesture: Gesture) => {
    dispatch({ type: "GESTURE", playerId, gesture, at: performance.now() });
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const gesture = keyGestures[event.key];
      if (!gesture || event.repeat) return;
      castGesture(event.shiftKey ? "PLAYER_B" : "PLAYER_A", gesture);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (state.status !== "PLAYING") return;
    const interval = window.setInterval(() => {
      dispatch({ type: "ENEMY_ATTACK", at: performance.now() });
    }, 7_000);
    return () => window.clearInterval(interval);
  }, [state.status, state.round]);

  const progress = state.enemyMaxHp === 0 ? 0 : (state.enemyHp / state.enemyMaxHp) * 100;

  return (
    <main>
      <header className="topbar">
        <div>
          <p className="eyebrow">Co-op gesture combat · proof of concept</p>
          <h1>Spell<span>Brawl</span></h1>
        </div>
        <div className="room-chip"><span /> Room: LOCAL</div>
      </header>

      <section className="game-shell">
        <div className="arena-wrap">
          <Arena state={state} />
          <div className="round-label">Round {state.roundNumber} / 3</div>
          <div className="enemy-hud">
            <small>{encounter.title}</small>
            <h2>{encounter.name}</h2>
            <div className="health-track"><span style={{ width: `${progress}%` }} /></div>
            <p>{state.enemyHp} / {state.enemyMaxHp} HP · {state.phase.replaceAll("_", " ")}</p>
          </div>
          <div className="party-health">✦ Shared link: {"◆".repeat(state.sharedHp)}{"◇".repeat(5 - state.sharedHp)}</div>
          <div className="message-banner">{state.message}</div>
          {state.status !== "PLAYING" && (
            <div className="overlay">
              <p>{state.status === "VICTORY" ? "The rift is sealed" : state.status === "DEFEAT" ? "The link has broken" : "Two hands. One spell."}</p>
              <h2>{state.status === "VICTORY" ? "Victory" : state.status === "DEFEAT" ? "Defeat" : "Enter the arena"}</h2>
              <button type="button" onClick={() => dispatch({ type: state.status === "LOBBY" ? "START" : "RESET" })}>
                {state.status === "LOBBY" ? "Begin POC" : "Return to lobby"}
              </button>
            </div>
          )}
        </div>

        <aside>
          <WebcamPreview />
          <GestureControls playerId="PLAYER_A" onGesture={castGesture} />
          <GestureControls playerId="PLAYER_B" onGesture={castGesture} />
          <button className="enemy-attack" type="button" onClick={() => dispatch({ type: "ENEMY_ATTACK", at: performance.now() })}>
            Simulate enemy attack
          </button>
        </aside>
      </section>
    </main>
  );
}
