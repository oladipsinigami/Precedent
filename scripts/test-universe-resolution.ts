import assert from "node:assert/strict";
import { findName, findNameBySymbol, findNameOrDefault } from "../lib/universe";

let passed = 0;
function check(label: string, fn: () => void) {
  fn();
  console.log(`ok - ${label}`);
  passed++;
}

// An explicitly selected instrument must beat any ticker that merely appears in
// the question text. Scanning the combined string in universe order used to let
// an early mention of a different instrument hijack the run.
check("selected symbol wins over an earlier ticker in the question", () => {
  const symbol = "TSLA";
  const question = "Stress-test the current TSLA rToken setup, and compare it to AAPL.";
  assert.equal(findNameBySymbol(symbol)?.native, "TSLA");
  // The old combined-text scan resolved this to AAPL.
  assert.equal(findName(`${symbol} ${question}`)?.native, "AAPL");
});

check("selection is resolved case-insensitively by native or rToken", () => {
  assert.equal(findNameBySymbol("tsla")?.native, "TSLA");
  assert.equal(findNameBySymbol(" rTSLA ")?.native, "TSLA");
});

check("an empty or unknown selection does not fabricate an instrument", () => {
  assert.equal(findNameBySymbol(""), undefined);
  assert.equal(findNameBySymbol("   "), undefined);
  assert.equal(findNameBySymbol("NOTALISTEDCO"), undefined);
});

check("questions without a selection still resolve by name", () => {
  assert.equal(findName("how does tesla look into earnings")?.native, "TSLA");
  assert.equal(findNameOrDefault("how does tesla look")?.native, "TSLA");
});

console.log(`${passed} universe-resolution checks passed`);
