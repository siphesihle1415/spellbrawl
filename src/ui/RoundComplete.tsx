import type { GameState, PlayerId } from "../game/types";

export function RoundComplete({ state, playerId, monsterName, onContinue, onExit }: { state: GameState; playerId: PlayerId; monsterName: string; onContinue: () => void; onExit: () => void }) {
  const meReady = state.continueReady[playerId];
  const readyCount = Number(state.continueReady.PLAYER_A) + Number(state.continueReady.PLAYER_B);
  return (
    <div className="round-complete" role="dialog" aria-label="Round complete">
      <small>{state.tutorial ? "Training cleared" : `Round ${state.roundNumber} cleared`}</small>
      <h2>{monsterName} defeated</h2>
      <p>{state.tutorial ? "Your practice ward fades. The true brawl is ready." : "The next rift opens only when both spellcasters choose to continue."}</p>
      <div className="progression-votes">
        <span className={state.continueReady.PLAYER_A ? "is-ready" : ""}>P1 {state.continueReady.PLAYER_A ? "Ready" : "Deciding"}</span>
        <span className={state.continueReady.PLAYER_B ? "is-ready" : ""}>P2 {state.continueReady.PLAYER_B ? "Ready" : "Deciding"}</span>
      </div>
      <div className="round-actions">
        <button type="button" onClick={onContinue} disabled={meReady}>{meReady ? `Waiting for partner · ${readyCount}/2` : "Continue"}</button>
        <button type="button" className="is-exit" onClick={onExit}>Exit lobby</button>
      </div>
    </div>
  );
}
