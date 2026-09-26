import { openRouterFreeModels } from "../lib/providers/openrouter-models";

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

async function main() {
  const models = await openRouterFreeModels();

  check("catalog returns at least one free model", models.length > 0);
  check("every id is a free-tier slug", models.every((m) => m.id.endsWith(":free")));
  check("ids are unique", new Set(models.map((m) => m.id)).size === models.length);
  check(
    "context length clears the synthesis floor",
    models.every((m) => m.contextLength >= 16_000),
  );
  check("waterfall stays inside the per-request candidate cap", models.length <= 5);
  check(
    "qwen3.8-27b is tried first when the catalog offers it",
    !models.some((m) => m.id === "qwen/qwen3.8-27b:free") || models[0].id === "qwen/qwen3.8-27b:free",
  );
  check("no paid model leaks into the free waterfall", !models.some((m) => !m.id.endsWith(":free")));

  console.log(`\n${passed} openrouter-free-rotation checks passed.`);
  console.log(`Order: ${models.map((m) => m.id).join(", ")}`);
}

main().catch((err) => {
  console.error("openrouter rotation test failed:", err);
  process.exitCode = 1;
});
