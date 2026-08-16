export function RoundLoader({ label }: { label: string }) {
  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-[#08060fcc] text-center backdrop-blur-sm">
      <div>
        <div className="mx-auto flex w-24 justify-between" aria-hidden="true">
          <span className="size-3 animate-pulse rounded-full bg-[#ff7658] shadow-[0_0_18px_#ff7658]" />
          <span className="size-3 animate-pulse rounded-full bg-[#6de6ff] shadow-[0_0_18px_#6de6ff] [animation-delay:250ms]" />
          <span className="size-3 animate-pulse rounded-full bg-[#bd74ff] shadow-[0_0_18px_#bd74ff] [animation-delay:500ms]" />
        </div>
        <p className="mt-4 text-xs tracking-[0.15em] text-[#b7a6d1] uppercase" aria-live="polite">{label}</p>
      </div>
    </div>
  );
}
