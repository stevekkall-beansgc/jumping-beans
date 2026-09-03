// Headed acceptance for the ordinary-browser self-serve lane across all three
// member products. Run against the four local isolated servers or the exact
// production Engine origin after deployment.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { SELF_SERVE_SCENARIOS } from "./demo-scenarios.mjs";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const engineUrl = new URL(process.env.SELF_SERVE_TEST_URL || "http://127.0.0.1:8082/");
const productionEngine = "https://jumping-beans-engine.steve-k-kall.workers.dev";
assert.ok(
  ["127.0.0.1", "localhost"].includes(engineUrl.hostname) || engineUrl.origin === productionEngine,
  "Use the local demo array or the exact production Engine origin",
);
const local = ["127.0.0.1", "localhost"].includes(engineUrl.hostname);
const origins = local
  ? {
      petsupply: `${engineUrl.protocol}//${engineUrl.hostname}:8084`,
      coffee: `${engineUrl.protocol}//${engineUrl.hostname}:8085`,
      watch: `${engineUrl.protocol}//${engineUrl.hostname}:8086`,
    }
  : {
      petsupply: "https://petsupply.pages.dev",
      coffee: "https://coffee-amk.pages.dev",
      watch: "https://watch-ce8.pages.dev",
    };
const labels = {
  petsupply: "Dog gear · under $50",
  coffee: "Coffee stories · under $15",
  watch: "Watches · under $500",
};
const evidenceDir = path.resolve(process.env.SELF_SERVE_EVIDENCE_DIR || "/private/tmp/jumping-beans-self-serve-evidence");
await mkdir(evidenceDir, { recursive: true });
const browser = await chromium.launch({
  headless: process.env.SELF_SERVE_HEADLESS === "1",
  ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}),
});
const results = [];

const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
const hiddenWithoutBox = (page, selector) => page.locator(selector).evaluate((node) => (
  node.hidden && getComputedStyle(node).display === "none" && node.getClientRects().length === 0
));

async function responsiveImageEvidence(page) {
  await page.waitForFunction(() => [...document.querySelectorAll('img[src*="cdn.shopify.com"]')]
    .filter((image) => {
      const rect = image.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight;
    })
    .every((image) => Boolean(image.currentSrc)), null, { timeout: 5000 });
  const evidence = await page.locator('img[src*="cdn.shopify.com"]').evaluateAll((images) => images.map((image) => {
    const source = new URL(image.src);
    const current = image.currentSrc ? new URL(image.currentSrc) : null;
    const rect = image.getBoundingClientRect();
    return {
      sourceWidth: Number(source.searchParams.get("width")),
      currentWidth: Number(current?.searchParams.get("width")),
      renderedWidth: rect.width,
      visible: rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight,
      hasResponsiveSet: image.srcset.split(",").filter(Boolean).length >= 2 && /\d+w/.test(image.srcset),
      sizes: image.sizes,
      srcset: image.srcset,
      deviceScaleFactor: devicePixelRatio,
      viewportWidth: innerWidth,
      rootFontSize: getComputedStyle(document.documentElement).fontSize,
    };
  }));
  for (const image of evidence) {
    assert.ok(image.sourceWidth > 0 && image.sourceWidth <= 640, "Shopify fallback images must request a bounded width");
    if (image.visible && image.hasResponsiveSet) {
      assert.ok(image.currentWidth > 0, "visible responsive images must select a sized Shopify source");
      assert.ok(
        image.currentWidth <= Math.ceil(image.renderedWidth * image.deviceScaleFactor * 2),
        `responsive source is too large: ${JSON.stringify(image)}`,
      );
    }
  }
  return evidence;
}

