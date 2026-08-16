import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { preloadAudioAssets, useGameAudio } from "./audio/useGameAudio";
import { directMessage, encounterForRound } from "./director/defaultConfig";
import { useRoundDialogue } from "./director/useRoundDialogue";
import { useRunConfiguration } from "./director/useRunConfiguration";
import { arenaAssetUrlsForRound, AUDIO_ASSET_URLS, STARTUP_ASSET_URLS } from "./game/assets";
import { encounterDialogue } from "./game/dialogue";
import { gameReducer, initialGameState } from "./game/engine";
import { rebaseSyncedState } from "./game/syncClock";
import { ATTACK_IMPACT_DELAY_MS, ROUND_ANIMATION_URLS } from "./game/monsters";
import { useRoundDisplay } from "./game/roundReveal";
import type { Gesture, PlayerId, RoundId } from "./game/types";
import { WebcamPreview } from "./hand/WebcamPreview";
import { CloudflareRoomTransport } from "./multiplayer/CloudflareRoomTransport";
import type { ConnectionState } from "./multiplayer/RoomTransport";
import { Arena } from "./render/Arena";
import { EncounterDialogue } from "./ui/EncounterDialogue";
import { MoveMenu } from "./ui/MoveMenu";
import { RemoteHandPreview } from "./ui/RemoteHandPreview";
import { RoomGate } from "./ui/RoomGate";
import { SpellPlayground } from "./ui/SpellPlayground";
import { RoundLoader } from "./ui/RoundLoader";
import { RoundComplete } from "./ui/RoundComplete";
import { StartupLoader } from "./ui/StartupLoader";

const keyGestures: Record<string, Gesture> = {
  "1": "FIST",
  "2": "OPEN_PALM",
  "3": "POINT",
  "4": "PINCH",
};

const lightweightTestMode = new URLSearchParams(window.location.search).has("lite");

