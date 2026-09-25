"use client";

interface HeaderProps {
  onLoadDemo: () => void;
  universeMeta: { source: "live" | "fallback"; count: number; asOf: string | null };
}

export function Header({ onLoadDemo, universeMeta }: HeaderProps) {
  const universeLive = universeMeta.source === "live";
  const universeLabel = universeLive
    ? `${universeMeta.count.toLocaleString("en-US")} rTokens Live`
    : `${universeMeta.count.toLocaleString("en-US")} Asset Fallback`;
  const universeTitle = universeLive
    ? `Bitget rToken universe refreshed ${universeMeta.asOf ? new Date(universeMeta.asOf).toLocaleString() : "recently"}`
    : "Live Bitget discovery is unavailable; showing the built-in fallback universe.";
  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#07090c]/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1520px] items-center justify-between px-3.5 py-2.5 sm:px-6 sm:py-3.5 lg:px-8">
        <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-gradient-to-br from-[#d4ff3f] to-[#b2e612] font-mono text-xs font-black text-[#080a0d] shadow-[0_0_18px_rgba(212,255,63,0.35)]">
            P
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold uppercase tracking-[0.24em] text-white">
                Precedent
              </span>
              <span className="rounded bg-white/[0.07] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[#9ba8b5]">
                Research Desk
              </span>
            </div>
            <div className="hidden sm:block text-[11px] text-[#788896] truncate">
              Institutional Intelligence for Tokenized US Equities & Assets
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-5 font-mono text-[11px] uppercase tracking-[0.14em] shrink-0">
          <span className="hidden items-center gap-1.5 text-[#6c7b89] lg:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-[#4a5866]" />
            Pure Research · Non-Execution
          </span>

          <div
            className={`flex items-center gap-1.5 sm:gap-2 rounded-full border px-2.5 py-1 sm:px-3 sm:py-1 ${
              universeLive
                ? "border-white/[0.09] bg-white/[0.03] text-[#a8b8c7]"
                : "border-[#f59e0b]/30 bg-[#f59e0b]/[0.06] text-[#d8a75a]"
            }`}
            title={universeTitle}
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${universeLive ? "bg-[#d4ff3f]" : "bg-[#f59e0b]"}`} />
              <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${universeLive ? "bg-[#d4ff3f]" : "bg-[#f59e0b]"}`} />
            </span>
            <span className="text-[9px] sm:text-[10px] tracking-[0.12em]">
              {universeLabel}
            </span>
          </div>

          <button
            type="button"
            onClick={onLoadDemo}
            className="group flex min-h-[44px] items-center gap-1.5 rounded-md bg-[#d4ff3f] px-3 text-xs font-bold text-[#080a0d] shadow-[0_0_18px_rgba(212,255,63,0.35)] transition hover:bg-white"
            title="Load and run the recommended demo walkthrough (AAPL swing stress-test)"
          >
            <span>Load recommended demo</span>
            <span className="transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
              ↗
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
