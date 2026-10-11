import assert from "node:assert/strict";
import { rankAnalogCandidates, sameIssuer } from "../lib/pillars/analogs";

type Candidate = { ticker: string; distance: number };

const cases: Array<[string, () => void]> = [];
function test(name: string, fn: () => void) {
  cases.push([name, fn]);
}

const order = (native: string, rows: Candidate[], members: string[] = []): string[] =>
  rankAnalogCandidates(native, rows, new Set(members)).map((c) => c.ticker);

test("a one-letter ticker is no longer related to a longer ticker", () => {
  // Before the fix, "AAPL".startsWith("A") put A in the related tier ahead of
  // every genuine peer. Now A and MSFT are equally unrelated, so the
  // provider's own distance decides between them.
  const result = order("AAPL", [
    { ticker: "A", distance: 0.5 },
    { ticker: "MSFT", distance: 0.6 },
    { ticker: "AAPL", distance: 0.2 },
  ]);
  assert.equal(sameIssuer("AAPL", "A", new Set()), false, "A must not count as related");
  assert.deepEqual(result, ["AAPL", "A", "MSFT"], `unexpected order: ${result.join(",")}`);
});

test("a related ticker outranks a closer unrelated one", () => {
  const result = order("AAPL", [
    { ticker: "A", distance: 0.1 },
    { ticker: "MSFT", distance: 0.9 },
  ], ["MSFT"]);
  assert.deepEqual(result, ["MSFT", "A"], `relatedness must beat distance: ${result.join(",")}`);
});

test("the same ticker outranks everything", () => {
  assert.equal(order("AAPL", [
    { ticker: "A", distance: 0.1 },
    { ticker: "AAPL", distance: 0.9 },
  ])[0], "AAPL");
});

test("a share-class sibling ranks as related", () => {
  const result = order("GOOGL", [
    { ticker: "GOOG", distance: 0.7 },
    { ticker: "XOM", distance: 0.2 },
  ]);
  assert.equal(result[0], "GOOG", `GOOG should outrank XOM: ${result.join(",")}`);
});

test("a share-class relation is symmetric", () => {
  const result = order("GOOG", [
    { ticker: "GOOGL", distance: 0.7 },
    { ticker: "XOM", distance: 0.2 },
  ]);
  assert.equal(result[0], "GOOGL");
});

test("community membership makes a ticker related", () => {
  const result = order("AAPL", [
    { ticker: "NVDA", distance: 0.9 },
    { ticker: "XOM", distance: 0.3 },
  ], ["NVDA"]);
  assert.equal(result[0], "NVDA", "a community member should outrank a non-member");
});

test("BA is not related to BRK.A despite the shared prefix", () => {
  const result = order("BRK.A", [
    { ticker: "BA", distance: 0.4 },
    { ticker: "BRK.B", distance: 0.9 },
  ]);
  assert.equal(result[0], "BRK.B", `BA must not outrank the real sibling: ${result.join(",")}`);
});

test("distance only breaks ties between equally related candidates", () => {
  const result = order("NVDA", [
    { ticker: "AMD", distance: 0.8 },
    { ticker: "INTC", distance: 0.4 },
  ], ["AMD", "INTC"]);
  assert.deepEqual(result, ["INTC", "AMD"], `closer community member should come first: ${result.join(",")}`);
});

test("case differences do not create false relatedness", () => {
  assert.equal(sameIssuer("AAPL", "aapl", new Set()), true);
  assert.equal(sameIssuer("AAPL", "a", new Set()), false);
});

test("an empty candidate list is fine", () => {
  assert.deepEqual(order("AAPL", []), []);
});

let failed = 0;
for (const [name, fn] of cases) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`[FAIL] ${name}`);
    console.error(err);
  }
}

if (failed > 0) {
  console.error(`${failed} of ${cases.length} analog-ranking checks failed`);
  process.exit(1);
}
console.log(`${cases.length} analog-ranking checks passed`);