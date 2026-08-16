import type { DialogueLine } from "../game/dialogue";
import { GestureGlyph } from "./GestureGlyph";

export function EncounterDialogue({ lines, step }: { lines: DialogueLine[]; step: number }) {
  const line = lines[Math.min(step, lines.length - 1)];
  return (
    <div className="encounter-dialogue" role="dialog" aria-label="Encounter dialogue">
      <small>AI Director · Encounter transmission</small>
      <h2>{line.speaker}</h2>
      <p>“{line.text}”</p>
      <div><GestureGlyph gesture="OPEN_PALM" /> Make any hand gesture to continue <b>{Math.min(step + 1, lines.length)} / {lines.length}</b></div>
    </div>
  );
}
