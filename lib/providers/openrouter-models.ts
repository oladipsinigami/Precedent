import { fetchJson } from "../http";

type OpenRouterModel = {
  id: string;
  name?: string;
  context_length?: number;
  // Free models are published with a ":free" slug suffix on OpenRouter.
  architecture?: { input_modalities?: string[]; output_modalities?: string[] };
};

export type OpenRouterFreeModel = { id: string; contextLength: number };

// OpenRouter's public catalog is unauthenticated, so the free tier can be
// discovered even when the request has no usable key. The list churns daily
// (free models are added and retired), so it is fetched live and cached for
// an hour rather than pinned in source.
const CATALOG_URL = "https://openrouter.ai/api/v1/models";
const CATALOG_TTL_MS = 60 * 60_000;
const REQUEST_TIMEOUT_MS = 6_000;

// A memo is a few thousand tokens of prompt plus a short JSON reply. Anything
// below this cannot reliably hold the four-witness prompt, so it is skipped
// rather than discovered and then failed on at synthesis time.
const MIN_CONTEXT_LENGTH = 16_000;

// Cap the waterfall so a large free catalog cannot push synthesis past the
// request deadline. Providers are tried in order; each miss moves on. Kept
// small on purpose: a reachable free model needs the whole synthesis budget to
// emit a full memo, so there is realistically time for a handful of attempts,
// not a dozen. The catalog is still queried live, so a retired slug is replaced
// by whatever is actually offered today.
const MAX_DISCOVERED_MODELS = 5;

// Verified free models, ordered by desk preference. The live catalog fills in
// around these, so a retired or rate-limited model simply falls through to the
// next entry rather than failing the run.
const PREFERRED_FREE_MODELS = [
  "qwen/qwen3.8-27b:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "liquid/lfm-2.5-2.6b:free",
  "nvidia/nemotron-3.5-lightning:free",
];

let cached: { expires: number; models: OpenRouterFreeModel[] } | null = null;
let inFlight: Promise<OpenRouterFreeModel[]> | null = null;

function normalizeCatalog(raw: OpenRouterModel[]): OpenRouterFreeModel[] {
  return raw
    .filter((m) => typeof m?.id === "string" && m.id.endsWith(":free"))
    // Text-in/text-out only: the memo schema is plain JSON, so a vision-only
    // or embedding-style free endpoint is not a usable synthesizer.
    .map((m) => ({ id: m.id, contextLength: m.context_length ?? 0 }))
    .filter((m) => m.contextLength >= MIN_CONTEXT_LENGTH);
}

/**
 * Discover the free OpenRouter models that are actually available right now.
 * Never throws: a catalog failure yields the pinned preference list so the
 * waterfall still has something to try.
 */
export async function openRouterFreeModels(): Promise<OpenRouterFreeModel[]> {
  const now = Date.now();
  if (cached && cached.expires > now) return cached.models;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const res = await fetchJson<{ data?: OpenRouterModel[] }>(CATALOG_URL, {
        timeoutMs: REQUEST_TIMEOUT_MS,
        cacheTtlMs: CATALOG_TTL_MS,
      });
      const discovered = normalizeCatalog(res.data ?? []);
      const byId = new Map(discovered.map((m) => [m.id, m]));

      // Preferences first and in order, then whatever else the catalog offers.
      const ordered: OpenRouterFreeModel[] = [];
      for (const id of PREFERRED_FREE_MODELS) {
        const hit = byId.get(id) ?? (id.endsWith(":free") ? { id, contextLength: MIN_CONTEXT_LENGTH } : null);
        if (hit) {
          ordered.push(hit);
          byId.delete(id);
        }
      }
      for (const rest of byId.values()) ordered.push(rest);

      const models = ordered.slice(0, MAX_DISCOVERED_MODELS);
      cached = { expires: Date.now() + CATALOG_TTL_MS, models };
      return models;
    } catch {
      // Offline or rate-limited: fall back to the pinned list only.
      return PREFERRED_FREE_MODELS.map((id) => ({ id, contextLength: MIN_CONTEXT_LENGTH }));
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}