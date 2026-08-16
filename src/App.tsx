import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { directMessage, encounterForRound } from "./director/defaultConfig";
import { useRunConfiguration } from "./director/useRunConfiguration";
import { gameReducer, initialGameState } from "./game/engine";
import type { Gesture, PlayerId, RoundId } from "./game/types";
import { WebcamPreview } from "./hand/WebcamPreview";
import { CloudflareRoomTransport } from "./multiplayer/CloudflareRoomTransport";
import type { ConnectionState } from "./multiplayer/RoomTransport";
import { Arena, criticalAssetCount } from "./render/Arena";
import { MoveMenu } from "./ui/MoveMenu";
import { RemoteHandPreview } from "./ui/RemoteHandPreview";
import { RoomGate } from "./ui/RoomGate";
import { StartupLoader } from "./ui/StartupLoader";

const keyGestures: Record<string, Gesture> = {
  "1": "FIST",
  "2": "OPEN_PALM",
  "3": "POINT",
  "4": "PINCH",
};

const previewRooms: { round: RoundId; label: string }[] = [
  { round: "EMBERMAW", label: "Center" },
  { round: "SHARD_WARDEN", label: "Right" },
  { round: "HEXWYRM", label: "Left" },
];

const lightweightTestMode = new URLSearchParams(window.location.search).has("lite");

