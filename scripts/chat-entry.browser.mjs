// Optional headed browser evidence against a separately served local candidate.
// PLAYWRIGHT_MODULE may point to an installed Playwright module; no dependency
// installation, account fixtures, transport replacements, or production calls.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const baseURL = process.env.CHAT_TEST_URL || 'http://127.0.0.1:8790';
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(baseURL).hostname), 'Use a local candidate only');
const output = path.resolve(process.env.CHAT_EVIDENCE_DIR || '/private/tmp/jumping-beans-chat-first-evidence');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: false, ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}) });
const evidence = [];
const errors = [];
const button = (page, name) => page.getByRole('button', { name, exact: true });
const focusId = (page) => page.evaluate(() => document.activeElement.id);
const reflow = async (page) => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'No horizontal overflow');
async function stableClick(page, locator) {
  await locator.scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => ({ y: scrollY, url: location.href }));
  await locator.click();
  assert.deepEqual(await page.evaluate(() => ({ y: scrollY, url: location.href })), before, 'In-place action cannot scroll or navigate');
}
try {
  // Product-section deep links survive reloads and cross-view navigation.
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    const partnerURL = new URL(baseURL);
    partnerURL.hash = 'partners';
    await page.goto(partnerURL.href);
    await page.locator('#partners').waitFor();
    assert.equal(await page.evaluate(() => location.hash), '#partners');
    assert.equal(await page.locator('#product-view').isVisible(), true);
    assert.ok(await page.locator('#partners').evaluate((node) => node.getBoundingClientRect().top < innerHeight), 'Partner deep link scrolls into view');
    await page.getByRole('link', { name: 'Open the technical network demo' }).click();
    assert.equal(await page.locator('#demo-view').isVisible(), true);
    await button(page, 'Review this choice').click();
    assert.equal(await page.locator('#product-view').isVisible(), true);
    assert.equal(await page.locator('#canvas-review').isVisible(), true);
    assert.equal(await focusId(page), 'product-preview-title', 'Demo review action moves focus to the revealed review');
    assert.ok(await page.locator('#product-preview-title').evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return rect.top >= 0 && rect.bottom <= innerHeight;
    }), 'Demo review heading scrolls into view');
    await page.getByRole('link', { name: 'For shoppers' }).click();
    assert.equal(await page.evaluate(() => location.hash), '#find-offers');
    assert.equal(await page.locator('#product-view').isVisible(), true);
    assert.ok(await page.locator('#find-offers').evaluate((node) => node.getBoundingClientRect().top < innerHeight), 'Cross-view shopper link scrolls into view');
    await context.close();
  }
  for (const [width, height] of [[1280, 900], [390, 844], [320, 568]]) {
    for (const colorScheme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width, height }, colorScheme, reducedMotion: 'reduce' });
      const page = await context.newPage();
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(baseURL);
      await page.locator('#canvas-enter-manual').waitFor();
      const prefix = `${width}-${colorScheme}`;
      assert.equal(await page.getByRole('heading', { level: 1 }).textContent(), 'See the offers you want—how you want, when you want.');
      assert.equal(await page.locator('#canvas-manual').isVisible(), false);
      assert.equal(await page.locator('#canvas-review').isVisible(), false);
      await reflow(page);
      await page.screenshot({ path: `${output}/${prefix}-entry.png`, fullPage: true });
      const initialHeight = await page.locator('.canvas-entry').evaluate((node) => node.getBoundingClientRect().height);
      const raw = 'Shopping for watches under $200. Show repair options first';
      await page.getByLabel('What matters to you?').fill(raw);
      // Native Tab/Enter activates review; Enter within the textarea stays text.
      await page.getByLabel('What matters to you?').press('End');
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('#canvas-review').isVisible(), false);
      await page.getByLabel('What matters to you?').fill(raw);
      await page.keyboard.press('Tab');
      assert.equal(await focusId(page), 'canvas-review-selection');
      assert.notEqual(await page.locator('#canvas-review-selection').evaluate((node) => getComputedStyle(node).outlineStyle), 'none');
      const beforeReview = await page.evaluate(() => scrollY);
      await page.keyboard.press('Enter');
      assert.equal(await page.evaluate(() => scrollY), beforeReview);
      assert.equal(await focusId(page), 'product-preview-title');
      assert.match(await page.locator('#product-review-rules').textContent(), /watches[\s\S]*\$200\.00[\s\S]*Show repair options first/);
      assert.equal(await page.locator('#canvas-results').isVisible(), false);
      assert.equal(await page.locator('#canvas-visit').isChecked(), true);
      assert.equal(await page.locator('#canvas-show-offers:visible').count(), 1);
      assert.equal(await page.getByLabel('What matters to you?').inputValue(), raw);
      await stableClick(page, button(page, 'Enter in the manual form'));
      assert.equal(await focusId(page), 'product-category');
      assert.equal(await page.locator('.canvas-entry').evaluate((node) => node.getBoundingClientRect().height), initialHeight);
      assert.equal(await page.locator('#product-category').inputValue(), 'watches');
      await page.locator('#product-max-price').fill('80');
      await stableClick(page, button(page, 'Back to chat'));
      assert.equal(await focusId(page), 'product-prompt-input');
      assert.equal(await page.getByLabel('What matters to you?').inputValue(), raw);
      await page.getByLabel('What matters to you?').fill(`${raw} please`);
      assert.match(await page.locator('#product-review-rules').textContent(), /\$80\.00/);
      assert.doesNotMatch(await page.locator('#product-review-rules').textContent(), /\$200/);
      await stableClick(page, button(page, 'Enter in the manual form'));
      await reflow(page);
      await page.screenshot({ path: `${output}/${prefix}-manual.png`, fullPage: true });
      // Invalid native number input is preserved through switches and cannot apply.
      await page.locator('#product-max-price').fill('-1');
      await stableClick(page, button(page, 'Back to chat'));
      await page.locator('#canvas-show-offers').click();
      assert.equal(await page.locator('#canvas-manual').isVisible(), true);
      assert.equal(await page.locator('#product-max-price').inputValue(), '-1');
      assert.equal(await page.locator('#canvas-results').isVisible(), false);
      await page.keyboard.press('Escape');
      await page.locator('#product-max-price').fill('80');
      await stableClick(page, button(page, 'Back to chat'));
      // The ordinary account view stays optional and returns to the same draft.
      await page.locator('#header-account').click();
      assert.equal(await page.locator('#account-view').isVisible(), true);
      await page.locator('#account-back').click();
      assert.equal(await page.getByLabel('What matters to you?').inputValue(), `${raw} please`);
      assert.match(await page.locator('#product-review-rules').textContent(), /\$80\.00/);
      await reflow(page);
      await page.screenshot({ path: `${output}/${prefix}-review.png`, fullPage: true });
      await page.locator('#canvas-show-offers').click();
      await page.locator('#canvas-results').waitFor();
      assert.match(await page.locator('#product-review-status').textContent(), /This visit only. Nothing was saved/);
      const result = await page.locator('#canvas-results').getAttribute('data-state');
      assert.equal(result, 'unavailable', 'This run checks honest unsupported-browser UI, not native execution');
      assert.match(await page.locator('#canvas-results-feed').textContent(), /Open inventory/);
      await reflow(page);
      await page.screenshot({ path: `${output}/${prefix}-results.png`, fullPage: true });
      await button(page, 'Change selection').click();
      assert.equal(await page.getByLabel('What matters to you?').inputValue(), `${raw} please`);
      await page.locator('#canvas-save').check();
      await stableClick(page, button(page, 'Enter in the manual form'));
      await stableClick(page, button(page, 'Back to chat'));
      assert.equal(await page.locator('#canvas-save').isChecked(), true);
      await page.locator('#canvas-show-offers').click();
      assert.match(await page.locator('#product-review-status').textContent(), /Saved in this browser until you use Forget/);
      assert.equal(await page.locator('#canvas-sync').isVisible(), true);
      await page.reload();
      await page.locator('#saved-preference-actions').waitFor();
      assert.match(await page.locator('#product-review-rules').textContent(), /\$80\.00/);
      await page.locator('#saved-selection-summary').click();
      page.once('dialog', (dialog) => dialog.accept());
      await button(page, 'Forget saved selection in this browser').click();
      assert.equal(await page.locator('#saved-preference-actions').isVisible(), false);
      assert.equal(await page.locator('#canvas-chat').isVisible(), true);
      // Category-scope recovery works from the chat view without losing the rule.
      await button(page, 'Review selection').click();
      await page.locator('#builder-title').click();
      await page.locator('#product-rule-text').fill('Show repair options first');
      await page.locator('#product-rule-scope').selectOption('category');
      await stableClick(page, button(page, 'Add rule'));
      assert.equal(await page.locator('#canvas-manual').isVisible(), true);
      assert.equal(await focusId(page), 'product-category');
      assert.equal(await page.locator('#product-rule-text').inputValue(), 'Show repair options first');
      assert.match(await page.locator('#product-review-status').textContent(), /Enter a category/);
      await reflow(page);
      evidence.push({ width, height, colorScheme, reducedMotion: true, entryHeight: initialHeight, modeSwitchScrollDelta: 0, horizontalOverflow: false, result, checks: 'chat/manual/back, keyboard/focus, review, correction, invalid budget, account return, visit/save/Forget, category recovery' });
      await context.close();
    }
  }
  assert.deepEqual(errors, [], 'No uncaught browser errors');
  await writeFile(`${output}/browser-results.json`, JSON.stringify({ browser: browser.version(), evidence, errors, nativeExecutionVerified: false }, null, 2) + '\n');
  console.log(JSON.stringify({ browser: browser.version(), cases: evidence.length, evidence: output, errors }, null, 2));
} finally {
  await browser.close();
}
