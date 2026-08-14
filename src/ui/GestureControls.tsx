import type { Gesture, PlayerId } from "../game/types";

const controls: Array<{ gesture: Gesture; label: string; key: string }> = [
  { gesture: "FIST", label: "Fist", key: "1" },
  { gesture: "THRUST", label: "Thrust", key: "2" },
  { gesture: "OPEN_PALM", label: "Open palm", key: "3" },
  { gesture: "POINT", label: "Point", key: "4" },
  { gesture: "PINCH", label: "Pinch", key: "5" },
  { gesture: "HANDS_APART", label: "Hands apart", key: "6" },
];

export function GestureControls({
  playerId,
  onGesture,
}: {
  playerId: PlayerId;
  onGesture: (playerId: PlayerId, gesture: Gesture) => void;
}) {
  return (
    <section className="gesture-panel">
      <div className="panel-heading">
        <span>{playerId === "PLAYER_A" ? "Player A" : "Player B"}</span>
        <small>{playerId === "PLAYER_A" ? "Local caster" : "Simulated remote"}</small>
      </div>
      <div className="gesture-grid">
        {controls.map((control) => (
          <button
            type="button"
            key={control.gesture}
            onClick={() => onGesture(playerId, control.gesture)}
          >
            <span>{control.label}</span>
            <kbd>{playerId === "PLAYER_A" ? control.key : `⇧${control.key}`}</kbd>
          </button>
        ))}
      </div>
    </section>
  );
}
