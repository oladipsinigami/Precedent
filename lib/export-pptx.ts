// PPTX export for the research memo. Runs entirely client-side (pptxgenjs) so
// no server round-trip and the trader's briefing never leaves the browser —
// consistent with the product's non-execution, privacy-first stance.

import PptxGenJS from "pptxgenjs";
import { STYLES } from "./style-profiles";
import type { Briefing, TradingStyle } from "./types";

// Palette mirrors the app: dark institutional base + lime accent.
const C = {
  bg: "06080B",
  panel: "0C1016",
  ink: "E7EBEF",
  mute: "8A9AA8",
  lime: "D4FF3F",
  line: "232D38",
};

const FONT_DISPLAY = "Georgia"; // serif stand-in for Newsreader in PPTX
const FONT_BODY = "Calibri";
const FONT_MONO = "Consolas";

function safe(v: string | undefined | null): string {
  return (v ?? "").replace(/\s+/g, " ").trim();
}

function bullets(items: string[], opts: { maxEach?: number } = {}): { text: string; options: Record<string, unknown> }[] {
  return items
    .map((raw) => safe(raw))
    .filter(Boolean)
    .map((t) => ({
      text: opts.maxEach && t.length > opts.maxEach ? t.slice(0, opts.maxEach - 1).trimEnd() + "…" : t,
      options: {
        bullet: { code: "2022", indent: 14 },
        color: C.ink,
        fontFace: FONT_BODY,
        fontSize: 13,
        lineSpacingMultiple: 1.18,
        paraSpaceAfter: 8,
      },
    }));
}

function addChrome(slide: PptxGenJS.Slide, section: string, pageNum: number, total: number) {
  slide.addShape("rect", { x: 0, y: 0, w: "100%", h: 0.06, fill: { color: C.lime } });
  slide.addText(section.toUpperCase(), {
    x: 0.5, y: 0.18, w: 6, h: 0.3,
    fontFace: FONT_MONO, fontSize: 9, bold: true, color: C.lime, charSpacing: 3,
  });
  slide.addText(`${pageNum} / ${total}`, {
    x: 9.0, y: 0.18, w: 0.9, h: 0.3, align: "right",
    fontFace: FONT_MONO, fontSize: 9, color: C.mute,
  });
  slide.addShape("line", { x: 0.5, y: 7.06, w: 9.0, h: 0, line: { color: C.line, width: 0.75 } });
  slide.addText("Precedent Research Desk · Non-execution institutional intelligence · Human decides", {
    x: 0.5, y: 7.12, w: 9, h: 0.26,
    fontFace: FONT_MONO, fontSize: 8, color: C.mute,
  });
}

function sectionHeading(slide: PptxGenJS.Slide, title: string, y: number) {
  slide.addShape("diamond", { x: 0.5, y: y + 0.06, w: 0.16, h: 0.16, fill: { color: C.lime } });
  slide.addText(title, {
    x: 0.78, y: y - 0.08, w: 8.6, h: 0.5,
    fontFace: FONT_DISPLAY, fontSize: 22, bold: true, color: C.ink,
  });
}

