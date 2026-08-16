import { useEffect, useRef } from "react";
import type { CombatEffectKind, GameStatus } from "../game/types";

const soundForEffect: Partial<Record<CombatEffectKind, string>> = {
  FIREBOLT: "/audio/fireball.mp3",
  SHIELD: "/audio/shield.mp3",
  PLAYER_HIT: "/audio/damage.mp3",
  ENEMY_EMERGE: "/audio/nextlevel.mp3",
};

function playFile(src: string, volume = 0.7) {
  const audio = new Audio(src);
  audio.volume = volume;
  void audio.play().catch(() => undefined);
}

function synthesize(kind: CombatEffectKind | "CLICK") {
  const AudioContextClass = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;
  const context = new AudioContextClass();
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
  oscillator.addEventListener("ended", () => void context.close());
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
  const music = useRef<HTMLAudioElement | null>(null);
  const previousStatus = useRef(status);

  useEffect(() => {
    const startMusic = () => {
      if (!music.current) {
        music.current = new Audio("/audio/gamesong.mp3");
        music.current.loop = true;
        music.current.volume = 0.24;
      }
      void music.current.play().catch(() => undefined);
    };
    const click = (event: PointerEvent) => {
      if ((event.target as Element | null)?.closest("button")) synthesize("CLICK");
      startMusic();
    };
    window.addEventListener("pointerdown", click);
    return () => {
      window.removeEventListener("pointerdown", click);
      music.current?.pause();
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
