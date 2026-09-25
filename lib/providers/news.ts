import { fetchText } from "../http";

export type Headline = {
  title: string;
  publisher: string;
  url: string;
  published?: string;
};

function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function parseRss(xml: string, limit = 8): Headline[] {
  const items = xml.split(/<item>/i).slice(1);
  const out: Headline[] = [];
  for (const item of items) {
    const title = item.match(/<title>([\s\S]*?)<\/title>/i)?.[1];
    const link = item.match(/<link>([\s\S]*?)<\/link>/i)?.[1];
    const pub = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1];
    const src = item.match(/<source[^>]*>([\s\S]*?)<\/source>/i)?.[1];
    if (!title || !link) continue;
    out.push({
      title: decode(title).trim(),
      publisher: decode(src ?? "RSS").trim(),
      url: decode(link).trim(),
      published: pub ? decode(pub).trim() : undefined,
    });
    if (out.length >= limit) break;
  }
  return out;
}

export async function googleNews(query: string): Promise<Headline[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
  try {
    const xml = await fetchText(url, { timeoutMs: 10_000, cacheTtlMs: 60_000 });
    return parseRss(xml, 8);
  } catch {
    return [];
  }
}

export async function yahooRss(symbol: string): Promise<Headline[]> {
  const url = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(symbol)}&region=US&lang=en-US`;
  try {
    const xml = await fetchText(url, { timeoutMs: 10_000, cacheTtlMs: 60_000 });
    return parseRss(xml, 8).map((h) => ({ ...h, publisher: h.publisher === "RSS" ? "Yahoo Finance" : h.publisher }));
  } catch {
    return [];
  }
}

// Words too common in equity headlines to identify a story. Dropping them makes
// the de-duplication key content-specific: two feeds carrying the same wire story
// with different lead text and different URLs still collapse to one entry.
const FILLER_WORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "have", "has", "was", "were", "are",
  "its", "their", "they", "them", "will", "would", "could", "should", "after", "before",
  "into", "over", "than", "then", "when", "while", "what", "which", "who", "why", "how",
  "said", "says", "new", "more", "most", "some", "such", "only", "also", "about", "amid",
  "stock", "stocks", "shares", "share", "market", "markets", "week", "daily", "update",
]);

// First few content words of a headline, used as a cross-publisher identity key.
export function fingerprintTokens(title: string, limit = 6): string[] {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !FILLER_WORDS.has(token))
    .slice(0, limit);
}

export function titleFingerprint(title: string): string {
  return fingerprintTokens(title).join(" ");
}

// True when `a` is a leading run of `b`. Feeds often carry a shortened version of
// the same wire story ("...will be worth" vs "...will be worth by 2030"), so a
// fixed-width key is not stable; containment catches both forms.
function startsWithTokens(a: string[], b: string[]): boolean {
  return a.length <= b.length && a.every((token, index) => b[index] === token);
}

// Publisher-agnostic article key: the same URL syndicated by two feeds collapses.
export function urlFingerprint(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname.replace(/^www\./, "")}${parsed.pathname.replace(/\/+$/, "")}`.toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

// Blend provider batches so no single feed monopolises the visible headline
// set. One item is taken from each batch per pass, in the caller's priority
// order, with de-duplication. Alpha Vantage alone can return 50 items, so without
// this the first provider would fill all 10 slots.
export function blendHeadlines(batches: Headline[][], limit: number): Headline[] {
  const seenTitles = new Set<string>();
  const seenTitleTokens: string[][] = [];
  const seenUrls = new Set<string>();
  const out: Headline[] = [];
  const cursors = batches.map(() => 0);
  let progressed = true;
  while (out.length < limit && progressed) {
    progressed = false;
    for (let i = 0; i < batches.length && out.length < limit; i++) {
      const batch = batches[i];
      while (cursors[i] < batch.length) {
        const item = batch[cursors[i]++];
        const title = item.title.trim();
        if (!title) continue;
        const tokens = fingerprintTokens(title);
        const titleKey = tokens.join(" ");
        const urlKey = urlFingerprint(item.url);
        const nearDuplicate =
          seenTitles.has(titleKey) ||
          (tokens.length >= 3 &&
            seenTitleTokens.some(
              (seen) => startsWithTokens(tokens, seen) || startsWithTokens(seen, tokens),
            ));
        if (nearDuplicate || seenUrls.has(urlKey)) continue;
        seenTitles.add(titleKey);
        seenTitleTokens.push(tokens);
        seenUrls.add(urlKey);
        out.push({ ...item, title });
        progressed = true;
        break;
      }
    }
  }
  return out;
}

export function tagHeadline(title: string): "earnings" | "guidance" | "macro" | "product" | "legal" | "other" {
  const t = title.toLowerCase();
  if (/\bearnings\b|\beps\b|\brevenue\b|\bresults\b/.test(t)) return "earnings";
  if (/\bguidance\b|\boutlook\b|\bforecast\b/.test(t)) return "guidance";
  if (/\bfed\b|\brate\b|\bcpi\b|\binflation\b|\btariff\b|\bgeopolit/.test(t)) return "macro";
  if (/\blawsuit\b|\bsec\b|\bantitrust\b|\binvestigat/.test(t)) return "legal";
  if (/\biphone\b|\blaunch\b|\bproduct\b|\bchip\b|\bmodel\b/.test(t)) return "product";
  return "other";
}

export function leanHeadline(title: string): "constructive" | "cautious" | "mixed" {
  const t = title.toLowerCase();
  const up = (t.match(/\bbeat\b|\bsurge\b|\brailly\b|\brecord\b|\braise\b|\bupgrade\b|\bstrong\b/g) ?? []).length;
  const down = (t.match(/\bmiss\b|\bcut\b|\bdelay\b|\bprobe\b|\bweak\b|\bdrop\b|\bwarning\b|\bslow/g) ?? []).length;
  if (up > down) return "constructive";
  if (down > up) return "cautious";
  return "mixed";
}
