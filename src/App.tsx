import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { directMessage, encounterForRound } from "./director/defaultConfig";
import { useRunConfiguration } from "./director/useRunConfiguration";
import { gameReducer, initialGameState } from "./game/engine";
import { ATTACK_IMPACT_DELAY_MS, ROUND_ANIMATION_URLS } from "./game/monsters";
import type { Gesture, PlayerId, RoundId } from "./game/types";
import { WebcamPreview } from "./hand/WebcamPreview";
import { CloudflareRoomTransport } from "./multiplayer/CloudflareRoomTransport";
import type { ConnectionState } from "./multiplayer/RoomTransport";
import { Arena, criticalAssetCount } from "./render/Arena";
import { GestureControls } from "./ui/GestureControls";
import { RoomGate } from "./ui/RoomGate";
import { RoundLoader } from "./ui/RoundLoader";
import { StartupLoader } from "./ui/StartupLoader";

const keyGestures: Record<string, Gesture> = {
  "1": "FIST",
  "2": "OPEN_PALM",
  "3": "POINT",
  "4": "PINCH",
  "5": "HANDS_APART",
};

const previewRooms: { round: RoundId; label: string }[] = [
  { round: "EMBERMAW", label: "Center" },
  { round: "SHARD_WARDEN", label: "Right" },
  { round: "HEXWYRM", label: "Left" },
];

