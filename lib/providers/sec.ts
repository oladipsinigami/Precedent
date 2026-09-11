import { fetchJson, fetchText, secHeaders } from "../http";

type Submissions = {
  name: string;
  cik: string;
  fiscalYearEnd?: string;
  sicDescription?: string;
  tickers?: string[];
  filings: {
    recent: {
      accessionNumber: string[];
      filingDate: string[];
      reportDate: string[];
      form: string[];
      primaryDocument: string[];
      primaryDocDescription: string[];
    };
  };
};

type Concept = {
  tag?: string;
  units: Record<string, { val: number; end: string; filed: string; form: string; frame?: string; fp?: string }[]>;
};

const REVENUE_TAGS = [
  "RevenueFromContractWithCustomerExcludingAssessedTax",
  "Revenues",
  "SalesRevenueNet",
];

function padCik(cik: string): string {
  return cik.replace(/\D/g, "").padStart(10, "0");
}

function accessionUrl(cik: string, accession: string, doc: string): string {
  const bare = accession.replace(/-/g, "");
  return `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${bare}/${doc}`;
}

export async function secSnapshot(cik: string) {
  const padded = padCik(cik);
  const sub = await fetchJson<Submissions>(`https://data.sec.gov/submissions/CIK${padded}.json`, {
    headers: secHeaders(),
    cacheTtlMs: 10 * 60_000,
    timeoutMs: 15_000,
  });
  const recent = sub.filings.recent;
  const filings = [];
  for (let i = 0; i < Math.min(recent.form.length, 40); i++) {
    const form = recent.form[i];
    if (!["10-K", "10-Q", "8-K", "8-K/A"].includes(form)) continue;
    filings.push({
      form,
      filed: recent.filingDate[i],
      reportDate: recent.reportDate[i],
      title: recent.primaryDocDescription[i],
      url: accessionUrl(sub.cik, recent.accessionNumber[i], recent.primaryDocument[i]),
    });
    if (filings.length >= 8) break;
  }

  const eps = await conceptLatest(padded, "EarningsPerShareDiluted", ["USD/shares", "USD"]);
  let revenue;
  for (const tag of REVENUE_TAGS) {
    revenue = await conceptLatest(padded, tag, ["USD"]);
    if (revenue) break;
  }

  return {
    name: sub.name,
    fiscalYearEnd: sub.fiscalYearEnd,
    sic: sub.sicDescription,
    filings,
    eps,
    revenue,
  };
}

async function conceptLatest(paddedCik: string, tag: string, unitKeys: string[]) {
  try {
    const data = await fetchJson<Concept>(
      `https://data.sec.gov/api/xbrl/companyconcept/CIK${paddedCik}/us-gaap/${tag}.json`,
      { headers: secHeaders(), cacheTtlMs: 30 * 60_000, timeoutMs: 12_000 },
    );
    const series = unitKeys.flatMap((k) => data.units[k] ?? []);
    const quarterly = series.filter((x) => x.form === "10-Q" || x.form === "10-K");
    const framed = quarterly.filter((x) => x.frame && /Q/.test(x.frame));
    const pool = framed.length ? framed : quarterly;
    if (!pool.length) return undefined;
    const last = pool[pool.length - 1];
    const prior = pool.length > 1 ? pool[pool.length - 2] : undefined;
    return {
      tag,
      value: last.val,
      periodEnd: last.end,
      form: last.form,
      filed: last.filed,
      frame: last.frame,
      prior: prior?.val,
    };
  } catch {
    return undefined;
  }
}

export async function secAtomHeadlines(cik: string): Promise<string[]> {
  try {
    const xml = await fetchText(
      `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${padCik(cik)}&type=8-K&count=8&output=atom`,
      { headers: secHeaders(), cacheTtlMs: 10 * 60_000 },
    );
    const titles = [...xml.matchAll(/<title>([^<]+)<\/title>/g)].map((m) => m[1]).slice(1, 6);
    return titles;
  } catch {
    return [];
  }
}
