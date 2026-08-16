import type { Gesture } from "../game/types";
import { GestureGlyph, gestureLabel } from "./GestureGlyph";

export function RemoteHandPreview({ gesture, active, ready, playerLabel }: { gesture?: Gesture; active: boolean; ready: boolean; playerLabel: string }) {
  const canTrack = active && ready;
  return (
    <section className="hand-card remote-hand-card" aria-label={`${playerLabel} hand tracking`}>
      <div className="hand-viewport">
        <div className={`remote-gesture ${gesture && canTrack ? "is-casting" : ""}`}>
          <GestureGlyph gesture={canTrack ? gesture : undefined} />
          <strong>{!active ? "Tracking paused" : ready ? gestureLabel(gesture) : "Camera access needed"}</strong>
        </div>
        <span className="player-rune">P{playerLabel.at(-1)}</span>
      </div>
      <div className="hand-card-meta">
        <span><i className={canTrack ? "status-dot is-live" : "status-dot"} /> {playerLabel}</span>
        <small>{!active ? "Paused" : ready ? "Ready" : "Not ready"}</small>
      </div>
      <p>{!active ? "Hand tracking is unavailable." : ready ? `${gestureLabel(gesture)} · shared from their tracker` : "Waiting for this player to grant camera access."}</p>
    </section>
  );
}
