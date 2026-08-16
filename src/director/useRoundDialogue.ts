import { useCallback, useEffect, useRef, useState } from "react";
import { requestRoundDialogue } from "./DialogueClient";
import type { DialogueMonster } from "./providers";
import type { GameStatus, RoundId } from "../game/types";

export type RoundDialogueLines = Partial<Record<RoundId, string[]>>;

export function useRoundDialogue(
  isHost: boolean,
  status: GameStatus,
  tutorial: boolean,
  round: RoundId,
  monster: DialogueMonster,
) {
  const [linesByRound, setLinesByRound] = useState<RoundDialogueLines>({});
  const requestedRounds = useRef<Set<RoundId>>(new Set());

  useEffect(() => {
    if (!isHost || tutorial || status !== "DIALOGUE") return;
    if (requestedRounds.current.has(round)) return;
    requestedRounds.current.add(round);

    let active = true;
    requestRoundDialogue(round, monster).then((result) => {
      if (!active || result.source !== "ai" || !result.lines) return;
      setLinesByRound((prev) => ({ ...prev, [round]: result.lines! }));
    });

    return () => {
      active = false;
    };
  }, [isHost, tutorial, status, round, monster]);

  const applyRemoteDialogue = useCallback((remoteRound: RoundId, lines: unknown) => {
    if (!Array.isArray(lines) || lines.length !== 3 || lines.some((line) => typeof line !== "string")) return false;
    setLinesByRound((prev) => ({ ...prev, [remoteRound]: lines as string[] }));
    return true;
  }, []);

  return { linesByRound, applyRemoteDialogue };
}
