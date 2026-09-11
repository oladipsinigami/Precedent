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
