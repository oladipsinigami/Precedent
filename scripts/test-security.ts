import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { redactUrlSecrets } from "../lib/http";
import { summarizePillarCoverage } from "../lib/pillar-scores";
import {
  isMarketStructureSnapshotStale,
  MARKET_STRUCTURE_SNAPSHOT_MAX_AGE_MS,
  type MarketStructureStore,
} from "../lib/pillars/market-structure";

const redacted = redactUrlSecrets(
  "https://example.com/feed?apikey=alpha-secret&symbol=AAPL&api_key=beta-secret&token=gamma-secret",
);
assert.equal(
  redacted,
  "https://example.com/feed?apikey=REDACTED&symbol=AAPL&api_key=REDACTED&token=REDACTED",
);
assert.equal(
  redactUrlSecrets("relative-or-invalid?apikey=alpha-secret&symbol=AAPL"),
  "relative-or-invalid?apikey=REDACTED&symbol=AAPL",
);
console.log("ok - redacts API keys and tokens from upstream URLs before reporting errors");

assert.equal(isMarketStructureSnapshotStale(new Date().toISOString()), false);
assert.equal(
  isMarketStructureSnapshotStale(new Date(Date.now() - MARKET_STRUCTURE_SNAPSHOT_MAX_AGE_MS - 1_000).toISOString()),
  true,
);
assert.equal(isMarketStructureSnapshotStale(undefined), true);
console.log("ok - detects fresh, stale, and missing market-structure snapshots");

const snapshot = JSON.parse(
  readFileSync(path.join(process.cwd(), "data", "market-structure.json"), "utf-8"),
) as MarketStructureStore & { raw?: unknown; cleaned?: unknown };
assert.ok(snapshot.communityStats && Object.keys(snapshot.communityStats).length > 0);
assert.ok(Array.isArray(snapshot.correlations) && snapshot.correlations.length > 0);
assert.ok(snapshot.correlations.every((row) => row.peers.length <= 6));
assert.ok(
  snapshot.correlations.every((row) => row.peers.every((peer) => typeof peer.residual === "number")),
  "every peer must carry a market-mode-removed correlation",
);
// Regression guard: the community pass used to collapse 490 of 494 names into a
// single "community", which made the peer cohort meaningless. Average linkage on
// residual correlations keeps the partition informative; if a future change
// reintroduces chaining, this fails loudly.
assert.ok(
  typeof snapshot.largestCommunityShare === "number" && snapshot.largestCommunityShare < 0.6,
  `largest community should stay under 60% of the universe, got ${snapshot.largestCommunityShare}`,
);
assert.ok(
  typeof snapshot.communityCount === "number" && snapshot.communityCount > 5,
  `expected a partitioned snapshot, got ${snapshot.communityCount} communities`,
);
assert.equal(snapshot.raw, undefined);
assert.equal(snapshot.cleaned, undefined);
console.log("ok - market-structure snapshot stores compact residual-correlation diagnostics");

const coverage = summarizePillarCoverage([true, true, false, true, false]);
assert.deepEqual(
  { available: coverage.available, total: coverage.total, label: coverage.label },
  { available: 3, total: 5, label: "partial" },
);
assert.match(coverage.basis, /not a blended investment score/i);
console.log("ok - reports evidence coverage without a blended 0-100 score");

console.log("5 security/data-integrity checks passed");
