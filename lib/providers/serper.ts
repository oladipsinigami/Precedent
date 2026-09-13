import type { Headline } from "./news";

type SerperResponse = {
  news?: {
    title?: string;
    link?: string;
    source?: string;
    date?: string;
  }[];
};

export async function serperNews(query: string, opts: { num?: number } = {}): Promise<Headline[]> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return [];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch("https://google.serper.dev/news", {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: query,
        num: Math.min(20, Math.max(1, opts.num ?? 8)),
        gl: "us",
        hl: "en",
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const data = (await response.json()) as SerperResponse;
    return (data.news ?? [])
      .map((item) => ({
        title: item.title?.trim() ?? "",
        publisher: item.source?.trim() || "Serper",
        url: item.link?.trim() ?? "",
        published: item.date?.trim(),
      }))
      .filter((item) => item.title.length > 0 && item.url.length > 0);
  } catch (err) {
    console.warn("[serper] news failed:", err instanceof Error ? err.message : err);
    return [];
  } finally {
    clearTimeout(timer);
  }
}
