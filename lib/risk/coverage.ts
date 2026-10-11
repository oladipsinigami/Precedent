import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Bar } from "../indicators";
import { boundaryAtShare, COVERAGE_TARGET } from "./risk-pillar";

export type JournalKind = "ordinary" | "earnings";

export type JournalEntry = {
  date: string;
  stock: string;
  kind: JournalKind;
  boundaryPct: number;
  targetShareInside: number;
  lockedAt: string;
  actualPct: number | null;
  result: "pending" | "inside" | "outside";
  gradedAt: string | null;
  sampleN: number;
  basis: string;
};

export type JournalFile = {
  version: 1;
  updatedAt: string;
  entries: JournalEntry[];
};

const DATA_DIR = path.join(process.cwd(), "data");
const JOURNAL_PATH = path.join(DATA_DIR, "coverage-journal.json");

export function readJournal(): JournalFile {
  try {
    const raw = readFileSync(JOURNAL_PATH, "utf8");
    const parsed = JSON.parse(raw) as JournalFile;
    if (!Array.isArray(parsed.entries)) throw new Error("entries missing");
    return parsed;
  } catch {
    return { version: 1, updatedAt: new Date().toISOString(), entries: [] };
  }
}

export function writeJournal(file: JournalFile): void {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(JOURNAL_PATH, `${JSON.stringify(file, null, 2)}\n`, "utf8");
}

export function entryKey(stock: string, date: string, kind: JournalKind): string {
  return `${stock}|${date}|${kind}`;
}

export function lockRange(file: JournalFile, entry: JournalEntry): boolean {
  const key = entryKey(entry.stock, entry.date, entry.kind);
  if (file.entries.some((existing) => entryKey(existing.stock, existing.date, existing.kind) === key)) {
    return false;
  }
  file.entries.push({ ...entry, actualPct: null, result: "pending", gradedAt: null });
  return true;
}

export function gradeEntry(entry: JournalEntry, actualPct: number): JournalEntry {
  if (entry.result !== "pending") return entry;
  const inside = Math.abs(actualPct) <= entry.boundaryPct;
  return {
    ...entry,
    actualPct,
    result: inside ? "inside" : "outside",
    gradedAt: new Date().toISOString(),
  };
}

export type JournalSummary = {
  locked: number;
  graded: number;
  pending: number;
  inside: number;
  outside: number;
  shareInside: number | null;
  targetShareInside: number;
  streak: { date: string; stock: string; kind: JournalKind; boundaryPct: number; actualPct: number | null; result: JournalEntry["result"] }[];
};

export function summarize(file: JournalFile, limit = 60): JournalSummary {
  const graded = file.entries.filter((entry) => entry.result !== "pending");
  const inside = graded.filter((entry) => entry.result === "inside").length;
  const ordered = [...file.entries].sort((a, b) => b.date.localeCompare(a.date) || a.stock.localeCompare(b.stock));

  return {
    locked: file.entries.length,
    graded: graded.length,
    pending: file.entries.length - graded.length,
    inside,
    outside: graded.length - inside,
    shareInside: graded.length ? inside / graded.length : null,
    targetShareInside: COVERAGE_TARGET,
    streak: ordered.slice(0, limit).map((entry) => ({
      date: entry.date,
      stock: entry.stock,
      kind: entry.kind,
      boundaryPct: entry.boundaryPct,
      actualPct: entry.actualPct,
      result: entry.result,
    })),
  };
}

export function sessionReturnPct(bars: Bar[], date: string): number | null {
  const dates = bars.map((bar) => new Date(bar.t * 1000).toISOString().slice(0, 10));
  const index = dates.indexOf(date);
  if (index < 1) return null;
  const prev = bars[index - 1].c;
  const cur = bars[index].c;
  if (!prev || prev <= 0) return null;
  return ((cur - prev) / prev) * 100;
}

export function ordinaryBoundaryFrom(bars: Bar[], excludeDates: ReadonlySet<string>): { boundaryPct: number; sampleN: number } | null {
  const moves: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const iso = new Date(bars[i].t * 1000).toISOString().slice(0, 10);
    if (excludeDates.has(iso)) continue;
    const prev = bars[i - 1].c;
    if (!prev || prev <= 0) continue;
    moves.push(((bars[i].c - prev) / prev) * 100);
  }
  const boundary = boundaryAtShare(moves, COVERAGE_TARGET);
  if (boundary === null) return null;
  return { boundaryPct: boundary, sampleN: moves.length };
}

export const JOURNAL_FILE = JOURNAL_PATH;