export function App() {
  const [state, dispatch] = useReducer(gameReducer, undefined, initialGameState);
  const [transport] = useState(() => new CloudflareRoomTransport());
  const [connection, setConnection] = useState<ConnectionState>({ status: "IDLE" });
  const [connectError, setConnectError] = useState("");
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewRound, setPreviewRound] = useState<RoundId>("EMBERMAW");
  const [previewResetKey, setPreviewResetKey] = useState(0);
  const [loadedAssets, setLoadedAssets] = useState<Set<string>>(() => new Set());
  const [loadedRoundAssets, setLoadedRoundAssets] = useState<Set<string>>(() => new Set());
  // Manual QA hook: append ?simulateLoad=6000 to hold the round loader open for that many ms
  // after every round change, regardless of real asset load speed. Real GLTF loads are fast
  // enough on localhost/warm cache that the loader rarely has a chance to appear otherwise.
  const [debugSimulateLoadMs] = useState(() => {
    const parsed = Number(new URLSearchParams(window.location.search).get("simulateLoad"));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  });
  const [debugDelayElapsed, setDebugDelayElapsed] = useState(debugSimulateLoadMs === 0);
  const [peerReadyRound, setPeerReadyRound] = useState<RoundId | null>(null);
  const lastReportedRoundRef = useRef<RoundId | null>(null);
  const roleRef = useRef<{ myPlayerId: PlayerId; isHost: boolean } | null>(null);
  const hasHostRole = (connection.status === "WAITING_FOR_PEER" || connection.status === "CONNECTED") && connection.isHost;
  const { configuration, status: directorStatus, applyRemoteConfiguration } = useRunConfiguration(hasHostRole);

  const encounter = encounterForRound(configuration, state.round);
  const enemyAssetsReady = debugDelayElapsed && ROUND_ANIMATION_URLS[state.round].every((url) => loadedRoundAssets.has(url));
  // Attacks are host-authoritative, so it's not enough for the host's own assets to be ready:
  // a guest with a slower connection could still be staring at their own RoundLoader — which
  // covers the attack windup cue — unable to defend against a hit they can't even see coming.
  const bothPlayersReady = enemyAssetsReady && peerReadyRound === state.round;

  const castGesture = (gesture: Gesture, at: number) => {
    const role = roleRef.current;
    if (!role) return;
    if (role.isHost) {
      dispatch({ type: "GESTURE", playerId: role.myPlayerId, gesture, at });
    } else {
      transport.publish({ type: "GESTURE", playerId: role.myPlayerId, gesture, at });
    }
  };

  const connectTransport = async (code: string) => {
    setConnectError("");
    setConnection({ status: "CONNECTING", code });
    try {
      await transport.connect(code);
    } catch (error) {
      setConnectError(
        error instanceof Error && error.message.includes("Timed out")
          ? "Room server unavailable. For local testing, start the app with npm run dev."
          : "Could not reach the room. Check the code and try again.",
      );
      setConnection({ status: "IDLE" });
    }
  };

  useEffect(() => {
    const unsubscribe = transport.subscribe((event) => {
      if (event.type === "ROLE_ASSIGNED") {
        roleRef.current = { myPlayerId: event.playerId, isHost: event.isHost };
        setConnection((current) =>
          current.status === "CONNECTING"
            ? { status: "WAITING_FOR_PEER", code: current.code, myPlayerId: event.playerId, isHost: event.isHost }
            : current,
        );
        transport.publish({ type: "PLAYER_READY", playerId: event.playerId });
        return;
      }
      if (event.type === "PLAYER_READY") {
        setConnection((current) =>
          current.status === "WAITING_FOR_PEER"
            ? { status: "CONNECTED", code: current.code, myPlayerId: current.myPlayerId, isHost: current.isHost }
            : current,
        );
        return;
      }
      if (event.type === "PEER_LEFT") {
        setConnection((current) =>
          current.status === "WAITING_FOR_PEER" || current.status === "CONNECTED"
            ? { status: "PEER_LEFT", code: current.code, myPlayerId: current.myPlayerId, isHost: current.isHost }
            : current,
        );
        setPeerReadyRound(null);
        return;
      }
      if (event.type === "ROUND_READY") {
        setPeerReadyRound(event.round);
        return;
      }
      if (event.type === "GESTURE") {
        if (roleRef.current?.isHost) {
          // The guest's `at` is on its own performance.now() clock, which is unrelated to
          // the host's. The host is authoritative and applies every gesture, so re-stamp
          // with the host clock at receipt time — otherwise cross-player combos, memory
          // windows, and shields compare timestamps from two unrelated clocks and misfire.
          dispatch({ type: "GESTURE", playerId: event.playerId, gesture: event.gesture, at: performance.now() });
        }
        return;
      }
      if (event.type === "STATE_SYNC") {
        dispatch({ type: "SYNC", state: event.state });
        return;
      }
      if (event.type === "DIRECTOR_SYNC") {
        applyRemoteConfiguration(event.configuration, event.source);
      }
    });
    return unsubscribe;
  }, [transport, applyRemoteConfiguration]);

  useEffect(() => () => transport.disconnect(), [transport]);

  useEffect(() => {
    if (connection.status === "CONNECTED" && connection.isHost) {
      transport.publish({ type: "STATE_SYNC", state });
    }
  }, [state, connection, transport]);

  useEffect(() => {
    if (
      connection.status === "CONNECTED"
      && connection.isHost
      && (directorStatus === "ai" || directorStatus === "static" || directorStatus === "fallback")
    ) {
      transport.publish({
        type: "DIRECTOR_SYNC",
        configuration,
        source: directorStatus,
      });
    }
  }, [configuration, connection, directorStatus, transport]);

  useEffect(() => {
    if (debugSimulateLoadMs === 0) return;
    setDebugDelayElapsed(false);
    const timer = window.setTimeout(() => setDebugDelayElapsed(true), debugSimulateLoadMs);
    return () => window.clearTimeout(timer);
  }, [state.status, state.round, debugSimulateLoadMs]);

  useEffect(() => {
    // Back in the LOBBY (fresh connect, or a replay after RESET) — any earlier ROUND_READY the
    // peer sent for EMBERMAW no longer reflects reality (their own readiness gate has since
    // reset too), so a stale match here would let this client skip the wait it should still do.
    if (state.status !== "LOBBY") return;
    setPeerReadyRound(null);
    lastReportedRoundRef.current = null;
  }, [state.status]);

  useEffect(() => {
    // EMBERMAW is also `state.round` while still in the LOBBY (before the match starts), so
    // without the PLAYING check a client can report ready before the round has actually begun.
    // The debug delay above correctly resets when PLAYING starts, but a premature report here
    // would already be latched by the peer and never gets un-published.
    if (state.status !== "PLAYING" || !enemyAssetsReady || connection.status !== "CONNECTED" || !roleRef.current) return;
    if (lastReportedRoundRef.current === state.round) return;
    lastReportedRoundRef.current = state.round;
    transport.publish({ type: "ROUND_READY", playerId: roleRef.current.myPlayerId, round: state.round });
  }, [state.status, enemyAssetsReady, state.round, connection, transport]);

  useEffect(() => {
    if (state.status !== "PLAYING" || !bothPlayersReady || connection.status !== "CONNECTED" || !connection.isHost) return;
    let impactTimeout: number | undefined;
    const interval = window.setInterval(() => {
      dispatch({ type: "ENEMY_ATTACK_WINDUP", at: performance.now() });
      impactTimeout = window.setTimeout(() => {
        dispatch({ type: "ENEMY_ATTACK", at: performance.now() });
      }, ATTACK_IMPACT_DELAY_MS[state.round]);
    }, 7_000);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(impactTimeout);
    };
  }, [state.status, state.round, bothPlayersReady, connection]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const gesture = keyGestures[event.key];
      if (!gesture || event.repeat) return;
      castGesture(gesture, performance.now());
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const progress = state.enemyMaxHp === 0 ? 0 : (state.enemyHp / state.enemyMaxHp) * 100;
  const connected = connection.status === "CONNECTED";
  const message = directMessage(configuration, state.message);
  const directorLabel = directorStatus === "ai"
    ? "AI Director"
    : directorStatus === "static"
      ? "Standalone run"
      : directorStatus === "loading"
        ? "Directing…"
        : "Classic run";
  const arenaState = isPreviewing ? { ...state, round: previewRound } : state;
  const onAssetLoaded = useCallback((assetUrl: string) => {
    setLoadedAssets((current) => current.has(assetUrl) ? current : new Set(current).add(assetUrl));
  }, []);
  const onRoundAssetLoaded = useCallback((assetUrl: string) => {
    setLoadedRoundAssets((current) => current.has(assetUrl) ? current : new Set(current).add(assetUrl));
  }, []);

  return (
    <main className="relative h-dvh w-screen overflow-hidden bg-[#08060f]">
      <section className="absolute inset-0 overflow-hidden">
        <Arena state={arenaState} enemyColor={encounter.color} preview={isPreviewing} resetKey={previewResetKey} onAssetLoaded={onAssetLoaded} onRoundAssetLoaded={onRoundAssetLoaded} />

        <StartupLoader loadedAssets={loadedAssets.size} totalAssets={criticalAssetCount} />

        <header className="absolute top-4 left-4 z-20 flex items-center gap-3 rounded-2xl border border-[#342849] bg-[#0c0915c9] px-4 py-3 backdrop-blur-md">
          <div>
            <p className="mb-0.5 text-[0.68rem] tracking-[0.17em] text-[#9d90bd] uppercase">Co-op gesture combat · proof of concept</p>
            <h1 className="font-display m-0 text-[clamp(1.7rem,4vw,2.8rem)] leading-none tracking-[-0.06em]">Spell<span className="text-[#ff7758]">Brawl</span></h1>
          </div>
          <div className="hidden rounded-full border border-[#3c3053] bg-[#141020cc] px-3.5 py-2.5 text-xs tracking-[0.08em] sm:block">
            <span className="mr-2 inline-block size-[7px] rounded-full bg-[#70efb0] shadow-[0_0_10px_#70efb0]" />{" "}
            {connection.status === "CONNECTED" || connection.status === "WAITING_FOR_PEER"
              ? `Room: ${connection.code} · ${connection.isHost ? "Host" : "Guest"}`
              : "Room: —"}
            <span className="ml-3 border-l border-[#3c3053] pl-3 text-[#b8a8d2]">{directorLabel}</span>
          </div>
        </header>

        {isPreviewing ? (
          <div className="absolute right-4 bottom-4 z-30 flex max-w-[calc(100%-2rem)] flex-wrap justify-end gap-2 rounded-2xl border border-[#493760] bg-[#0c0915df] p-3 text-xs backdrop-blur-md">
            {previewRooms.map(({ round, label }) => (
              <button
                key={round}
                type="button"
                className={`rounded-full border px-3 py-2 ${previewRound === round ? "border-[#ff9a6a] bg-[#ff7758] text-[#180b11]" : "border-[#57466f] bg-[#171020] text-[#e7ddf7]"}`}
                onClick={() => { setPreviewRound(round); setPreviewResetKey((key) => key + 1); }}
              >
                {label} room
              </button>
            ))}
            <button id="explore-scene" type="button" className="rounded-full border border-[#70efb0] bg-[#173225] px-3 py-2 text-[#baf7d5]">Explore · WASD + mouse</button>
            <button type="button" className="rounded-full border border-[#57466f] bg-[#171020] px-3 py-2 text-[#e7ddf7]" onClick={() => setIsPreviewing(false)}>Exit preview</button>
          </div>
        ) : !connected ? (
          <RoomGate connection={connection} errorMessage={connectError} onCreate={connectTransport} onJoin={connectTransport} onPreview={() => setIsPreviewing(true)} />
        ) : (
          <>
            <div className="absolute top-[104px] left-1/2 z-10 w-[min(380px,65%)] -translate-x-1/2 text-center min-[901px]:top-5">
              <small className="tracking-[0.15em] text-[#b8a8d2] uppercase">{encounter.title}</small>
              <h2 className="font-display my-1 text-[clamp(1.4rem,3vw,2.2rem)]">{encounter.name}</h2>
              <div className="h-[7px] rounded-[9px] border border-[#6c567e] bg-[#110d19] p-px">
                <span className="block h-full rounded-[7px] bg-linear-to-r from-[#ff554a] to-[#ffb14a] transition-[width] duration-300" style={{ width: `${progress}%` }} />
              </div>
              <p className="m-[5px] text-[0.7rem] text-[#ac9dbf] uppercase">{state.enemyHp} / {state.enemyMaxHp} HP · {state.phase.replaceAll("_", " ")}</p>
              {state.phase === "FUSION_FINISHER" && (
                <p className="mx-auto mt-2 max-w-[36rem] rounded-lg border border-[#4d3b65] bg-[#0c0915dd] px-3 py-2 text-xs text-[#e5d5fa]">
                  <strong className="text-[#ffcb76]">{configuration.finisher.name}:</strong> {configuration.finisher.clue}
                </p>
              )}
            </div>

            <div className="absolute top-[190px] left-4 z-10 flex flex-col items-start gap-2 min-[901px]:top-[124px]">
              <div className="rounded-full border border-[#392e4c] bg-[#0c0915cc] px-3 py-2.5 text-[0.7rem] tracking-[0.08em] uppercase backdrop-blur-sm">Round {state.roundNumber} / 3</div>
              <div className="rounded-full border border-[#392e4c] bg-[#0c0915cc] px-3 py-2.5 text-[0.7rem] tracking-[0.08em] text-[#e5b6ff] uppercase backdrop-blur-sm">✦ Shared link: {"◆".repeat(state.sharedHp)}{"◇".repeat(5 - state.sharedHp)}</div>
            </div>

            <div className="absolute bottom-[44dvh] left-1/2 z-10 w-[min(700px,calc(100%_-_32px))] -translate-x-1/2 rounded-xl border border-[#3b2d50] bg-[#0c0915df] px-5 py-3.5 text-center text-sm text-[#ded4ef] backdrop-blur-md min-[901px]:bottom-6">{message}</div>

            {state.status === "PLAYING" && !enemyAssetsReady && <RoundLoader label={`Summoning ${encounter.name}…`} />}
            {state.status === "PLAYING" && enemyAssetsReady && !bothPlayersReady && <RoundLoader label="Waiting for the other spellcaster…" />}

            {state.status !== "PLAYING" && (
              <div className="absolute inset-0 z-[15] grid place-content-center bg-[radial-gradient(circle,#160f27aa,#08060fef_70%)] text-center">
                <p className="m-0 text-[0.7rem] tracking-[0.15em] text-[#b7a6d1] uppercase">{state.status === "VICTORY" ? "The rift is sealed" : state.status === "DEFEAT" ? "The link has broken" : "Two hands. One spell."}</p>
                <h2 className="font-display mt-2 mb-[22px] text-[clamp(2.4rem,7vw,5rem)]">{state.status === "VICTORY" ? "Victory" : state.status === "DEFEAT" ? "Defeat" : "Enter the arena"}</h2>
                {connection.isHost ? (
                  <button className="justify-self-center rounded-full border border-[#ff9a6a] bg-linear-to-br from-[#ffd376] to-[#ff7258] px-[22px] py-3 font-bold text-[#180b11] transition-transform hover:scale-105" type="button" onClick={() => dispatch({ type: state.status === "LOBBY" ? "START" : "RESET" })}>
                    {state.status === "LOBBY" ? "Begin POC" : "Return to lobby"}
                  </button>
                ) : (
                  <p className="m-0 text-[0.7rem] tracking-[0.15em] text-[#b7a6d1] uppercase">Waiting for the host…</p>
                )}
              </div>
            )}

            <aside className="absolute right-3 bottom-3 left-3 z-20 grid max-h-[41dvh] grid-cols-2 gap-2 overflow-y-auto min-[901px]:top-4 min-[901px]:right-4 min-[901px]:bottom-auto min-[901px]:left-auto min-[901px]:flex min-[901px]:max-h-[calc(100dvh_-_32px)] min-[901px]:w-[340px] min-[901px]:flex-col min-[901px]:gap-3">
              <WebcamPreview onGesture={(gesture) => castGesture(gesture, performance.now())} />
              <GestureControls onGesture={(gesture) => castGesture(gesture, performance.now())} />
              {connection.isHost && (
                <button
                  className="col-span-2 cursor-pointer rounded-[10px] border border-dashed border-[#653c45] bg-[#0c0915bb] p-2.5 text-[0.68rem] text-[#b9979d] backdrop-blur-sm disabled:cursor-not-allowed disabled:opacity-40 min-[901px]:col-auto"
                  type="button"
                  disabled={!bothPlayersReady}
                  onClick={() => {
                    dispatch({ type: "ENEMY_ATTACK_WINDUP", at: performance.now() });
                    window.setTimeout(() => dispatch({ type: "ENEMY_ATTACK", at: performance.now() }), ATTACK_IMPACT_DELAY_MS[state.round]);
                  }}
                >
                  Simulate enemy attack
                </button>
              )}
            </aside>
          </>
        )}
      </section>
    </main>
  );
}
