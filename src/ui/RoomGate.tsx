import { useState } from "react";
import type { ConnectionState } from "../multiplayer/RoomTransport";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateRoomCode(): string {
  let code = "";
  for (let index = 0; index < 4; index += 1) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

export function RoomGate({
  connection,
  errorMessage,
  onCreate,
  onJoin,
  onTestSpells,
}: {
  connection: ConnectionState;
  errorMessage?: string;
  onCreate: (code: string) => void;
  onJoin: (code: string) => void;
  onTestSpells: () => void;
}) {
  const [joinCode, setJoinCode] = useState("");

  if (connection.status === "WAITING_FOR_PEER" || connection.status === "CONNECTED") {
    return (
      <div className="absolute inset-0 z-[15] grid place-content-center bg-[radial-gradient(circle,#160f27aa,#08060fef_70%)] text-center">
        <p className="m-0 text-[0.7rem] tracking-[0.15em] text-[#b7a6d1] uppercase">Room code</p>
        <h2 className="font-display mt-2 mb-[10px] text-[clamp(2.4rem,7vw,5rem)]">{connection.code}</h2>
        <p className="m-0 text-sm text-[#ded4ef]">
          {connection.status === "WAITING_FOR_PEER"
            ? "Waiting for the other spellcaster to join…"
            : connection.isHost
              ? "Both casters connected. Press Start below to begin."
              : "Both casters connected. Waiting for the host to start."}
        </p>
      </div>
    );
  }

  if (connection.status === "PEER_LEFT") {
    return (
      <div className="absolute inset-0 z-[15] grid place-content-center bg-[radial-gradient(circle,#160f27aa,#08060fef_70%)] text-center">
        <p className="m-0 text-[0.7rem] tracking-[0.15em] text-[#ff9a9a] uppercase">Connection lost</p>
        <h2 className="font-display mt-2 mb-[22px] text-[clamp(2rem,6vw,3.5rem)]">The other caster left</h2>
        <button
          className="justify-self-center rounded-full border border-[#ff9a6a] bg-linear-to-br from-[#ffd376] to-[#ff7258] px-[22px] py-3 font-bold text-[#180b11] transition-transform hover:scale-105"
          type="button"
          onClick={() => onCreate(generateRoomCode())}
        >
          Create a new room
        </button>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-[15] grid place-content-center bg-[radial-gradient(circle,#160f27aa,#08060fef_70%)] text-center">
      <p className="m-0 text-[0.7rem] tracking-[0.15em] text-[#b7a6d1] uppercase">Two hands. One spell.</p>
      <h2 className="font-display mt-2 mb-[22px] text-[clamp(2.4rem,7vw,5rem)]">Enter the arena</h2>
      <div className="flex flex-col items-center gap-3">
        <button
          className="w-[220px] cursor-pointer rounded-full border border-[#ff9a6a] bg-linear-to-br from-[#ffd376] to-[#ff7258] px-[22px] py-3 font-bold text-[#180b11] transition-transform hover:scale-105 disabled:opacity-60"
          type="button"
          onClick={() => onCreate(generateRoomCode())}
          disabled={connection.status === "CONNECTING"}
        >
          Create room
        </button>
        <button
          className="w-[220px] cursor-pointer rounded-full border border-[#70efb0] bg-[#11271d] px-[22px] py-3 font-bold text-[#baf7d5] transition-transform hover:scale-105"
          type="button"
          onClick={onTestSpells}
        >
          Practice Spells
        </button>
        <div className="flex items-center gap-2">
          <input
            className="w-[120px] rounded-full border border-[#57466f] bg-[#171020] px-3 py-2 text-center tracking-[0.2em] text-[#e7ddf7] uppercase"
            placeholder="CODE"
            maxLength={4}
            value={joinCode}
            onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
          />
          <button
            className="cursor-pointer rounded-full border border-[#57466f] bg-[#171020] px-4 py-2 text-[#e7ddf7] disabled:opacity-60"
            type="button"
            onClick={() => onJoin(joinCode)}
            disabled={connection.status === "CONNECTING" || joinCode.length !== 4}
          >
            Join
          </button>
        </div>
        {connection.status === "CONNECTING" && <p className="m-0 text-xs text-[#9d90bd]">Connecting…</p>}
        {errorMessage && <p className="m-0 text-xs text-[#ff9a9a]">{errorMessage}</p>}
      </div>
    </div>
  );
}