try {
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 568 }]) {
    for (const scenario of SELF_SERVE_SCENARIOS) {
      const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
      const page = await context.newPage();
      const pageErrors = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      await page.goto(engineUrl.href, { waitUntil: "domcontentloaded" });
      await page.locator("#canvas-chat-form").waitFor();
      assert.equal(await noOverflow(page), true);
      await page.getByRole("button", { name: labels[scenario.partner], exact: true }).click();
      await page.locator("#canvas-review").waitFor();
      const review = await page.locator("#product-review-rules").textContent();
      assert.match(review, new RegExp(scenario.category, "i"));
      assert.match(review, new RegExp(`\\$${scenario.maxPrice}(?:\\.00)?`));

      await page.getByRole("button", { name: /^Show matching offers/ }).click();
      const preview = page.getByRole("link", { name: "Open storefront preview", exact: true });
      await preview.waitFor({ timeout: 1500 });
      const engineImages = await responsiveImageEvidence(page);
      const previewHref = await preview.getAttribute("href");
      assert.ok(previewHref);
      const handoff = new URL(previewHref);
      assert.equal(handoff.origin, origins[scenario.partner]);
      assert.match(handoff.hash, /^#jb_preferences=/);

      await page.goto(handoff.href, { waitUntil: "domcontentloaded" });
      await page.locator("#grid[aria-busy=\"false\"]").waitFor();
      assert.equal(await page.evaluate(() => location.hash), "", "preference fragment is scrubbed after hydration");
      assert.match(await page.locator("#banner").textContent(), /Your Engine selection is applied/);
      assert.equal(await page.locator("#grid").getAttribute("aria-live"), null, "the full card grid is not a live region");
      assert.equal(await hiddenWithoutBox(page, "#action-chain-preview"), true);
      const cards = page.locator("#grid > li:has(article.offer-card)");
      const cardCount = await cards.count();
      assert.ok(cardCount > 0 && cardCount <= 24, `bounded first render for ${scenario.partner}`);
      const prices = await page.locator("#grid .deal-price").allTextContents();
      assert.ok(prices.every((value) => Number(value.replace(/[^0-9.]/g, "")) < scenario.maxPrice));
      const categoryLabels = (await page.locator("#grid .category").allTextContents()).map((value) => value.trim().toLowerCase());
      if (scenario.partner === "petsupply") {
        const productText = await cards.evaluateAll((items) => items.map((item) => `${item.querySelector(".category")?.textContent || ""} ${item.querySelector("h2")?.textContent || ""}`.toLowerCase()));
        const invalidProductText = productText.filter((value) => !/\bdog\b/.test(value) || /\bcat\b/.test(value));
        assert.deepEqual(invalidProductText, [], `Petsupply recipe must render dog inventory only: ${JSON.stringify(invalidProductText)}`);
      } else {
        assert.ok(categoryLabels.every((value) => value === scenario.category), `${scenario.partner} must render only its requested category`);
      }
      if (["petsupply", "coffee"].includes(scenario.partner)) {
        assert.equal(await page.locator("#grid .expiry").count(), 0, `${scenario.partner} must remove urgency copy`);
      }
      if (scenario.partner === "coffee") {
        assert.match(await cards.first().locator("h2").textContent(), /Light Roast Coffee/i, "Coffee story offer must rank first");
        assert.match(await cards.first().textContent(), /bright, easy everyday roast/i, "Coffee story must remain source-backed and visible");
      }
      if (scenario.partner === "watch") {
        assert.equal(await page.locator("#grid").getAttribute("data-feed-style"), "compare");
        assert.equal(await cards.first().locator(".offer-card__body").evaluate((node) => getComputedStyle(node).order), "-1");
      }
      assert.equal(await noOverflow(page), true);
      const storefrontImages = await responsiveImageEvidence(page);

      if (scenario.partner === "watch" && viewport.width === 390) {
        const more = page.getByRole("button", { name: /Show \d+ more/ });
        if (await more.count()) {
          await more.click();
          assert.equal(await page.evaluate(() => document.activeElement?.tagName), "H2");
        }
        const actionHref = await page.getByRole("link", { name: "Try an action chain" }).first().getAttribute("href");
        assert.ok(actionHref);
        await page.goto(actionHref, { waitUntil: "domcontentloaded" });
        await page.locator('#grid[aria-busy="false"]').waitFor();
        await page.locator("#action-chain-preview:not([hidden])").waitFor();
        assert.equal(await page.evaluate(() => location.hash), "", "Watch action-chain navigation must scrub the preference fragment after hydration");
        const actionBanner = await page.locator("#banner").textContent();
        assert.match(actionBanner, /Your Engine selection is applied/, "Watch action-chain navigation must retain the applied Engine selection");
        assert.match(actionBanner, new RegExp(scenario.category, "i"), "Watch action-chain navigation must retain the selected category");
        assert.match(actionBanner, new RegExp(`\\$${scenario.maxPrice}(?:\\.00)?`), "Watch action-chain navigation must retain the selected budget");
        assert.equal(await page.locator("#grid").getAttribute("data-feed-style"), "compare", "Watch action-chain navigation must retain the selected feed style");
        const actionCards = page.locator("#grid > li:has(article.offer-card)");
        const actionCardCount = await actionCards.count();
        assert.ok(actionCardCount > 0 && actionCardCount <= 24, "Watch action-chain navigation must keep a bounded eligible result set");
        assert.equal(actionCardCount, cardCount, "Watch action-chain navigation must retain the same applied result set");
        const actionPrices = await page.locator("#grid .deal-price").allTextContents();
        assert.equal(actionPrices.length, actionCardCount, "every Watch action-chain result must expose one catalog price");
        assert.ok(
          actionPrices.every((value) => Number(value.replace(/[^0-9.]/g, "")) < scenario.maxPrice),
          `Watch action-chain results must remain under $${scenario.maxPrice}`,
        );
        const actionCategories = (await page.locator("#grid .category").allTextContents()).map((value) => value.trim().toLowerCase());
        assert.equal(actionCategories.length, actionCardCount, "every Watch action-chain result must expose one category");
        assert.ok(actionCategories.every((value) => value === scenario.category), "Watch action-chain navigation must retain only watch-category results");
        const actionImages = await responsiveImageEvidence(page);
        assert.ok(actionImages.some(({ sourceWidth, hasResponsiveSet }) => sourceWidth <= 320 && hasResponsiveSet), "action thumbnail must use a responsive bounded source");
        const next = page.getByRole("button", { name: /Continue to choose|Review approval/ });
        await next.click();
        assert.equal(await page.evaluate(() => document.activeElement?.id), "action-step-two-title");
        await next.click();
        assert.equal(await page.evaluate(() => document.activeElement?.id), "action-step-three-title");
        await page.getByRole("button", { name: "Back", exact: true }).click();
        assert.equal(await page.evaluate(() => document.activeElement?.id), "action-step-two-title");
        await next.click();
        await page.getByRole("button", { name: "Approve demo action", exact: true }).click();
        assert.equal(await page.evaluate(() => document.activeElement?.id), "action-step-four-title");
      }

      if (viewport.width === 390) {
        await page.screenshot({ path: path.join(evidenceDir, `${scenario.partner}-390.png`), fullPage: true });
      }
      assert.deepEqual(pageErrors, []);
      results.push({
        partner: scenario.partner,
        viewport,
        handoffOrigin: handoff.origin,
        cardCount,
        maxPrice: scenario.maxPrice,
        overflow: false,
        responsiveImages: {
          engine: engineImages.length,
          storefront: storefrontImages.length,
        },
        pageErrors,
      });
      await context.close();
    }
  }
  const pagingContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const pagingPage = await pagingContext.newPage();
  const pagingErrors = [];
  pagingPage.on("pageerror", (error) => pagingErrors.push(error.message));
  await pagingPage.goto(`${origins.watch}/`, { waitUntil: "domcontentloaded" });
  await pagingPage.locator('#grid[aria-busy="false"]').waitFor();
  assert.equal(await pagingPage.locator("#grid > li:has(article.offer-card)").count(), 24);
  await pagingPage.getByRole("button", { name: /Show 24 more/ }).click();
  assert.equal(await pagingPage.locator("#grid > li:has(article.offer-card)").count(), 48);
  assert.equal(await pagingPage.evaluate(() => document.activeElement?.tagName), "H2");
  assert.equal(await noOverflow(pagingPage), true);
  assert.deepEqual(pagingErrors, []);
  await pagingContext.close();
  const receipt = {
    checkedAt: new Date().toISOString(),
    browser: browser.version(),
    engine: engineUrl.origin,
    cases: results.length,
    paging: { partner: "watch", viewport: { width: 390, height: 844 }, initialCards: 24, expandedCards: 48, focusMovedToFirstNewHeading: true },
    nativeExecutionVerified: false,
    results,
  };
  await writeFile(path.join(evidenceDir, "ordinary-browser-results.json"), `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(JSON.stringify(receipt, null, 2));
} finally {
  await browser.close();
}
