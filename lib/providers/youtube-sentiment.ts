import { fetchJson } from "../http";
import type { YouTubeItem } from "../types";
import { classifyLean, majorityLean } from "./social";

type SearchResponse = {
  items?: { id?: { videoId?: string }; snippet?: { title?: string; channelTitle?: string; publishedAt?: string } }[];
};

type VideosResponse = {
  items?: { id?: string; statistics?: { viewCount?: string } }[];
};

type CommentsResponse = {
  items?: {
    snippet?: { topLevelComment?: { snippet?: { textDisplay?: string; likeCount?: number } } };
  }[];
};

// YouTube discourse provider (YouTube Data API v3). Watch the daily quota:
// one search.list call plus one commentThreads.list call per video.
// Failure (quota, key, network) returns an empty list plus a caveat.
export async function fetchYouTubeSentiment(
  query: string,
  options: { maxVideos?: number } = {},
): Promise<{ items: YouTubeItem[]; caveat?: string }> {
  const max = options.maxVideos ?? 6;
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return { items: [], caveat: "YouTube discourse unavailable (no API key configured)" };

  try {
    const search = await fetchJson<SearchResponse>(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&orderBy=relevance&maxResults=${max}` +
        `&q=${encodeURIComponent(query)}&key=${key}`,
      { timeoutMs: 12_000 },
    );
    const videos = (search.items ?? [])
      .filter((v) => v.id?.videoId)
      .map((v) => ({
        id: v.id?.videoId as string,
        title: v.snippet?.title ?? "",
        channelTitle: v.snippet?.channelTitle ?? "unknown",
        publishedAt: v.snippet?.publishedAt ?? "",
      }));
    if (!videos.length) return { items: [] };

    const stats = await fetchJson<VideosResponse>(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videos.map((v) => v.id).join(",")}&key=${key}`,
      { timeoutMs: 12_000 },
    ).catch(() => ({ items: [] as NonNullable<VideosResponse["items"]> }));
    const views = new Map((stats.items ?? []).map((s) => [s.id, s.statistics?.viewCount]));

    const items: YouTubeItem[] = [];
    for (const v of videos) {
      const comments = await fetchJson<CommentsResponse>(
        `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${v.id}&orderBy=relevance&maxResults=4&textFormat=plainText&key=${key}`,
        { timeoutMs: 12_000 },
      ).catch(() => ({ items: [] as NonNullable<CommentsResponse["items"]> }));
      const topComments = (comments.items ?? [])
        .map((c) => c.snippet?.topLevelComment?.snippet)
        .filter((s): s is NonNullable<typeof s> => !!s?.textDisplay)
        .map((s) => ({ text: s.textDisplay as string, lean: classifyLean(s.textDisplay as string), likeCount: s.likeCount }));
      const viewCount = views.get(v.id);
      items.push({
        videoId: v.id,
        title: v.title,
        channelTitle: v.channelTitle,
        url: `https://www.youtube.com/watch?v=${v.id}`,
        publishedAt: v.publishedAt,
        viewCount: viewCount ? Number(viewCount) : undefined,
        topComments,
        overallLean: majorityLean([classifyLean(v.title), ...topComments.map((c) => c.lean)]),
      });
    }
    return { items };
  } catch {
    return { items: [], caveat: "YouTube discourse unavailable (quota or API error)" };
  }
}
