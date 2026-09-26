import { fmtMoney } from "../http";
import { secAtomHeadlines, secSnapshot } from "../providers/sec";
import { simfinFundamentalsSummary } from "../providers/simfin";
import type { FundamentalsPillar } from "../types";
import type { NameCard } from "../universe";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

// EDGAR reports fiscalYearEnd as a bare MMDD string ("0926" for a late-September
// close), which is unreadable in trader-facing prose. Render it as a month plus
// day, and fall back to the raw value for anything that is not a 4-digit MMDD so
// no information is invented.
function formatFiscalYearEnd(raw: string | undefined): string {
  const value = raw?.trim();
  if (!value) return "unknown";
  if (!/^\d{4}$/.test(value)) return value;
  const month = Number(value.slice(0, 2));
  const day = Number(value.slice(2, 4));
  if (month < 1 || month > 12 || day < 1 || day > 31) return value;
  return `${MONTHS[month - 1]} ${day}`;
}

export async function runFundamentals(name: NameCard): Promise<FundamentalsPillar> {
  try {
    const [snap, atom, simfin] = await Promise.all([
      name.cik ? secSnapshot(name.cik).catch(() => null) : Promise.resolve(null),
      name.cik ? secAtomHeadlines(name.cik).catch(() => []) : Promise.resolve([]),
      simfinFundamentalsSummary(name.native).catch(() => null),
    ]);

    if (!snap && !simfin) {
      const reason = !name.cik
        ? "No SEC CIK mapping is available for this symbol and external fundamental provider (SimFin) was unavailable."
        : "SEC EDGAR and SimFin fundamentals were unreachable this run.";
      return {
        ok: false,
        error: reason,
        company: name.name,
        ticker: name.native,
        latestFilings: [],
        catalysts: [],
        notes: [
          !name.cik
            ? "SEC fundamentals are unavailable for this symbol; synthesis should rely on the other retrieved pillars."
            : "Fundamentals degraded to empty. Synthesis should lean on headlines only.",
          !process.env.SIMFIN_API_KEY
            ? "SimFin unavailable: SIMFIN_API_KEY is not configured."
            : "SimFin fundamentals returned no data or reached rate limit this run.",
        ],
        sources: [
          ...(!name.cik ? [{ label: "SEC EDGAR unavailable for this symbol" }] : []),
        ],
      };
    }

    const company = snap?.name || simfin?.companyInfo?.name || name.name;
    const sector = name.sector || simfin?.companyInfo?.sector;

    const catalysts: string[] = [];
    if (snap) {
      for (const f of snap.filings) {
        if (f.form.startsWith("8-K")) {
          catalysts.push(`${f.filed}: ${f.form}${f.title ? ` — ${f.title}` : ""}`);
        }
      }
      for (const t of atom) {
        if (!catalysts.some((c) => c.includes(t.slice(0, 24)))) catalysts.push(t);
      }
    }

    // Resolve EPS: prefer primary SEC XBRL, fallback to SimFin
    const eps = snap?.eps
      ? {
          value: snap.eps.value,
          periodEnd: snap.eps.periodEnd,
          form: snap.eps.form,
          filed: snap.eps.filed,
          frame: snap.eps.frame,
          prior: snap.eps.prior,
        }
      : simfin?.eps !== undefined
        ? {
            value: simfin.eps,
            periodEnd: simfin.reportDate ?? "unknown",
            form: simfin.period ? `SimFin ${simfin.period}` : "SimFin Statement",
            filed: simfin.reportDate ?? "unknown",
            prior: simfin.priorIncome?.eps,
          }
        : undefined;

    // Resolve Revenue: prefer primary SEC XBRL, fallback to SimFin
    const revenue = snap?.revenue
      ? {
          value: snap.revenue.value,
          periodEnd: snap.revenue.periodEnd,
          form: snap.revenue.form,
          filed: snap.revenue.filed,
          frame: snap.revenue.frame,
        }
      : simfin?.revenue !== undefined
        ? {
            value: simfin.revenue,
            periodEnd: simfin.reportDate ?? "unknown",
            form: simfin.period ? `SimFin ${simfin.period}` : "SimFin Statement",
            filed: simfin.reportDate ?? "unknown",
          }
        : undefined;

    const notes: string[] = [];
    if (snap?.eps) {
      const delta = snap.eps.prior !== undefined ? ` vs prior reported ${snap.eps.prior}` : "";
      notes.push(
        `Latest diluted EPS in SEC XBRL: ${snap.eps.value} for period ending ${snap.eps.periodEnd} (${snap.eps.form} filed ${snap.eps.filed})${delta}.`,
      );
    } else if (simfin?.eps !== undefined) {
      const priorDelta =
        simfin.priorIncome?.eps !== undefined ? ` vs prior ${simfin.priorIncome.eps}` : "";
      notes.push(
        `SimFin reported diluted EPS: ${simfin.eps} for period ${simfin.period ?? "latest"} (${simfin.reportDate ?? "Statement"})${priorDelta}.`,
      );
    } else {
      notes.push("Full EPS series was unavailable; falling back to filings list and earnings-language headlines.");
    }

    if (snap?.revenue) {
      notes.push(
        `Latest revenue tag ${snap.revenue.tag}: ${fmtMoney(snap.revenue.value)} for period ending ${snap.revenue.periodEnd} (${snap.revenue.form} filed ${snap.revenue.filed}).`,
      );
    } else if (simfin?.revenue !== undefined) {
      notes.push(
        `SimFin standardized revenue: ${fmtMoney(simfin.revenue)} for period ${simfin.period ?? "latest"} (${simfin.reportDate ?? "Statement"}).`,
      );
    }

    if (snap) {
      notes.push(
        `Fiscal year end on file: ${formatFiscalYearEnd(snap.fiscalYearEnd)}. Upcoming catalysts are inferred from recent 8-Ks, not from a paid calendar.`,
      );
    } else {
      notes.push("SEC CIK filings unavailable for this symbol; fundamental context provided via SimFin.");
    }

    if (simfin && (simfin.revenue !== undefined || simfin.netIncome !== undefined)) {
      const parts: string[] = [];
      if (simfin.revenue !== undefined) parts.push(`Revenue ${fmtMoney(simfin.revenue)}`);
      if (simfin.netIncome !== undefined) parts.push(`Net Income ${fmtMoney(simfin.netIncome)}`);
      if (simfin.grossMargin !== undefined) parts.push(`Gross margin ${(simfin.grossMargin * 100).toFixed(1)}%`);
      if (simfin.operatingMargin !== undefined) parts.push(`Operating margin ${(simfin.operatingMargin * 100).toFixed(1)}%`);
      if (simfin.freeCashFlow !== undefined) parts.push(`FCF ${fmtMoney(simfin.freeCashFlow)}`);
      if (parts.length > 0) {
        const periodLabel = simfin.period ? ` (${simfin.period}${simfin.fiscalYear ? ` ${simfin.fiscalYear}` : ""})` : "";
        notes.push(`SimFin key metrics${periodLabel}: ${parts.join(" · ")}.`);
      }
    }

    if (!process.env.SIMFIN_API_KEY) {
      notes.push("SimFin provider unavailable: SIMFIN_API_KEY is not configured.");
    } else if (!simfin) {
      notes.push("SimFin provider returned no usable records or reached rate limit this run.");
    }

    const sources = [
      ...(snap && name.cik
        ? [
            {
              label: "SEC EDGAR submissions",
              url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${name.cik}`,
            },
            { label: "SEC companyconcept XBRL" },
          ]
        : []),
      ...(simfin
        ? [
            {
              label: "SimFin standardized financial statements",
              url: `https://app.simfin.com/companies/${name.native}`,
            },
          ]
        : []),
    ];

    const simfinData = simfin
      ? {
          revenue: simfin.revenue,
          netIncome: simfin.netIncome,
          operatingIncome: simfin.operatingIncome,
          grossProfit: simfin.grossProfit,
          eps: simfin.eps,
          grossMargin: simfin.grossMargin,
          operatingMargin: simfin.operatingMargin,
          netMargin: simfin.netMargin,
          freeCashFlow: simfin.freeCashFlow,
          period: simfin.period,
          fiscalYear: simfin.fiscalYear,
          reportDate: simfin.reportDate,
        }
      : undefined;

    return {
      ok: true,
      company,
      ticker: name.native,
      fiscalYearEnd: snap?.fiscalYearEnd ? formatFiscalYearEnd(snap.fiscalYearEnd) : undefined,
      sector,
      latestFilings: snap?.filings ?? [],
      eps,
      revenue,
      simfin: simfinData,
      catalysts: catalysts.slice(0, 6),
      notes,
      sources,
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
