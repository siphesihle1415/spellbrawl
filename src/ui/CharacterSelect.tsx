import { CHARACTER_ROSTER, bothPicked, takenBy } from "../game/characters";
import type { CharacterId, CharacterSelections } from "../game/characters";
import type { PlayerId } from "../game/types";

export function CharacterSelect({
  characters,
  myPlayerId,
  onSelect,
}: {
  characters: CharacterSelections;
  myPlayerId: PlayerId;
  onSelect: (characterId: CharacterId) => void;
}) {
  const myPick = characters[myPlayerId];

  return (
    <div className="absolute inset-0 z-[15] grid place-content-center bg-[radial-gradient(circle,#160f27aa,#08060fef_70%)] text-center">
      <p className="m-0 text-[0.7rem] tracking-[0.15em] text-[#b7a6d1] uppercase">Choose your caster</p>
      <h2 className="font-display mt-2 mb-[22px] text-[clamp(2rem,6vw,3.5rem)]">Pick a character</h2>
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-stretch">
        {Object.values(CHARACTER_ROSTER).map((character) => {
          const owner = takenBy(characters, character.id);
          const isMine = owner === myPlayerId;
          const isTakenByOther = owner !== undefined && !isMine;

          return (
            <button
              key={character.id}
              type="button"
              disabled={isTakenByOther}
              onClick={() => onSelect(character.id)}
              className={`w-[220px] cursor-pointer rounded-2xl border px-5 py-4 transition-transform disabled:cursor-not-allowed disabled:opacity-50 ${
                isMine
                  ? "border-[#ff9a6a] bg-linear-to-br from-[#ffd376] to-[#ff7258] text-[#180b11]"
                  : "border-[#57466f] bg-[#171020] text-[#e7ddf7] hover:scale-105"
              }`}
            >
              <span className="block font-bold">{character.name}</span>
              {isTakenByOther && (
                <span className="mt-1 block text-[0.65rem] uppercase tracking-[0.1em]">
                  Taken by {owner === "PLAYER_A" ? "Player A" : "Player B"}
                </span>
              )}
              {isMine && <span className="mt-1 block text-[0.65rem] uppercase tracking-[0.1em]">Your pick</span>}
            </button>
          );
        })}
      </div>
      {myPick === undefined && <p className="m-0 mt-3 text-xs text-[#9d90bd]">Tap a character to lock it in.</p>}
      {myPick !== undefined && !bothPicked(characters) && (
        <p className="m-0 mt-3 text-xs text-[#9d90bd]">Waiting for the other caster to choose…</p>
      )}
    </div>
  );
}
