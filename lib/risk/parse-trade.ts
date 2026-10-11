import { UNIVERSE } from "../universe";

export type TradeIntent = {
  asset?: string;
  rToken?: string;
  side: "LONG" | "SHORT";
  notionalUsd?: number;
  holdSessions?: number;
  maxLossUsd?: number;
  maxLossPct?: number;
  fieldOrigins: Record<"asset" | "notional" | "hold" | "loss", "rules" | "claude" | "none">;
  missing: Array<"asset" | "notional" | "hold" | "loss">;
};

const SIZE_UNITS: Record<string, number> = {
  k: 1_000, thousand: 1_000, grand: 1_000,
  m: 1_000_000, million: 1_000_000, mm: 1_000_000,
};

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, couple: 2, few: 3,
};

const KNOWN_TICKERS = new Map<string, string>();
for (const card of UNIVERSE) {
  KNOWN_TICKERS.set(card.native.toLowerCase(), card.native);
  KNOWN_TICKERS.set(card.rToken.toLowerCase(), card.native);
  for (const alias of card.aliases) KNOWN_TICKERS.set(alias.toLowerCase(), card.native);
}

type Amount = {
  value: number;
  start: number;
  end: number;
  text: string;
};

const TIME_UNITS = /^(?:trading\s+)?(days?|sessions?|weeks?|months?)\b/;
const LOSS_AFTER = /^(?:limit|loss|stop|risk|cap|budget)\b/;
const LOSS_BEFORE = /\b(max loss|loss limit|loss cap|maximum loss|cap loss|lose at most|can lose|can take|stop me at|willing to lose|risk|tolerate|budget|limit|loss|stop|cap)(?:\s+\w+){0,2}\s*\$?$/;

function scanAmounts(text: string): Amount[] {
  const out: Amount[] = [];
  const pattern = /(\d[\d,._]*)\s*(thousand|million|grand|mm|k|m)?\b/gi;
  for (const match of text.matchAll(pattern)) {
    const raw = match[1].replace(/[,_]/g, "");
    const base = Number(raw);
    if (!Number.isFinite(base)) continue;
    const unitToken = match[2]?.toLowerCase();
    const unit = unitToken ? SIZE_UNITS[unitToken] : 1;
    if (unit === undefined) continue;
    const start = match.index ?? 0;
    out.push({ value: base * unit, start, end: start + match[0].length, text: match[0] });
  }
  return out;
}

type AmountRole = "loss" | "hold" | "size" | "percent";

function classifyAmount(amount: Amount, lower: string): AmountRole {
  const rawAfter = lower.slice(amount.end);
  if (/^\s*%/.test(rawAfter)) return "percent";

  const after = rawAfter.replace(/^\s+/, "");
  const before = lower.slice(0, amount.start).replace(/\s+$/, "");

  if (TIME_UNITS.test(after)) return "hold";
  if (LOSS_AFTER.test(after)) return "loss";
  if (LOSS_BEFORE.test(before)) return "loss";

  const afterTwo = after.split(/[\s,.;?!]+/).slice(0, 2).join(" ");
  if (LOSS_AFTER.test(afterTwo)) return "loss";

  return "size";
}

function findAsset(text: string): { asset?: string; rToken?: string } {
  const lower = text.toLowerCase();
  for (const card of UNIVERSE) {
    const candidates = [card.native.toLowerCase(), card.rToken.toLowerCase(), ...card.aliases];
    for (const candidate of candidates) {
      if (!candidate) continue;
      const pattern = new RegExp(`(?<![a-z0-9])${candidate.replace(/[^a-z0-9]/g, "")}(?![a-z0-9])`, "i");
      if (pattern.test(lower)) return { asset: card.native, rToken: card.rToken };
    }
  }

  const token = text.match(/(?<![A-Za-z0-9])r?([A-Z]{2,5})(?![A-Za-z0-9])/);
  if (token) {
    const bare = token[0].replace(/^r/, "").toUpperCase();
    if (bare.length >= 2) return { asset: bare, rToken: `r${bare}` };
  }
  return {};
}

function wordToNumber(token: string): number | undefined {
  const lower = token.toLowerCase();
  if (/^\d+$/.test(lower)) return Number(lower);
  return NUMBER_WORDS[lower];
}

function parseHoldSessions(text: string, consumed: Amount[]): number | undefined {
  const lower = text.toLowerCase();

  const explicit = lower.match(/(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|couple|few)\s*(?:trading\s*)?(days?|sessions?)/);
  if (explicit) {
    const value = wordToNumber(explicit[1]);
    if (value !== undefined && value > 0) return Math.round(value);
  }

  const weeks = lower.match(/(\d+|a|an|one|two|three|four|five)\s*weeks?/);
  if (weeks) {
    const token = weeks[1];
    const value = token === "a" || token === "an" ? 1 : wordToNumber(token);
    if (value !== undefined) return Math.round(value * 5);
  }

  const months = lower.match(/(\d+|one|two|three)\s*months?/);
  if (months) {
    const value = wordToNumber(months[1]);
    if (value !== undefined) return Math.round(value * 21);
  }

  for (const amount of consumed) {
    const after = lower.slice(amount.end, amount.end + 24);
    if (/\b(one|two|three|four|five|couple|few)\b/.test(after)) {
      const word = after.match(/\b(one|two|three|four|five|couple|few)\b/);
      if (word) {
        const value = wordToNumber(word[1]);
        if (value !== undefined) return Math.round(value);
      }
    }
  }

  if (/\bovernight\b/.test(lower)) return 1;
  if (/\bthis week\b|\bnext week\b|\bthe week\b/.test(lower)) return 5;
  return undefined;
}

