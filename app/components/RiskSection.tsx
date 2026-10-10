"use client";

import { LossPathChart } from "./LossPathChart";
import type { RiskPillar } from "@/lib/risk/risk-pillar";

interface RiskSectionProps {
  risk?: RiskPillar;
}

const VERDICT_STYLE: Record<RiskPillar["verdict"], { chip: string; label: string }> = {
  FITS: { chip: "border-moss/35 bg-moss/10 text-moss-deep", label: "Fits your limit" },
  DOES_NOT_FIT: { chip: "border-alert/40 bg-alert/10 text-alert-deep", label: "Does not fit" },
  NO_LIMIT: { chip: "border-mute-dim/40 bg-mute-dim/10 text-ink-mute", label: "No loss limit supplied" },
  UNAVAILABLE: { chip: "border-mute-dim/40 bg-mute-dim/10 text-ink-mute", label: "Unavailable" },
};

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

export function RiskSection({ risk }: RiskSectionProps) {
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

  return (
    <div className="rounded-sm border border-shell/12 bg-paper shadow-sm">
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
          <Metric label="Your size" value={money(risk.notionalUsd)} />
          <Metric
            label="Worst measured loss"
            value={money(risk.worstLossUsd, 2)}
            tone={risk.worstLossUsd !== null && risk.maxLossUsd !== null && risk.worstLossUsd > risk.maxLossUsd ? "bad" : "good"}
          />
          <Metric label="Your loss limit" value={risk.maxLossUsd === null ? "not supplied" : money(risk.maxLossUsd)} />
          <Metric
            label={showFit ? "Size that fits" : "Fitted size"}
            value={showFit ? money(fitted) : risk.sizing.ok ? "no limit set" : "unavailable"}
            tone={showFit ? "good" : "neutral"}
          />
        </div>

        <dl className="grid gap-x-6 gap-y-2 border-t border-shell/10 pt-3 text-[11px] leading-relaxed sm:grid-cols-2">
          <Row label="Hold">
            {risk.window.from && risk.window.to
              ? `${risk.window.from} to ${risk.window.to} · ${risk.holdSessions} session${risk.holdSessions === 1 ? "" : "s"}`
              : "not resolved"}
          </Row>
          <Row label="Adverse move">{`${pct(risk.adverseMovePct)} — ${risk.adverseDriver}`}</Row>
          <Row label="Hold range">
            {risk.ordinary.status === "NO_DATA"
              ? "not enough clean history in this run"
              : `±${risk.ordinary.boundaryPct.toFixed(2)}% · ${shareInside(risk.ordinary.shareInside)} held out of sample against an 80% target (${risk.ordinary.status === "HOLDS" ? "on target" : "below target"})`}
          </Row>
          <Row label="Round-trip cost">
            {costs.ok
              ? `${costs.roundTrip.costBps.toFixed(1)} bps (${money(costs.roundTrip.costUsd, 2)}) on ${money(costs.notionalUsd)} notional`
              : "order book unavailable — cost excluded rather than assumed"}
          </Row>
        </dl>

        {risk.path.length > 1 && (
          <div className="border-t border-shell/10 pt-3">
            <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-wider text-mute-dim">
              Where the limit breaks
            </p>
            <LossPathChart risk={risk} />
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
            Walked the live {costs.venue} book at {money(costs.notionalUsd)}: spread {(costs.spreadBps ?? 0).toFixed(2)} bps,
            top ten levels holding {money(costs.top10DepthUsd.ask)} on the ask side, fee{" "}
            {costs.feeSchedule ? `${costs.feeSchedule.takerBps} bps taker` : "applied per venue tier"}. Book stamped{" "}
            {costs.bookAsOf}.
          </p>
        )}

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
}: {
  label: string;
  value: string;
  tone?: "good" | "bad" | "neutral";
}) {
  const valueTone = tone === "bad" ? "text-alert-deep" : tone === "good" ? "text-moss-deep" : "text-ink-strong";
  return (
    <div className="rounded-sm border border-shell/12 bg-paper-alt px-3 py-2.5">
      <div className="font-mono text-[9px] font-bold uppercase tracking-wider text-mute-dim">{label}</div>
      <div className={`mt-1 font-mono text-sm font-semibold ${valueTone}`}>{value}</div>
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
