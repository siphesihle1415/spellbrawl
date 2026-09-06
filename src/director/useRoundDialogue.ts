import { useCallback, useEffect, useRef, useState } from "react";
import { requestRoundDialogue, type DialogueResult } from "./DialogueClient";
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
  const requests = useRef(new Map<RoundId, Promise<DialogueResult>>());
  const { name, title, theme } = monster;

  useEffect(() => {
    if (!isHost || tutorial || status !== "DIALOGUE") return;
    // Reattach to the same request after effect cleanup (including StrictMode).
    // The encounter object is recreated on every App render; depend on its fields.
    let pending = requests.current.get(round);
    if (!pending) {
      pending = requestRoundDialogue(round, { name, title, theme });
      requests.current.set(round, pending);
    }

    let active = true;
    pending.then((result) => {
      if (!active || result.source !== "ai" || !result.lines) return;
      setLinesByRound((prev) => ({ ...prev, [round]: result.lines! }));
    });

    return () => {
      active = false;
    };
  }, [isHost, tutorial, status, round, name, title, theme]);

  const applyRemoteDialogue = useCallback((remoteRound: RoundId, lines: unknown) => {
    if (!Array.isArray(lines) || lines.length !== 3 || lines.some((line) => typeof line !== "string")) return false;
    setLinesByRound((prev) => ({ ...prev, [remoteRound]: lines as string[] }));
    return true;
  }, []);

  return { linesByRound, applyRemoteDialogue };
}
