import { chromium } from "playwright";
import fs from "fs";
import path from "path";

async function recordDemo() {
  const videoDir = path.join(process.cwd(), "docs", "raw_recording");
  if (!fs.existsSync(videoDir)) {
    fs.mkdirSync(videoDir, { recursive: true });
  }

  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: {
      dir: videoDir,
      size: { width: 1920, height: 1080 },
    },
  });

  const page = await context.newPage();

  console.log("Navigating to http://localhost:3000...");
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await page.waitForTimeout(4000);

  // Scene 1: Introduction (0:00 - 0:25)
  console.log("Scene 1: Introduction...");
  await page.waitForTimeout(20000);

  // Scene 2: Click "Load recommended demo" & Intake (0:25 - 0:50)
  console.log("Scene 2: Research Intake...");
  const demoButton = page.locator("button:has-text('Load recommended demo')").first();
  if (await demoButton.isVisible()) {
    await demoButton.click();
  }
  await page.waitForTimeout(22000);

  // Scene 3: Parallel 4-Witness Pipeline & Results (0:50 - 1:15)
  console.log("Scene 3: Results & 4-Witness Pipeline...");
  await page.waitForTimeout(22000);

  // Scene 4: Primary Memo & Empirical Base Rates (1:15 - 1:55)
  console.log("Scene 4: Scrolling Primary Memo & Empirical Base Rates...");
  await page.evaluate(() => window.scrollBy({ top: 450, behavior: "smooth" }));
  await page.waitForTimeout(18000);

  await page.evaluate(() => window.scrollBy({ top: 550, behavior: "smooth" }));
  await page.waitForTimeout(18000);

  // Scene 5: Active Compliance & Language Guard (1:55 - 2:15)
  console.log("Scene 5: Active Compliance...");
  await page.waitForTimeout(18000);

  // Scene 6: Expandable Technical Accordions & RMT (2:15 - 2:40)
  console.log("Scene 6: Expanding Technical Accordions...");
  const accordion = page.locator("summary, button, h3, [role='button']").filter({ hasText: /Historical Analogs|Verified Evidence|Deep Quantitative/i }).first();
  if (await accordion.isVisible()) {
    await accordion.click();
    await page.waitForTimeout(2000);
  }
  await page.evaluate(() => window.scrollBy({ top: 650, behavior: "smooth" }));
  await page.waitForTimeout(22000);

  // Scene 7: Human Decision Record (2:40 - 3:03)
  console.log("Scene 7: Human Decision Record...");
  const decisionTextarea = page.locator("textarea").first();
  if (await decisionTextarea.isVisible()) {
    await decisionTextarea.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
    await decisionTextarea.fill("Decision Rationale: Willing to hold rAAPL swing position into Friday earnings disclosure, provided rToken basis remains within ±0.30% of NY cash close and RSI stays below 70.");
    await page.waitForTimeout(18000);
  }

  console.log("Finishing video recording...");
  await page.waitForTimeout(3000);
  await context.close();
  await browser.close();

  // Find recorded video file
  const files = fs.readdirSync(videoDir);
  const webmFile = files.find((f) => f.endsWith(".webm"));
  if (webmFile) {
    const srcPath = path.join(videoDir, webmFile);
    const destPath = path.join(process.cwd(), "docs", "raw_demo.webm");
    fs.copyFileSync(srcPath, destPath);
    console.log(`Video recorded successfully to ${destPath}`);
  }
}

recordDemo().catch((err) => {
  console.error("Recording error:", err);
  process.exit(1);
});
