import { DEMO_TASK, normalizeQuestion } from "../lib/style-profiles";

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

const base = normalizeQuestion(DEMO_TASK.question);

check("demo question normalizes to itself", base === normalizeQuestion(DEMO_TASK.question));
check(
  "ASCII 'x' for the multiplication sign still matches the demo",
  normalizeQuestion(DEMO_TASK.question.replace("7×24", "7x24")) === base,
);
check(
  "a plain hyphen for the em dash still matches the demo",
  normalizeQuestion(DEMO_TASK.question.replace(" — ", " - ")) === base,
);
check(
  "a straight apostrophe for the curly one still matches the demo",
  normalizeQuestion(DEMO_TASK.question.replace("I’m", "I'm")) === base,
);
check(
  "collapsed and padded whitespace still matches the demo",
  normalizeQuestion(`   ${DEMO_TASK.question.replace(/ /g, "   ")}  `) === base,
);
check(
  "a non-breaking space still matches the demo",
  normalizeQuestion(DEMO_TASK.question.replace(" versus ", " versus ")) === base,
);
check(
  "genuinely different wording does NOT match the demo",
  normalizeQuestion("What is AAPL doing into next week?") !== base,
);
check(
  "a real research question is not treated as the demo",
  normalizeQuestion("Stress-test the current AAPL rToken setup into next week") !== base,
);
check("normalizer is case-insensitive on the demo text", normalizeQuestion(DEMO_TASK.question.toUpperCase()) === base);

console.log(`\n${passed} demo-fast-path checks passed.`);