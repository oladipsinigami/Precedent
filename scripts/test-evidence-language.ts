import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

// The guard bans these in model output. The same words must not be emitted by
// our own deterministic string builders, or the product reintroduces the
// judgement it claims not to make. Scans literal strings in lib/ and app/,
// skipping comments, regexes and identifiers.
//
// Reporting a provider's measured value is different from asserting our own
// view. "aggregateLean" and the bullish/bearish split are counts from a source
// and stay; what must go is a standalone adjective used as our own verdict.
const BANNED = ["constructive", "cautious", "bullish", "bearish"];
const DATA_VALUE_CONTEXT =
  /(aggregateLean|\.lean|sentimentScore|lean ===|aggregate lean|lean ===|lean:)/i;

// A bare enum literal ("constructive" on its own) is the lean vocabulary, not a
// sentence. Prose that interpolates measured counts is also fine.
const BARE_ENUM_LITERAL = /^(constructive|cautious|bullish|bearish)$/;
const MEASURED_COUNT_TEMPLATE = /% (bullish|bearish|constructive|cautious)/i;
// Naming the lean vocabulary of a provider is not a verdict.
const REPORTS_A_LEAN = /(tone|lean|sentiment|headline)/i;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === ".next-dev") continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

const STRING_LITERAL = /"([^"\n]{3,})"|'([^'\n]{3,})'|`([^`\n]{3,})`/g;

function literalsIn(file: string): string[] {
  const raw = readFileSync(file, "utf8");
  // Drop line comments and block comments so prose explaining the rule is not
  // mistaken for user-visible copy.
  const stripped = raw.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1 ");
  const found: string[] = [];
  for (const m of stripped.matchAll(STRING_LITERAL)) {
    found.push(m[1] ?? m[2] ?? m[3] ?? "");
  }
  return found;
}

const cases: Array<[string, () => void]> = [];
function test(name: string, fn: () => void) { cases.push([name, fn]); }

test("no user-visible string emits a directional adjective", () => {
  const files = [...walk("lib"), ...walk("app")];
  const offenders: string[] = [];
  for (const file of files) {
    if (file.includes("language-guard")) continue;
    for (const literal of literalsIn(file)) {
      const lower = literal.toLowerCase();
      if (DATA_VALUE_CONTEXT.test(literal)) continue;
      if (BARE_ENUM_LITERAL.test(literal)) continue;
      if (MEASURED_COUNT_TEMPLATE.test(literal)) continue;
      if (REPORTS_A_LEAN.test(literal)) continue;
      for (const word of BANNED) {
        if (lower.includes(word)) {
          offenders.push(`${file}: "${literal.slice(0, 90)}"`);
        }
      }
    }
  }
  assert.deepEqual(offenders, [], `directional words in literals:\n${offenders.join("\n")}`);
});

test("the old aggregate sentence is gone", () => {
  const files = [...walk("lib"), ...walk("app")];
  for (const file of files) {
    assert.ok(
      !readFileSync(file, "utf8").includes("broadly ${labels[0]}"),
      `${file} still builds the aggregate agreement sentence`,
    );
  }
});

test("communityStability has been renamed rather than left as an alias", () => {
  const offenders: string[] = [];
  for (const file of [...walk("lib"), ...walk("app"), ...walk("scripts")]) {
    if (file.includes("test-")) continue;
    if (readFileSync(file, "utf8").includes("communityStability")) offenders.push(file);
  }
  assert.deepEqual(offenders, [], `stale communityStability in: ${offenders.join(", ")}`);
});

test("the community flag only claims availability", () => {
  const flags = readFileSync("lib/flags.ts", "utf8");
  const lines = flags.split("\n");
  const start = lines.findIndex((line) => line.includes("const communityData"));
  assert.ok(start >= 0, "communityData assignment not found");
  const block = lines.slice(start, start + 4).join("\n");
  assert.ok(/available|unavailable/.test(block), "must be an availability pair");
  assert.ok(!/stable|unstable/.test(block), "must not describe stability");
});

test("the clustering threshold is a named constant", () => {
  const flags = readFileSync("lib/flags.ts", "utf8");
  assert.ok(flags.includes("TIGHT_BAND_SPAN_PCT"), "threshold constant missing");
  assert.ok(flags.includes("Tunable"), "threshold needs a comment saying it is tunable");
});

let failed = 0;
for (const [name, fn] of cases) {
  try { fn(); console.log(`[PASS] ${name}`); }
  catch (err) { failed += 1; console.error(`[FAIL] ${name}`); console.error(err); }
}
if (failed > 0) { console.error(`${failed} of ${cases.length} evidence-language checks failed`); process.exit(1); }
console.log(`${cases.length} evidence-language checks passed`);