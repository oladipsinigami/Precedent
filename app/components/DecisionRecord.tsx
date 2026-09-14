"use client";

import { useEffect, useRef } from "react";

interface DecisionRecordProps {
  decisionNote: string;
  onDecisionNoteChange: (value: string) => void;
}

const DEFAULT_PROMPTS_TEMPLATE = `1. What would make me wait or step aside?
- 

2. What price level or news would change my mind?
- 

3. Am I comfortable holding if the price drops 3–4% in the next few days?
- 

4. Is the overnight Bitget price more important to me than the regular daytime stock price?
- `;

const GUIDED_PROMPTS = [
  "What would make me wait or step aside?",
  "What price level or news would change my mind?",
  "Am I comfortable holding if the price drops 3–4% in the next few days?",
  "Is the overnight Bitget price more important to me than the regular daytime stock price?",
];

export function DecisionRecord({ decisionNote, onDecisionNoteChange }: DecisionRecordProps) {
  const hasInitializedRef = useRef(false);

  // Pre-fill the 3-4 practical reflection prompts if the note is empty upon initial view
  useEffect(() => {
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      if (!decisionNote) {
        onDecisionNoteChange(DEFAULT_PROMPTS_TEMPLATE);
      }
    }
  }, [decisionNote, onDecisionNoteChange]);

  function addPrompt(prompt: string) {
    const formatted = `Prompt: ${prompt}\n- `;
    const updated = decisionNote.trim() ? `${decisionNote.trim()}\n\n${formatted}` : formatted;
    onDecisionNoteChange(updated);
  }

  function handleClear() {
    onDecisionNoteChange("");
  }

  function handleReset() {
    onDecisionNoteChange(DEFAULT_PROMPTS_TEMPLATE);
  }

  return (
    <section className="border-t border-[#141918]/15 bg-[#e2e9de] px-4 py-6 sm:px-10 sm:py-10">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#486326]" />
            <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#486326]">
              Personal Reflection
            </span>
          </div>
          <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[#121614] sm:text-2xl font-display">
            Human Decision Record – Personal Reflection
          </h3>
          <p className="mt-1 font-mono text-xs font-medium text-[#486326]">
            Your Personal Notes (Non-Execution)
          </p>
        </div>

        <div className="flex items-center gap-2 rounded border border-[#141918]/15 bg-white/60 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-[#344236] shadow-xs">
          <span className="h-1.5 w-1.5 rounded-full bg-[#486326]" />
          <span>Non-Execution · Browser-Only</span>
        </div>
      </div>

      {/* Prominent Non-Execution Notice */}
      <div className="mt-4 rounded-sm border border-[#486326]/25 bg-[#fbf8f2] p-3.5 text-xs leading-relaxed text-[#3f4c41]">
        <div className="flex items-start gap-2.5">
          <span className="text-base leading-none select-none">🔒</span>
          <div>
            <strong className="text-[#18211a]">Strictly Personal Reflection — No Order Will Ever Be Sent: </strong>
            <span>
              This workspace is purely for your private discretionary thinking before making any choice. Precedent is an educational research tool. It does not connect to brokers or exchange accounts, cannot route orders, and keeps your notes in this browser tab only.
            </span>
          </div>
        </div>
      </div>

      <div className="mt-6">
        {/* Guided Prompts Card Header */}
        <div className="mb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-[#303c32]">
              Guided reflection prompts (pre-filled below):
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleReset}
                className="rounded border border-[#141918]/15 bg-white/50 px-2.5 py-1 font-mono text-[11px] text-[#344236] transition hover:bg-white hover:text-[#18211a]"
                title="Reset note back to default guided prompts"
              >
                Reset prompts
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="rounded border border-[#141918]/15 bg-white/50 px-2.5 py-1 font-mono text-[11px] text-[#7a3b3b] transition hover:bg-[#fae8e8] hover:text-[#5a2020]"
                title="Clear all notes in the text area"
              >
                Clear notes
              </button>
            </div>
          </div>

          <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
            {GUIDED_PROMPTS.map((prompt, index) => (
              <button
                key={prompt}
                type="button"
                onClick={() => addPrompt(prompt)}
                className="rounded border border-[#141918]/12 bg-white/50 px-3 py-2 text-left text-xs leading-relaxed text-[#344236] transition hover:border-[#486326]/45 hover:bg-white active:scale-[0.99]"
              >
                <span className="font-semibold text-[#486326]">{index + 1}.</span> {prompt}
              </button>
            ))}
          </div>
        </div>

        {/* Free-text reflection textarea */}
        <textarea
          value={decisionNote}
          onChange={(event) => onDecisionNoteChange(event.target.value)}
          rows={8}
          className="w-full rounded-sm border border-[#141918]/20 bg-[#fbf8f2] p-3.5 sm:p-4 text-sm leading-relaxed text-[#141918] placeholder:text-[#78887a] outline-none transition focus:border-[#486326] focus:ring-1 focus:ring-[#486326]/40 font-sans"
          placeholder="Write your personal reflections, plan boundaries, and answers to the prompts above..."
        />

        {/* Footer info */}
        <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between font-mono text-[10px] text-[#5c6e5e]">
          <span>Non-execution record: Stored locally in this browser tab only. No order will ever be sent.</span>
          <span>{decisionNote.length} characters</span>
        </div>
      </div>
    </section>
  );
}
