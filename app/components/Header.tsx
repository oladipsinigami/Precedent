"use client";

interface HeaderProps {
  onLoadDemo: () => void;
}

export function Header({ onLoadDemo }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#07090c]/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1520px] items-center justify-between px-5 py-3.5 lg:px-8">
        <div className="flex items-center gap-3.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-[#d4ff3f] font-mono text-xs font-black text-[#080a0d] shadow-[0_0_16px_rgba(212,255,63,0.35)]">
            P
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-semibold uppercase tracking-[0.24em] text-white">
                Precedent
              </span>
              <span className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[#8b99a6]">
                Desk v2
              </span>
            </div>
            <div className="text-[11px] text-[#71808e]">
              Multi-Factor Research Workbench · Bitget rTokens
            </div>
          </div>
        </div>

        <div className="flex items-center gap-5 font-mono text-[11px] uppercase tracking-[0.14em]">
          <span className="hidden items-center gap-1.5 text-[#62707d] sm:inline-flex">
            <span className="h-1 w-1 rounded-full bg-[#52606d]" />
            Non-Execution Environment
          </span>

          <div className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[#a0b0be]">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#d4ff3f] opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#d4ff3f]" />
            </span>
            <span className="text-[10px] tracking-[0.12em]">Bitget Live Tape</span>
          </div>

          <button
            type="button"
            onClick={onLoadDemo}
            className="group flex items-center gap-1.5 text-xs text-[#d4ff3f] transition hover:text-white"
            title="Load NVDA Post-Earnings Drift Demo Case"
          >
            <span>Preset Demo</span>
            <span className="transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
              ↗
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