export function App() {
  const [state, dispatch] = useReducer(gameReducer, undefined, initialGameState);
  const display = useRoundDisplay(state);
  const [transport] = useState(() => new CloudflareRoomTransport());
  const [connection, setConnection] = useState<ConnectionState>({ status: "IDLE" });
  const [connectError, setConnectError] = useState("");
  const [isSpellPlayground, setIsSpellPlayground] = useState(false);
  const [playgroundState, dispatchPlayground] = useReducer(gameReducer, undefined, () => gameReducer(initialGameState(), { type: "START" }));
  const [loadedAssets, setLoadedAssets] = useState<Set<string>>(() => new Set());
  const [assetError, setAssetError] = useState("");
  const [now, setNow] = useState(0);
  const [cameraReadyByPlayer, setCameraReadyByPlayer] = useState<Record<PlayerId, boolean>>({ PLAYER_A: false, PLAYER_B: false });
  const cameraReadyRef = useRef<Record<PlayerId, boolean>>({ PLAYER_A: false, PLAYER_B: false });
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
  const spellPlaygroundRef = useRef(false);
  const hasHostRole = (connection.status === "WAITING_FOR_PEER" || connection.status === "CONNECTED") && connection.isHost;
  const { configuration, status: directorStatus, applyRemoteConfiguration } = useRunConfiguration(hasHostRole);
  useGameAudio(state.effect?.id, state.effect?.kind, state.status);

  const encounter = encounterForRound(configuration, state.round);
  const displayEncounter = encounterForRound(configuration, display.round);
  const { linesByRound: dialogueLinesByRound, applyRemoteDialogue } = useRoundDialogue(
    hasHostRole,
    state.status,
    state.tutorial,
    state.round,
    encounter,
  );
  const enemyRoundAssets = ROUND_ANIMATION_URLS[state.round];
  const loadedEnemyAssetCount = enemyRoundAssets.filter((url) => loadedAssets.has(url)).length;
  const enemyAssetsReady = lightweightTestMode || (debugDelayElapsed && loadedEnemyAssetCount === enemyRoundAssets.length);
  // Attacks are host-authoritative, so it's not enough for the host's own assets to be ready:
  // a guest with a slower connection could still be staring at their own RoundLoader — which
  // covers the attack windup cue — unable to defend against a hit they can't even see coming.
  const bothPlayersReady = enemyAssetsReady && peerReadyRound === state.round;

  const applyCameraReady = useCallback((playerId: PlayerId, ready: boolean) => {
    if (cameraReadyRef.current[playerId] === ready) return;
    cameraReadyRef.current = { ...cameraReadyRef.current, [playerId]: ready };
    setCameraReadyByPlayer(cameraReadyRef.current);
  }, []);

  const resetCameraReadiness = useCallback(() => {
    cameraReadyRef.current = { PLAYER_A: false, PLAYER_B: false };
    setCameraReadyByPlayer(cameraReadyRef.current);
  }, []);

  const reportLocalCameraReady = useCallback((ready: boolean) => {
    const role = roleRef.current;
    if (!role || cameraReadyRef.current[role.myPlayerId] === ready) return;
    applyCameraReady(role.myPlayerId, ready);
    transport.publish({ type: "CAMERA_READY", playerId: role.myPlayerId, ready });
  }, [applyCameraReady, transport]);

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
        resetCameraReadiness();
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
      if (event.type === "CAMERA_READY") {
        applyCameraReady(event.playerId, event.ready);
        return;
      }
      if (event.type === "PEER_LEFT") {
        dispatch({ type: "RESET" });
        resetCameraReadiness();
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
      if (event.type === "SESSION_END") {
        dispatch({ type: "RESET" });
        resetCameraReadiness();
        roleRef.current = null;
        transport.disconnect();
        setConnectError("The arena session was ended by the other player.");
        setConnection({ status: "IDLE" });
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
      if (event.type === "GESTURE_END") {
        if (roleRef.current?.isHost) dispatch({ type: "GESTURE_END", playerId: event.playerId });
        return;
      }
      if (event.type === "PROGRESSION_CHOICE") {
        if (roleRef.current?.isHost && event.choice === "CONTINUE") dispatch({ type: "CONTINUE_READY", playerId: event.playerId });
        return;
      }
      if (event.type === "STATE_SYNC") {
        dispatch({ type: "SYNC", state: rebaseSyncedState(event.state, event.sentAt, performance.now()) });
        return;
      }
      if (event.type === "DIRECTOR_SYNC") {
        applyRemoteConfiguration(event.configuration, event.source);
        return;
      }
      if (event.type === "DIALOGUE_SYNC") {
        applyRemoteDialogue(event.round, event.lines);
      }
    });
    return unsubscribe;
  }, [transport, applyRemoteConfiguration, applyRemoteDialogue, applyCameraReady, resetCameraReadiness]);

  useEffect(() => () => transport.disconnect(), [transport]);

  useEffect(() => {
    if (connection.status === "CONNECTED" && connection.isHost) {
      transport.publish({ type: "STATE_SYNC", state, sentAt: performance.now() });
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
    const lines = dialogueLinesByRound[state.round];
    if (!lines || connection.status !== "CONNECTED" || !connection.isHost) return;
    transport.publish({ type: "DIALOGUE_SYNC", round: state.round, lines });
  }, [dialogueLinesByRound, state.round, connection, transport]);

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
    if ((state.status !== "PLAYING" && state.status !== "DIALOGUE") || !enemyAssetsReady || connection.status !== "CONNECTED" || !roleRef.current) return;
    if (lastReportedRoundRef.current === state.round) return;
    lastReportedRoundRef.current = state.round;
    transport.publish({ type: "ROUND_READY", playerId: roleRef.current.myPlayerId, round: state.round });
  }, [state.status, enemyAssetsReady, state.round, connection, transport]);

  useEffect(() => {
    if (state.status !== "MONSTER_DEFEATED" || connection.status !== "CONNECTED" || !connection.isHost) return;
    const timer = window.setTimeout(() => dispatch({ type: "SHOW_ROUND_COMPLETE" }), 4_200);
    return () => window.clearTimeout(timer);
  }, [state.status, connection]);

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
    if (state.status !== "PLAYING" && !isSpellPlayground) {
      setNow(0);
      return;
    }
    const update = () => setNow(performance.now());
    update();
    const interval = window.setInterval(update, 100);
    return () => window.clearInterval(interval);
  }, [state.status, isSpellPlayground]);

  spellPlaygroundRef.current = isSpellPlayground;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const gesture = keyGestures[event.key];
      if (!gesture || event.repeat) return;
      if (!spellPlaygroundRef.current) castGesture(gesture, performance.now());
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (!keyGestures[event.key]) return;
      if (!spellPlaygroundRef.current) clearGesture();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  const progress = display.enemyMaxHp === 0 ? 0 : (display.enemyHp / display.enemyMaxHp) * 100;
  const connected = connection.status === "CONNECTED";
  const hasRoom = connection.status === "CONNECTED" || connection.status === "WAITING_FOR_PEER";
  const message = directMessage(configuration, display.message);
  const directorLabel = directorStatus === "ai"
    ? "AI Director"
    : directorStatus === "static"
      ? "Standalone run"
      : directorStatus === "loading"
        ? "Directing…"
        : "Classic run";
  const arenaState = isSpellPlayground ? playgroundState : state;
  const arenaEncounter = encounterForRound(configuration, arenaState.round);
  const arenaAssets = arenaAssetUrlsForRound(arenaState.round);
  const loadedArenaAssetCount = arenaAssets.filter((url) => loadedAssets.has(url)).length;
  const arenaAssetsReady = lightweightTestMode || loadedArenaAssetCount === arenaAssets.length;
  const loadedStartupAssetCount = STARTUP_ASSET_URLS.filter((url) => loadedAssets.has(url)).length;
  const myPlayerId = hasRoom ? connection.myPlayerId : "PLAYER_A";
  const otherPlayerId: PlayerId = myPlayerId === "PLAYER_A" ? "PLAYER_B" : "PLAYER_A";
  const trackingActive = connected && (display.status === "LOBBY" || display.status === "DIALOGUE" || display.status === "PLAYING");
  const bothCamerasReady = cameraReadyByPlayer.PLAYER_A && cameraReadyByPlayer.PLAYER_B;
  const readyCameraCount = Number(cameraReadyByPlayer.PLAYER_A) + Number(cameraReadyByPlayer.PLAYER_B);
  const onAssetLoaded = useCallback((assetUrl: string) => {
    setLoadedAssets((current) => current.has(assetUrl) ? current : new Set(current).add(assetUrl));
  }, []);
  const onAssetError = useCallback((error: Error) => {
    setAssetError(error.message || "A 3D asset could not be loaded.");
  }, []);

  useEffect(() => {
    // Audio failures never gate or error the loading screens: sound is not
    // required for the arena to be playable, unlike the 3D models below.
    const cleanups = preloadAudioAssets(AUDIO_ASSET_URLS, onAssetLoaded, () => undefined);
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [onAssetLoaded]);
  const retryAssetLoading = useCallback(() => window.location.reload(), []);

  useEffect(() => setAssetError(""), [arenaState.round]);

  const exitSession = () => {
    const role = roleRef.current;
    if (role && connected) transport.publish({ type: "SESSION_END", playerId: role.myPlayerId });
    window.setTimeout(() => {
      transport.disconnect();
      roleRef.current = null;
      dispatch({ type: "RESET" });
      resetCameraReadiness();
      setConnectError("");
      setConnection({ status: "IDLE" });
    }, connected ? 120 : 0);
  };

  const openSpellPlayground = () => {
    dispatchPlayground({ type: "RESET" });
    dispatchPlayground({ type: "START" });
    setIsSpellPlayground(true);
  };

  const closeSpellPlayground = () => {
    setIsSpellPlayground(false);
    dispatchPlayground({ type: "RESET" });
  };

  const chooseContinue = () => {
    const role = roleRef.current;
    if (!role) return;
    if (role.isHost) dispatch({ type: "CONTINUE_READY", playerId: role.myPlayerId });
    else transport.publish({ type: "PROGRESSION_CHOICE", playerId: role.myPlayerId, choice: "CONTINUE" });
  };

  const clearGesture = () => {
    const role = roleRef.current;
    if (!role) return;
    dispatch({ type: "GESTURE_END", playerId: role.myPlayerId });
    if (!role.isHost) transport.publish({ type: "GESTURE_END", playerId: role.myPlayerId });
  };

  return (
    <main className="relative h-dvh w-screen overflow-hidden bg-[#08060f]">
      <section className="absolute inset-0 overflow-hidden">
        {lightweightTestMode
          ? <div className="arena-lite-bg" aria-hidden="true" />
          : <Arena state={arenaState} playerId={myPlayerId} enemyColor={arenaEncounter.color} now={now} onAssetLoaded={onAssetLoaded} onAssetError={onAssetError} />}

        {!lightweightTestMode && <StartupLoader loadedAssets={loadedStartupAssetCount} totalAssets={STARTUP_ASSET_URLS.length} errorMessage={assetError} onRetry={retryAssetLoading} />}

        <header className="game-header">
          <h1>Spell<span>Brawl</span></h1>
          <div className="room-chip">
            <span className="mr-2 inline-block size-[7px] rounded-full bg-[#70efb0] shadow-[0_0_10px_#70efb0]" />{" "}
            {connection.status === "CONNECTED" || connection.status === "WAITING_FOR_PEER"
              ? `Room: ${connection.code} · ${connection.isHost ? "Host" : "Guest"}`
              : "Room: —"}
            <span>{directorLabel}</span>
          </div>
          {hasRoom && <button className="exit-session" type="button" onClick={exitSession}>Exit lobby</button>}
        </header>

        {!lightweightTestMode && isSpellPlayground && (!arenaAssetsReady || assetError) && (
          <RoundLoader label={`Summoning ${arenaEncounter.name}…`} loadedAssets={loadedArenaAssetCount} totalAssets={arenaAssets.length} errorMessage={assetError} onRetry={retryAssetLoading} />
        )}

        {isSpellPlayground ? (
          <SpellPlayground state={playgroundState} now={now} dispatch={dispatchPlayground} onExit={closeSpellPlayground} testMode={import.meta.env.DEV && lightweightTestMode} />
        ) : !connected ? (
          <RoomGate connection={connection} errorMessage={connectError} onCreate={connectTransport} onJoin={connectTransport} onTestSpells={openSpellPlayground} />
        ) : (
          <>
            <div className="enemy-hud">
              <small className="tracking-[0.15em] text-[#b8a8d2] uppercase">{displayEncounter.title}</small>
              <h2 className="font-display my-1 text-[clamp(1.4rem,3vw,2.2rem)]">{displayEncounter.name}</h2>
              <div className="h-[7px] rounded-[9px] border border-[#6c567e] bg-[#110d19] p-px">
                <span className="block h-full rounded-[7px] bg-linear-to-r from-[#ff554a] to-[#ffb14a] transition-[width] duration-300" style={{ width: `${progress}%` }} />
              </div>
              <p className="m-[5px] text-[0.7rem] text-[#ac9dbf] uppercase">{display.enemyHp} / {display.enemyMaxHp} HP · {display.phase.replaceAll("_", " ")}</p>
              {state.phase === "FUSION_FINISHER" && (
                <p className="mx-auto mt-2 max-w-[36rem] rounded-lg border border-[#4d3b65] bg-[#0c0915dd] px-3 py-2 text-xs text-[#e5d5fa]">
                  <strong className="text-[#ffcb76]">{configuration.finisher.name}:</strong> {configuration.finisher.clue}
                </p>
              )}
            </div>

            <div className="team-status">
              <div>{state.tutorial ? "Practice round" : `Round ${display.roundNumber} / 3`}</div>
              <div className="shared-hp"><span><b>Shared HP</b><em>{state.sharedHp} / 5</em></span><div><i style={{ width: `${state.sharedHp * 20}%` }} /></div></div>
            </div>

            <div className="combat-message">{message}</div>

            <MoveMenu state={state} playerId={myPlayerId} now={now} />

            <div className={`player-cameras ${state.status === "LOBBY" ? "is-lobby" : ""}`}>
              <WebcamPreview
                playerLabel={myPlayerId === "PLAYER_A" ? "Player 1" : "Player 2"}
                active={trackingActive}
                castingEnabled={display.status === "PLAYING" || display.status === "DIALOGUE"}
                testMode={import.meta.env.DEV && lightweightTestMode}
                onGesture={(gesture) => castGesture(gesture, performance.now())}
                onGestureEnd={clearGesture}
                onReadyChange={reportLocalCameraReady}
              />
              <RemoteHandPreview playerLabel={otherPlayerId === "PLAYER_A" ? "Player 1" : "Player 2"} active={trackingActive} ready={cameraReadyByPlayer[otherPlayerId]} gesture={state.players[otherPlayerId].lastGesture} />
            </div>

            {state.sharedHp <= 2 && state.status === "PLAYING" && <div className="low-health-vignette" aria-hidden="true" />}
            {state.effect?.kind === "PLAYER_HIT" && <div key={state.effect.id} className="damage-flash" aria-hidden="true" />}

            {state.status === "PLAYING" && (!enemyAssetsReady || assetError) && <RoundLoader label={`Summoning ${encounter.name}…`} loadedAssets={loadedEnemyAssetCount} totalAssets={enemyRoundAssets.length} errorMessage={assetError} onRetry={retryAssetLoading} />}
            {state.status === "PLAYING" && enemyAssetsReady && !assetError && !bothPlayersReady && <RoundLoader label="Waiting for the other spellcaster…" />}

            {state.status === "DIALOGUE" && (!enemyAssetsReady || assetError) && <RoundLoader label={`Summoning ${encounter.name}…`} loadedAssets={loadedEnemyAssetCount} totalAssets={enemyRoundAssets.length} errorMessage={assetError} onRetry={retryAssetLoading} />}
            {state.status === "DIALOGUE" && enemyAssetsReady && !assetError && !bothPlayersReady && <RoundLoader label="Waiting for the other spellcaster…" />}
            {state.status === "DIALOGUE" && bothPlayersReady && <EncounterDialogue lines={encounterDialogue(state, configuration, dialogueLinesByRound[state.round])} step={state.dialogueStep} />}
            {state.status === "MONSTER_DEFEATED" && <div className="final-words"><small>Final words</small><p>{state.message}</p></div>}
            {state.status === "ROUND_COMPLETE" && <RoundComplete state={state} playerId={myPlayerId} monsterName={encounter.name} onContinue={chooseContinue} onExit={exitSession} />}

            {(display.status === "LOBBY" || display.status === "VICTORY" || display.status === "DEFEAT") && (
              <div className="absolute inset-0 z-[15] grid place-content-center bg-[radial-gradient(circle,#160f27aa,#08060fef_70%)] text-center">
                <p className="m-0 text-[0.7rem] tracking-[0.15em] text-[#b7a6d1] uppercase">{display.status === "VICTORY" ? "The rift is sealed" : display.status === "DEFEAT" ? "The link has broken" : "Two hands. One spell."}</p>
                <h2 className="font-display mt-2 mb-[22px] text-[clamp(2.4rem,7vw,5rem)]">{display.status === "VICTORY" ? "Victory" : display.status === "DEFEAT" ? "Defeat" : "Enter the arena"}</h2>
                {state.status === "LOBBY" && <p className="mb-4 text-xs tracking-[0.12em] text-[#b7a6d1] uppercase" aria-live="polite">Cameras ready · {readyCameraCount} / 2</p>}
                {connection.isHost ? (
                  <button className="justify-self-center rounded-full border border-[#ff9a6a] bg-linear-to-br from-[#ffd376] to-[#ff7258] px-[22px] py-3 font-bold text-[#180b11] transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-45" type="button" disabled={state.status === "LOBBY" && !bothCamerasReady} onClick={() => { if (state.status !== "LOBBY" || bothCamerasReady) dispatch({ type: state.status === "LOBBY" ? "START" : "RESET" }); }}>
                    {state.status === "LOBBY" ? bothCamerasReady ? "Start" : "Waiting for cameras" : "Return to lobby"}
                  </button>
                ) : (
                  <p className="m-0 text-[0.7rem] tracking-[0.15em] text-[#b7a6d1] uppercase">{state.status === "LOBBY" && !bothCamerasReady ? "Grant camera access on both screens…" : "Waiting for the host…"}</p>
                )}
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