export function App() {
  const [state, dispatch] = useReducer(gameReducer, undefined, initialGameState);
  const [transport] = useState(() => new CloudflareRoomTransport());
  const [connection, setConnection] = useState<ConnectionState>({ status: "IDLE" });
  const [connectError, setConnectError] = useState("");
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewRound, setPreviewRound] = useState<RoundId>("EMBERMAW");
  const [previewResetKey, setPreviewResetKey] = useState(0);
  const [loadedAssets, setLoadedAssets] = useState<Set<string>>(() => new Set());
  const [now, setNow] = useState(0);
  const roleRef = useRef<{ myPlayerId: PlayerId; isHost: boolean } | null>(null);
  const hasHostRole = (connection.status === "WAITING_FOR_PEER" || connection.status === "CONNECTED") && connection.isHost;
  const { configuration, status: directorStatus, applyRemoteConfiguration } = useRunConfiguration(hasHostRole);

  const encounter = encounterForRound(configuration, state.round);

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
        dispatch({ type: "RESET" });
        setConnection((current) =>
          current.status === "WAITING_FOR_PEER" || current.status === "CONNECTED"
            ? { status: "PEER_LEFT", code: current.code, myPlayerId: current.myPlayerId, isHost: current.isHost }
            : current,
        );
        return;
      }
      if (event.type === "SESSION_END") {
        dispatch({ type: "RESET" });
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
    if (state.status !== "PLAYING" || connection.status !== "CONNECTED" || !connection.isHost) return;
    const interval = window.setInterval(() => {
      dispatch({ type: "ENEMY_ATTACK", at: performance.now() });
    }, 7_000);
    return () => window.clearInterval(interval);
  }, [state.status, state.round, connection]);

  useEffect(() => {
    if (state.status !== "PLAYING") {
      setNow(0);
      return;
    }
    const update = () => setNow(performance.now());
    update();
    const interval = window.setInterval(update, 100);
    return () => window.clearInterval(interval);
  }, [state.status]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const gesture = keyGestures[event.key];
      if (!gesture || event.repeat) return;
      castGesture(gesture, performance.now());
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (keyGestures[event.key]) clearGesture();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  const progress = state.enemyMaxHp === 0 ? 0 : (state.enemyHp / state.enemyMaxHp) * 100;
  const connected = connection.status === "CONNECTED";
  const hasRoom = connection.status === "CONNECTED" || connection.status === "WAITING_FOR_PEER";
  const message = directMessage(configuration, state.message);
  const directorLabel = directorStatus === "ai"
    ? "AI Director"
    : directorStatus === "static"
      ? "Standalone run"
      : directorStatus === "loading"
        ? "Directing…"
        : "Classic run";
  const arenaState = isPreviewing ? { ...state, round: previewRound } : state;
  const myPlayerId = hasRoom ? connection.myPlayerId : "PLAYER_A";
  const otherPlayerId: PlayerId = myPlayerId === "PLAYER_A" ? "PLAYER_B" : "PLAYER_A";
  const trackingActive = connected && state.status === "PLAYING";
  const onAssetLoaded = useCallback((assetUrl: string) => {
    setLoadedAssets((current) => current.has(assetUrl) ? current : new Set(current).add(assetUrl));
  }, []);

  const exitSession = () => {
    const role = roleRef.current;
    if (role && connected) transport.publish({ type: "SESSION_END", playerId: role.myPlayerId });
    window.setTimeout(() => {
      transport.disconnect();
      roleRef.current = null;
      dispatch({ type: "RESET" });
      setConnectError("");
      setConnection({ status: "IDLE" });
    }, connected ? 120 : 0);
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
          : <Arena state={arenaState} playerId={myPlayerId} enemyColor={encounter.color} now={now} preview={isPreviewing} resetKey={previewResetKey} onAssetLoaded={onAssetLoaded} />}

        {!lightweightTestMode && <StartupLoader loadedAssets={loadedAssets.size} totalAssets={criticalAssetCount} />}

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
            <div className="enemy-hud">
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

            <div className="team-status">
              <div>Round {state.roundNumber} / 3</div>
              <div className="shared-hp"><span><b>Shared HP</b><em>{state.sharedHp} / 5</em></span><div><i style={{ width: `${state.sharedHp * 20}%` }} /></div></div>
            </div>

            <div className="combat-message">{message}</div>

            <MoveMenu state={state} playerId={myPlayerId} now={now} />

            <div className="player-cameras">
              <WebcamPreview playerLabel={myPlayerId === "PLAYER_A" ? "Player 1" : "Player 2"} active={trackingActive} onGesture={(gesture) => castGesture(gesture, performance.now())} onGestureEnd={clearGesture} />
              <RemoteHandPreview playerLabel={otherPlayerId === "PLAYER_A" ? "Player 1" : "Player 2"} active={trackingActive} gesture={state.players[otherPlayerId].lastGesture} />
            </div>

            {state.sharedHp <= 2 && state.status === "PLAYING" && <div className="low-health-vignette" aria-hidden="true" />}
            {state.effect?.kind === "PLAYER_HIT" && <div key={state.effect.id} className="damage-flash" aria-hidden="true" />}

            {state.status !== "PLAYING" && (
              <div className="absolute inset-0 z-[15] grid place-content-center bg-[radial-gradient(circle,#160f27aa,#08060fef_70%)] text-center">
                <p className="m-0 text-[0.7rem] tracking-[0.15em] text-[#b7a6d1] uppercase">{state.status === "VICTORY" ? "The rift is sealed" : state.status === "DEFEAT" ? "The link has broken" : "Two hands. One spell."}</p>
                <h2 className="font-display mt-2 mb-[22px] text-[clamp(2.4rem,7vw,5rem)]">{state.status === "VICTORY" ? "Victory" : state.status === "DEFEAT" ? "Defeat" : "Enter the arena"}</h2>
                {connection.isHost ? (
                  <button className="justify-self-center rounded-full border border-[#ff9a6a] bg-linear-to-br from-[#ffd376] to-[#ff7258] px-[22px] py-3 font-bold text-[#180b11] transition-transform hover:scale-105" type="button" onClick={() => dispatch({ type: state.status === "LOBBY" ? "START" : "RESET" })}>
                    {state.status === "LOBBY" ? "Start" : "Return to lobby"}
                  </button>
                ) : (
                  <p className="m-0 text-[0.7rem] tracking-[0.15em] text-[#b7a6d1] uppercase">Waiting for the host…</p>
                )}
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
