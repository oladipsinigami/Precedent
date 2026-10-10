import assert from "node:assert/strict";
import { applyLossLimit, mergeClaudeIntent, parseTradeIntent } from "../lib/risk/parse-trade";

type Expectation = {
  sentence: string;
  asset?: string;
  side?: "LONG" | "SHORT";
  notionalUsd?: number;
  holdSessions?: number;
  maxLossUsd?: number;
};

const cases: Expectation[] = [
  {
    sentence: "buy $10k rNVDA, holding 5 days, max loss $600",
    asset: "NVDA", side: "LONG", notionalUsd: 10_000, holdSessions: 5, maxLossUsd: 600,
  },
  {
    sentence: "What happens if I hold 20k NVDA for 5 days with 600 limit?",
    asset: "NVDA", side: "LONG", notionalUsd: 20_000, holdSessions: 5, maxLossUsd: 600,
  },
  {
    sentence: "long $5,000 of TSLA for 3 days, I can lose 250",
    asset: "TSLA", side: "LONG", notionalUsd: 5_000, holdSessions: 3, maxLossUsd: 250,
  },
  {
    sentence: "short 8k AMD until Friday, stop me at 400",
    asset: "AMD", side: "SHORT", notionalUsd: 8_000, maxLossUsd: 400,
  },
  {
    sentence: "go long meta 12k, 1 week, max loss 3%",
    asset: "META", side: "LONG", notionalUsd: 12_000, holdSessions: 5, maxLossUsd: undefined,
  },
  {
    sentence: "bet against Tesla with 4000 for 10 days, 5% max loss",
    asset: "TSLA", side: "SHORT", notionalUsd: 4_000, holdSessions: 10,
  },
  {
    sentence: "rAMZN 7500 two days limit 300",
    asset: "AMZN", notionalUsd: 7_500, holdSessions: 2, maxLossUsd: 300,
  },
  {
    sentence: "hold googl perp 25k 3 days, cap loss at $900",
    asset: "GOOGL", notionalUsd: 25_000, holdSessions: 3, maxLossUsd: 900,
  },
  {
    sentence: "HOOD 1,500 dollars 1 day risk $60",
    asset: "HOOD", notionalUsd: 1_500, holdSessions: 1, maxLossUsd: 60,
  },
  {
    sentence: "$10k long Apple for a week, 2% limit",
    asset: undefined, side: "LONG", notionalUsd: 10_000, holdSessions: 5,
  },
  {
    sentence: "what if I put 50k in nvidia for 2 days and can take 1,500 loss",
    asset: "NVDA", notionalUsd: 50_000, holdSessions: 2, maxLossUsd: 1_500,
  },
  {
    sentence: "long NVDA",
    asset: "NVDA", side: "LONG",
  },
  {
    sentence: "10k tesla",
    asset: "TSLA", notionalUsd: 10_000,
  },
  {
    sentence: "thinking about a big nvda position for a while",
    asset: "NVDA",
  },
];

let failed = 0;
let checks = 0;

function check(name: string, condition: boolean, detail: string) {
  checks += 1;
  if (condition) {
    console.log(`[PASS] ${name}`);
    return;
  }
  failed += 1;
  console.error(`[FAIL] ${name}: ${detail}`);
}

for (const expectation of cases) {
  const parsed = parseTradeIntent(expectation.sentence);
  const label = expectation.sentence;

  if (expectation.asset !== undefined) {
    check(`asset of "${label}"`, parsed.asset === expectation.asset, `expected ${expectation.asset}, got ${parsed.asset}`);
  }
  if (expectation.side !== undefined) {
    check(`side of "${label}"`, parsed.side === expectation.side, `expected ${expectation.side}, got ${parsed.side}`);
  }
  if (expectation.notionalUsd !== undefined) {
    check(
      `size of "${label}"`,
      parsed.notionalUsd === expectation.notionalUsd,
      `expected ${expectation.notionalUsd}, got ${parsed.notionalUsd}`,
    );
  }
  if (expectation.holdSessions !== undefined) {
    check(
      `hold of "${label}"`,
      parsed.holdSessions === expectation.holdSessions,
      `expected ${expectation.holdSessions}, got ${parsed.holdSessions}`,
    );
  }
  if (expectation.maxLossUsd !== undefined) {
    check(
      `loss of "${label}"`,
      parsed.maxLossUsd === expectation.maxLossUsd,
      `expected ${expectation.maxLossUsd}, got ${parsed.maxLossUsd}`,
    );
  }
}

const percentIntent = parseTradeIntent("go long meta 12k, 1 week, max loss 3%");
check("percent limit is captured", percentIntent.maxLossPct === 3, `got ${percentIntent.maxLossPct}`);
const percentResolved = applyLossLimit(percentIntent);
check("percent limit converts to dollars", percentResolved.maxLossUsd === 360, `got ${percentResolved.maxLossUsd}`);

const bare = parseTradeIntent("long NVDA");
check("bare intent reports missing fields", bare.missing.includes("notional") && bare.missing.includes("hold"), JSON.stringify(bare.missing));

const empty = parseTradeIntent("");
check("empty text reports every field missing", empty.missing.length === 4, JSON.stringify(empty.missing));

const claudeFill = mergeClaudeIntent(parseTradeIntent("long NVDA"), {
  notionalUsd: 12_000,
  holdSessions: 5,
  maxLossUsd: 400,
});
check("claude fills fields rules missed", claudeFill.notionalUsd === 12_000 && claudeFill.holdSessions === 5 && claudeFill.maxLossUsd === 400, JSON.stringify(claudeFill));
check("claude-sourced fields are attributed", claudeFill.fieldOrigins.notional === "claude" && claudeFill.fieldOrigins.asset === "rules", JSON.stringify(claudeFill.fieldOrigins));

const rulesWin = mergeClaudeIntent(parseTradeIntent("buy $10k rNVDA, holding 5 days, max loss $600"), {
  notionalUsd: 999,
  holdSessions: 99,
});
check("rules take precedence over claude", rulesWin.notionalUsd === 10_000 && rulesWin.holdSessions === 5, JSON.stringify(rulesWin));

if (failed > 0) {
  console.error(`${failed} of ${checks} trade-intent checks failed`);
  process.exit(1);
}
console.log(`${checks} trade-intent checks passed`);
void assert;