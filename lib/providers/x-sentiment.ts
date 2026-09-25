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

function providerFailureReason(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/request limit exceeded|\b429\b/i.test(message)) return "request limit exceeded";
  if (/\b(401|403)\b/.test(message)) return `credentials rejected or quota exhausted (${message})`;
  if (/aborted|timed? out/i.test(message)) return "request timed out";
  return message ? `API error (${message})` : "API error";
}

const X_CACHE_TTL_MS = 10 * 60 * 1000;
const xCache = new Map<
  string,
  { expires: number; result: { posts: SocialPost[]; caveat?: string } }
>();

export async function fetchXSentiment(
  parts: { native: string; name: string; rToken: string; bitgetSymbols?: string[] },
  options: { maxPosts?: number; hours?: number } = {},
): Promise<{ posts: SocialPost[]; caveat?: string }> {
  const cacheKey = `${parts.native}|${options.maxPosts ?? 20}|${options.hours ?? 48}`;
  const hit = xCache.get(cacheKey);
  if (hit && hit.expires > Date.now()) return hit.result;
  const result = await fetchXSentimentUncached(parts, options);
  if (result.posts.length > 0 || !result.caveat) {
    xCache.set(cacheKey, { expires: Date.now() + X_CACHE_TTL_MS, result });
  }
  return result;
}

async function fetchXSentimentUncached(
  parts: { native: string; name: string; rToken: string; bitgetSymbols?: string[] },
  options: { maxPosts?: number; hours?: number } = {},
): Promise<{ posts: SocialPost[]; caveat?: string }> {
  const max = options.maxPosts ?? 20;
  const token = process.env.X_BEARER_TOKEN;
  if (!token) return { posts: [], caveat: "X discourse unavailable (no X API credentials configured)" };

  try {
    const query = `(${buildSearchQuery(parts)}) lang:en -is:retweet`;
    const hours = options.hours ?? 48;
    const cutoff = Date.now() - hours * 3_600_000;

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
    return { posts };
  } catch (error) {
    const reason = providerFailureReason(error);
    return {
      posts: [],
      caveat: `X discourse unavailable (official X ${reason})`,
    };
  }
}
