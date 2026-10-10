import { yahooChart } from "../lib/providers/yahoo";
import {
  type JournalEntry,
  gradeEntry,
  lockRange,
  ordinaryBoundaryFrom,
  readJournal,
  sessionReturnPct,
  summarize,
  writeJournal,
} from "../lib/risk/coverage";
import { historicalFomcDates, holdWindow, isoDay, sessionsBetween } from "../lib/risk/events";

const WATCHLIST = [
  "AAPL", "MSFT", "NVDA", "AMZN", "META", "GOOGL", "TSLA", "AMD", "AVGO", "NFLX",
  "COIN", "PLTR", "MS", "GS", "JPM", "BAC", "UNH", "XOM", "LLY", "CRM",
];

const CONCURRENCY = 4;

async function withRetry<T>(label: string, run: () => Promise<T>, attempts = 3): Promise<T | null> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await run();
    } catch (err) {
      lastError = err;
      console.error(`  ${label} attempt ${attempt}/${attempts} failed: ${String(err)}`);
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
    }
  }
  console.error(`  ${label} gave up after ${attempts} attempts: ${String(lastError)}`);
  return null;
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index] as T);
    }
  });
  await Promise.all(workers);
  return results;
}

async function run() {
  const today = isoDay(new Date());
  const journal = readJournal();
  let locked = 0;
  let graded = 0;
  const skipped: string[] = [];

  const fomcResult = await withRetry("fomc calendar", () => historicalFomcDates(), 2);
  const fomcDates = new Set(fomcResult?.dates ?? []);
  const fomcAvailable = Boolean(fomcResult?.dates.length);
  const forwardDates = sessionsBetween(today, 3);
  const tomorrow = forwardDates[1] ?? forwardDates[forwardDates.length - 1] ?? today;

  const measured = await mapWithConcurrency(WATCHLIST, CONCURRENCY, async (stock) => {
    const chart = await withRetry(`lock ${stock}`, () => yahooChart(stock, "2y", "1d"));
    if (!chart || chart.bars.length < 120) {
      skipped.push(stock);
      return null;
    }
    const exclude = new Set<string>([...fomcDates]);
    const result = ordinaryBoundaryFrom(chart.bars, exclude);
    if (!result) {
      skipped.push(stock);
      return null;
    }
    return { stock, result };
  });

  for (const item of measured) {
    if (!item) continue;
    const entry: JournalEntry = {
      date: tomorrow,
      stock: item.stock,
      kind: "ordinary",
      boundaryPct: Number(item.result.boundaryPct.toFixed(4)),
      targetShareInside: 0.8,
      lockedAt: new Date().toISOString(),
      actualPct: null,
      result: "pending",
      gradedAt: null,
      sampleN: item.result.sampleN,
      basis: fomcAvailable
        ? `80th percentile of ${item.result.sampleN} past sessions for ${item.stock}, excluding scheduled policy days, fitted before ${tomorrow}.`
        : `80th percentile of ${item.result.sampleN} past sessions for ${item.stock}, fitted before ${tomorrow}. Policy-day exclusion was unavailable on this run, so the range includes any scheduled decision day.`,
    };
    if (lockRange(journal, entry)) locked += 1;
  }

  const pending = journal.entries.filter((entry) => entry.result === "pending");
  const gradedResults = await mapWithConcurrency(pending, CONCURRENCY, async (entry) => {
    const chart = await withRetry(`grade ${entry.stock} ${entry.date}`, () => yahooChart(entry.stock, "1y", "1d"), 2);
    if (!chart) return null;
    const actual = sessionReturnPct(chart.bars, entry.date);
    if (actual === null) return null;
    return { entry, updated: gradeEntry(entry, actual) };
  });

  for (const item of gradedResults) {
    if (!item) continue;
    const index = journal.entries.indexOf(item.entry);
    if (item.updated !== item.entry) {
      journal.entries[index] = item.updated;
      graded += 1;
    }
  }

  journal.updatedAt = new Date().toISOString();
  writeJournal(journal);

  const summary = summarize(journal, 12);
  console.log(`locked ${locked} new entries for ${tomorrow}`);
  console.log(`graded ${graded} previously locked entries`);
  if (skipped.length) console.log(`skipped ${skipped.length} without usable history: ${skipped.join(", ")}`);
  if (!fomcAvailable) console.log("policy-day exclusion unavailable on this run; disclosed on every entry written");
  console.log(
    `journal: ${summary.graded} graded, ${summary.pending} pending, ` +
      `${summary.shareInside === null ? "n/a" : `${(summary.shareInside * 100).toFixed(1)}%`} inside ` +
      `against a ${(summary.targetShareInside * 100).toFixed(0)}% target`,
  );
  for (const row of summary.streak.slice(0, 8)) {
    console.log(
      `  ${row.date} ${row.stock} ${row.kind} range ±${row.boundaryPct.toFixed(2)}% ` +
        `actual ${row.actualPct === null ? "pending" : `${row.actualPct > 0 ? "+" : ""}${row.actualPct.toFixed(2)}%`} ${row.result}`,
    );
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});