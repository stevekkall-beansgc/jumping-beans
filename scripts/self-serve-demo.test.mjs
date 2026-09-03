import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { previewPartnerHandoff, readPreferenceHandoff } from '../engine/preference-handoff.mjs';
import { evaluateOffer } from '../engine/p0.js';
import { SELF_SERVE_SCENARIOS } from './demo-scenarios.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

async function executeCatalog(partner, input) {
  const [source, catalogJSON] = await Promise.all([
    readFile(path.join(ROOT, 'partners', partner, 'tool.js'), 'utf8'),
    readFile(path.join(ROOT, 'partners', partner, 'catalog.json'), 'utf8'),
  ]);
  const context = vm.createContext({
    location: { hostname: 'localhost', protocol: 'http:' },
    window: { dispatchEvent() {} }, CustomEvent: class {}, console: { log() {} },
    catalogJSON, inputJSON: JSON.stringify(input),
  });
  vm.runInContext('globalThis.fetch=async()=>({json:async()=>JSON.parse(catalogJSON)});globalThis.document={modelContext:{registerTool:async tool=>globalThis.tool=tool}}', context);
  await vm.runInContext(`(async()=>{${source}})()`, context, { timeout: 1000 });
  return JSON.parse(JSON.stringify(await vm.runInContext('tool.execute(JSON.parse(inputJSON))', context, { timeout: 2000 })));
}

const formats = ['testimonial', 'no-urgency'];
const request = (category, maxPrice) => ({
  categories: [category], maxPrice,
  preferencePlane: { feedStyle: 'visual', category, maxPrice, formats, rules: [] },
  explain: true,
});

test('every canonical demo vertical returns bounded real member inventory', async () => {
  for (const scenario of SELF_SERVE_SCENARIOS) {
    const { partner, category, maxPrice } = scenario;
    const result = await executeCatalog(partner, request(category, maxPrice));
    assert.ok(result.deals.length > 0, `${partner} must return a self-serve ${category} result`);
    assert.ok(result.deals.length <= 24, `${partner} response stays bounded`);
    assert.ok(result.deals.every((deal) => deal.dealPrice <= maxPrice), `${partner} enforces the selected budget`);
    assert.ok(result.deals.every((deal) => deal.availability !== 'out-of-stock'), `${partner} excludes unavailable products`);
    assert.ok(result.deals.every((deal) => deal.partnerId === partner), `${partner} preserves member provenance`);
    const visible = result.deals.filter((deal) => evaluateOffer(deal, { preferences: scenario }).eligible);
    assert.ok(visible.length > 0, `${partner} must expose an offer inside the exclusive self-serve budget`);
    assert.ok(visible.every((deal) => deal.dealPrice < maxPrice), `${partner} visible results must honor “under” exactly`);
  }
});

test('the Engine removes an exact-ceiling result from an exclusive budget', () => {
  const deal = { category: 'coffee', dealPrice: 15 };
  assert.equal(evaluateOffer(deal, { preferences: { maxPrice: 15 } }).eligible, true);
  assert.equal(evaluateOffer(deal, { preferences: { maxPrice: 15, maxPriceInclusive: false } }).eligible, false);
});

test('the Watch story scenario preserves its source-backed testimonial', async () => {
  const result = await executeCatalog('watch', request('watches', 1200));
  const story = result.deals.find((deal) => deal.sku === 'NIV-77007Q45');
  assert.ok(story, 'Watch story offer must remain available at the documented $1,200 story budget');
  assert.equal(story.collateral[0]?.type, 'testimonial');
  assert.equal(story.collateral[0]?.source, 'Watch Co customer story');
});

test('the visual coffee scenario puts available testimonial collateral first', async () => {
  const input = request('coffee', 20);
  input.preferencePlane.rules = [{ text: 'Require roast: light', scope: 'category', category: 'coffee' }];
  const result = await executeCatalog('coffee', input);
  const story = result.deals.find((deal) => deal.sku === 'LGLIGT10');
  assert.ok(story, 'Light Roast Coffee must remain in the demo catalog');
  assert.equal(story.collateral[1]?.type, 'testimonial');
});

test('all self-serve routes carry the same validated visit-only plane', () => {
  const origins = { petsupply: 'https://pet.example', coffee: 'https://coffee.example', watch: 'https://watch.example' };
  for (const category of ['dog gear', 'coffee', 'watches']) {
    const preview = previewPartnerHandoff(request(category, 100).preferencePlane, origins, {
      origins: Object.values(origins), applied: true,
    });
    const received = readPreferenceHandoff(new URL(preview.href).hash);
    assert.equal(received.category, category);
    assert.equal(received.maxPrice, 100);
    assert.equal(received.feedStyle, 'visual');
    assert.deepEqual(received.formats, formats);
  }
});

test('ordinary partner pages skip native registration and its duplicate catalog load', async () => {
  for (const partner of SELF_SERVE_SCENARIOS.map(({ partner }) => partner)) {
    const source = await readFile(path.join(ROOT, 'partners', partner, 'tool.js'), 'utf8');
    let fetches = 0;
    const context = vm.createContext({
      location: { hostname: `${partner}.example`, protocol: 'https:' },
      document: {},
      fetch: async () => { fetches += 1; return { json: async () => [] }; },
      console: { log() {} },
    });
    await vm.runInContext(`(async()=>{${source}})()`, context, { timeout: 1000 });
    assert.equal(fetches, 0, `${partner} must leave catalog rendering to the storefront when native WebMCP is absent`);
  }
});
