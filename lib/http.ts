const YAHOO_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const SEC_UA = "PrecedentResearch/0.1 (Bitget Hackathon S2; research workbench)";

type CacheEntry = { expires: number; value: unknown };
const cache = new Map<string, CacheEntry>();

export async function fetchText(
  url: string,
  opts: { headers?: Record<string, string>; timeoutMs?: number; cacheTtlMs?: number } = {},
): Promise<string> {
  const ttl = opts.cacheTtlMs ?? 0;
  if (ttl > 0) {
    const hit = cache.get(url);
    if (hit && hit.expires > Date.now()) return hit.value as string;
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 12_000);
  try {
    const res = await fetch(url, {
      headers: opts.headers,
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
    const text = await res.text();
    if (ttl > 0) cache.set(url, { expires: Date.now() + ttl, value: text });
    return text;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJson<T>(
  url: string,
  opts: { headers?: Record<string, string>; timeoutMs?: number; cacheTtlMs?: number } = {},
): Promise<T> {
  const text = await fetchText(url, opts);
  return JSON.parse(text) as T;
}

export function yahooHeaders(): Record<string, string> {
  return { "User-Agent": YAHOO_UA, Accept: "application/json,text/plain,*/*" };
}

export function secHeaders(): Record<string, string> {
  return { "User-Agent": SEC_UA, Accept: "application/json" };
}

export function fmtMoney(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function fmtPct(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "n/a";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(digits)}%`;
}

export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}
