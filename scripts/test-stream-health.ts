import assert from "node:assert/strict";
import { buildStreamHealth } from "../lib/stream-health";
import type { PillarBundle } from "../lib/types";

const cases: Array<[string, () => void]> = [];
function test(name: string, fn: () => void) { cases.push([name, fn]); }

function bundle(overrides: Partial<Record<keyof PillarBundle, unknown>> = {}): PillarBundle {
  const base = {
    fundamentals: { ok: true, caveats: [] },
    technicals: { ok: true, caveats: [] },
    news: { ok: true, caveats: [] },
    analogs: { ok: true, caveats: [] },
    marketStructure: { ok: true, stale: false, caveats: [] },
  };
  return { ...base, ...overrides } as unknown as PillarBundle;
}

test("an all-good bundle yields no banner", () => {
  const health = buildStreamHealth(bundle());
  assert.equal(health.showBanner, false);
  assert.equal(health.usable, 5);
  assert.equal(health.degraded.length, 0);
});

test("a stale market-structure snapshot degrades that stream only", () => {
  const health = buildStreamHealth(
    bundle({ marketStructure: { ok: true, stale: true, computedAt: "2026-10-02T11:05:18.009Z", caveats: [] } }),
  );
  assert.equal(health.showBanner, true);
  assert.deepEqual(health.degraded, ["marketStructure"]);
  assert.match(health.headline, /4 of 5 evidence streams usable/);
  assert.match(health.headline, /market structure \(stale snapshot/);
});

test("the stale reason names the snapshot timestamp", () => {
  const health = buildStreamHealth(
    bundle({ marketStructure: { ok: true, stale: true, computedAt: "2026-10-02T11:05:18.009Z", caveats: [] } }),
  );
  const stream = health.streams.find((s) => s.name === "marketStructure");
  assert.match(stream!.reasons[0]!, /2026-10-02/);
});

test("a failed stream degrades with its error", () => {
  const health = buildStreamHealth(bundle({ news: { ok: false, error: "X credentials missing", caveats: [] } }));
  assert.deepEqual(health.degraded, ["news"]);
  assert.match(health.headline, /X credentials missing/);
});

test("an ok stream carrying caveats still counts as degraded", () => {
  const health = buildStreamHealth(bundle({ analogs: { ok: true, caveats: ["only 12 analogs found"] } }));
  assert.deepEqual(health.degraded, ["analogs"]);
  assert.match(health.headline, /only 12 analogs found/);
});

test("several degraded streams are all named", () => {
  const health = buildStreamHealth(
    bundle({
      news: { ok: false, error: "no headlines", caveats: [] },
      marketStructure: { ok: true, stale: true, computedAt: "x", caveats: [] },
      analogs: { ok: false, error: "history too short", caveats: [] },
    }),
  );
  assert.equal(health.usable, 2);
  assert.equal(health.degraded.length, 3);
  assert.match(health.headline, /2 of 5/);
});

test("a null bundle degrades everything rather than claiming health", () => {
  const health = buildStreamHealth(null);
  assert.equal(health.usable, 0);
  assert.equal(health.showBanner, true);
  assert.equal(health.degraded.length, 5);
});

test("every stream carries a label and a status", () => {
  const health = buildStreamHealth(bundle());
  assert.equal(health.streams.length, 5);
  for (const stream of health.streams) {
    assert.ok(stream.label.length > 0, `${stream.name} has no label`);
    assert.ok(stream.status === "ok" || stream.status === "degraded");
  }
});

test("the healthy headline states that nothing was degraded", () => {
  const health = buildStreamHealth(bundle());
  assert.match(health.headline, /All 5 evidence streams returned usable data/);
});

let failed = 0;
for (const [name, fn] of cases) {
  try { fn(); console.log(`[PASS] ${name}`); }
  catch (err) { failed += 1; console.error(`[FAIL] ${name}`); console.error(err); }
}
if (failed > 0) { console.error(`${failed} of ${cases.length} stream-health checks failed`); process.exit(1); }
console.log(`${cases.length} stream-health checks passed`);