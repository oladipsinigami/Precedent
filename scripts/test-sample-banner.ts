import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("app/components/ResultsView.tsx", "utf8");
const cases: Array<[string, () => void]> = [];
function test(name: string, fn: () => void) { cases.push([name, fn]); }

test("a persistent banner renders when isSample is true", () => {
  assert.ok(source.includes("briefing.isSample ?"), "no isSample conditional");
  assert.ok(source.includes("Sample data — not live"), "no banner copy");
  assert.ok(source.includes('role="status"'), "banner not announced to assistive tech");
});

test("the banner sits above the memo, not inside it", () => {
  const bannerAt = source.indexOf("Sample data — not live");
  const memoAt = source.indexOf("<ResearchMemo");
  assert.ok(bannerAt > 0 && memoAt > 0, "banner or memo not found");
  assert.ok(bannerAt < memoAt, "the banner must render before the memo");
});

test("the banner names the consequence of sample data", () => {
  assert.ok(/fixed sample data/.test(source), "the banner must say the figures are fixed sample data");
  assert.ok(/compute against live data/.test(source), "the banner must say how to get live data");
});

test("no banner renders when isSample is false", () => {
  const start = source.indexOf("briefing.isSample ?");
  assert.ok(start > 0, "conditional missing");
  const rest = source.slice(start);
  // The ternary's false branch must be null so a live memo emits nothing.
  const falseBranch = rest.indexOf(": null");
  assert.ok(falseBranch > 0, "the false branch is not null");
  const trueBranch = rest.slice(0, falseBranch);
  assert.ok(!/\?\s*:/.test(trueBranch.replace("briefing.isSample ?", "")), "unexpected nested ternary");
});

let failed = 0;
for (const [name, fn] of cases) {
  try { fn(); console.log(`[PASS] ${name}`); }
  catch (err) { failed += 1; console.error(`[FAIL] ${name}`); console.error(err); }
}
if (failed > 0) { console.error(`${failed} of ${cases.length} sample-banner checks failed`); process.exit(1); }
console.log(`${cases.length} sample-banner checks passed`);