export function parseTradeIntent(text: string): TradeIntent {
  const origins: TradeIntent["fieldOrigins"] = { asset: "none", notional: "none", hold: "none", loss: "none" };
  const intent: TradeIntent = {
    side: "LONG",
    fieldOrigins: origins,
    missing: [],
  };

  if (!text || !text.trim()) {
    intent.missing = ["asset", "notional", "hold", "loss"];
    return intent;
  }

  const lower = text.toLowerCase();
  if (/\b(short|sell|selling|against|bearish|put|shorted)\b/.test(lower)) intent.side = "SHORT";

  const asset = findAsset(text);
  if (asset.asset) {
    intent.asset = asset.asset;
    intent.rToken = asset.rToken;
    origins.asset = "rules";
  }

  const amounts = scanAmounts(text);
  const lossAmounts: Amount[] = [];
  const holdAmounts: Amount[] = [];
  const sizeAmounts: Amount[] = [];
  const percentAmounts: Amount[] = [];

  for (const amount of amounts) {
    const role = classifyAmount(amount, lower);
    if (role === "percent") percentAmounts.push(amount);
    else if (role === "loss") lossAmounts.push(amount);
    else if (role === "hold") holdAmounts.push(amount);
    else sizeAmounts.push(amount);
  }

  const lossAmount = lossAmounts[0];
  if (lossAmount) {
    intent.maxLossUsd = lossAmount.value;
    origins.loss = "rules";
  } else {
    const percentAmount = percentAmounts[0];
    if (percentAmount) {
      const before = lower.slice(0, percentAmount.start).replace(/\s+$/, "");
      const after = lower.slice(percentAmount.end).replace(/^\s*%/, "").replace(/^\s+/, "");
      if (LOSS_AFTER.test(after) || LOSS_BEFORE.test(before)) {
        const value = percentAmount.value;
        if (Number.isFinite(value) && value > 0 && value <= 100) {
          intent.maxLossPct = value;
          origins.loss = "rules";
        }
      }
    }
  }

  const sizeAmount = sizeAmounts[0];
  if (sizeAmount) {
    intent.notionalUsd = sizeAmount.value;
    origins.notional = "rules";
  }

  const holdSessions = parseHoldSessions(text, holdAmounts);
  if (holdSessions !== undefined) {
    intent.holdSessions = holdSessions;
    origins.hold = "rules";
  }

  if (!intent.asset) intent.missing.push("asset");
  if (intent.notionalUsd === undefined) intent.missing.push("notional");
  if (intent.holdSessions === undefined) intent.missing.push("hold");
  if (intent.maxLossUsd === undefined && intent.maxLossPct === undefined) intent.missing.push("loss");

  return intent;
}

export function applyLossLimit(intent: TradeIntent): TradeIntent {
  if (intent.maxLossUsd !== undefined || intent.maxLossPct === undefined || !intent.notionalUsd) {
    return intent;
  }
  return { ...intent, maxLossUsd: (intent.notionalUsd * intent.maxLossPct) / 100 };
}

export function mergeClaudeIntent(
  rules: TradeIntent,
  fromClaude: Partial<Omit<TradeIntent, "fieldOrigins" | "missing">>,
): TradeIntent {
  const origins = { ...rules.fieldOrigins };
  if (fromClaude.asset && !rules.asset) origins.asset = "claude";
  if (fromClaude.notionalUsd !== undefined && rules.notionalUsd === undefined) origins.notional = "claude";
  if (fromClaude.holdSessions !== undefined && rules.holdSessions === undefined) origins.hold = "claude";
  if (
    (fromClaude.maxLossUsd !== undefined || fromClaude.maxLossPct !== undefined) &&
    rules.maxLossUsd === undefined &&
    rules.maxLossPct === undefined
  ) {
    origins.loss = "claude";
  }

  const merged: TradeIntent = {
    side: fromClaude.side ?? rules.side,
    asset: rules.asset ?? fromClaude.asset,
    rToken: rules.rToken ?? fromClaude.rToken,
    notionalUsd: rules.notionalUsd ?? fromClaude.notionalUsd,
    holdSessions: rules.holdSessions ?? fromClaude.holdSessions,
    maxLossUsd: rules.maxLossUsd ?? fromClaude.maxLossUsd,
    maxLossPct: rules.maxLossPct ?? fromClaude.maxLossPct,
    fieldOrigins: origins,
    missing: [],
  };

  if (!merged.asset) merged.missing.push("asset");
  if (merged.notionalUsd === undefined) merged.missing.push("notional");
  if (merged.holdSessions === undefined) merged.missing.push("hold");
  if (merged.maxLossUsd === undefined && merged.maxLossPct === undefined) merged.missing.push("loss");

  return merged;
}

export function intentIsComplete(intent: TradeIntent): boolean {
  return intent.missing.length === 0;
}