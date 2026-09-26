// Headed native WebMCP cold-start acceptance. Each run uses a new persistent
// Chrome profile and performs the user action before any registry probe.
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const engineUrl = new URL(process.env.NATIVE_COLD_START_URL || "http://127.0.0.1:8082/");
const productionEngine = "https://jumping-beans-engine.steve-k-kall.workers.dev";
assert.ok(
  ["127.0.0.1", "localhost"].includes(engineUrl.hostname) || engineUrl.origin === productionEngine,
  "Use the local demo array or the exact production Engine origin",
);

const local = ["127.0.0.1", "localhost"].includes(engineUrl.hostname);
const partnerOrigins = local
  ? [8084, 8085, 8086].map((port) => `${engineUrl.protocol}//${engineUrl.hostname}:${port}`)
  : ["https://petsupply.pages.dev", "https://coffee-amk.pages.dev", "https://watch-ce8.pages.dev"];
const chromeExecutable = process.env.CHROME_EXECUTABLE || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const runCount = Number(process.env.NATIVE_COLD_START_RUNS || 5);
assert.ok(Number.isInteger(runCount) && runCount >= 5 && runCount <= 20, "Run count must be an integer from 5 through 20");
const evidenceDir = path.resolve(process.env.NATIVE_COLD_START_EVIDENCE_DIR || "/private/tmp/jumping-beans-native-cold-start");
const exactGreen = `Native WebMCP verified with all ${partnerOrigins.length} member sites`;
const starter = "Shopping for coffee under $15. Show customer stories first.";
const results = [];
await mkdir(evidenceDir, { recursive: true });

