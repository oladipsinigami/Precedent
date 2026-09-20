// Smoke test for the language guard — the product's hard compliance layer.
// Runs the documented edge cases and exits non-zero on any failure so it can
// gate deploys (CI, pre-demo check, or Vercel build step).
//
// Usage: npm test

import { runLanguageGuardSelfTest } from "../lib/language-guard";

const { passed, results } = runLanguageGuardSelfTest();

for (const r of results) {
  const mark = r.passed ? "PASS" : "FAIL";
  console.log(`[${mark}] ${r.label}`);
  if (!r.passed) {
    console.log(`       input:  "${r.input}"`);
    console.log(`       output: "${r.output}"`);
  }
}

if (!passed) {
  console.error(`\n${results.filter((r) => !r.passed).length}/${results.length} language-guard cases failed.`);
  process.exit(1);
}
console.log(`\nAll ${results.length} language-guard cases passed.`);
