"use client";

import type { Briefing, MarketStructurePillar, NewsPillar, StructureFlags } from "@/lib/types";

interface EvidenceSectionProps {
  evidence: Briefing["evidence"];
  flags?: StructureFlags;
  marketStructure?: MarketStructurePillar;
  news?: NewsPillar;
}

export function EvidenceSection({ evidence, flags, marketStructure, news }: EvidenceSectionProps) {
  return (
    <div className="grid gap-6 lg:gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
      {/* Left Column: Primary Evidence Claims */}
      <div className="space-y-4 sm:space-y-5">
        <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.16em] text-[#4d6330]">
          Verified Claims & Empirical Sources ({evidence.length})
        </div>

        {evidence.map((item, index) => (
          <div
            key={`${item.source}-${index}`}
            className="group relative rounded-sm border-l-2 border-[#486326] bg-[#121814]/[0.03] p-3.5 sm:p-4 transition hover:bg-[#121814]/[0.05]"
          >
            <p className="text-sm leading-relaxed text-[#1a211c] font-normal">{item.claim}</p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2 font-mono text-[10px] tracking-wider text-[#637265]">
              <span className="rounded bg-[#486326]/10 px-2 py-0.5 font-semibold text-[#486326]">
                {item.pillar}
              </span>
              <span>·</span>
              <span className="truncate">{item.source}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Right Column: Institutional Structural Diagnostics Cards */}
      <div className="space-y-4 sm:space-y-5">
        {flags && <FlagsCard flags={flags} />}
        {marketStructure && <RmtCard market={marketStructure} />}
        {news && <SocialSummary news={news} />}
      </div>
    </div>
  );
}

export function FlagsCard({ flags }: { flags: StructureFlags }) {
  const getBadgeColor = (val: string) => {
    if (val === "high" || val === "aligned" || val === "stable") return "text-[#3f6324] bg-[#486326]/10";
    if (val === "moderate") return "text-[#a3681e] bg-[#b5731d]/10";
    return "text-[#7a483a] bg-[#8a4a3a]/10";
  };

  return (
    <div className="rounded-sm border border-[#141918]/15 bg-[#fcf9f2] p-4 sm:p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[#486326]">
          Structural Flags
        </div>
        <span className="font-mono text-[9px] uppercase text-[#738275]">Disaggregated</span>
      </div>

      <div className="mt-4 space-y-2.5 text-xs">
        <div className="flex items-center justify-between gap-3 border-b border-[#141918]/[0.06] pb-2">
          <span className="text-[#657367]">Catalyst Density</span>
          <span className={`font-mono text-[10px] uppercase font-semibold px-2 py-0.5 rounded ${getBadgeColor(flags.catalystDensity)}`}>
            {flags.catalystDensity}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3 border-b border-[#141918]/[0.06] pb-2">
          <span className="text-[#657367]">Regime Alignment</span>
          <span className={`font-mono text-[10px] uppercase font-semibold px-2 py-0.5 rounded ${getBadgeColor(flags.regimeAlignment)}`}>
            {flags.regimeAlignment}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3 border-b border-[#141918]/[0.06] pb-2">
          <span className="text-[#657367]">Community Stability</span>
          <span className={`font-mono text-[10px] uppercase font-semibold px-2 py-0.5 rounded ${getBadgeColor(flags.communityStability)}`}>
            {flags.communityStability}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-[#657367]">Analog Base Quality</span>
          <span className="font-mono text-[11px] text-[#222a24]">
            n={flags.analogQuality.n} · {flags.analogQuality.clustered ? "Clustered" : "Scattered"}
          </span>
        </div>
      </div>

      {flags.balanceSheet.length > 0 && (
        <div className="mt-4 border-t border-[#141918]/10 pt-3 text-[11px] leading-relaxed text-[#5a685c]">
          <span className="font-semibold text-[#425244]">Balance Sheet Note: </span>
          {flags.balanceSheet[0]}
        </div>
      )}
    </div>
  );
}

export function RmtCard({ market }: { market: MarketStructurePillar }) {
  const modePct = market.marketModeStrength !== undefined ? market.marketModeStrength * 100 : null;

  return (
    <div className="rounded-sm border border-[#141918]/15 bg-[#fcf9f2] p-4 sm:p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[#486326]">
          RMT Eigenstructure
        </div>
        <span className="font-mono text-[9px] uppercase text-[#738275]">
          {market.communityId ?? "Global"}
        </span>
      </div>

      <div className="mt-3">
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-[#637265]">Market-Mode Share</span>
          <span className="font-mono text-sm font-bold text-[#1f2821]">
            {modePct !== null ? `${modePct.toFixed(1)}%` : "N/A"}
          </span>
        </div>

        {modePct !== null && (
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#141918]/10">
            <div
              className={`h-full rounded-full transition-all ${
                modePct > 50 ? "bg-[#b85324]" : "bg-[#486326]"
              }`}
              style={{ width: `${Math.min(100, Math.max(5, modePct))}%` }}
            />
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-[10px] text-[#556357]">
          <div>
            <span className="text-[#859487]">Info vs Noise: </span>
            <span className="font-semibold text-[#253028]">
              {market.infoBeyondNoisePct?.toFixed(1) ?? "N/A"}%
            </span>
          </div>
          <div>
            <span className="text-[#859487]">Universe: </span>
            <span className="font-semibold text-[#253028]">{market.universeSize} assets</span>
          </div>
        </div>
      </div>

      <div className="mt-4 border-t border-[#141918]/10 pt-3 text-[11px] leading-relaxed text-[#5a685c]">
        {market.stability ?? market.caveats.join(" ")}
      </div>
    </div>
  );
}

export function SocialSummary({ news }: { news: NewsPillar }) {
  return (
    <div className="rounded-sm border border-[#141918]/15 bg-[#fcf9f2] p-4 sm:p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[#486326]">
          Discourse Density
        </div>
        <span className="font-mono text-[9px] uppercase text-[#738275]">Multi-Source</span>
      </div>

      <div className="mt-3.5 grid grid-cols-2 gap-3 text-xs">
        <div className="rounded border border-[#141918]/[0.07] bg-white/60 p-2.5">
          <div className="font-mono text-[10px] uppercase text-[#738375]">Headlines</div>
          <div className="mt-1 font-mono text-base font-bold text-[#1f2821]">{news.headlines.length}</div>
        </div>
        <div className="rounded border border-[#141918]/[0.07] bg-white/60 p-2.5">
          <div className="font-mono text-[10px] uppercase text-[#738375]">X / Twitter</div>
          <div className="mt-1 font-mono text-base font-bold text-[#1f2821]">{news.social.x.length}</div>
        </div>
        <div className="rounded border border-[#141918]/[0.07] bg-white/60 p-2.5">
          <div className="font-mono text-[10px] uppercase text-[#738375]">YouTube</div>
          <div className="mt-1 font-mono text-base font-bold text-[#1f2821]">{news.social.youtube.length}</div>
        </div>
        <div className="rounded border border-[#141918]/[0.07] bg-white/60 p-2.5">
          <div className="font-mono text-[10px] uppercase text-[#738375]">Aggregate</div>
          <div className="mt-1 truncate font-mono text-xs font-semibold text-[#486326]">{news.aggregateLean}</div>
        </div>
      </div>

      {news.caveats.length > 0 && (
        <div className="mt-3.5 border-t border-[#141918]/10 pt-3 text-[11px] leading-relaxed text-[#5a685c]">
          {news.caveats[0]}
        </div>
      )}
    </div>
  );
}
