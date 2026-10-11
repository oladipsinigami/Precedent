"use client";

import { animate, onScroll, stagger, utils } from "animejs";
import { animateCountUp } from "@/lib/motion/count-up";
import { MOTION_EASE } from "@/lib/motion/tokens";
import { useAnimeScope } from "@/lib/motion/use-anime-scope";
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
  const scoreItems: Array<[string, PillarScore]> = [
    ["Sentiment", scores.sentiment],
    ["Fundamentals", scores.fundamentals],
    ["Technicals", scores.technicals],
  ];

  const { rootRef } = useAnimeScope<HTMLDivElement>(({ root }) => {
    let hasPlayed = false;

    const playEvidenceTelemetry = () => {
      if (hasPlayed) return;
      hasPlayed = true;

      const claims = root.querySelectorAll<HTMLElement>("[data-anim='evidence-claim']");
      if (claims.length > 0) {
        utils.set(claims, { opacity: 0, translateY: 6 });
        animate(claims, {
          opacity: [0, 1],
          translateY: [6, 0],
          duration: 240,
          delay: stagger(40),
          ease: MOTION_EASE.default,
        });
      }

      scoreItems.forEach(([, item], idx) => {
        if (item.value === null) return;
        const valNode = root.querySelector<HTMLElement>(`[data-anim-score-val="${idx}"]`);
        const barNode = root.querySelector<HTMLElement>(`[data-anim-score-bar="${idx}"]`);

        animateCountUp(valNode, {
          from: 0,
          to: item.value,
          decimals: 0,
          suffix: " / 100",
          delay: 100 + idx * 55,
        });

        if (barNode) {
          utils.set(barNode, { scaleX: 0, transformOrigin: "left center" });
          animate(barNode, {
            scaleX: [0, 1],
            duration: 360,
            delay: 120 + idx * 55,
            ease: MOTION_EASE.expo,
          });
        }
      });

      const flagRows = root.querySelectorAll<HTMLElement>("[data-anim='flag-row']");
      if (flagRows.length > 0) {
        utils.set(flagRows, { opacity: 0, translateX: 6 });
        animate(flagRows, {
          opacity: [0, 1],
          translateX: [6, 0],
          duration: 220,
          delay: stagger(35, { start: 80 }),
          ease: MOTION_EASE.default,
        });
      }

      // Rule #2: Only animate RMT telemetry when the snapshot is NOT stale
      if (marketStructure && !marketStructure.stale) {
        const modePct =
          marketStructure.marketModeStrength !== undefined
            ? marketStructure.marketModeStrength * 100
            : null;
        if (modePct !== null) {
          animateCountUp(root.querySelector<HTMLElement>("[data-anim='rmt-mode-pct']"), {
            from: 0,
            to: modePct,
            decimals: 1,
            suffix: "%",
            delay: 140,
          });

          const modeBar = root.querySelector<HTMLElement>("[data-anim='rmt-mode-bar']");
          if (modeBar) {
            utils.set(modeBar, { scaleX: 0, transformOrigin: "left center" });
            animate(modeBar, {
              scaleX: [0, 1],
              duration: 380,
              delay: 140,
              ease: MOTION_EASE.expo,
            });
          }
        }

        const peerRows = root.querySelectorAll<HTMLElement>("[data-anim='rmt-peer-row']");
        if (peerRows.length > 0) {
          utils.set(peerRows, { opacity: 0, translateY: 4 });
          animate(peerRows, {
            opacity: [0, 1],
            translateY: [4, 0],
            duration: 220,
            delay: stagger(40, { start: 180 }),
            ease: MOTION_EASE.default,
          });
        }

        const peerBars = root.querySelectorAll<HTMLElement>("[data-anim='rmt-peer-bar']");
        if (peerBars.length > 0) {
          utils.set(peerBars, { scaleX: 0, transformOrigin: "left center" });
          animate(peerBars, {
            scaleX: [0, 1],
            duration: 320,
            delay: stagger(45, { start: 210 }),
            ease: MOTION_EASE.expo,
          });
        }
      }

      const socialCards = root.querySelectorAll<HTMLElement>("[data-anim='social-card']");
      if (socialCards.length > 0) {
        utils.set(socialCards, { opacity: 0, translateY: 5 });
        animate(socialCards, {
          opacity: [0, 1],
          translateY: [5, 0],
          duration: 220,
          delay: stagger(35, { start: 140 }),
          ease: MOTION_EASE.default,
        });
      }
    };

    const parentDetails = root.closest("details");
    if (parentDetails && !parentDetails.open) {
      const onToggle = () => {
        if (parentDetails.open) {
          hasPlayed = false;
          playEvidenceTelemetry();
        }
      };
      parentDetails.addEventListener("toggle", onToggle);
      return () => parentDetails.removeEventListener("toggle", onToggle);
    }

    onScroll({
      target: root,
      onEnterForward: () => {
        playEvidenceTelemetry();
      },
    });
  }, [marketStructure?.stale]);

  return (
    <div ref={rootRef} className="grid gap-6 lg:gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
      {/* Left Column: Primary Evidence Claims */}
      <div className="space-y-4 sm:space-y-5">
        <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.16em] text-moss">
          ✦ Verified Empirical Signals & Primary Sources ({evidence.length})
        </div>

        {evidence.map((item, index) => (
          <div
            key={`${item.source}-${index}`}
            data-anim="evidence-claim"
            className="group relative rounded-sm border-l-2 border-moss bg-shell/[0.03] p-3.5 sm:p-4 transition hover:bg-shell/[0.05]"
          >
            <p className="text-sm leading-relaxed text-ink-strong font-normal">{item.claim}</p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2 font-mono text-[10px] tracking-wider text-mute-dim">
              <span className="rounded bg-moss/10 px-2 py-0.5 font-semibold text-moss">
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
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {[
        ["Sentiment", scores.sentiment],
        ["Fundamentals", scores.fundamentals],
        ["Technicals", scores.technicals],
      ].map(([label, score], idx) => {
        const item = score as PillarScore;
        const pct = item.value !== null ? Math.min(100, Math.max(4, item.value)) : 0;
        return (
          <div key={label as string} className="rounded-sm border border-shell/12 bg-paper p-3.5 shadow-sm">
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-moss">
              {label as string}
            </div>
            <div className="mt-1 text-lg font-semibold text-ink-strong">
              <span data-anim-score-val={idx}>
                {item.value === null ? "N/A" : `${item.value} / 100`}
              </span>{" "}
              <span className="text-[10px] uppercase text-ink-faint">· {item.label}</span>
            </div>
            {item.value !== null && (
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-shell/10">
                <div
                  data-anim-score-bar={idx}
                  className="h-full rounded-full bg-moss origin-left"
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}
            <p className="mt-1.5 text-[11px] leading-relaxed text-mute-dim">{item.basis}</p>
          </div>
        );
      })}
    </div>
  );
}

export function FlagsCard({ flags }: { flags: StructureFlags }) {
  const getBadgeColor = (val: string) => {
    if (val === "high" || val === "aligned" || val === "stable" || val === "available") {
      return "text-moss bg-moss/10";
    }
    if (val === "moderate") return "text-amber-deep bg-amber-deep/10";
    return "text-warn-deep bg-warn-deep/10";
  };

  return (
    <div className="rounded-sm border border-shell/15 bg-paper p-4 sm:p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-moss">
          ✦ Microstructural Diagnostics
        </div>
        <span className="font-mono text-[9px] uppercase text-ink-faint">Disaggregated Indicators</span>
      </div>

      <div className="mt-4 space-y-2.5 text-xs">
        <div
          data-anim="flag-row"
          className="flex items-center justify-between gap-3 border-b border-shell/[0.06] pb-2"
        >
          <span className="text-mute-dim">Catalyst Density</span>
          <span className={`font-mono text-[10px] uppercase font-semibold px-2 py-0.5 rounded ${getBadgeColor(flags.catalystDensity)}`}>
            {flags.catalystDensity}
          </span>
        </div>

        <div
          data-anim="flag-row"
          className="flex items-center justify-between gap-3 border-b border-shell/[0.06] pb-2"
        >
          <span className="text-mute-dim">Regime Alignment</span>
          <span className={`font-mono text-[10px] uppercase font-semibold px-2 py-0.5 rounded ${getBadgeColor(flags.regimeAlignment)}`}>
            {flags.regimeAlignment}
          </span>
        </div>

        <div
          data-anim="flag-row"
          className="flex items-center justify-between gap-3 border-b border-shell/[0.06] pb-2"
        >
          <span className="text-mute-dim">Community Stability</span>
          <span className={`font-mono text-[10px] uppercase font-semibold px-2 py-0.5 rounded ${getBadgeColor(flags.communityData)}`}>
            community data {flags.communityData}
          </span>
        </div>

        <div data-anim="flag-row" className="flex items-center justify-between gap-3">
          <span className="text-mute-dim">Analog Base Quality</span>
          <span className="font-mono text-[11px] text-ink-body">
            n={flags.analogQuality.n} · {flags.analogQuality.clustered ? "Clustered" : "Scattered"}
          </span>
        </div>
      </div>

      {flags.balanceSheet.length > 0 && (
        <div className="mt-4 border-t border-shell/10 pt-3 text-[11px] leading-relaxed text-mute-faint">
          <span className="font-semibold text-moss-alt">Balance Sheet Note: </span>
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
    <div className={`rounded-sm border bg-paper p-4 sm:p-5 shadow-sm ${market.stale ? "border-amber-deep/40" : "border-shell/15"}`}>
      <div className="flex items-center justify-between">
        <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-moss">
          ✦ RMT Market-Mode Dynamics
        </div>
        <span className={`font-mono text-[9px] uppercase ${market.stale ? "font-semibold text-amber-deep" : "text-ink-faint"}`}>
          {market.stale
            ? "Stale Snapshot"
            : hasCohort
              ? `${market.communityId ?? "Cohort"} · ${cohortSize} names`
              : "No Distinct Cohort"}
        </span>
      </div>

      <div className="mt-3">
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-mute-dim">Market-Mode Share</span>
          <span data-anim="rmt-mode-pct" className="font-mono text-sm font-bold text-ink-strong">
            {modePct !== null ? `${modePct.toFixed(1)}%` : "N/A"}
          </span>
        </div>

        {modePct !== null && (
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-shell/10">
            <div
              data-anim="rmt-mode-bar"
              className={`h-full rounded-full origin-left ${
                modePct > 50 ? "bg-amber-deep" : "bg-moss"
              }`}
              style={{ width: `${Math.min(100, Math.max(5, modePct))}%` }}
            />
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-[10px] text-mute-faint">
          <div>
            <span className="text-mute">Info vs Noise: </span>
            <span className="font-semibold text-ink-body">
              {market.infoBeyondNoisePct?.toFixed(1) ?? "N/A"}%
            </span>
          </div>
          <div>
            <span className="text-mute">Universe: </span>
            <span className="font-semibold text-ink-body">{market.universeSize} assets</span>
          </div>
        </div>
      </div>

      {peers.length > 0 && (
        <div className="mt-3 border-t border-shell/10 pt-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-mute">
            {hasCohort ? "Cohort peers" : "Strongest residual partners"}
          </div>
          <ul className="mt-2 space-y-2">
            {peers.slice(0, 4).map((peer) => {
              const barPct = Math.min(100, Math.max(6, Math.abs(peer.residual) * 100));
              return (
                <li key={peer.peer} data-anim="rmt-peer-row" className="space-y-1">
                  <div className="flex items-baseline justify-between gap-2 text-[11px]">
                    <span className="font-semibold text-ink-body">{peer.peer}</span>
                    <span className="font-mono text-[10px] text-mute-dim">
                      ρ {peer.residual.toFixed(2)}
                      <span className="text-mute"> (raw {peer.raw.toFixed(2)})</span>
                    </span>
                  </div>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-shell/10">
                    <div
                      data-anim="rmt-peer-bar"
                      className="h-full rounded-full bg-moss/75 origin-left"
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-[10px] leading-relaxed text-mute">
            Correlations measured after the market mode is removed, so they describe co-movement
            beyond the beta these names share with the market.
          </p>
        </div>
      )}

      <div className="mt-4 border-t border-shell/10 pt-3 text-[11px] leading-relaxed text-mute-faint">
        {market.stability ?? market.caveats.join(" ")}
      </div>
    </div>
  );
}

export function SocialSummary({ news }: { news: NewsPillar }) {
  return (
    <div className="rounded-sm border border-shell/15 bg-paper p-4 sm:p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-moss">
          ✦ Multi-Channel Discourse Velocity
        </div>
        <span className="font-mono text-[9px] uppercase text-ink-faint">Multi-Source</span>
      </div>

      <div className={`mt-3.5 grid ${news.social.reddit?.length ? "grid-cols-4" : "grid-cols-3"} gap-2.5 text-xs`}>
        <div data-anim="social-card" className="rounded border border-shell/[0.07] bg-white/60 p-2.5">
          <div className="font-mono text-[10px] uppercase text-ink-faint">Wire / News</div>
          <div className="mt-1 font-mono text-base font-bold text-ink-strong">{news.headlines.length}</div>
        </div>
        <div data-anim="social-card" className="rounded border border-shell/[0.07] bg-white/60 p-2.5">
          <div className="font-mono text-[10px] uppercase text-ink-faint">X / Social</div>
          <div className="mt-1 font-mono text-base font-bold text-ink-strong">{news.social.x.length}</div>
        </div>
        {news.social.reddit && news.social.reddit.length > 0 && (
          <div data-anim="social-card" className="rounded border border-shell/[0.07] bg-white/60 p-2.5">
            <div className="font-mono text-[10px] uppercase text-ink-faint">Reddit Tape</div>
            <div className="mt-1 font-mono text-base font-bold text-ink-strong">{news.social.reddit.length}</div>
          </div>
        )}
        <div data-anim="social-card" className="rounded border border-shell/[0.07] bg-white/60 p-2.5">
          <div className="font-mono text-[10px] uppercase text-ink-faint">Consensus</div>
          <div className="mt-1 truncate font-mono text-xs font-semibold text-moss">{news.aggregateLean}</div>
        </div>
      </div>

      {news.adanos?.buzzScore !== undefined && (
        <div className="mt-2.5 flex items-center justify-between rounded border border-shell/[0.07] bg-white/60 px-2.5 py-1.5 font-mono text-[10px]">
          <span className="uppercase text-ink-faint">Adanos BuzzScore</span>
          <span className="font-bold text-ink-strong">{news.adanos.buzzScore.toFixed(1)} / 100</span>
        </div>
      )}

      {news.caveats.length > 0 && (
        <div className="mt-3.5 border-t border-shell/10 pt-3 text-[11px] leading-relaxed text-mute-faint">
          {news.caveats[0]}
        </div>
      )}
    </div>
  );
}
