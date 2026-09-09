import { useEffect, useRef } from "react";
import type { CombatEffectKind, GameStatus } from "../game/types";
import { acquireFromPool } from "./audioPool";

const soundForEffect: Partial<Record<CombatEffectKind, string>> = {
  FIREBOLT: "/audio/fireball.mp3",
  SHIELD: "/audio/shield.mp3",
  PLAYER_HIT: "/audio/damage.mp3",
  ENEMY_EMERGE: "/audio/nextlevel.mp3",
};

// Pooled per src so rapid overlapping hits don't each allocate a new HTMLAudioElement.
const effectPools = new Map<string, HTMLAudioElement[]>();

function reportPlaybackError(source: string, error: unknown) {
  console.warn("[audio] Playback failed", {
    source,
    name: error instanceof Error ? error.name : "UnknownError",
    message: error instanceof Error ? error.message : String(error),
  });
}

function playFile(src: string, volume = 0.7) {
  let pool = effectPools.get(src);
  if (!pool) {
    pool = [];
    effectPools.set(src, pool);
  }
  const audio = acquireFromPool(pool, () => new Audio(src));
  audio.currentTime = 0;
  audio.volume = volume;
  void audio.play().catch((error: unknown) => reportPlaybackError(src, error));
}

// Shared for the session: browsers cap open AudioContexts, so one per blip eventually kills sound.
let sharedContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  const AudioContextClass = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!sharedContext) sharedContext = new AudioContextClass();
  if (sharedContext.state === "suspended") {
    void sharedContext.resume().catch((error: unknown) => reportPlaybackError("synthesizer", error));
  }
  return sharedContext;
}

function synthesize(kind: CombatEffectKind | "CLICK") {
  const context = getAudioContext();
  if (!context) return;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const duration = kind === "STARFALL" ? 1.8 : kind === "ARMOR_BREAK" ? 0.65 : kind === "BARRIER" ? 0.9 : 0.06;
  oscillator.type = kind === "STARFALL" ? "sawtooth" : kind === "ARMOR_BREAK" ? "square" : "sine";
  oscillator.frequency.setValueAtTime(kind === "STARFALL" ? 90 : kind === "ARMOR_BREAK" ? 180 : kind === "BARRIER" ? 320 : 520, context.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(kind === "STARFALL" ? 38 : kind === "CLICK" ? 700 : 90, context.currentTime + duration);
  gain.gain.setValueAtTime(kind === "CLICK" ? 0.025 : 0.11, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + duration);
  // Disconnect rather than close: the context is shared.
  oscillator.addEventListener("ended", () => {
    oscillator.disconnect();
    gain.disconnect();
  });
}

export function preloadAudioAssets(urls: readonly string[], onLoaded: (url: string) => void, onError: (error: Error) => void) {
  return urls.map((url) => {
    const audio = new Audio();
    const cleanup = () => {
      audio.removeEventListener("canplaythrough", loaded);
      audio.removeEventListener("error", failed);
    };
    const loaded = () => { cleanup(); onLoaded(url); };
    const failed = () => { cleanup(); onError(new Error(`Could not load ${url}`)); };
    audio.preload = "auto";
    audio.addEventListener("canplaythrough", loaded, { once: true });
    audio.addEventListener("error", failed, { once: true });
    audio.src = url;
    audio.load();
    return cleanup;
  });
}

export function useGameAudio(effectId: number | undefined, effectKind: CombatEffectKind | undefined, status: GameStatus) {
  const previousStatus = useRef(status);

  useEffect(() => {
    const audio = new Audio("/audio/gamesong.mp3");
    audio.loop = true;
    audio.volume = 0.24;
    audio.preload = "auto";
    audio.load();
    let disposed = false;
    const startMusic = () => {
      if (!audio.paused) return;
      void audio.play().catch((error: unknown) => {
        // Autoplay may need a user gesture; the input listeners retry below.
        if (disposed || (error instanceof Error && error.name === "NotAllowedError")) return;
        reportPlaybackError("/audio/gamesong.mp3", error);
      });
    };

    const click = (event: PointerEvent) => {
      if ((event.target as Element | null)?.closest("button")) synthesize("CLICK");
      startMusic();
    };
    startMusic();
    window.addEventListener("pointerdown", click);
    // Touch activation is granted on release; keyboard users may never point.
    window.addEventListener("pointerup", startMusic, true);
    window.addEventListener("click", startMusic, true);
    window.addEventListener("keydown", startMusic, true);
    return () => {
      disposed = true;
      window.removeEventListener("pointerdown", click);
      window.removeEventListener("pointerup", startMusic, true);
      window.removeEventListener("click", startMusic, true);
      window.removeEventListener("keydown", startMusic, true);
      audio.pause();
    };
  }, []);

  useEffect(() => {
    if (!effectId || !effectKind) return;
    const file = soundForEffect[effectKind];
    if (file) playFile(file);
    else synthesize(effectKind);
  }, [effectId, effectKind]);

  useEffect(() => {
    if (previousStatus.current !== status) {
      if (status === "ROUND_COMPLETE") playFile("/audio/nextlevel.mp3", 0.65);
      if (status === "DEFEAT") playFile("/audio/gameover.mp3", 0.75);
      previousStatus.current = status;
    }
  }, [status]);
}
