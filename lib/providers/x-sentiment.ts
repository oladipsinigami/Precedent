import { fetchJson } from "../http";
import type { SocialPost } from "../types";
import { buildSearchQuery, classifyLean, scoreEngagement } from "./social";

type XSearchResponse = {
  data?: {
    id: string;
    text: string;
    author_id?: string;
    created_at?: string;
    public_metrics?: {
      like_count?: number;
      retweet_count?: number;
      reply_count?: number;
      impression_count?: number;
    };
  }[];
  includes?: { users?: { id: string; username?: string; name?: string }[] };
};

type SorsaSearchResponse = {
  tweets?: {
    id: string;
    full_text?: string;
    created_at?: string;
    likes_count?: number;
    retweet_count?: number;
    reply_count?: number;
    view_count?: number;
    user?: { username?: string };
  }[];
};

export async function fetchXSentiment(
  parts: { native: string; name: string; rToken: string; bitgetSymbols?: string[] },
  options: { maxPosts?: number; hours?: number } = {},
): Promise<{ posts: SocialPost[]; caveat?: string }> {
  const max = options.maxPosts ?? 20;
  const sorsaKey = process.env.SORSA_API_KEY;
  const token = process.env.X_BEARER_TOKEN;
  if (!sorsaKey && !token) return { posts: [], caveat: "X discourse unavailable (no X API credentials configured)" };

  try {
    const query = `(${buildSearchQuery(parts)}) lang:en -is:retweet`;
    const hours = options.hours ?? 48;
    const cutoff = Date.now() - hours * 3_600_000;
    let sorsaFailed = false;

    if (sorsaKey) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 12_000);
        try {
          const response = await fetch("https://api.sorsa.io/v3/search-tweets", {
            method: "POST",
            headers: { ApiKey: sorsaKey, "Content-Type": "application/json" },
            body: JSON.stringify({ query, order: "latest" }),
            signal: controller.signal,
          });
          if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
          const data = (await response.json()) as SorsaSearchResponse;
          const posts = (data.tweets ?? [])
            .filter((post) => post.full_text && (!post.created_at || Date.parse(post.created_at) >= cutoff))
            .map((post) => {
              const metrics = {
                likes: post.likes_count,
                reposts: post.retweet_count,
                replies: post.reply_count,
                views: post.view_count,
              };
              return {
                id: post.id,
                platform: "x" as const,
                text: post.full_text ?? "",
                author: post.user?.username ?? "unknown",
                url: `https://x.com/i/status/${post.id}`,
                createdAt: post.created_at ?? new Date().toISOString(),
                metrics,
                lean: classifyLean(post.full_text ?? ""),
                engagementScore: scoreEngagement(metrics),
              };
            })
            .sort((a, b) => b.engagementScore - a.engagementScore)
            .slice(0, max);
          return { posts };
        } finally {
          clearTimeout(timer);
        }
      } catch {
        if (!token) return { posts: [], caveat: "X discourse unavailable (API error)" };
        sorsaFailed = true;
      }
    }

    if (!token) return { posts: [], caveat: "X discourse unavailable (no X API credentials configured)" };
    const url =
      `https://api.x.com/2/tweets/search/recent?query=${encodeURIComponent(query)}` +
      `&max_results=${Math.min(100, Math.max(10, max))}&tweet.fields=created_at,public_metrics,author_id&expansions=author_id`;
    const data = await fetchJson<XSearchResponse>(url, {
      headers: { Authorization: `Bearer ${token}` },
      timeoutMs: 12_000,
    });
    const users = new Map((data.includes?.users ?? []).map((u) => [u.id, u.username ?? u.name ?? u.id]));
    const posts = (data.data ?? [])
      .filter((post) => !post.created_at || Date.parse(post.created_at) >= cutoff)
      .map((post) => {
        const metrics = {
          likes: post.public_metrics?.like_count,
          reposts: post.public_metrics?.retweet_count,
          replies: post.public_metrics?.reply_count,
          views: post.public_metrics?.impression_count,
        };
        return {
          id: post.id,
          platform: "x" as const,
          text: post.text,
          author: (post.author_id && users.get(post.author_id)) || "unknown",
          url: `https://x.com/i/status/${post.id}`,
          createdAt: post.created_at ?? new Date().toISOString(),
          metrics,
          lean: classifyLean(post.text),
          engagementScore: scoreEngagement(metrics),
        };
      })
      .sort((a, b) => b.engagementScore - a.engagementScore)
      .slice(0, max);
    return { posts, ...(sorsaFailed ? { caveat: "Sorsa unavailable; official X fallback used" } : {}) };
  } catch {
    return { posts: [], caveat: "X discourse unavailable (API error)" };
  }
}
