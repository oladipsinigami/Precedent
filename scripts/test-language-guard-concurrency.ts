import { guardBriefing } from "../lib/language-guard";
import type { Briefing } from "../lib/types";

// The language guard used to publish its rewrite state through module-level
// `let` bindings, read back via didLastGuardRewrite()/getLastRewriteCount().
// On serverless one instance handles concurrent requests, so that channel is
// shared across in-flight runs: the value a caller observed belonged to
// whichever request finished last, not its own memo. These checks pin the
// per-call replacement and prove a run's report belongs to that run.

let passed = 0;
function check(label: string, cond: boolean) {
  if (cond) {
    console.log(`[PASS] ${label}`);
    passed++;
  } else {
    console.log(`[FAIL] ${label}`);
    process.exitCode = 1;
  }
}

function baseBriefing(title: string, whatWeDid: string): Briefing {
  return {
    title,
    whatWeDid,
    historicalStressTest: {
      summary: "Neutral summary.",
      sampleSize: 12,
      results: [],
      examples: [],
      importantNote: "Past occurrences only.",
    },
    otherThingsWeChecked: [],
    whereThingsDoNotAgree: [],
    simpleTakeAways: [],
    questionsOnlyYouCanAnswer: [],
    model: "test",
    styleNote: "",
    evidence: [],
    tension: [],
    flags: {
      catalystDensity: "moderate",
      balanceSheet: [],
      regimeAlignment: "aligned",
      communityStability: "stable",
      analogQuality: { n: 300, clustered: true },
    },
    unverified: [],
    historicalAnalog: {
      setup: "",
      analogs: [],
      baseRates: [],
      caveat: "",
    },
    considerations: { forStyle: [], invalidation: [], questions: [] },
    sources: [],
  };
}

// A prohibited verdict phrase: the guard rewrites this.
const DIRTY = baseBriefing("Final Recommendation: BUY AAPL", "You should enter here.");

// No prohibited language: the guard must leave this untouched.
const CLEAN = baseBriefing("rAAPL swing stress test", "Cross-examined the 24/7 basis against the NY cash close.");

function run(b: Briefing): number {
  let count = -1;
  guardBriefing(b, (c) => {
    count = c;
  });
  return count;
}

const dirtyCount = run(DIRTY);
check("a memo with prohibited language reports a rewrite", dirtyCount > 0);
check("the report is non-negative (sentinel not left behind)", dirtyCount >= 0);

const cleanCount = run(CLEAN);
check("a clean memo reports zero rewrites", cleanCount === 0);

// THE REGRESSION: with shared module state, the clean run overwrote the dirty
// run's value, so the dirty run's result was unrecoverable and a reader asking
// after the second call saw the wrong number. Each call must now own its count.
check(
  "a clean run does not clobber a prior run's rewrite count",
  dirtyCount > 0 && cleanCount === 0,
);

// Reverse order proves independence, not ordering luck.
const cleanFirst = run(CLEAN);
const dirtySecond = run(DIRTY);
check(
  "results are order-independent: clean-then-dirty stays distinguishable",
  cleanFirst === 0 && dirtySecond > 0,
);

// Interleaving guard runs must not bleed into one another.
const a = run(DIRTY);
const b = run(CLEAN);
const c = run(DIRTY);
check("interleaved runs each report their own outcome", a > 0 && b === 0 && c > 0);

// The shared accessors are gone entirely rather than merely unused.
const guardModule = guardBriefing as unknown as Record<string, unknown>;
check("no module-level rewrite-state accessor remains on the guard", guardModule !== undefined);
import * as guardApi from "../lib/language-guard";
check(
  "didLastGuardRewrite is no longer exported (state cannot leak)",
  (guardApi as Record<string, unknown>).didLastGuardRewrite === undefined,
);
check(
  "getLastRewriteCount is no longer exported (state cannot leak)",
  (guardApi as Record<string, unknown>).getLastRewriteCount === undefined,
);

console.log(`\n${passed} language-guard-concurrency checks passed.`);