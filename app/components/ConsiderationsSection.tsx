"use client";

import { animate, onScroll, stagger, utils } from "animejs";
import { animateCountUp } from "@/lib/motion/count-up";
import { MOTION_EASE } from "@/lib/motion/tokens";
import { useAnimeScope } from "@/lib/motion/use-anime-scope";
import type { AnalogsPillar, Briefing, StructureFlags } from "@/lib/types";
import type { PillarScore } from "@/lib/pillar-scores";

interface ConsiderationsSectionProps {
  considerations: Briefing["considerations"];
  scores: { sentiment: PillarScore; fundamentals: PillarScore; technicals: PillarScore };
  analogs?: AnalogsPillar;
  analogQuality?: StructureFlags["analogQuality"];
}

export function ConsiderationsSection({
  considerations,
  scores,
  analogs,
  analogQuality,
}: ConsiderationsSectionProps) {
  const scoreList: Array<[string, PillarScore]> = [
    ["Sentiment", scores.sentiment],
    ["Fundamentals", scores.fundamentals],
    ["Technicals", scores.technicals],
  ];
  const available = scoreList.filter(([, score]) => score.value !== null);
  // No aggregate verdict here. The pillars describe how much evidence each
  // stream returned; combining them into one adjective read as a directional
  // call the data does not support.
  const trajectory = analogs?.ranges.length
    ? `Analog bands remain available across ${analogs.ranges.length} horizon${analogs.ranges.length === 1 ? "" : "s"} and are ${analogQuality?.clustered ? "clustered" : "scattered"} in the available sample; ${analogs.informative?.note ?? "dispersion should be read as historical context rather than a forecast."}`
    : "Analog trajectory context was unavailable for this run.";

  const { rootRef } = useAnimeScope<HTMLDivElement>(({ root }) => {
    let hasPlayed = false;

    const playGovernanceReveal = () => {
      if (hasPlayed) return;
      hasPlayed = true;

      scoreList.forEach(([, item], idx) => {
        if (item.value === null) return;
        const valNode = root.querySelector<HTMLElement>(`[data-anim-gov-score="${idx}"]`);
        const barNode = root.querySelector<HTMLElement>(`[data-anim-gov-bar="${idx}"]`);

        animateCountUp(valNode, {
          from: 0,
          to: item.value,
          decimals: 0,
          suffix: " / 100",
          delay: 60 + idx * 50,
        });

        if (barNode) {
          utils.set(barNode, { scaleX: 0, transformOrigin: "left center" });
          animate(barNode, {
            scaleX: [0, 1],
            duration: 340,
            delay: 80 + idx * 50,
            ease: MOTION_EASE.expo,
          });
        }
      });

      const cols = root.querySelectorAll<HTMLElement>("[data-anim='consideration-col']");
      if (cols.length > 0) {
        utils.set(cols, { opacity: 0, translateY: 6 });
        animate(cols, {
          opacity: [0, 1],
          translateY: [6, 0],
          duration: 240,
          delay: stagger(50, { start: 100 }),
          ease: MOTION_EASE.default,
        });
      }

      const items = root.querySelectorAll<HTMLElement>("[data-anim='consideration-item']");
      if (items.length > 0) {
        utils.set(items, { opacity: 0, translateY: 4 });
        animate(items, {
          opacity: [0, 1],
          translateY: [4, 0],
          duration: 210,
          delay: stagger(30, { start: 170 }),
          ease: MOTION_EASE.default,
        });
      }
    };

    const parentDetails = root.closest("details");
    if (parentDetails && !parentDetails.open) {
      const onToggle = () => {
        if (parentDetails.open) {
          hasPlayed = false;
          playGovernanceReveal();
        }
      };
      parentDetails.addEventListener("toggle", onToggle);
      return () => parentDetails.removeEventListener("toggle", onToggle);
    }

    onScroll({
      target: root,
      onEnterForward: () => {
        playGovernanceReveal();
      },
    });
  }, []);

  return (
    <div ref={rootRef} className="space-y-5">
      {/* Pillar Coverage & Trajectory Context Strip */}
      <div className="rounded-sm border border-shell/12 bg-paper p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-shell/[0.08] pb-2.5">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-moss">
            ✦ Quantitative Stream Coverage ({available.length} of {scoreList.length} Scored)
          </span>
          <span className="font-mono text-[9px] uppercase tracking-wider text-ink-faint">
            0–100 Evidence Density Index
          </span>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {scoreList.map(([label, item], idx) => {
            const pct = item.value !== null ? Math.min(100, Math.max(4, item.value)) : 0;
            return (
              <div key={label} className="rounded border border-shell/[0.08] bg-white/60 p-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-mute-dim">
                    {label}
                  </span>
                  <span
                    data-anim-gov-score={idx}
                    className="font-mono text-xs font-bold text-ink-strong"
                  >
                    {item.value === null ? "N/A" : `${item.value} / 100`}
                  </span>
                </div>
                {item.value !== null ? (
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-shell/10">
                    <div
                      data-anim-gov-bar={idx}
                      className="h-full rounded-full bg-moss origin-left"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                ) : (
                  <div className="mt-1.5 font-mono text-[9px] uppercase text-ink-faint">
                    Unverified in this run
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p className="mt-2.5 text-[11px] leading-relaxed text-mute-dim">{trajectory}</p>
      </div>

      <div className="grid gap-4 sm:gap-6 md:grid-cols-3">
        {/* Column 1: Operating Frame Considerations */}
        <div
          data-anim="consideration-col"
          className="rounded-sm border border-shell/12 bg-paper p-4 sm:p-5 shadow-sm"
        >
          <div className="flex items-center gap-2 border-b border-shell/10 pb-3">
            <span className="h-2 w-2 rounded-full bg-moss" />
            <h4 className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-moss">
              ✦ Horizon Considerations
            </h4>
          </div>
          <ul className="mt-4 space-y-3.5">
            {considerations.forStyle.map((item, index) => (
              <li
                key={index}
                data-anim="consideration-item"
                className="flex items-start gap-2.5 text-xs leading-relaxed text-ink-body"
              >
                <span className="font-mono text-[11px] font-bold text-moss">0{index + 1}</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Column 2: Invalidation Criteria */}
        <div
          data-anim="consideration-col"
          className="rounded-sm border border-shell/12 bg-paper p-4 sm:p-5 shadow-sm"
        >
          <div className="flex items-center gap-2 border-b border-shell/10 pb-3">
            <span className="h-2 w-2 rounded-full bg-alert-alt" />
            <h4 className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-warn">
              ✦ Invalidation Triggers
            </h4>
          </div>
          <ul className="mt-4 space-y-3.5">
            {considerations.invalidation.map((item, index) => (
              <li
                key={index}
                data-anim="consideration-item"
                className="flex items-start gap-2.5 text-xs leading-relaxed text-ink-body"
              >
                <span className="font-mono text-[11px] font-bold text-warn">✕</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Column 3: Deliberative Questions */}
        <div
          data-anim="consideration-col"
          className="rounded-sm border border-shell/12 bg-paper p-4 sm:p-5 shadow-sm"
        >
          <div className="flex items-center gap-2 border-b border-shell/10 pb-3">
            <span className="h-2 w-2 rounded-full bg-slate" />
            <h4 className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-slate">
              ✦ Deliberative Questions
            </h4>
          </div>
          <ul className="mt-4 space-y-3.5">
            {considerations.questions.map((item, index) => (
              <li
                key={index}
                data-anim="consideration-item"
                className="flex items-start gap-2.5 text-xs leading-relaxed text-ink-body"
              >
                <span className="font-mono text-[11px] font-bold text-slate">?</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
