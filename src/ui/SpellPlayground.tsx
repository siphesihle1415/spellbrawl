import type { Dispatch } from "react";
import type { GameAction, GameState } from "../game/types";
import { WebcamPreview } from "../hand/WebcamPreview";
import { MoveMenu } from "./MoveMenu";

export function SpellPlayground({ state, now, dispatch, onExit, testMode }: { state: GameState; now: number; dispatch: Dispatch<GameAction>; onExit: () => void; testMode: boolean }) {
  return (
    <div className="spell-playground-ui">
      <div className="playground-heading">
        <div><small>Temporary practice arena · Enemy {state.enemyHp} / {state.enemyMaxHp} HP</small><h2>Spell Playground</h2><p>FIST → OPEN PALM launches Firebolt. OPEN PALM raises Shield.</p></div>
        <button type="button" onClick={onExit}>Exit playground</button>
      </div>

      <div className="combat-message">{state.message}</div>
      <MoveMenu state={state} playerId="PLAYER_A" now={now} />
      <div className="playground-camera">
        <WebcamPreview
          playerLabel="Player 1"
          active
          castingEnabled
          testMode={testMode}
          onGesture={(gesture) => dispatch({ type: "GESTURE", playerId: "PLAYER_A", gesture, at: performance.now() })}
          onGestureEnd={() => dispatch({ type: "GESTURE_END", playerId: "PLAYER_A" })}
          onReadyChange={() => undefined}
        />
      </div>
    </div>
  );
}
