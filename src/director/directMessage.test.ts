import { describe, expect, it } from "vitest";
import { encounters } from "../game/config";
import { gameReducer, initialGameState } from "../game/engine";
import type { GameState, RoundId } from "../game/types";
import { directMessage } from "./defaultConfig";
import type { RunConfiguration } from "./schema";

// Every slot renamed away from its canonical name, so a leak is unambiguous.
const renamed: RunConfiguration = {
  embermaw: { name: "Cinderfang", title: "The Furnace Beast", theme: "FIRE" },
  shardWarden: { name: "Rift Sentinel", title: "The Fractured Guard", theme: "FROST" },
  hexwyrm: { name: "Vhar'Zul", title: "The Last Calamity", theme: "VOID" },
  finisher: { name: "Twin Nova", clue: "FIST from A. PINCH from B. One final OPEN PALM from A." },
};

const fighting = (round: RoundId, extra: Partial<GameState> = {}): GameState => ({
  ...initialGameState(),
  status: "PLAYING",
  round,
  phase: "ACTIVE",
  enemyHp: 1,
  enemyMaxHp: encounters[round].hp,
  ...extra,
});

const firebolt = (state: GameState): GameState => {
  const primed = gameReducer(state, { type: "GESTURE", playerId: "PLAYER_A", gesture: "FIST", at: 100 });
  return gameReducer(primed, { type: "GESTURE", playerId: "PLAYER_A", gesture: "OPEN_PALM", at: 200 });
};

const hexwyrmFinisher = (state: GameState): GameState => {
  let next = gameReducer(state, { type: "GESTURE", playerId: "PLAYER_A", gesture: "FIST", at: 100 });
  next = gameReducer(next, { type: "GESTURE", playerId: "PLAYER_B", gesture: "PINCH", at: 200 });
  return gameReducer(next, { type: "GESTURE", playerId: "PLAYER_A", gesture: "OPEN_PALM", at: 300 });
};

describe("directMessage over engine-authored messages", () => {
  it("renames the tutorial monster's final words", () => {
    const defeated = firebolt(fighting("EMBERMAW", { tutorial: true }));

    expect(defeated.status).toBe("MONSTER_DEFEATED");
    expect(directMessage(renamed, defeated.message)).toContain("Cinderfang");
    expect(directMessage(renamed, defeated.message)).not.toContain("Embermaw");
  });

  it("renames the first monster's final words", () => {
    const defeated = firebolt(fighting("EMBERMAW"));

    expect(defeated.status).toBe("MONSTER_DEFEATED");
    expect(directMessage(renamed, defeated.message)).toContain("Cinderfang");
    expect(directMessage(renamed, defeated.message)).not.toContain("Embermaw");
  });

  it("renames the Warden's final words", () => {
    const defeated = firebolt(fighting("SHARD_WARDEN"));

    expect(defeated.status).toBe("MONSTER_DEFEATED");
    expect(directMessage(renamed, defeated.message)).toContain("Rift Sentinel");
    expect(directMessage(renamed, defeated.message)).not.toContain("Shard Warden");
  });

  it("renames the Hexwyrm's final words", () => {
    const defeated = hexwyrmFinisher(fighting("HEXWYRM", { phase: "FUSION_FINISHER" }));

    expect(defeated.status).toBe("MONSTER_DEFEATED");
    expect(directMessage(renamed, defeated.message)).toContain("Vhar'Zul");
    expect(directMessage(renamed, defeated.message)).not.toContain("Hexwyrm");
  });

  it("renames the round-complete banner", () => {
    const complete = gameReducer(firebolt(fighting("SHARD_WARDEN")), { type: "SHOW_ROUND_COMPLETE" });

    expect(complete.status).toBe("ROUND_COMPLETE");
    expect(directMessage(renamed, complete.message)).toContain("Rift Sentinel");
    expect(directMessage(renamed, complete.message)).not.toContain("Shard Warden");
  });
});
