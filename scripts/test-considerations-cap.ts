import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import {
  CONSIDERATIONS_MAX_ITEMS,
  CONSIDERATIONS_MAX_WORDS,
  capConsiderations,
  guardBriefing,
} from "../lib/language-guard";
import type { Briefing } from "../lib/types";

const cases: Array<[string, () => void]> = [];
function test(name: string, fn: () => void) { cases.push([name, fn]); }

function eightLongItems(prefix: string): string[] {
  return Array.from({ length: 8 }, (_, i) =>
    `${prefix} item ${i} describing an extremely long consideration with far more than twenty words in it so the cap must trim it down to something a reader can scan quickly.`,
  );
}

test("each list holds at most three items", () => {
  const out = capConsiderations(eightLongItems("alpha"));
  assert.ok(out.length <= CONSIDERATIONS_MAX_ITEMS, `got ${out.length}`);
});

test("each item holds at most twenty words", () => {
  for (const item of capConsiderations(eightLongItems("alpha"))) {
    const words = item.split(/\s+/).length;
    assert.ok(words <= CONSIDERATIONS_MAX_WORDS, `"${item}" has ${words} words`);
  }
});

test("items without a number or a named source are dropped", () => {
  const out = capConsiderations([
    "This is a vague assertion with neither a figure nor any cited source anywhere.",
    "RSI-14 currently reads 61.4.",
    "The SEC EDGAR filing tape is the last verified baseline.",
  ]);
  assert.equal(out.length, 2, `expected the vague line to be dropped: ${JSON.stringify(out)}`);
});

test("empty and missing lists are safe", () => {
  assert.deepEqual(capConsiderations([]), []);
  assert.deepEqual(capConsiderations(undefined), []);
  assert.deepEqual(capConsiderations(null), []);
});

test("the documented limits are three items and twenty words", () => {
  assert.equal(CONSIDERATIONS_MAX_ITEMS, 3);
  assert.equal(CONSIDERATIONS_MAX_WORDS, 20);
});

function baseBriefing(): Briefing {
  return {
    title: "t",
    whatWeDid: "d",
    historicalStressTest: {
      summary: "",
      sampleSize: 12,
      importantNote: "not a forecast",
      results: [],
      examples: [],
    },
    otherThingsWeChecked: [],
    simpleTakeAways: [],
    whereThingsDoNotAgree: [],
    questionsOnlyYouCanAnswer: [],
    evidence: [],
    tension: [],
    unverified: [],
    styleNote: "",
    model: "m",
    considerations: {
      forStyle: eightLongItems("alpha"),
      invalidation: eightLongItems("beta"),
      questions: eightLongItems("gamma"),
    },
  } as unknown as Briefing;
}

test("guardBriefing caps every consideration list", () => {
  const out = guardBriefing(baseBriefing());
  for (const key of ["forStyle", "invalidation", "questions"] as const) {
    const list = out.considerations[key];
    assert.ok(list.length <= 3, `${key} has ${list.length}`);
    for (const item of list) {
      assert.ok(item.split(/\s+/).length <= 20, `${key}: "${item}" is too long`);
    }
  }
});

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (["node_modules", ".next", ".next-dev"].includes(entry)) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

test("the unsupported sentences no longer exist in lib", () => {
  const banned = [
    "peer moves inside that group carry higher explanatory power",
    "standing aside represents the disciplined institutional choice",
    "This memo is framed for a",
  ];
  const offenders: string[] = [];
  for (const file of walk("lib")) {
    const text = readFileSync(file, "utf8");
    for (const phrase of banned) {
      if (text.includes(phrase)) offenders.push(`${file}: ${phrase}`);
    }
  }
  assert.deepEqual(offenders, [], `unsupported copy remains: ${offenders.join(", ")}`);
});

let failed = 0;
for (const [name, fn] of cases) {
  try { fn(); console.log(`[PASS] ${name}`); }
  catch (err) { failed += 1; console.error(`[FAIL] ${name}`); console.error(err); }
}
if (failed > 0) { console.error(`${failed} of ${cases.length} considerations-cap checks failed`); process.exit(1); }
console.log(`${cases.length} considerations-cap checks passed`);