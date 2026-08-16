import { useEffect, useState } from "react";
import { requestLoaderFacts } from "../director/LoaderFactsClient";
import { fallbackLoaderFacts } from "../director/loaderFacts";

export function RoundLoader({ label, loadedAssets, totalAssets, errorMessage, onRetry }: { label: string; loadedAssets?: number; totalAssets?: number; errorMessage?: string; onRetry?: () => void }) {
  const hasProgress = loadedAssets !== undefined && totalAssets !== undefined;
  const percentage = hasProgress && totalAssets > 0 ? Math.round((loadedAssets / totalAssets) * 100) : 0;
  const [facts, setFacts] = useState<string[]>([...fallbackLoaderFacts]);
  const [factIndex, setFactIndex] = useState(0);
  const [showError, setShowError] = useState(false);

  useEffect(() => {
    void requestLoaderFacts().then((result) => setFacts(result.facts));
  }, []);

  useEffect(() => {
    const factTimer = window.setInterval(() => setFactIndex((index) => (index + 1) % facts.length), 6_000);
    return () => window.clearInterval(factTimer);
  }, [facts.length]);

  useEffect(() => {
    const errorTimer = window.setTimeout(() => setShowError(true), 4_000);
    return () => window.clearTimeout(errorTimer);
  }, []);

  const visibleError = showError ? errorMessage : "";

  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-[#08060f] text-center">
      <div>
        <div className="mx-auto flex w-24 justify-between" aria-hidden="true">
          <span className="size-3 animate-pulse rounded-full bg-[#ff7658] shadow-[0_0_18px_#ff7658]" />
          <span className="size-3 animate-pulse rounded-full bg-[#6de6ff] shadow-[0_0_18px_#6de6ff] [animation-delay:250ms]" />
          <span className="size-3 animate-pulse rounded-full bg-[#bd74ff] shadow-[0_0_18px_#bd74ff] [animation-delay:500ms]" />
        </div>
        <p className="mt-4 text-xs tracking-[0.15em] text-[#b7a6d1] uppercase" aria-live="polite">{visibleError ? "The summoning was interrupted" : label}</p>
        {hasProgress && !visibleError && (
          <>
            <div className="mx-auto mt-4 h-1.5 w-48 overflow-hidden rounded-full bg-[#21172c]"><span className="block h-full rounded-full bg-linear-to-r from-[#ff7658] to-[#6de6ff] transition-[width] duration-300" style={{ width: `${percentage}%` }} /></div>
            <small className="mt-2 block text-[0.6rem] text-[#897b9b]">{loadedAssets} / {totalAssets} assets</small>
          </>
        )}
        {visibleError && onRetry && <button className="mt-4 cursor-pointer rounded-full border border-[#ff9a6a] bg-[#35161c] px-4 py-2 text-xs font-bold text-[#ffc0b7]" type="button" onClick={onRetry}>Retry loading</button>}
        <article className="round-fact"><small>AI Director field note</small><p>{facts[factIndex]}</p></article>
      </div>
    </div>
  );
}
