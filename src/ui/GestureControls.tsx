import type { Gesture } from "../game/types";

const controls: Array<{ gesture: Gesture; label: string; key: string }> = [
  { gesture: "FIST", label: "Fist", key: "1" },
  { gesture: "THRUST", label: "Thrust", key: "2" },
  { gesture: "OPEN_PALM", label: "Open palm", key: "3" },
  { gesture: "POINT", label: "Point", key: "4" },
  { gesture: "PINCH", label: "Pinch", key: "5" },
  { gesture: "HANDS_APART", label: "Hands apart", key: "6" },
];

export function GestureControls({ onGesture }: { onGesture: (gesture: Gesture) => void }) {
  return (
    <section className="rounded-[15px] border border-[#2e2440] bg-[#100c19cc] p-[11px]">
      <div className="mx-0.5 mt-px mb-[9px] flex items-baseline justify-between">
        <span className="font-display text-sm">Your gestures</span>
        <small className="text-[0.62rem] text-[#81738f]">Keyboard 1–6</small>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {controls.map((control) => (
          <button
            className="flex min-h-[38px] cursor-pointer items-center justify-between rounded-lg border border-[#342943] bg-[#171120] px-2 py-[7px] text-[0.69rem] text-[#cfc4df] transition duration-150 hover:-translate-y-px hover:border-[#765b9a] hover:bg-[#22182f] hover:text-white"
            type="button"
            key={control.gesture}
            onClick={() => onGesture(control.gesture)}
          >
            <span>{control.label}</span>
            <kbd className="font-sans text-[0.6rem] text-[#82738e]">{control.key}</kbd>
          </button>
        ))}
      </div>
    </section>
  );
}
