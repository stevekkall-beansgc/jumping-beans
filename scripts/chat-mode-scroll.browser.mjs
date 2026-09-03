// Focused, local-only headed regression. Use the same PLAYWRIGHT_MODULE,
// CHROME_EXECUTABLE, CHAT_TEST_URL and CHAT_EVIDENCE_DIR as chat-entry.browser.mjs.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const baseURL = process.env.CHAT_TEST_URL || 'http://127.0.0.1:8082';
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(baseURL).hostname), 'Local candidate only');
const output = path.resolve(process.env.CHAT_EVIDENCE_DIR || '/private/tmp/jumping-beans-scroll-evidence');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: false, ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}) });
const evidence = [];
const errors = [];
const words = 'Shopping for watches under $200. Show repair options first';

async function geometry(page) {
  return page.evaluate(() => ({
    x: scrollX, y: scrollY, url: location.href,
    workspace: document.querySelector('.canvas-entry').getBoundingClientRect().toJSON(),
    overflow: document.documentElement.scrollWidth > innerWidth,
  }));
}

async function switchMode(page, id, activation, top) {
  const locator = page.locator(`#${id}`);
  if (activation === 'keyboard') {
    // Follow native tab order; do not synthesize a click or call the controller.
    for (let count = 0; await page.evaluate(() => document.activeElement.id) !== id; count++) {
      assert.ok(count < 20, 'Mode switch is keyboard reachable');
      await page.keyboard.press('Tab');
    }
    assert.notEqual(await locator.evaluate((node) => getComputedStyle(node).outlineStyle), 'none');
  }
  // Explicit fixture positioning happens BEFORE measurement. Activation below
  // neither calls scrollIntoView nor permits a locator to center the button.
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), top);
  const before = await geometry(page);
  assert.equal(before.y, top);
  const box = await locator.boundingBox();
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const viewport = page.viewportSize();
  assert.ok(point.y > 0 && point.y < viewport.height, 'Activate a visible button');
  await page.evaluate(() => {
    window.scrollSamples = [];
    const end = performance.now() + 650;
    window.scrollSampling = new Promise((resolve) => {
      function sample() {
        window.scrollSamples.push({ x: scrollX, y: scrollY });
        if (performance.now() < end) requestAnimationFrame(sample);
        else resolve();
      }
      sample();
    });
  });
  if (activation === 'keyboard') await page.keyboard.press('Enter');
  else await page.mouse.click(point.x, point.y);
  const immediate = await geometry(page);
  const samples = await page.evaluate(async () => { await window.scrollSampling; return window.scrollSamples; });
  const after = await geometry(page);
  assert.deepEqual(immediate, before, 'The switch preserves scroll, URL and workspace immediately');
  assert.deepEqual(after, before, 'The switch preserves scroll, URL and workspace after settling');
  assert.ok(samples.every(({ x, y }) => x === before.x && y === before.y), 'No delayed or transient scroll');
  assert.equal(after.overflow, false);
  const expectedFocus = id === 'canvas-enter-manual' ? 'product-category' : 'product-prompt-input';
  assert.equal(await page.evaluate(() => document.activeElement.id), expectedFocus);
  assert.equal(await page.locator(`#${expectedFocus}`).isVisible(), true);
  const focusBox = await page.locator(`#${expectedFocus}`).boundingBox();
  assert.ok(focusBox.x >= 0 && focusBox.y >= 0 && focusBox.x + focusBox.width <= viewport.width && focusBox.y + focusBox.height <= viewport.height, 'Focused field stays inside the viewport');
  return { activation, id, before: before.y, immediate: immediate.y, after: after.y, samples: samples.length, workspace: after.workspace, focus: expectedFocus, focusBox };
}

try {
  for (const [width, height] of [[1280, 900], [390, 844], [320, 900], [320, 568]]) {
    for (const reducedMotion of ['no-preference', 'reduce']) {
      for (const colorScheme of ['light', 'dark']) {
        const context = await browser.newContext({ viewport: { width, height }, colorScheme, reducedMotion });
        const page = await context.newPage();
        page.on('pageerror', (error) => errors.push(error.message));
        await page.goto(baseURL);
        await page.locator('#canvas-enter-manual').waitFor();
        assert.equal(await page.getByRole('heading', { level: 1 }).textContent(), 'See the offers you want—how you want, when you want.');
        await page.getByLabel('What matters to you?').fill(words);
        const switches = [];
        // A 568px-high screen requires ordinary scrolling to reach the action.
        const top = height === 568 ? 200 : 0;
        for (const activation of ['pointer', 'keyboard']) {
          switches.push(await switchMode(page, 'canvas-enter-manual', activation, top));
          await page.locator('#product-max-price').fill('80');
          switches.push(await switchMode(page, 'canvas-back-chat', activation, top));
          assert.equal(await page.getByLabel('What matters to you?').inputValue(), words);
          assert.equal(await page.locator('#product-max-price').inputValue(), '80');
        }
        switches.push(await switchMode(page, 'canvas-enter-manual', 'pointer', top + 100));
        switches.push(await switchMode(page, 'canvas-back-chat', 'pointer', top + 100));
        assert.equal(await page.locator('#canvas-visit').isChecked(), true);
        assert.equal(await page.locator('#canvas-show-offers:visible').count(), 1);
        assert.match(await page.locator('#product-review-rules').textContent(), /\$80\.00/);
        // A real smooth scroll can already be in flight when an in-place edit
        // begins. Record the position at click dispatch, not at test scheduling.
        await page.locator('#canvas-enter-manual').evaluate((node) => {
          node.addEventListener('pointerdown', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }, { once: true });
          node.addEventListener('click', () => {
            window.switchDispatchY = scrollY;
          }, { once: true, capture: true });
        });
        const movingBox = await page.locator('#canvas-enter-manual').boundingBox();
        await page.mouse.click(movingBox.x + 20, movingBox.y + 20);
        await page.waitForTimeout(650);
        const moving = await page.evaluate(() => ({ atDispatch: window.switchDispatchY, after: scrollY, focus: document.activeElement.id }));
        assert.equal(moving.focus, 'product-category');
        assert.equal(moving.after, moving.atDispatch, 'In-place switch cancels pending smooth scrolling');
        await page.screenshot({ path: `${output}/${width}-${height}-${colorScheme}-${reducedMotion}.png`, fullPage: true });
        evidence.push({ width, height, colorScheme, reducedMotion, switches, moving, horizontalOverflow: false });
        console.log(`pass ${width}x${height} ${colorScheme} ${reducedMotion}: six stable switches`);
        await context.close();
      }
    }
  }
  assert.deepEqual(errors, [], 'No uncaught page errors');
  const result = { browser: browser.version(), baseURL, evidence, errors, nativeExecutionVerified: false };
  await writeFile(`${output}/scroll-results.json`, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ browser: result.browser, cases: evidence.length, switches: evidence.reduce((sum, item) => sum + item.switches.length, 0), evidence: output, errors }, null, 2));
} finally {
  await browser.close();
}
