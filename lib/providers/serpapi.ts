import { fetchJson } from "../http";
import type { Headline } from "./news";

type SerpNewsResult = {
  error?: string;
  news_results?: {
    title?: string;
    link?: string;
    source?: { name?: string } | string;
    date?: string;
    published_at?: string;
    date_utc?: string;
  }[];
};

export async function serpNews(query: string, opts: { num?: number } = {}): Promise<Headline[]> {
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) return [];

  try {
    const params = new URLSearchParams({
      engine: "google_news",
      q: query,
      api_key: apiKey,
      num: String(Math.min(20, Math.max(1, opts.num ?? 8))),
    });
    const response = await fetchJson<SerpNewsResult>(
      `https://serpapi.com/search.json?${params.toString()}`,
      { timeoutMs: 8_000, cacheTtlMs: 60_000 },
    );
    if (response.error) throw new Error(response.error);
    return (response.news_results ?? [])
      .map((item) => ({
        title: item.title?.trim() ?? "",
        publisher:
          typeof item.source === "string"
            ? item.source.trim() || "SerpAPI"
            : item.source?.name?.trim() || "SerpAPI",
        url: item.link?.trim() ?? "",
        published: item.published_at?.trim() ?? item.date?.trim() ?? item.date_utc?.trim(),
      }))
      .filter((item) => item.title.length > 0 && item.url.length > 0);
  } catch (err) {
    console.warn(
      "[serpapi] google_news failed:",
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}
