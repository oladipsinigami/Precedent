import { fetchJson } from "../http";

export type SimFinCompactSection = {
  statement?: string;
  columns: string[];
  data: (string | number | null)[][];
};

export type SimFinCompanyInfo = {
  simFinId?: number;
  ticker: string;
  name?: string;
  industryId?: number;
  sector?: string;
  industry?: string;
  country?: string;
  raw?: Record<string, unknown>;
};

export type SimFinStatementItem = {
  ticker: string;
  statement: string; // "PL" | "BS" | "CF" | "DERIVED"
  fiscalYear?: number;
  period?: string; // "Q1" | "Q2" | "Q3" | "Q4" | "FY"
  reportDate?: string;
  revenue?: number;
  grossProfit?: number;
  operatingIncome?: number;
  netIncome?: number;
  eps?: number;
  totalAssets?: number;
  totalLiabilities?: number;
  totalEquity?: number;
  operatingCashFlow?: number;
  capitalExpenditures?: number;
  freeCashFlow?: number;
  raw: Record<string, unknown>;
};

export type SimFinFundamentalsSummary = {
  companyInfo?: SimFinCompanyInfo;
  latestIncome?: SimFinStatementItem;
  priorIncome?: SimFinStatementItem;
  latestBalanceSheet?: SimFinStatementItem;
  latestCashFlow?: SimFinStatementItem;
  revenue?: number;
  netIncome?: number;
  grossProfit?: number;
  operatingIncome?: number;
  eps?: number;
  grossMargin?: number;
  operatingMargin?: number;
  netMargin?: number;
  period?: string;
  fiscalYear?: number;
  reportDate?: string;
  freeCashFlow?: number;
};

/**
 * Normalizes input tickers or tokenized stock symbols (e.g. "rAAPL", "AAPLUSDT", "RAAPLUSDT")
 * to the underlying US equity ticker (e.g. "AAPL").
 */
export function normalizeTicker(symbol: string): string {
  let clean = symbol.trim().toUpperCase();
  clean = clean.replace(/USDT$/, "");
  if (/^R[A-Z]{1,5}$/.test(clean)) {
    return clean.slice(1);
  }
  return clean;
}

function findNumber(obj: Record<string, unknown>, keys: string[]): number | undefined {
  const normKeys = keys.map((k) => k.toLowerCase().replace(/[^a-z0-9]/g, ""));
  for (const [k, v] of Object.entries(obj)) {
    const normK = k.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (normKeys.includes(normK)) {
      const num = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
      if (!Number.isNaN(num)) return num;
    }
  }
  return undefined;
}

function findString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  const normKeys = keys.map((k) => k.toLowerCase().replace(/[^a-z0-9]/g, ""));
  for (const [k, v] of Object.entries(obj)) {
    const normK = k.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (normKeys.includes(normK) && v !== null && v !== undefined) {
      const s = String(v).trim();
      if (s) return s;
    }
  }
  return undefined;
}

/**
 * Internal helper to query SimFin API v3 endpoints.
 * Degrades gracefully when SIMFIN_API_KEY is not configured or on rate limits.
 */
async function fetchSimFin<T>(
  path: string,
  extraParams: Record<string, string | number | undefined> = {},
): Promise<T | null> {
  const apiKey = process.env.SIMFIN_API_KEY;
  if (!apiKey) return null;

  const queryParams = new URLSearchParams();
  for (const [k, v] of Object.entries(extraParams)) {
    if (v !== undefined) queryParams.set(k, String(v));
  }
  const qs = queryParams.toString();
  const url = `https://backend.simfin.com/api/v3/${path}${qs ? `?${qs}` : ""}`;

  try {
    const data = await fetchJson<T>(url, {
      headers: {
        Authorization: apiKey,
        Accept: "application/json",
      },
      timeoutMs: 8_000,
      cacheTtlMs: 300_000,
    });
    if (data && typeof data === "object" && "error" in (data as Record<string, unknown>)) {
      console.warn("[simfin] API returned error message:", (data as Record<string, unknown>).error);
      return null;
    }
    return data;
  } catch (err) {
    console.warn(`[simfin] ${path} fetch failed:`, err instanceof Error ? err.message : err);
    return null;
  }
}

