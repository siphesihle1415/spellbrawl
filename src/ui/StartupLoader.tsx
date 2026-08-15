import { useEffect, useState } from "react";
import { requestLoaderFacts } from "../director/LoaderFactsClient";
import { fallbackLoaderFacts } from "../director/loaderFacts";

export function StartupLoader({ loadedAssets, totalAssets }: { loadedAssets: number; totalAssets: number }) {
  const [complete, setComplete] = useState(false);
  const [minimumElapsed, setMinimumElapsed] = useState(false);
  const [facts, setFacts] = useState<string[]>([...fallbackLoaderFacts]);
  const [factIndex, setFactIndex] = useState(0);
  const [source, setSource] = useState<"ai" | "static" | "fallback">("fallback");

  useEffect(() => {
    const minimumDisplay = window.setTimeout(() => setMinimumElapsed(true), 900);
    return () => window.clearTimeout(minimumDisplay);
  }, []);

  useEffect(() => {
    if (minimumElapsed && loadedAssets >= totalAssets) setComplete(true);
  }, [loadedAssets, minimumElapsed, totalAssets]);

  useEffect(() => {
    void requestLoaderFacts().then((result) => {
      setFacts(result.facts);
      setSource(result.source);
      setFactIndex(0);
    });
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setFactIndex((index) => (index + 1) % facts.length), 4_500);
    return () => window.clearInterval(interval);
  }, [facts.length]);

  if (complete) return null;

  const percentage = Math.round((loadedAssets / totalAssets) * 100);
  const status = loadedAssets === 0 ? "Opening the rift…" : `Binding arena relics · ${loadedAssets} / ${totalAssets}`;

  return (
    <div className="absolute inset-0 z-50 grid place-items-center overflow-hidden bg-[#08060f] px-6 text-center">
      <div className="absolute -top-40 left-1/2 size-[34rem] -translate-x-1/2 rounded-full bg-[#6134b4]/20 blur-3xl" />
      <div className="relative w-full max-w-xl">
        <p className="mb-3 text-[0.7rem] tracking-[0.28em] text-[#ba9ce8] uppercase">SpellBrawl</p>
        <h2 className="font-display m-0 text-[clamp(2.4rem,8vw,5.5rem)] leading-none">Summoning the arena</h2>
        <div className="mx-auto mt-7 flex w-24 justify-between" aria-hidden="true">
          <span className="size-3 animate-pulse rounded-full bg-[#ff7658] shadow-[0_0_18px_#ff7658]" />
          <span className="size-3 animate-pulse rounded-full bg-[#6de6ff] shadow-[0_0_18px_#6de6ff] [animation-delay:250ms]" />
          <span className="size-3 animate-pulse rounded-full bg-[#bd74ff] shadow-[0_0_18px_#bd74ff] [animation-delay:500ms]" />
        </div>
        <div className="mt-8 h-2 overflow-hidden rounded-full border border-[#5b4575] bg-[#120d1d] p-px">
          <span className="block h-full rounded-full bg-linear-to-r from-[#ff7658] via-[#bd74ff] to-[#6de6ff] transition-[width] duration-300" style={{ width: `${percentage}%` }} />
        </div>
        <p className="mt-3 text-xs tracking-[0.1em] text-[#b7a6d1] uppercase">{status}</p>
        <article className="mt-10 rounded-2xl border border-[#46335f] bg-[#110c19c9] px-6 py-5 text-left backdrop-blur-md">
          <p className="m-0 text-[0.65rem] tracking-[0.22em] text-[#9bdbff] uppercase">Director's field note {source === "ai" ? "· live" : ""}</p>
          <p className="mt-3 mb-0 min-h-12 text-sm leading-6 text-[#eee7fa]" aria-live="polite">{facts[factIndex]}</p>
        </article>
      </div>
    </div>
  );
}
