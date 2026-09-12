"use client";

interface DecisionRecordProps {
  decisionNote: string;
  onDecisionNoteChange: (value: string) => void;
}

export function DecisionRecord({ decisionNote, onDecisionNoteChange }: DecisionRecordProps) {
  return (
    <section className="border-t border-[#141918]/15 bg-[#e2e9de] px-4 py-6 sm:px-10 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#486326]" />
            <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#486326]">
              Human Decision Record
            </span>
          </div>
          <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[#121614] sm:text-2xl font-display">
            What remains unresolved for you?
          </h3>
          <p className="mt-1.5 text-xs text-[#5a685c]">
            Stored in this browser session only. This space is dedicated to discretionary reflection, not automated order entry.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded border border-[#141918]/15 bg-white/40 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-[#506052]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#738275]" />
          <span>Non-Execution Record</span>
        </div>
      </div>

      <div className="mt-5 sm:mt-6">
        <textarea
          value={decisionNote}
          onChange={(event) => onDecisionNoteChange(event.target.value)}
          rows={4}
          className="w-full rounded-sm border border-[#141918]/20 bg-[#f7f4ee] p-3.5 sm:p-4 text-sm leading-relaxed text-[#141918] placeholder:text-[#78887a] outline-none transition focus:border-[#486326] focus:ring-1 focus:ring-[#486326]/40"
          placeholder="What are you waiting for? Which catalyst or price boundary would change your mind?"
        />
        <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between font-mono text-[10px] text-[#657567]">
          <span>Prompt: Explicitly state what fact or invalidation level would cause you to step aside.</span>
          <span>{decisionNote.length} characters</span>
        </div>
      </div>
    </section>
  );
}
