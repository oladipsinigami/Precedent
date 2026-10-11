"use client";

import { animate, createDrawable, stagger, utils } from "animejs";
import { animateCountUp } from "@/lib/motion/count-up";
import { MOTION_EASE } from "@/lib/motion/tokens";
import { useAnimeScope } from "@/lib/motion/use-anime-scope";
import { LossPathChart } from "./LossPathChart";
import type { RiskPillar } from "@/lib/risk/risk-pillar";

interface RiskSectionProps {
  risk?: RiskPillar;
  runId?: number;
  animateResult?: boolean;
  recalibrationKey?: number;
}

const VERDICT_STYLE: Record<RiskPillar["verdict"], { chip: string; label: string }> = {
  FITS: { chip: "border-moss/35 bg-moss/10 text-moss-deep", label: "Fits your limit" },
  DOES_NOT_FIT: { chip: "border-alert/40 bg-alert/10 text-alert-deep", label: "Does not fit" },
  NO_LIMIT: { chip: "border-mute-dim/40 bg-mute-dim/10 text-ink-mute", label: "No loss limit supplied" },
  UNAVAILABLE: { chip: "border-mute-dim/40 bg-mute-dim/10 text-ink-mute", label: "Unavailable" },
};

const RISK_RULER_TICKS = 36;

