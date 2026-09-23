"use client";

import { useEffect, useRef } from "react";

interface DecisionRecordProps {
  decisionNote: string;
  onDecisionNoteChange: (value: string) => void;
}

const DEFAULT_PROMPTS_TEMPLATE = `1. What market evidence or tape action would cause me to step aside?
- 

2. At what specific price boundary or catalyst disclosure is my thesis invalidated?
- 

3. What is my maximum tolerable drawdown if this asset moves 3–5% against me over the holding horizon?
- 

4. How am I weighting 24/7 Bitget tokenized tape liquidity vs. primary US exchange daytime session context?
- `;

const GUIDED_PROMPTS = [
  "What market evidence or tape action would cause me to step aside?",
  "At what specific price boundary or catalyst disclosure is my thesis invalidated?",
  "What is my maximum tolerable drawdown if this asset moves 3–5% against me?",
  "How am I weighting 24/7 Bitget venue tape vs. primary US daytime session context?",
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
    <section
      id="decision-record"
      className="relative scroll-mt-6 border-t-2 border-[#486326] bg-[#e2e9de] px-4 py-6 shadow-[0_-18px_44px_-24px_rgba(18,22,20,0.45)] sm:px-10 sm:py-10"
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#486326]" />
            <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#486326]">
              Trader Deliberation Canvas
            </span>
          </div>
          <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[#121614] sm:text-2xl font-display">
            ✦ Trader Decision Record · Deliberative Journal
          </h3>
          <p className="mt-1 font-mono text-xs font-medium text-[#486326]">
            Private Pre-Trade Deliberation & Risk Framing (Non-Execution)
          </p>
        </div>

        <div className="flex items-center gap-2 rounded border border-[#141918]/15 bg-white/60 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-[#344236] shadow-xs">
          <span className="h-1.5 w-1.5 rounded-full bg-[#486326]" />
          <span>Non-Execution · Auto-saved Locally</span>
        </div>
      </div>

      {/* Prominent Non-Execution Notice */}
      <div className="mt-4 rounded-sm border border-[#486326]/25 bg-[#fbf8f2] p-3.5 text-xs leading-relaxed text-[#3f4c41]">
        <div className="flex items-start gap-2.5">
          <span className="text-base leading-none select-none">🔒</span>
          <div>
            <strong className="text-[#18211a]">Strictly Private Discretionary Journal · Non-Execution Sandbox: </strong>
            <span>
              Precedent is an institutional intelligence workbench designed exclusively for pre-trade clarity. It does not interface with brokerage accounts or exchanges, cannot execute trades, and saves your notes exclusively to this local browser session. Crystallize your operational rules and risk parameters here before deploying capital.
            </span>
          </div>
        </div>
      </div>

      <div className="mt-6">
        {/* Guided Prompts Card Header */}
        <div className="mb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-[#303c32]">
              ✦ Guided Deliberation Prompts (Select to append or review below):
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleReset}
                className="rounded border border-[#141918]/15 bg-white/50 px-2.5 py-1 font-mono text-[11px] text-[#344236] transition hover:bg-white hover:text-[#18211a]"
                title="Reset note back to default guided prompts"
              >
                ✦ Reset Prompts
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="rounded border border-[#141918]/15 bg-white/50 px-2.5 py-1 font-mono text-[11px] text-[#7a3b3b] transition hover:bg-[#fae8e8] hover:text-[#5a2020]"
                title="Clear all notes in the text area"
              >
                ✕ Clear Canvas
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
          placeholder="Record your private thesis, sizing constraints, stop levels, and deliberative reflections here..."
        />

        {/* Footer info */}
        <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between font-mono text-[10px] text-[#5c6e5e]">
          <span>✦ Discretionary Deliberation Record · ✓ Auto-saved to this browser · Zero order routing</span>
          <span>{decisionNote.length} characters</span>
        </div>
      </div>
    </section>
  );
}
