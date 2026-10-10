"use client";

interface HeaderProps {
  onLoadDemo: () => void;
  onStartTour?: () => void;
  universeMeta: { source: "live" | "cached" | "fallback"; count: number; asOf: string | null };
}

export function Header({ onLoadDemo, onStartTour, universeMeta }: HeaderProps) {
  const universeHealthy = universeMeta.source !== "fallback";
  const universeLabel =
    universeMeta.source === "live"
      ? `${universeMeta.count.toLocaleString("en-US")} rTokens Live`
      : universeMeta.source === "cached"
        ? `${universeMeta.count.toLocaleString("en-US")} rTokens · cached`
        : "Built-in list · discovery offline";
  const universeTitle =
    universeMeta.source === "live"
      ? `Bitget rToken universe refreshed ${universeMeta.asOf ? new Date(universeMeta.asOf).toLocaleString() : "recently"}`
      : universeMeta.source === "cached"
        ? `Live Bitget discovery is unreachable. Showing the last successfully fetched universe from ${universeMeta.asOf ? new Date(universeMeta.asOf).toLocaleString() : "an earlier session"}.`
        : "Live Bitget discovery is unavailable and no earlier universe was cached; showing the built-in fallback list.";
  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-blot/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1520px] items-center justify-between px-3.5 py-2.5 sm:px-6 sm:py-3.5 lg:px-8">
        <div className="flex items-center gap-3 sm:gap-3.5 min-w-0" data-tour="tour-brand">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-gradient-to-br from-lime to-lime-alt font-mono text-xs font-black text-blot shadow-[0_0_18px_rgba(212,255,63,0.35)]">
            P
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold uppercase tracking-[0.24em] text-white">
                Precedent
              </span>
              <span className="rounded bg-white/[0.07] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-slate-text">
                Research Desk
              </span>
            </div>
            <div className="hidden sm:block text-[11px] text-slate-line truncate">
              Institutional Intelligence for Tokenized US Equities & Assets
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-5 font-mono text-[11px] uppercase tracking-[0.14em] shrink-0">
          <span className="hidden items-center gap-1.5 text-slate-line lg:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-slate" />
            Pure Research · Non-Execution
          </span>

          <div
            data-tour="tour-universe"
            className={`flex items-center gap-1.5 sm:gap-2 rounded-full border px-2.5 py-1 sm:px-3 sm:py-1 ${
              universeHealthy
                ? "border-white/[0.09] bg-white/[0.03] text-slate-pale"
                : "border-amber/30 bg-amber/[0.06] text-gold"
            }`}
            title={universeTitle}
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${universeHealthy ? "bg-lime" : "bg-amber"}`} />
              <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${universeHealthy ? "bg-lime" : "bg-amber"}`} />
            </span>
            <span className="text-[9px] sm:text-[10px] tracking-[0.12em]">
              {universeLabel}
            </span>
          </div>

          {onStartTour && (
            <button
              type="button"
              onClick={onStartTour}
              className="hidden min-h-[44px] items-center rounded-md border border-white/15 bg-white/[0.04] px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-mid transition hover:border-lime/50 hover:text-white sm:inline-flex"
              title="Explain every control on this screen"
            >
              Quick tour
            </button>
          )}

          <button
            type="button"
            data-tour="tour-demo"
            onClick={onLoadDemo}
            className="group flex min-h-[44px] items-center gap-1.5 rounded-md bg-lime px-3 text-xs font-bold text-blot shadow-[0_0_18px_rgba(212,255,63,0.35)] transition hover:bg-white"
            title="Load and run the recommended demo walkthrough (AAPL swing stress-test)"
          >
            <span>Load recommended demo</span>
            <span className="transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
              ↗
            </span>
          </button>
        </div>
      </div>
      {onStartTour && (
        <div className="border-t border-white/[0.06] px-3.5 py-2 sm:hidden">
          <button
            type="button"
            onClick={onStartTour}
            className="flex min-h-[40px] w-full items-center justify-center rounded-md border border-white/15 bg-white/[0.04] font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-lime"
          >
            Quick tour · explain this screen
          </button>
        </div>
      )}
    </header>
  );
}
