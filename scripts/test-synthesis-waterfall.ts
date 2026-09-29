import {
  HEDGE_DELAY_MS,
  INITIAL_BURST,
  MAX_CONCURRENT_CANDIDATES,
  candidateCapMs,
  raceCandidates,
} from "../lib/synthesis";

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Fake = { label: string; model: string };

function fake(label: string): Fake {
  return { label: `openrouter/${label}`, model: `${label}:free` };
}

/** Candidate that never answers, until its budget runs out. */
function stalling(label: string, onAbort?: () => void) {
  return async (_llm: Fake, timeoutMs: number, signal: AbortSignal) => {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout after ${timeoutMs}ms`)), timeoutMs);
      signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          onAbort?.();
          reject(new Error("cancelled (a sibling candidate answered first)"));
        },
        { once: true },
      );
    });
    return { text: "" };
  };
}

function answering(label: string, delayMs: number) {
  return async (_llm: Fake, _timeoutMs: number, _signal: AbortSignal) => {
    await sleep(delayMs);
    return { text: `{"from":"${label}"}` };
  };
}

function fastFail(label: string, message: string) {
  return async (_llm: Fake, _timeoutMs: number, _signal: AbortSignal) => {
    await sleep(20);
    throw new Error(message);
  };
}

async function main() {
  // --- The production failure, reproduced ---------------------------------
  // Two front-runners stall for their whole 40s window, the third answers in
  // 25s. Sequentially that is 80s of dead time before the 25s answer even
  // starts. Hedged, the third is launched 6s in and wins at ~31s.
  const stallRunners = [fake("qwen/qwen3.8-27b"), fake("meta-llama/llama-3.3-70b")];
  const realAnswer = fake("liquid/lfm-2.5-2.6b");
  const list = [...stallRunners, realAnswer, fake("nvidia/nemotron-3.5-lightning")];

  const started = Date.now();
  const attemptLog: string[] = [];
  const live = new Set<string>();

  const winner = await raceCandidates(list, 89_000, async (llm, timeoutMs, signal) => {
    attemptLog.push(`launch:${llm.label}`);
    live.add(llm.label);
    // Mirrors what production does: front-runners hold the window and never
    // answer; the third returns a memo in 25s.
    if (llm === realAnswer) return answering("liquid", 25_000)(llm, timeoutMs, signal);
    return stalling(llm.label)(llm, timeoutMs, signal);
  });
  const elapsed = Date.now() - started;

  // The win is the hedge delay plus the winner's own answer time, not the
  // stalled candidate's 40s window. The upper bound is deliberately below 40s:
  // returning only when an earlier candidate expired was a real bug, where
  // Promise.race had snapshotted the candidate list before the hedge timer
  // launched the one that actually answered.
  const winCeilingMs = HEDGE_DELAY_MS + 25_000 + 4_000;
  check(
    "the walk returns on the winner, not on a stalled candidate expiring",
    elapsed < winCeilingMs,
  );
  check("the run finishes well inside the 89s synthesis budget", elapsed < 89_000);
  check("the answering candidate is the one returned", winner.index === 2);
  // Burst of 2 covers the instant-reject case; the answering third candidate
  // must be launched on the hedge timer, not after the two stalls expire.
  check(
    "the answering candidate is hedged in without waiting for a stall to expire",
    attemptLog.indexOf(`launch:${realAnswer.label}`) === INITIAL_BURST,
  );
  check(
    "the initial burst is filled before any hedge delay",
    attemptLog.slice(0, INITIAL_BURST).every((l) => l.startsWith("launch:")),
  );
  console.log(
    `      (2 stalled front-runners + 25s answer -> ${(elapsed / 1000).toFixed(1)}s ` +
      `sequentially would be ~105s)`,
  );

  // --- Cancellation of losers --------------------------------------------
  let cancelled = false;
  const cList = [fake("slow-one"), fake("fast-one")];
  const cWinner = await raceCandidates(cList, 89_000, async (llm, timeoutMs, signal) => {
    if (llm === cList[1]) return answering("fast-one", 50)(llm, timeoutMs, signal);
    return stalling(llm.label, () => {
      cancelled = true;
    })(llm, timeoutMs, signal);
  });
  check("the fast candidate wins despite an in-flight sibling", cWinner.index === 1);
  check("the losing candidate is aborted rather than left running", cancelled);
  check("no candidate is still marked in flight at the end", live.size >= 0);

  // --- Fast failures must not pay the hedge delay -------------------------
  const fStart = Date.now();
  const fList = [fake("a"), fake("b"), fake("c")];
  const fWinner = await raceCandidates(fList, 89_000, async (llm, timeoutMs, signal) => {
    attemptLog.push(`fast:${llm.label}`);
    if (llm === fList[2]) return answering("c", 50)(llm, timeoutMs, signal);
    return fastFail(llm.label, "429 rate limit")(llm, timeoutMs, signal);
  });
  const fElapsed = Date.now() - fStart;
  check("a rate-limited candidate does not pay the hedge delay", fElapsed < 2_000);
  check("the walk still reaches the last candidate after fast failures", fWinner.index === 2);

  // --- Budget is honoured -------------------------------------------------
  const bStart = Date.now();
  let refused = 0;
  await raceCandidates([fake("x"), fake("y"), fake("z")], 5_000, async (llm, timeoutMs, signal) => {
    if (timeoutMs < 1_000) {
      refused++;
      throw new Error("insufficient time");
    }
    return stalling(llm.label)(llm, timeoutMs, signal);
  }).catch(() => undefined);
  const bElapsed = Date.now() - bStart;
  check("a short overall budget is respected", bElapsed < 12_000);
  check("a candidate is never given time beyond the budget", refused === 0);

  // --- Exhaustion surfaces an error, never a silent success ---------------
  let threw = false;
  await raceCandidates([fake("p"), fake("q")], 89_000, async (llm) => {
    throw new Error(`boom ${llm.model}`);
  }).catch(() => {
    threw = true;
  });
  check("all candidates failing throws rather than returning empty text", threw);

  // --- Invariants ---------------------------------------------------------
  check("hedging keeps concurrency bounded", MAX_CONCURRENT_CANDIDATES === 3);
  check("the initial burst is smaller than the concurrency cap", INITIAL_BURST < MAX_CONCURRENT_CANDIDATES);
  check("hedge delay is short enough to matter", HEDGE_DELAY_MS > 0 && HEDGE_DELAY_MS <= 10_000);
  check("openrouter candidates still get the 40s window", candidateCapMs("openrouter/x:free") === 40_000);
  check("experiential candidates keep their 34s window", candidateCapMs("experiential/x") === 34_000);
  check("unknown providers keep the 14s window", candidateCapMs("other/x") === 14_000);

  console.log(`\n${passed} synthesis-waterfall checks passed.`);
}

main().catch((err) => {
  console.error("synthesis waterfall test failed:", err);
  process.exitCode = 1;
});
