"use client";

import type { Briefing, MarketStructurePillar, NewsPillar, StructureFlags } from "@/lib/types";
import type { PillarScore } from "@/lib/pillar-scores";

interface EvidenceSectionProps {
  evidence: Briefing["evidence"];
  flags?: StructureFlags;
  marketStructure?: MarketStructurePillar;
  news?: NewsPillar;
  scores: { sentiment: PillarScore; fundamentals: PillarScore; technicals: PillarScore };
}

export function EvidenceSection({ evidence, flags, marketStructure, news, scores }: EvidenceSectionProps) {
  return (
    <div className="grid gap-6 lg:gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
      {/* Left Column: Primary Evidence Claims */}
      <div className="space-y-4 sm:space-y-5">
        <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.16em] text-[#4d6330]">
          ✦ Verified Empirical Signals & Primary Sources ({evidence.length})
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
        <ScoreRow scores={scores} />
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

function ScoreRow({ scores }: { scores: EvidenceSectionProps["scores"] }) {
  return <div className="grid gap-3 sm:grid-cols-3">
    {[
      ["Sentiment", scores.sentiment],
      ["Fundamentals", scores.fundamentals],
      ["Technicals", scores.technicals],
    ].map(([label, score]) => {
      const item = score as PillarScore;
      return <div key={label as string} className="rounded-sm border border-[#141918]/12 bg-[#fcf9f2] p-3.5 shadow-sm">
        <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[#486326]">{label as string}</div>
        <div className="mt-1 text-lg font-semibold text-[#1f2821]">{item.value === null ? "N/A" : `${item.value} / 100`} <span className="text-[10px] uppercase text-[#738275]">· {item.label}</span></div>
        <p className="mt-1 text-[11px] leading-relaxed text-[#637265]">{item.basis}</p>
      </div>;
    })}
  </div>;
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
          ✦ Microstructural Diagnostics
        </div>
        <span className="font-mono text-[9px] uppercase text-[#738275]">Disaggregated Indicators</span>
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
  const cohortSize = market.communityMembers?.length ?? 0;
  const hasCohort = cohortSize > 1;
  const peers = market.cleanedCorrelations ?? [];

  return (
    <div className={`rounded-sm border bg-[#fcf9f2] p-4 sm:p-5 shadow-sm ${market.stale ? "border-[#b5731d]/40" : "border-[#141918]/15"}`}>
      <div className="flex items-center justify-between">
        <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[#486326]">
          ✦ RMT Market-Mode Dynamics
        </div>
        <span className={`font-mono text-[9px] uppercase ${market.stale ? "font-semibold text-[#a3681e]" : "text-[#738275]"}`}>
          {market.stale
            ? "Stale Snapshot"
            : hasCohort
              ? `${market.communityId ?? "Cohort"} · ${cohortSize} names`
              : "No Distinct Cohort"}
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

      {peers.length > 0 && (
        <div className="mt-3 border-t border-[#141918]/10 pt-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#859487]">
            {hasCohort ? "Cohort peers" : "Strongest residual partners"}
          </div>
          <ul className="mt-1.5 space-y-1">
            {peers.slice(0, 4).map((peer) => (
              <li key={peer.peer} className="flex items-baseline justify-between gap-2 text-[11px]">
                <span className="font-semibold text-[#253028]">{peer.peer}</span>
                <span className="font-mono text-[10px] text-[#637265]">
                  ρ {peer.residual.toFixed(2)}
                  <span className="text-[#859487]"> (raw {peer.raw.toFixed(2)})</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[10px] leading-relaxed text-[#859487]">
            Correlations measured after the market mode is removed, so they describe co-movement
            beyond the beta these names share with the market.
          </p>
        </div>
      )}

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
          ✦ Multi-Channel Discourse Velocity
        </div>
        <span className="font-mono text-[9px] uppercase text-[#738275]">Multi-Source</span>
      </div>

      <div className={`mt-3.5 grid ${news.social.reddit?.length ? "grid-cols-4" : "grid-cols-3"} gap-2.5 text-xs`}>
        <div className="rounded border border-[#141918]/[0.07] bg-white/60 p-2.5">
          <div className="font-mono text-[10px] uppercase text-[#738375]">Wire / News</div>
          <div className="mt-1 font-mono text-base font-bold text-[#1f2821]">{news.headlines.length}</div>
        </div>
        <div className="rounded border border-[#141918]/[0.07] bg-white/60 p-2.5">
          <div className="font-mono text-[10px] uppercase text-[#738375]">X / Social</div>
          <div className="mt-1 font-mono text-base font-bold text-[#1f2821]">{news.social.x.length}</div>
        </div>
        {news.social.reddit && news.social.reddit.length > 0 && (
          <div className="rounded border border-[#141918]/[0.07] bg-white/60 p-2.5">
            <div className="font-mono text-[10px] uppercase text-[#738375]">Reddit Tape</div>
            <div className="mt-1 font-mono text-base font-bold text-[#1f2821]">{news.social.reddit.length}</div>
          </div>
        )}
        <div className="rounded border border-[#141918]/[0.07] bg-white/60 p-2.5">
          <div className="font-mono text-[10px] uppercase text-[#738375]">Consensus</div>
          <div className="mt-1 truncate font-mono text-xs font-semibold text-[#486326]">{news.aggregateLean}</div>
        </div>
      </div>

      {news.adanos?.buzzScore !== undefined && (
        <div className="mt-2.5 flex items-center justify-between rounded border border-[#141918]/[0.07] bg-white/60 px-2.5 py-1.5 font-mono text-[10px]">
          <span className="uppercase text-[#738375]">Adanos BuzzScore</span>
          <span className="font-bold text-[#1f2821]">{news.adanos.buzzScore.toFixed(1)} / 100</span>
        </div>
      )}

      {news.caveats.length > 0 && (
        <div className="mt-3.5 border-t border-[#141918]/10 pt-3 text-[11px] leading-relaxed text-[#5a685c]">
          {news.caveats[0]}
        </div>
      )}
    </div>
  );
}
