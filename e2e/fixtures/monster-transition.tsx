import { useState } from "react";
import { createRoot } from "react-dom/client";
import { AnimationAction } from "three";
import { Arena } from "../../src/render/Arena";
import { gameReducer, initialGameState } from "../../src/game/engine";
import { encounters } from "../../src/game/config";
import type { GameState } from "../../src/game/types";
import "../../src/styles.css";

const animationStarts: { clip: string; root: string }[] = [];
Object.assign(window, { animationStarts });
const play = AnimationAction.prototype.play;
AnimationAction.prototype.play = function () {
  animationStarts.push({ clip: this.getClip().name, root: this.getRoot().uuid });
  return play.call(this);
};

function Harness() {
  const [state, setState] = useState<GameState>({ ...initialGameState(), status: "PLAYING", tutorial: false });
  const playerId = new URLSearchParams(location.search).has("guest") ? "PLAYER_B" : "PLAYER_A";
  return <>
    <Arena state={state} playerId={playerId} enemyColor={encounters[state.round].color} />
    <div style={{ position: "fixed", zIndex: 10 }}>
      <button onClick={() => setState({ ...state, round: "HEXWYRM", status: "PLAYING", enemyHp: 5, enemyMaxHp: 5 })}>Select third-level spell</button>
      <button onClick={() => setState({ ...state, enemyHp: 0, status: "MONSTER_DEFEATED" })}>Defeat monster</button>
      <button onClick={() => setState(gameReducer(state, { type: "SHOW_ROUND_COMPLETE" }))}>Finish death hold</button>
      <button onClick={() => setState(gameReducer(gameReducer(state,
        { type: "CONTINUE_READY", playerId: "PLAYER_A" }),
        { type: "CONTINUE_READY", playerId: "PLAYER_B" }))}>Both continue</button>
      <output>{state.round} {state.status}</output>
    </div>
  </>;
}

createRoot(document.getElementById("root")!).render(<Harness />);
