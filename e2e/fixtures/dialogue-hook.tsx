import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { useRoundDialogue } from "../../src/director/useRoundDialogue";

function Harness() {
  const [renders, setRenders] = useState(0);
  const [active, setActive] = useState(true);
  const { linesByRound } = useRoundDialogue(true, active ? "DIALOGUE" : "PLAYING", false, "EMBERMAW", {
    name: "Embermaw", title: "The Starved Flame", theme: "FIRE",
  });
  return <>
    <button onClick={() => setRenders(renders + 1)}>Rerender {renders}</button>
    <button onClick={() => setActive(!active)}>Toggle dialogue</button>
    <output>{JSON.stringify(linesByRound)}</output>
  </>;
}

createRoot(document.getElementById("root")!).render(<StrictMode><Harness /></StrictMode>);
