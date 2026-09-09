import { createRoot } from "react-dom/client";
import { StartupLoader } from "../../src/ui/StartupLoader";
import { RoundLoader } from "../../src/ui/RoundLoader";
import "../../src/styles.css";
const round = new URLSearchParams(location.search).has("round");
createRoot(document.getElementById("root")!).render(<main className="relative h-dvh overflow-hidden">{round ? <RoundLoader label="Summoning the next encounter…" loadedAssets={1} totalAssets={4} /> : <StartupLoader loadedAssets={1} totalAssets={10} />}</main>);
