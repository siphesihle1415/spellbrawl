import type { Gesture } from "../game/types";
import { GestureGlyph, gestureLabel } from "./GestureGlyph";

export function RemoteHandPreview({ gesture, active, playerLabel }: { gesture?: Gesture; active: boolean; playerLabel: string }) {
  return (
    <section className="hand-card remote-hand-card" aria-label={`${playerLabel} hand tracking`}>
      <div className="hand-viewport">
        <div className={`remote-gesture ${gesture && active ? "is-casting" : ""}`}>
          <GestureGlyph gesture={active ? gesture : undefined} />
          <strong>{active ? gestureLabel(gesture) : "Tracking paused"}</strong>
        </div>
        <span className="player-rune">P{playerLabel.at(-1)}</span>
      </div>
      <div className="hand-card-meta">
        <span><i className={active ? "status-dot is-live" : "status-dot"} /> {playerLabel}</span>
        <small>{active ? "Synced" : "Paused"}</small>
      </div>
      <p>{active ? `${gestureLabel(gesture)} · shared from their tracker` : "Hand tracking resumes when the game begins."}</p>
    </section>
  );
}