for (let run = 1; run <= runCount; run += 1) {
  const profileDir = await mkdtemp(path.join(os.tmpdir(), "jumping-beans-native-cold-start-"));
  let context;
  let page;
  const started = Date.now();
  const pageErrors = [];
  try {
    context = await chromium.launchPersistentContext(profileDir, {
      executablePath: chromeExecutable,
      headless: false,
      args: ["--no-first-run", "--disable-extensions", ...(local ? ["--enable-features=WebMCP,WebMCPTesting"] : [])],
      viewport: { width: 1280, height: 900 },
      reducedMotion: "reduce",
    });
    page = context.pages()[0] || await context.newPage();
    page.on("pageerror", (error) => pageErrors.push(String(error?.stack || error)));
    await page.goto(engineUrl.href, { waitUntil: "domcontentloaded", timeout: 30000 });

    // Keep this as the first action. A getTools probe here would warm the
    // registry and hide the startup race this acceptance is intended to catch.
    await page.locator(`[data-self-serve-prompt="${starter}"]`).click();
    await page.locator("#canvas-show-offers").click();
    await page.locator(".engine-details summary").click();
    await page.locator("#browser-readiness .bl-callout__title", { hasText: exactGreen }).waitFor({ timeout: 15000 });

    const evidence = await page.evaluate(async ({ origins, expectedTitle }) => {
      const readiness = document.querySelector("#browser-readiness");
      const title = readiness?.querySelector(".bl-callout__title")?.textContent?.trim() || null;
      const partnerTools = await document.modelContext.getTools({ fromOrigins: origins });
      const matching = partnerTools
        .filter((tool) => tool.name === "get_matching_deals" && origins.includes(tool.origin))
        .map(({ name, origin }) => ({ name, origin }));
      const engineTools = await document.modelContext.getTools();
      const receiptTool = engineTools.find((tool) => tool.name === "get_journey_receipt" && tool.origin === location.origin);
      let journeyReceipt = null;
      if (receiptTool) {
        const rawReceipt = await document.modelContext.executeTool(receiptTool, JSON.stringify({}));
        journeyReceipt = typeof rawReceipt === "string" ? JSON.parse(rawReceipt) : rawReceipt;
      }
      const receiptOrigins = journeyReceipt?.decisionReceipt?.origins || [];
      const outcomeEvents = (journeyReceipt?.events || []).filter((event) => event.type === "journey.outcome"
        && event.outcomeType === "preference_applied" && event.status === "partner_acknowledged");
      const latestDecision = (journeyReceipt?.events || []).filter((event) => event.type === "capability.decision").at(-1) || null;
      return {
        crossOriginIsolated,
        nativeSurface: ["getTools", "executeTool", "registerTool"].every((name) => typeof document.modelContext?.[name] === "function"),
        readiness: { title, tone: readiness?.dataset?.tone || null, role: readiness?.getAttribute("role") || null },
        resultState: document.querySelector("#canvas-results")?.dataset?.state || null,
        matching,
        receipt: {
          found: Boolean(receiptTool && journeyReceipt),
          connectedOrigins: journeyReceipt?.decisionReceipt?.connectedOrigins || [],
          terminalOrigins: receiptOrigins.filter(({ status }) => ["ready", "no-match"].includes(status)).map(({ origin }) => origin),
          latestDecisionConnectedOriginCount: latestDecision?.connectedOriginCount ?? null,
          acknowledgedOutcomeCount: outcomeEvents.length,
        },
        exactTitle: title === expectedTitle,
      };
    }, { origins: partnerOrigins, expectedTitle: exactGreen });
    const uniqueOrigins = [...new Set(evidence.matching.map(({ origin }) => origin))].sort();
    const passed = evidence.crossOriginIsolated
      && evidence.nativeSurface
      && evidence.exactTitle
      && evidence.readiness.tone === "success"
      && evidence.readiness.role === "status"
      && evidence.resultState === "results"
      && JSON.stringify(uniqueOrigins) === JSON.stringify([...partnerOrigins].sort())
      && evidence.receipt.found
      && JSON.stringify([...new Set(evidence.receipt.connectedOrigins)].sort()) === JSON.stringify([...partnerOrigins].sort())
      && JSON.stringify([...new Set(evidence.receipt.terminalOrigins)].sort()) === JSON.stringify([...partnerOrigins].sort())
      && evidence.receipt.latestDecisionConnectedOriginCount === partnerOrigins.length
      && evidence.receipt.acknowledgedOutcomeCount === 1
      && pageErrors.length === 0;
    results.push({ run, passed, elapsedMs: Date.now() - started, browser: context.browser()?.version() || null, pageErrors, evidence });
  } catch (error) {
    const failureState = await page?.evaluate(async (origins) => {
      const readiness = document.querySelector("#browser-readiness");
      let matching = [];
      try {
        matching = (await document.modelContext?.getTools?.({ fromOrigins: origins }) || [])
          .filter((tool) => tool.name === "get_matching_deals")
          .map(({ name, origin }) => ({ name, origin }));
      } catch {}
      return {
        nativeSurface: typeof document.modelContext === "object",
        readiness: {
          title: readiness?.querySelector(".bl-callout__title")?.textContent?.trim() || null,
          tone: readiness?.dataset?.tone || null,
        },
        resultState: document.querySelector("#canvas-results")?.dataset?.state || null,
        matching,
      };
    }, partnerOrigins).catch(() => null);
    results.push({ run, passed: false, elapsedMs: Date.now() - started, pageErrors, failureState, error: String(error?.stack || error) });
  } finally {
    await context?.close().catch(() => {});
    await rm(profileDir, { recursive: true, force: true });
  }
}

const receipt = {
  checkedAt: new Date().toISOString(),
  engine: engineUrl.origin,
  runs: runCount,
  passed: results.filter(({ passed }) => passed).length,
  actionBeforeRegistryProbe: true,
  results,
};
await writeFile(path.join(evidenceDir, "native-cold-start-results.json"), `${JSON.stringify(receipt, null, 2)}\n`);
console.log(JSON.stringify(receipt, null, 2));
assert.equal(receipt.passed, runCount, `Native WebMCP cold-start acceptance failed in ${runCount - receipt.passed} of ${runCount} fresh profiles`);
