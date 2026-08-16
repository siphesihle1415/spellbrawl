import type { Gesture } from "../game/types";

const glyphs: Record<Gesture, string> = {
  FIST: "✊",
  OPEN_PALM: "✋",
  POINT: "☝",
  PINCH: "🤏",
};

export function GestureGlyph({ gesture, className = "" }: { gesture?: Gesture; className?: string }) {
  return (
    <span className={`gesture-glyph ${className}`} aria-hidden="true">
      {gesture ? glyphs[gesture] : "◇"}
    </span>
  );
}

export function gestureLabel(gesture?: Gesture) {
  return gesture?.replaceAll("_", " ") ?? "Waiting";
}
