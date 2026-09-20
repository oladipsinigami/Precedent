// Bitget Signal provider — routes through Bitget's official public MCP data
// service (the same backend that powers the `bitget-signal` skill stack:
// macro-analyst, sentiment-analyst, market-intel, news-briefing,
// technical-analysis). No API key required.
//
// The tools are slow (~15–25s over SSE), so callers must wrap these in a
// timeout race and degrade gracefully — the pillar continues with its other
// providers when the MCP data does not land in budget.

import { callMcpTool, mcpJson, mcpText } from "./bitget-mcp";
import type { Headline } from "./news";

export type BitgetSignalFeedItem = {
  feed: string;
  error?: string;
  items?: { title?: string; link?: string; published?: string; summary?: string }[];
};

// The MCP news_feed tool aggregates 44 RSS/Atom sources (the same stream the
// official news-briefing skill consumes). We map feed items into the pillar's
// Headline shape and apply the keyword filter locally as a safety net — the
// server-side filter is authoritative when it works.
export async function bitgetSignalNews(keyword: string, limit = 6): Promise<Headline[]> {
  const result = await callMcpTool("news_feed", { action: "latest", limit: 10, keyword }, 24_000);
  const parsed = mcpJson<BitgetSignalFeedItem[]>(result);
  if (!Array.isArray(parsed)) return [];
  const kw = keyword.trim().toLowerCase();
  const headlines: Headline[] = [];
  for (const feed of parsed) {
    for (const item of feed.items ?? []) {
      const title = item.title?.trim();
      const url = item.link?.trim();
      if (!title || !url) continue;
      if (kw && !title.toLowerCase().includes(kw) && !(item.summary ?? "").toLowerCase().includes(kw)) {
        continue;
      }
      headlines.push({
        title,
        publisher: `Bitget Signal · ${feed.feed}`,
        url,
        published: item.published,
      });
      if (headlines.length >= limit) return headlines;
    }
  }
  return headlines;
}

// Fear & Greed index via the sentiment_index tool (sentiment-analyst skill).
// Slow on cold calls — only use with an external timeout race.
export async function bitgetSignalFearGreed(): Promise<{ value: number; label: string } | null> {
  const result = await callMcpTool("sentiment_index", { action: "current" }, 20_000);
  const text = mcpText(result);
  const valueMatch = text.match(/(\d{1,3})\s*\/\s*100/) ?? text.match(/value[:\s]+(\d{1,3})/i);
  const labelMatch = text.match(/(EXTREME FEAR|FEAR|NEUTRAL|GREED|EXTREME GREED)/i);
  if (!valueMatch) return null;
  return {
    value: Number(valueMatch[1]),
    label: labelMatch ? labelMatch[1].toUpperCase() : "UNRATED",
  };
}
