import type { Headline } from "./news";

// You.com Web Search API — optional search-enrichment provider for the news
// pillar. One endpoint returns a web section and a news section; the news
// section appears automatically when the query has news intent (You.com has no
// separate news endpoint), so we prefer it and only fall back to web results
// when no news came back, which keeps blog/quote pages out of the headline mix.
//
// The key is optional: without YDC_API_KEY this returns [] and the pillar's
// aggregated notice records the gap instead of failing the run.
// Docs: https://you.com/docs/api-reference/search
const SEARCH_URL = "https://ydc-index.io/v1/search";

type YouComResult = {
  title?: string;
  url?: string;
  page_age?: string;
  source?: string;
  publisher?: string;
};

type YouComResponse = {
  results?: { web?: YouComResult[]; news?: YouComResult[] };
};

// News results carry no publisher field, so attribute the outlet by host.
function publisherFrom(item: YouComResult): string {
  const explicit = item.source?.trim() || item.publisher?.trim();
  if (explicit) return explicit;
  try {
    return new URL(item.url ?? "").hostname.replace(/^www\./, "") || "You.com";
  } catch {
    return "You.com";
  }
}

export async function youcomNews(
  query: string,
  opts: { num?: number; freshness?: string } = {},
): Promise<Headline[]> {
  const apiKey = process.env.YDC_API_KEY;
  if (!apiKey) return [];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(SEARCH_URL, {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        count: Math.min(100, Math.max(1, opts.num ?? 8)),
        freshness: opts.freshness ?? "week",
        country: "US",
        language: "EN",
        safesearch: "moderate",
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const data = (await response.json()) as YouComResponse;
    const news = data.results?.news ?? [];
    const items = news.length ? news : data.results?.web ?? [];
    const seen = new Set<string>();
    return items
      .map((item) => ({
        title: item.title?.trim() ?? "",
        publisher: publisherFrom(item),
        url: item.url?.trim() ?? "",
        published: item.page_age?.trim(),
      }))
      .filter((item) => {
        if (!item.title || !item.url || seen.has(item.url)) return false;
        seen.add(item.url);
        return true;
      });
  } catch (err) {
    console.warn("[youcom] search failed:", err instanceof Error ? err.message : err);
    return [];
  } finally {
    clearTimeout(timer);
  }
}