function parseCompactStatementItems(json: unknown): SimFinStatementItem[] {
  const results: SimFinStatementItem[] = [];
  if (!json) return results;

  type CompanyWithStatements = {
    ticker?: string;
    statements?: SimFinCompactSection[];
  };

  const compList: (CompanyWithStatements | SimFinCompactSection)[] = Array.isArray(json)
    ? (json as (CompanyWithStatements | SimFinCompactSection)[])
    : typeof json === "object"
      ? [json as (CompanyWithStatements | SimFinCompactSection)]
      : [];

  for (const comp of compList) {
    if (!comp) continue;
    const compTicker = "ticker" in comp && typeof comp.ticker === "string" ? comp.ticker : "";
    const sections: SimFinCompactSection[] =
      "statements" in comp && Array.isArray(comp.statements)
        ? comp.statements
        : "columns" in comp && Array.isArray(comp.columns)
          ? [comp as SimFinCompactSection]
          : [];

    for (const sec of sections) {
      if (!sec || !Array.isArray(sec.columns) || !Array.isArray(sec.data)) continue;
      const stmtType = (sec.statement ?? "").toUpperCase();
      const cols = sec.columns;
      for (const row of sec.data) {
        if (!Array.isArray(row)) continue;
        const rowObj: Record<string, unknown> = {};
        for (let i = 0; i < cols.length; i++) {
          const c = cols[i];
          if (c) rowObj[c] = row[i];
        }

        const ticker = findString(rowObj, ["Ticker", "symbol"]) || compTicker;
        const fiscalYear = findNumber(rowObj, ["Fiscal Year", "fyear", "Year"]);
        const period = findString(rowObj, ["Fiscal Period", "Period", "period"]);
        const reportDate = findString(rowObj, ["Report Date", "reportDate", "Date"]);

        const revenue = findNumber(rowObj, ["Revenue", "Sales", "Total Revenue", "Turnover"]);
        const grossProfit = findNumber(rowObj, ["Gross Profit", "Gross Margin"]);
        const operatingIncome = findNumber(rowObj, ["Operating Income (Loss)", "Operating Income", "Operating Profit"]);
        const netIncome = findNumber(rowObj, ["Net Income", "Net Income Available to Common Shareholders", "Net Income (Common)", "Net Profit"]);
        const eps = findNumber(rowObj, [
          "Diluted Earnings Per Share",
          "Earnings Per Share (Diluted)",
          "Diluted EPS",
          "EPS (Diluted)",
          "EPS",
          "Basic Earnings Per Share",
        ]);

        const totalAssets = findNumber(rowObj, ["Total Assets"]);
        const totalLiabilities = findNumber(rowObj, ["Total Liabilities"]);
        const totalEquity = findNumber(rowObj, ["Total Equity", "Total Stockholders Equity"]);

        const operatingCashFlow = findNumber(rowObj, [
          "Cash from Operating Activities",
          "Net Cash from Operating Activities",
          "Net Cash from Operations",
          "Cash Flow from Operations",
          "Operating Cash Flow",
        ]);
        const capitalExpenditures = findNumber(rowObj, [
          "Change in Fixed Assets & Intangibles",
          "Capital Expenditures",
          "CapEx",
        ]);
        const freeCashFlow =
          findNumber(rowObj, ["Free Cash Flow"]) ??
          (operatingCashFlow !== undefined && capitalExpenditures !== undefined
            ? operatingCashFlow - Math.abs(capitalExpenditures)
            : undefined);

        results.push({
          ticker,
          statement:
            stmtType ||
            (revenue !== undefined || netIncome !== undefined ? "PL" : totalAssets !== undefined ? "BS" : "CF"),
          fiscalYear,
          period,
          reportDate,
          revenue,
          grossProfit,
          operatingIncome,
          netIncome,
          eps,
          totalAssets,
          totalLiabilities,
          totalEquity,
          operatingCashFlow,
          capitalExpenditures,
          freeCashFlow,
          raw: rowObj,
        });
      }
    }
  }
  return results;
}

function parseCompactCompanyInfo(json: unknown, fallbackTicker: string): SimFinCompanyInfo | null {
  if (!json) return null;
  const items: SimFinCompactSection[] = Array.isArray(json)
    ? (json as SimFinCompactSection[])
    : typeof json === "object" && "columns" in (json as Record<string, unknown>)
      ? [json as SimFinCompactSection]
      : [];

  for (const item of items) {
    if (!item || !Array.isArray(item.columns) || !Array.isArray(item.data)) continue;
    const cols = item.columns;
    const row = item.data[0];
    if (!Array.isArray(row)) continue;
    const obj: Record<string, unknown> = {};
    for (let i = 0; i < cols.length; i++) {
      const c = cols[i];
      if (c) obj[c] = row[i];
    }
    return {
      simFinId: findNumber(obj, ["id", "SimFinId"]),
      ticker: findString(obj, ["ticker", "Ticker", "symbol"]) || fallbackTicker,
      name: findString(obj, ["name", "Company Name"]),
      industryId: findNumber(obj, ["sectorCode", "IndustryId"]),
      sector: findString(obj, ["industryName", "sectorName", "Sector", "sector"]),
      industry: findString(obj, ["sectorName", "industryName", "Industry", "industry"]),
      country: findString(obj, ["market", "Country", "country"]),
      raw: obj,
    };
  }
  return null;
}

