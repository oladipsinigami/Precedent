import { fmtMoney } from "../http";
import { secAtomHeadlines, secSnapshot } from "../providers/sec";
import type { FundamentalsPillar } from "../types";
import type { NameCard } from "../universe";

export async function runFundamentals(name: NameCard): Promise<FundamentalsPillar> {
  if (!name.cik) {
    return {
      ok: false,
      error: "No SEC CIK mapping is available for this Bitget RWA symbol.",
      company: name.name,
      ticker: name.native,
      latestFilings: [],
      catalysts: [],
      notes: ["SEC fundamentals are unavailable for this symbol; synthesis should rely on the other retrieved pillars."],
      sources: [{ label: "SEC EDGAR unavailable for this symbol" }],
    };
  }
  try {
    const [snap, atom] = await Promise.all([secSnapshot(name.cik), secAtomHeadlines(name.cik)]);
    const catalysts: string[] = [];
    for (const f of snap.filings) {
      if (f.form.startsWith("8-K")) {
        catalysts.push(`${f.filed}: ${f.form}${f.title ? ` — ${f.title}` : ""}`);
      }
    }
    for (const t of atom) {
      if (!catalysts.some((c) => c.includes(t.slice(0, 24)))) catalysts.push(t);
    }

    const notes: string[] = [];
    if (snap.eps) {
      const delta =
        snap.eps.prior !== undefined ? ` vs prior reported ${snap.eps.prior}` : "";
      notes.push(
        `Latest diluted EPS in SEC XBRL: ${snap.eps.value} for period ending ${snap.eps.periodEnd} (${snap.eps.form} filed ${snap.eps.filed})${delta}.`,
      );
    } else {
      notes.push("Full EPS series was unavailable; falling back to filings list and earnings-language headlines.");
    }
    if (snap.revenue) {
      notes.push(
        `Latest revenue tag ${snap.revenue.tag}: ${fmtMoney(snap.revenue.value)} for period ending ${snap.revenue.periodEnd} (${snap.revenue.form} filed ${snap.revenue.filed}).`,
      );
    }
    notes.push(
      `Fiscal year end on file: ${snap.fiscalYearEnd ?? "unknown"}. Upcoming catalysts are inferred from recent 8-Ks, not from a paid calendar.`,
    );

    return {
      ok: true,
      company: snap.name,
      ticker: name.native,
      fiscalYearEnd: snap.fiscalYearEnd,
      sector: name.sector,
      latestFilings: snap.filings,
      eps: snap.eps
        ? {
            value: snap.eps.value,
            periodEnd: snap.eps.periodEnd,
            form: snap.eps.form,
            filed: snap.eps.filed,
            frame: snap.eps.frame,
            prior: snap.eps.prior,
          }
        : undefined,
      revenue: snap.revenue
        ? {
            value: snap.revenue.value,
            periodEnd: snap.revenue.periodEnd,
            form: snap.revenue.form,
            filed: snap.revenue.filed,
            frame: snap.revenue.frame,
          }
        : undefined,
      catalysts: catalysts.slice(0, 6),
      notes,
      sources: [
        { label: "SEC EDGAR submissions", url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${name.cik}` },
        { label: "SEC companyconcept XBRL" },
      ],
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Fundamentals fetch failed",
      company: name.name,
      ticker: name.native,
      latestFilings: [],
      catalysts: [],
      notes: ["Fundamentals degraded to empty. Synthesis should lean on headlines only."],
      sources: [],
    };
  }
}