function money(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

function pct(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function shareInside(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "not graded";
  return `${(value * 100).toFixed(0)}%`;
}

export function RiskSection({
  risk,
  runId = 0,
  animateResult = false,
  recalibrationKey = 0,
}: RiskSectionProps) {
  const shouldAnimate = Boolean(
    (animateResult || recalibrationKey > 0) &&
      risk &&
      risk.verdict !== "UNAVAILABLE",
  );

  const canAnimateCosts = Boolean(shouldAnimate && risk?.costs.ok);

  const { rootRef } = useAnimeScope<HTMLDivElement>(
    ({ root }) => {
      if (!shouldAnimate || !risk) return;

      const cards = root.querySelectorAll<HTMLElement>("[data-anim='risk-card']");
      if (cards.length > 0) {
        utils.set(cards, { opacity: 0, translateY: 5 });
        animate(cards, {
          opacity: [0, 1],
          translateY: [5, 0],
          duration: 240,
          delay: stagger(35, { start: 40 }),
          ease: MOTION_EASE.default,
        });
      }

      if (typeof risk.notionalUsd === "number" && Number.isFinite(risk.notionalUsd)) {
        animateCountUp(root.querySelector<HTMLElement>("[data-anim-count='notional-usd']"), {
          from: 0,
          to: risk.notionalUsd,
          decimals: 0,
          prefix: "$",
          useLocale: true,
          delay: 60,
        });
      }

      if (typeof risk.worstLossUsd === "number" && Number.isFinite(risk.worstLossUsd)) {
        animateCountUp(root.querySelector<HTMLElement>("[data-anim-count='worst-loss-usd']"), {
          from: 0,
          to: risk.worstLossUsd,
          decimals: 2,
          prefix: "$",
          useLocale: true,
          delay: 95,
        });
      }

      if (typeof risk.maxLossUsd === "number" && Number.isFinite(risk.maxLossUsd)) {
        animateCountUp(root.querySelector<HTMLElement>("[data-anim-count='max-loss-usd']"), {
          from: 0,
          to: risk.maxLossUsd,
          decimals: 0,
          prefix: "$",
          useLocale: true,
          delay: 130,
        });
      }

      const fittedVal = risk.sizing.largestFittingNotionalUsd;
      if (typeof fittedVal === "number" && Number.isFinite(fittedVal) && fittedVal > 0) {
        animateCountUp(root.querySelector<HTMLElement>("[data-anim-count='fitted-size-usd']"), {
          from: 0,
          to: fittedVal,
          decimals: 0,
          prefix: "$",
          useLocale: true,
          delay: 165,
        });
      }

      if (typeof risk.adverseMovePct === "number" && Number.isFinite(risk.adverseMovePct)) {
        animateCountUp(root.querySelector<HTMLElement>("[data-anim-count='adverse-move-pct']"), {
          from: 0,
          to: risk.adverseMovePct,
          decimals: 2,
          prefix: risk.adverseMovePct > 0 ? "+" : "",
          suffix: "%",
          delay: 140,
        });
      }

      const leaders = root.querySelectorAll<SVGGeometryElement>("[data-anim='risk-leader']");
      if (leaders.length > 0) {
        const drawable = createDrawable(leaders, 0, 0);
        animate(drawable, {
          draw: "0 1",
          duration: 360,
          delay: stagger(55, { start: 110 }),
          ease: MOTION_EASE.expo,
        });
      }

      const budgetBars = root.querySelectorAll<HTMLElement>("[data-anim='risk-budget-bar']");
      if (budgetBars.length > 0) {
        utils.set(budgetBars, { scaleX: 0, transformOrigin: "left center" });
        animate(budgetBars, {
          scaleX: [0, 1],
          duration: 380,
          delay: stagger(60, { start: 130 }),
          ease: MOTION_EASE.expo,
        });
      }

      const ticks = root.querySelectorAll<HTMLElement>("[data-anim='risk-ruler-tick']");
      if (ticks.length > 0) {
        utils.set(ticks, { scaleY: 0, opacity: 0, transformOrigin: "bottom center" });
        animate(ticks, {
          scaleY: [0, 1],
          opacity: [0, 1],
          duration: 210,
          delay: stagger(9, { start: 100 }),
          ease: MOTION_EASE.default,
        });
      }

      const eventRows = root.querySelectorAll<HTMLElement>("[data-anim='risk-event-row']");
      if (eventRows.length > 0) {
        utils.set(eventRows, { opacity: 0, translateY: 4 });
        animate(eventRows, {
          opacity: [0, 1],
          translateY: [4, 0],
          duration: 220,
          delay: stagger(30, { start: 180 }),
          ease: MOTION_EASE.default,
        });
      }

      if (canAnimateCosts) {
        const rtNode = root.querySelector<HTMLElement>("[data-anim-count='round-trip-bps']");
        animateCountUp(rtNode, {
          from: 0,
          to: risk.costs.roundTrip.costBps,
          decimals: 1,
          suffix: " bps",
          delay: 140,
        });

        if (risk.costs.spreadBps !== undefined && risk.costs.spreadBps !== null) {
          const spreadNode = root.querySelector<HTMLElement>("[data-anim-count='book-spread-bps']");
          animateCountUp(spreadNode, {
            from: 0,
            to: risk.costs.spreadBps,
            decimals: 2,
            suffix: " bps",
            delay: 165,
          });
        }
      }
    },
    [runId, recalibrationKey],
  );

  if (!risk || risk.verdict === "UNAVAILABLE") {
    return (
      <div className="rounded-sm border border-amber/35 bg-paper-alt px-4 py-5 sm:px-5" data-tour="tour-risk-unavailable">
        <div className="flex items-baseline justify-between gap-3">
          <h4 className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-amber-deep">
            ✦ Size not checked
          </h4>
          <span className="font-mono text-[10px] uppercase tracking-wider text-mute-dim">
            the verdict was withheld, not estimated
          </span>
        </div>
        <p className="mt-2.5 text-sm leading-relaxed text-ink-body">
          Precedent could not measure enough to say whether this size fits your loss limit, so it did not guess. Name the
          position size, the hold and the most you can lose, and the check runs again.
        </p>
        {risk?.unverified?.length ? (
          <ul className="mt-2.5 space-y-1 border-t border-shell/10 pt-2.5">
            {risk.unverified.map((item) => (
              <li key={item} className="text-[11px] leading-relaxed text-mute-dim">
                {item}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  const verdict = VERDICT_STYLE[risk.verdict];
  const fitted = risk.sizing.largestFittingNotionalUsd;
  const showFit = fitted !== null && fitted > 0;
  const costs = risk.costs;

  const hasBudgetRuler =
    risk.worstLossUsd !== null &&
    risk.maxLossUsd !== null &&
    risk.maxLossUsd > 0 &&
    Number.isFinite(risk.worstLossUsd) &&
    Number.isFinite(risk.maxLossUsd);

  const rawRatio = hasBudgetRuler ? (risk.worstLossUsd ?? 0) / (risk.maxLossUsd ?? 1) : 0;
  const clampedPct = Math.min(100, Math.max(2, rawRatio * 100));
  const isBreach = risk.verdict === "DOES_NOT_FIT" || rawRatio > 1;
  const activeTickIdx = Math.min(
    RISK_RULER_TICKS - 1,
    Math.max(0, Math.round((clampedPct / 100) * (RISK_RULER_TICKS - 1))),
  );
  const markerX = 40 + (clampedPct / 100) * 560;

  return (
    <div ref={rootRef} className="rounded-sm border border-shell/12 bg-paper shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-shell/10 px-4 py-3.5 sm:px-5">
        <h4 className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-moss-deep">
          ✦ Does this size survive the hold?
        </h4>
        <span
          className={`rounded-sm border px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider ${verdict.chip}`}
        >
          {verdict.label}
        </span>
      </div>

      <div className="space-y-4 px-4 py-4 sm:px-5">
        <p className="text-sm leading-relaxed text-ink-strong">{risk.verdictSentence}</p>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric
            label="Your size"
            value={money(risk.notionalUsd)}
            countHook="notional-usd"
          />
          <Metric
            label="Worst measured loss"
            value={money(risk.worstLossUsd, 2)}
            tone={risk.worstLossUsd !== null && risk.maxLossUsd !== null && risk.worstLossUsd > risk.maxLossUsd ? "bad" : "good"}
            countHook="worst-loss-usd"
          />
          <Metric
            label="Your loss limit"
            value={risk.maxLossUsd === null ? "not supplied" : money(risk.maxLossUsd)}
            countHook={risk.maxLossUsd !== null ? "max-loss-usd" : undefined}
          />
          <Metric
            label={showFit ? "Size that fits" : "Fitted size"}
            value={showFit ? money(fitted) : risk.sizing.ok ? "no limit set" : "unavailable"}
            tone={showFit ? "good" : "neutral"}
            countHook={showFit ? "fitted-size-usd" : undefined}
          />
        </div>

        {/* Loss-Budget & Sizing Capacity Ruler Scrubber (renders on 1-session & multi-session holds) */}
        {hasBudgetRuler && (
          <div className="rounded-sm border border-shell/15 bg-paper-alt p-3.5 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className={`h-1.5 w-1.5 rounded-full ${isBreach ? "bg-alert-deep" : "bg-moss"}`} />
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-shell">
                  Loss-Budget Utilization & Sizing Envelope
                </span>
              </div>
              <span className="font-mono text-[10px] text-mute-dim">
                {(rawRatio * 100).toFixed(1)}% of {money(risk.maxLossUsd)} limit consumed
              </span>
            </div>

            {/* Technical Leader-Line Callout SVG */}
            <div className="mt-2 overflow-hidden">
              <svg
                viewBox="0 0 640 54"
                className="h-auto w-full select-none"
                role="img"
                aria-label="Loss budget utilization callout schematic"
              >
                {/* Baseline track */}
                <line
                  x1="40"
                  y1="44"
                  x2="600"
                  y2="44"
                  stroke="var(--c-shell)"
                  strokeOpacity="0.2"
                  strokeWidth="1"
                />
                {/* Callout elbow from Worst Measured Loss point */}
                <path
                  data-anim="risk-leader"
                  d={`M ${markerX.toFixed(1)} 44 L ${markerX.toFixed(1)} 22 L ${Math.min(480, markerX + 26).toFixed(1)} 12 L ${Math.min(510, markerX + 120).toFixed(1)} 12`}
                  fill="none"
                  stroke={isBreach ? "var(--c-alert-deep)" : "var(--c-moss-deep)"}
                  strokeWidth="1.3"
                />
                <circle
                  cx={markerX}
                  cy="44"
                  r="3.2"
                  fill={isBreach ? "var(--c-alert-deep)" : "var(--c-moss)"}
                />
                <text
                  x={Math.min(512, markerX + 30)}
                  y="9"
                  fontFamily="monospace"
                  fontSize="9.5"
                  fontWeight="bold"
                  fill={isBreach ? "var(--c-alert-deep)" : "var(--c-moss-deep)"}
                >
                  worst loss {money(risk.worstLossUsd, 2)} ({(rawRatio * 100).toFixed(1)}%)
                </text>

                {/* Callout elbow at 100% Loss Limit right boundary */}
                <path
                  data-anim="risk-leader"
                  d="M 600 44 L 600 22 L 584 12 L 525 12"
                  fill="none"
                  stroke="var(--c-shell)"
                  strokeOpacity="0.55"
                  strokeWidth="1.1"
                />
                <circle cx="600" cy="44" r="2.6" fill="var(--c-shell)" />
                <text
                  x="600"
                  y="36"
                  textAnchor="end"
                  fontFamily="monospace"
                  fontSize="9"
                  fill="var(--c-ink-faint)"
                >
                  limit {money(risk.maxLossUsd)}
                </text>
              </svg>
            </div>

            {/* Proportional ScaleX Fill Bar */}
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-shell/12">
              <div
                data-anim="risk-budget-bar"
                className={`h-full rounded-full ${isBreach ? "bg-alert-deep" : "bg-moss"}`}
                style={{ width: `${clampedPct}%` }}
              />
            </div>

            {/* Dark-Pill Tick Scrubber Ruler (inspired by animejs.com) */}
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 rounded-full bg-shell px-3.5 py-1.5 shadow-inner overflow-x-auto">
                <span className="font-mono text-[9px] uppercase tracking-widest text-slate-text shrink-0">
                  $0
                </span>
                <div className="flex items-end gap-[3px] h-3">
                  {Array.from({ length: RISK_RULER_TICKS }).map((_, idx) => {
                    const isCurrent = idx === activeTickIdx;
                    const isFilled = idx < activeTickIdx;
                    return (
                      <span
                        key={idx}
                        data-anim="risk-ruler-tick"
                        className={`w-[1.5px] rounded-full ${
                          isCurrent
                            ? isBreach
                              ? "h-3 bg-alert shadow-[0_0_6px_var(--c-alert)]"
                              : "h-3 bg-lime shadow-[0_0_6px_var(--c-lime)]"
                            : isFilled
                              ? isBreach
                                ? "h-2 bg-alert/65"
                                : "h-2 bg-lime/60"
                              : idx % 6 === 0
                                ? "h-2 bg-white/35"
                                : "h-1.5 bg-white/15"
                        }`}
                      />
                    );
                  })}
                </div>
                <span className="font-mono text-[9px] uppercase tracking-widest text-slate-text shrink-0">
                  {money(risk.maxLossUsd)}
                </span>
              </div>

              {showFit && risk.notionalUsd !== null && (
                <div className="font-mono text-[10px] text-mute-dim">
                  <span>Sizing headroom: </span>
                  <span className="font-bold text-ink-strong">
                    {money(risk.notionalUsd)} used of {money(fitted)} max fitting notional
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        <dl className="grid gap-x-6 gap-y-2 border-t border-shell/10 pt-3 text-[11px] leading-relaxed sm:grid-cols-2">
          <Row label="Hold">
            {risk.window.from && risk.window.to
              ? `${risk.window.from} to ${risk.window.to} · ${risk.holdSessions} session${risk.holdSessions === 1 ? "" : "s"}`
              : "not resolved"}
          </Row>
          <Row label="Adverse move">
            <span data-anim-count="adverse-move-pct">{pct(risk.adverseMovePct)}</span>
            {` — ${risk.adverseDriver}`}
          </Row>
          <Row label="Hold range">
            {risk.ordinary.status === "NO_DATA"
              ? "not enough clean history in this run"
              : `±${risk.ordinary.boundaryPct.toFixed(2)}% · ${shareInside(risk.ordinary.shareInside)} held out of sample against an 80% target (${risk.ordinary.status === "HOLDS" ? "on target" : "below target"})`}
          </Row>
          <Row label="Round-trip cost">
            {costs.ok ? (
              <>
                <span data-anim-count="round-trip-bps">{costs.roundTrip.costBps.toFixed(1)} bps</span>{" "}
                {`(${money(costs.roundTrip.costUsd, 2)}) on ${money(costs.notionalUsd)} notional`}
              </>
            ) : (
              "order book unavailable — cost excluded rather than assumed"
            )}
          </Row>
        </dl>

        {risk.path.length > 1 && (
          <div className="border-t border-shell/10 pt-3">
            <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-wider text-mute-dim">
              Where the limit breaks
            </p>
            <LossPathChart risk={risk} runId={runId} recalibrationKey={recalibrationKey} />
          </div>
        )}

        {risk.scheduled.length > 0 && (
          <div className="border-t border-shell/10 pt-3">
            <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-mute-dim">
              Scheduled inside the hold
            </p>
            <ul className="mt-2 space-y-1.5">
              {risk.scheduled.slice(0, 8).map((event) => (
                <li
                  key={`${event.kind}-${event.date}-${event.label}`}
                  data-anim="risk-event-row"
                  className="flex items-baseline justify-between gap-3 text-[11px] text-ink-body"
                >
                  <span className="min-w-0 truncate">
                    <span className="font-mono text-[10px] uppercase text-mute-dim">{event.date}</span> {event.label}
                  </span>
                  <span className="shrink-0 font-mono text-[10px] text-mute-dim">{event.source}</span>
                </li>
              ))}
              {risk.scheduled.length > 8 && (
                <li className="text-[11px] italic text-mute-dim">
                  and {risk.scheduled.length - 8} more dated events inside this hold
                </li>
              )}
            </ul>
          </div>
        )}

        {risk.severities.length > 0 && (
          <div className="border-t border-shell/10 pt-3">
            <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-mute-dim">
              Measured severity of each event kind
            </p>
            <ul className="mt-2 space-y-1.5">
              {risk.severities.map((severity) => (
                <li
                  key={severity.kind}
                  className="flex items-baseline justify-between gap-3 text-[11px] text-ink-body"
                >
                  <span>{severity.label}</span>
                  <span className="shrink-0 font-mono text-[10px] text-mute-dim">
                    ±{severity.measuredPct.toFixed(2)}% · {severity.sampleN} past ·{" "}
                    {severity.coverage.status === "HOLDS"
                      ? "on target"
                      : severity.coverage.status === "SHORT_OF_TARGET"
                        ? "below target"
                        : "not graded"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {costs.ok && costs.top10DepthUsd && (
          <p className="border-t border-shell/10 pt-3 text-[11px] leading-relaxed text-ink-mute">
            Walked the live {costs.venue} book at {money(costs.notionalUsd)}: spread{" "}
            <span data-anim-count="book-spread-bps">{(costs.spreadBps ?? 0).toFixed(2)} bps</span>, top ten levels
            holding {money(costs.top10DepthUsd.ask)} on the ask side, fee{" "}
            {costs.feeSchedule ? `${costs.feeSchedule.takerBps} bps taker` : "applied per venue tier"}. Book stamped{" "}
            {costs.bookAsOf}.
          </p>
        )}

        {/* Deliberately static per Rule #2: unverified caveats never animate */}
        {risk.unverified.length > 0 && (
          <div className="border-t border-shell/10 pt-3">
            <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-warn">
              Not verified in this run
            </p>
            <ul className="mt-1.5 space-y-1">
              {risk.unverified.map((item) => (
                <li key={item} className="text-[11px] leading-relaxed text-warn-deep">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="border-t border-shell/10 pt-3 text-[11px] italic leading-relaxed text-mute-dim">
          Every figure here is a measured distribution, not a forecast. Precedent does not predict prices or tell you what
          to buy. You decide.
        </p>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  tone = "neutral",
  countHook,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad" | "neutral";
  countHook?: string;
}) {
  const valueTone = tone === "bad" ? "text-alert-deep" : tone === "good" ? "text-moss-deep" : "text-ink-strong";
  return (
    <div data-anim="risk-card" className="rounded-sm border border-shell/12 bg-paper-alt px-3 py-2.5">
      <div className="font-mono text-[9px] font-bold uppercase tracking-wider text-mute-dim">{label}</div>
      <div data-anim-count={countHook} className={`mt-1 font-mono text-sm font-semibold ${valueTone}`}>
        {value}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-wider text-mute-dim">{label}</dt>
      <dd className="min-w-0 text-ink-body">{children}</dd>
    </div>
  );
}