export async function downloadBriefingPptx(opts: {
  briefing: Briefing;
  style: TradingStyle;
  symbol: string;
  regime?: string;
  decisionNote?: string;
  mode?: "executive" | "full";
}): Promise<void> {
  const { briefing, style, symbol, regime, decisionNote, mode = "full" } = opts;
  const isExecutive = mode === "executive";
  const profile = STYLES[style] ?? STYLES.swing;

  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "PRECEDENT", width: 10, height: 7.5 });
  pptx.layout = "PRECEDENT";
  pptx.author = "Precedent Research Desk";
  pptx.company = "Bitget AI Base Camp Hackathon S2 · Track 3";
  pptx.title = isExecutive
    ? `Precedent Executive Briefing — ${symbol}`
    : `Precedent Quantitative Research Dossier — ${symbol}`;

  const hasAnalogs = !isExecutive && (briefing.historicalAnalog?.analogs?.length ?? 0) > 0;
  const total = isExecutive
    ? 4 // Title + Takeaways/Tensions + Plan Questions + Decision Record
    : 1 + 5 + (hasAnalogs ? 1 : 0); // title + 5 sections (+ optional analog detail)
  let page = 0;

  const newSlide = (section: string) => {
    const s = pptx.addSlide();
    s.background = { color: C.bg };
    page += 1;
    addChrome(s, section, page, total);
    return s;
  };

  // ---------- 1 · Title ----------
  {
    const s = pptx.addSlide();
    s.background = { color: C.bg };
    page += 1;
    addChrome(s, isExecutive ? "Executive Briefing" : "Overview", page, total);
    s.addShape("rect", { x: 0, y: 0, w: "100%", h: 0.08, fill: { color: C.lime } });
    s.addText(
      isExecutive
        ? "✦ PRECEDENT · EXECUTIVE RESEARCH BRIEFING"
        : "✦ PRECEDENT · QUANTITATIVE RESEARCH DOSSIER",
      {
        x: 0.5, y: 0.6, w: 9, h: 0.35, fontFace: FONT_MONO, fontSize: 11, bold: true, color: C.lime, charSpacing: 4,
      },
    );
    s.addShape("line", { x: 0.5, y: 1.1, w: 1.6, h: 0, line: { color: C.lime, width: 1.5 } });
    s.addText(safe(briefing.title) || `Research Memo — ${symbol}`, {
      x: 0.5, y: 1.35, w: 9, h: 1.7, fontFace: FONT_DISPLAY, fontSize: 32, bold: true, color: C.ink, lineSpacingMultiple: 1.05,
    });
    s.addText(
      [
        { text: "Target: ", options: { color: C.mute } },
        { text: symbol, options: { color: C.lime, bold: true } },
        { text: "    Style: ", options: { color: C.mute } },
        { text: profile.label, options: { color: C.ink, bold: true } },
        { text: "    Regime: ", options: { color: C.mute } },
        { text: regime ?? briefing.regime ?? "normal", options: { color: C.ink } },
        { text: "    Deck: ", options: { color: C.mute } },
        { text: isExecutive ? "Executive Summary" : "Full Quantitative Dossier", options: { color: C.lime } },
      ],
      { x: 0.5, y: 3.2, w: 9, h: 0.4, fontFace: FONT_MONO, fontSize: 12 },
    );
    s.addText(safe(briefing.whatWeDid), {
      x: 0.5, y: 3.8, w: 9, h: 1.6, fontFace: FONT_BODY, fontSize: 13, color: C.mute, lineSpacingMultiple: 1.3,
    });
    s.addShape("line", { x: 0.5, y: 6.6, w: 9, h: 0, line: { color: C.line, width: 0.75 } });
    s.addText(
      "Research briefing only — no BUY/SELL signal, no execution path. Historical results are past occurrences, not predictions.",
      { x: 0.5, y: 6.72, w: 9, h: 0.5, fontFace: FONT_BODY, fontSize: 9.5, italic: true, color: C.mute },
    );
  }

  if (isExecutive) {
    // ---------- Executive 2 · Core Takeaways & Tensions ----------
    {
      const s = newSlide("01 · Executive Takeaways & Tensions");
      sectionHeading(s, "Core Takeaways & Signal Tensions", 0.62);

      s.addText("CORE EXECUTIVE TAKEAWAYS", {
        x: 0.6, y: 1.25, w: 8.8, h: 0.3, fontFace: FONT_MONO, fontSize: 10, bold: true, color: C.lime, charSpacing: 2,
      });
      const takeaways = (briefing.simpleTakeAways ?? []).slice(0, 3);
      s.addText(bullets(takeaways, { maxEach: 200 }) as never, { x: 0.6, y: 1.55, w: 8.8, h: 2.2, valign: "top" });

      s.addText("WHERE THE SIGNALS DIVERGE", {
        x: 0.6, y: 3.85, w: 8.8, h: 0.3, fontFace: FONT_MONO, fontSize: 10, bold: true, color: C.lime, charSpacing: 2,
      });
      const tensions = (briefing.whereThingsDoNotAgree ?? []).slice(0, 3);
      const tensionItems = tensions.length
        ? tensions.map((x) => `⚡ ${safe(x.conflict)} — Why it matters: ${safe(x.whyItMatters)}`)
        : ["No material cross-pillar conflicts were detected in this run."];
      s.addText(bullets(tensionItems, { maxEach: 220 }) as never, { x: 0.6, y: 4.15, w: 8.8, h: 2.6, valign: "top" });
    }

    // ---------- Executive 3 · Considerations & Questions ----------
    {
      const s = newSlide("02 · Strategy & Questions");
      sectionHeading(s, `Key Considerations & Plan Questions`, 0.62);

      s.addText(`STYLE CONSIDERATIONS (${profile.label.toUpperCase()})`, {
        x: 0.6, y: 1.25, w: 8.8, h: 0.3, fontFace: FONT_MONO, fontSize: 10, bold: true, color: C.lime, charSpacing: 2,
      });
      const items = [
        ...(briefing.otherThingsWeChecked ?? []).slice(0, 2),
        ...(briefing.considerations?.invalidation ?? []).slice(0, 2).map((x) => `Invalidation condition: ${safe(x)}`),
      ];
      s.addText(bullets(items, { maxEach: 220 }) as never, { x: 0.6, y: 1.55, w: 8.8, h: 2.3, valign: "top" });

      const qs = (briefing.questionsOnlyYouCanAnswer ?? []).slice(0, 3);
      if (qs.length) {
        s.addText("QUESTIONS ONLY YOU CAN ANSWER", {
          x: 0.6, y: 4.0, w: 8.8, h: 0.3, fontFace: FONT_MONO, fontSize: 10, bold: true, color: C.lime, charSpacing: 2,
        });
        s.addText(bullets(qs, { maxEach: 180 }) as never, { x: 0.6, y: 4.3, w: 8.8, h: 2.5, valign: "top" });
      }
    }

    // ---------- Executive 4 · Decision Record ----------
    {
      const s = newSlide("03 · Trader Decision Record");
      sectionHeading(s, "Trader Decision Record (Non-Execution)", 0.62);
      const note = safe(decisionNote);
      s.addText(
        note
          ? note.split("\n").map((line) => ({
              text: line,
              options: { fontFace: FONT_BODY, fontSize: 12, color: C.ink, lineSpacingMultiple: 1.15, paraSpaceAfter: 4 },
            })) as never
          : "No decision notes were recorded in this session.",
        { x: 0.6, y: 1.3, w: 8.8, h: 4.6, valign: "top" },
      );
      s.addShape("rect", { x: 0.6, y: 6.0, w: 8.8, h: 0.85, fill: { color: C.panel }, line: { color: C.line, width: 0.75 } });
      s.addText(
        "Strictly private discretionary journal. Precedent does not interface with brokerage accounts or exchanges and cannot execute trades.",
        { x: 0.8, y: 6.12, w: 8.4, h: 0.62, fontFace: FONT_BODY, fontSize: 10, color: C.mute, lineSpacingMultiple: 1.2 },
      );
    }

    const dateTag = new Date().toISOString().slice(0, 10);
    const cleanSym = symbol.replace(/[^A-Za-z0-9]/g, "");
    const fileName = `Precedent-Executive-Briefing-${cleanSym}-${dateTag}.pptx`;
    await pptx.writeFile({ fileName });
    return;
  }

  // ---------- 2 · Evidence ----------
  {
    const s = newSlide("01 · Verified Evidence");
    sectionHeading(s, "Verified Evidence & Source Attribution", 0.62);
    const ev = (briefing.evidence ?? []).slice(0, 6);
    const rows = ev.length
      ? ev.map((e) => `${safe(e.claim)}  —  [${safe(e.source)}]`)
      : briefing.otherThingsWeChecked ?? [];
    s.addText(bullets(rows, { maxEach: 220 }) as never, { x: 0.6, y: 1.3, w: 8.8, h: 5.5, valign: "top" });
  }

  // ---------- 3 · Tension ----------
  {
    const s = newSlide("02 · Tension");
    sectionHeading(s, "Where the Signals Diverge", 0.62);
    const t = (briefing.whereThingsDoNotAgree ?? []).slice(0, 5);
    const items = t.length
      ? t.map((x) => `⚡ ${safe(x.conflict)} — Why it matters: ${safe(x.whyItMatters)}`)
      : ["No material cross-pillar conflicts were detected in this run."];
    s.addText(bullets(items, { maxEach: 240 }) as never, { x: 0.6, y: 1.3, w: 8.8, h: 5.5, valign: "top" });
  }

  // ---------- 4 · Historical stress test ----------
  {
    const s = newSlide("03 · Historical Stress Test");
    sectionHeading(s, "Historical Analogs & Empirical Ranges", 0.62);
    const st = briefing.historicalStressTest;
    const lines: string[] = [safe(st?.summary)];
    for (const r of st?.results ?? []) {
      lines.push(`${r.period}: rose ${safe(r.wentUp)} · typical ${safe(r.typicalMove)} · median ${safe(r.median)}`);
    }
    lines.push(`Sample size: ${st?.sampleSize ?? 0} past cases`);
    s.addText(bullets(lines, { maxEach: 200 }) as never, { x: 0.6, y: 1.3, w: 8.8, h: 3.4, valign: "top" });
    if (st?.importantNote) {
      s.addShape("rect", { x: 0.6, y: 5.0, w: 8.8, h: 1.5, fill: { color: C.panel }, line: { color: C.line, width: 0.75 } });
      s.addText(safe(st.importantNote), {
        x: 0.8, y: 5.15, w: 8.4, h: 1.2, fontFace: FONT_BODY, fontSize: 11, italic: true, color: C.mute, lineSpacingMultiple: 1.25,
      });
    }
  }

  // ---------- 4b · Analog episodes (optional) ----------
  if (hasAnalogs) {
    const s = newSlide("03 · Analog Episodes");
    sectionHeading(s, "Closest Historical Episodes", 0.62);
    const rows = briefing.historicalAnalog.analogs.slice(0, 5).map((a) => ({
      text: [
        { text: `${safe(a.ticker)}  `, options: { bold: true, color: C.lime, fontFace: FONT_MONO } },
        { text: `${safe(a.date)}  ·  ${safe(a.followed)}`, options: { color: C.ink } },
      ],
      options: { bullet: { code: "2022", indent: 14 }, fontSize: 12.5, lineSpacingMultiple: 1.2, paraSpaceAfter: 10, fontFace: FONT_BODY },
    }));
    s.addText(rows as never, { x: 0.6, y: 1.3, w: 8.8, h: 5.4, valign: "top" });
  }

  // ---------- 5 · Considerations ----------
  {
    const s = newSlide("04 · Considerations");
    sectionHeading(s, `Considerations for the ${profile.label}`, 0.62);
    const items = [
      ...(briefing.simpleTakeAways ?? []).slice(0, 4),
      ...(briefing.considerations?.invalidation ?? []).slice(0, 2).map((x) => `Invalidation: ${safe(x)}`),
    ];
    s.addText(bullets(items, { maxEach: 220 }) as never, { x: 0.6, y: 1.3, w: 8.8, h: 3.4, valign: "top" });
    const qs = (briefing.questionsOnlyYouCanAnswer ?? []).slice(0, 3);
    if (qs.length) {
      s.addText("QUESTIONS ONLY YOU CAN ANSWER", {
        x: 0.6, y: 4.9, w: 8.8, h: 0.3, fontFace: FONT_MONO, fontSize: 10, bold: true, color: C.lime, charSpacing: 2,
      });
      s.addText(bullets(qs, { maxEach: 160 }) as never, { x: 0.6, y: 5.25, w: 8.8, h: 1.7, valign: "top" });
    }
  }

  // ---------- 6 · Decision record ----------
  {
    const s = newSlide("05 · Trader Decision Record");
    sectionHeading(s, "Trader Decision Record (Non-Execution)", 0.62);
    const note = safe(decisionNote);
    s.addText(
      note
        ? note.split("\n").map((line) => ({
            text: line,
            options: { fontFace: FONT_BODY, fontSize: 11.5, color: C.ink, lineSpacingMultiple: 1.15, paraSpaceAfter: 4 },
          })) as never
        : "No decision notes were recorded in this session.",
      { x: 0.6, y: 1.3, w: 8.8, h: 4.6, valign: "top" }
    );
    s.addShape("rect", { x: 0.6, y: 6.0, w: 8.8, h: 0.85, fill: { color: C.panel }, line: { color: C.line, width: 0.75 } });
    s.addText(
      "Strictly private discretionary journal. Precedent does not interface with brokerage accounts or exchanges and cannot execute trades.",
      { x: 0.8, y: 6.12, w: 8.4, h: 0.62, fontFace: FONT_BODY, fontSize: 10, color: C.mute, lineSpacingMultiple: 1.2 }
    );
  }

  const dateTag = new Date().toISOString().slice(0, 10);
  const cleanSym = symbol.replace(/[^A-Za-z0-9]/g, "");
  const fileName = `Precedent-Quant-Dossier-${cleanSym}-${dateTag}.pptx`;
  await pptx.writeFile({ fileName });
}
