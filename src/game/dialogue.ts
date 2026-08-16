import type { GameState } from "./types";
import type { RunConfiguration } from "../director/schema";

export type DialogueLine = { speaker: string; text: string };

export function encounterDialogue(state: GameState, configuration: RunConfiguration): DialogueLine[] {
  if (state.tutorial) {
    return [
      { speaker: "AI Director", text: "This is a protected practice duel. Your shared health cannot run out here." },
      { speaker: configuration.embermaw.name, text: "Show me whether two spellcasters can move as one." },
      { speaker: "Players", text: "Raise a palm to defend. Charge a fist, then open it to answer with fire." },
    ];
  }
  if (state.round === "EMBERMAW") return [
    { speaker: configuration.embermaw.name, text: "The rehearsal is over. Now the flame bites back." },
    { speaker: "Player 1", text: "We learned your rhythm." },
    { speaker: "Player 2", text: "And we brought twice the fire." },
  ];
  if (state.round === "SHARD_WARDEN") return [
    { speaker: configuration.shardWarden.name, text: "No spell crosses the crystal threshold." },
    { speaker: "Player 2", text: "Then I will mark the fracture." },
    { speaker: "Player 1", text: "And I will drive the fire through it." },
  ];
  return [
    { speaker: configuration.hexwyrm.name, text: "Your little bond ends where the void begins." },
    { speaker: "Player 1", text: "One hand anchors the rift." },
    { speaker: "Player 2", text: "The other tears it open. Together, we finish this." },
  ];
}