/**
 * Fetches general company information by ticker symbol.
 */
export async function simfinCompanyInfo(symbol: string): Promise<SimFinCompanyInfo | null> {
  const ticker = normalizeTicker(symbol);
  if (!ticker) return null;

  const res = await fetchSimFin<unknown>("companies/general/compact", { ticker });
  return parseCompactCompanyInfo(res, ticker);
}

/**
 * Fetches standardized financial statements (PL, BS, CF) in compact format.
 */
export async function simfinStatements(
  symbol: string,
  opts: { statements?: string; period?: string; fyear?: string } = {},
): Promise<SimFinStatementItem[]> {
  const ticker = normalizeTicker(symbol);
  if (!ticker) return [];

  const res = await fetchSimFin<unknown>("companies/statements/compact", {
    ticker,
    statements: opts.statements ?? "PL,BS,CF",
    period: opts.period ?? "q1,q2,q3,q4,fy",
    fyear: opts.fyear,
  });

  return parseCompactStatementItems(res);
}

/**
 * High-level helper for the Fundamentals pillar: concurrently retrieves
 * company metadata, latest Profit & Loss statement, and key balance/cash metrics.
 */
export async function simfinFundamentalsSummary(
  symbol: string,
): Promise<SimFinFundamentalsSummary | null> {
  const apiKey = process.env.SIMFIN_API_KEY;
  if (!apiKey) return null;

  const ticker = normalizeTicker(symbol);
  if (!ticker) return null;

  try {
    const [info, stmts] = await Promise.all([
      simfinCompanyInfo(ticker).catch(() => null),
      simfinStatements(ticker, { statements: "PL,BS,CF" }).catch(() => []),
    ]);

    if (!info && (!stmts || stmts.length === 0)) {
      return null;
    }

    const plList = stmts.filter((s) => s.statement === "PL" || s.revenue !== undefined || s.netIncome !== undefined);
    const bsList = stmts.filter((s) => s.statement === "BS" || s.totalAssets !== undefined);
    const cfList = stmts.filter((s) => s.statement === "CF" || s.operatingCashFlow !== undefined);

    const periodWeight: Record<string, number> = {
      fy: 5,
      q4: 4,
      q3: 3,
      q2: 2,
      q1: 1,
      h2: 3.5,
      h1: 1.5,
    };
    const sortFn = (a: SimFinStatementItem, b: SimFinStatementItem) => {
      const yearA = a.fiscalYear ?? 0;
      const yearB = b.fiscalYear ?? 0;
      if (yearA !== yearB) return yearB - yearA;
      const pA = periodWeight[(a.period ?? "").toLowerCase()] ?? 0;
      const pB = periodWeight[(b.period ?? "").toLowerCase()] ?? 0;
      if (pA !== pB) return pB - pA;
      return (b.reportDate ?? "").localeCompare(a.reportDate ?? "");
    };

    plList.sort(sortFn);
    bsList.sort(sortFn);
    cfList.sort(sortFn);

    const latestIncome = plList[0];
    const priorIncome = plList[1];
    const latestBalanceSheet = bsList[0];
    const latestCashFlow = cfList[0];

    const revenue = latestIncome?.revenue;
    const netIncome = latestIncome?.netIncome;
    const grossProfit = latestIncome?.grossProfit;
    const operatingIncome = latestIncome?.operatingIncome;
    const eps = latestIncome?.eps;

    const grossMargin =
      revenue && revenue > 0 && grossProfit !== undefined ? grossProfit / revenue : undefined;
    const operatingMargin =
      revenue && revenue > 0 && operatingIncome !== undefined ? operatingIncome / revenue : undefined;
    const netMargin =
      revenue && revenue > 0 && netIncome !== undefined ? netIncome / revenue : undefined;

    return {
      companyInfo: info ?? undefined,
      latestIncome,
      priorIncome,
      latestBalanceSheet,
      latestCashFlow,
      revenue,
      netIncome,
      grossProfit,
      operatingIncome,
      eps,
      grossMargin,
      operatingMargin,
      netMargin,
      period: latestIncome?.period,
      fiscalYear: latestIncome?.fiscalYear,
      reportDate: latestIncome?.reportDate,
      freeCashFlow: latestCashFlow?.freeCashFlow,
    };
  } catch (err) {
    console.warn(`[simfin] simfinFundamentalsSummary error for ${ticker}:`, err instanceof Error ? err.message : err);
    return null;
  }
}
