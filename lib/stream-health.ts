import type { PillarBundle } from "./types";

export type StreamName = "fundamentals" | "technicals" | "news" | "analogs" | "marketStructure";

export type StreamState = {
  name: StreamName;
  label: string;
  status: "ok" | "degraded";
  reasons: string[];
};

export type StreamHealth = {
  usable: number;
  total: number;
  degraded: StreamName[];
  showBanner: boolean;
  headline: string;
  streams: StreamState[];
};

const LABELS: Record<StreamName, string> = {
  fundamentals: "fundamentals",
  technicals: "tape",
  news: "news",
  analogs: "analogs",
  marketStructure: "market structure",
};

function reasonsFor(name: StreamName, pillars: PillarBundle | null): string[] {
  if (!pillars) return ["stream data was not returned in this run"];
  const reasons: string[] = [];
  const add = (text: string | undefined | null) => {
    if (text && text.trim()) reasons.push(text.trim());
  };

  if (name === "marketStructure") {
    const ms = pillars.marketStructure;
    if (!ms?.ok) add(ms?.error);
    else if (ms.stale) {
      add(
        `stale snapshot (computed ${ms.computedAt ?? "at an earlier run"}); run npm run precompute to refresh`,
      );
    }
  }

  const pillar = pillars[name] as { ok?: boolean; error?: string; caveats?: string[] } | undefined;
  if (pillar) {
    if (!pillar.ok) add(pillar.error);
    // A stream that returned ok but logged caveats is still degraded: the
    // caveat is the reason a reader should not read it as complete.
    (pillar.caveats ?? []).forEach((caveat) => add(caveat));
  }

  return reasons;
}

export function buildStreamHealth(pillars: PillarBundle | null): StreamHealth {
  const names: StreamName[] = ["fundamentals", "technicals", "news", "analogs", "marketStructure"];

  const streams: StreamState[] = names.map((name) => {
    const reasons = reasonsFor(name, pillars);
    return {
      name,
      label: LABELS[name],
      status: reasons.length ? "degraded" : "ok",
      reasons,
    };
  });

  const degraded = streams.filter((s) => s.status === "degraded");
  const usable = streams.length - degraded.length;

  const headline = degraded.length
    ? `${usable} of ${streams.length} evidence streams usable. Degraded: ${degraded
        .map((s) => `${s.label}${s.reasons.length ? ` (${s.reasons[0]})` : ""}`)
        .join("; ")}`
    : `All ${streams.length} evidence streams returned usable data.`;

  return {
    usable,
    total: streams.length,
    degraded: degraded.map((s) => s.name),
    showBanner: degraded.length > 0,
    headline,
    streams,
  };
}