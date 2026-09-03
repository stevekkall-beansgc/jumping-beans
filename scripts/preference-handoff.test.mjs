import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { partnerHandoffUrl, previewPartnerHandoff, readPreferenceHandoff, eligibleStorefrontOffer } from '../engine/preference-handoff.mjs';
import { preferenceSharingPayload } from '../engine/preference-plane.mjs';

const origin = 'https://coffee.example';
const options = { origins: [origin], applied: true };
const selection = { category: 'coffee', maxPrice: 20, feedStyle: 'visual', formats: ['testimonial', 'no-urgency'], rules: [] };
const handoff = (plane = selection) => partnerHandoffUrl(origin, plane, options);
const fragment = (object) => '#jb_preferences=' + encodeURIComponent(JSON.stringify(object));

test('partner hidden content cannot be exposed by component display rules', () => {
  const css = readFileSync(new URL('../shared/storefront.css', import.meta.url), 'utf8');
  assert.match(css, /:where\(\[hidden\]\)\s*\{\s*display:\s*none\s*!important/);
});

test('round trip shares canonical preferences only and normalizes destination', () => {
  const raw = { ...selection, identity: { email: 'private@example.org' }, memory: ['private memory'], receipts: ['private receipt'], prompt: 'private prompt', rules: [{ id: 'private-id', text: 'my private@example.org needs coffee', active: true }] };
  const url = new URL(partnerHandoffUrl(origin + '/account?email=private#secret', raw, options));
  assert.equal(url.pathname, '/'); assert.equal(url.search, '');
  assert.deepEqual(readPreferenceHandoff(url.hash), preferenceSharingPayload(raw));
  assert.doesNotMatch(decodeURIComponent(url.hash), /private|identity|receipts|prompt|memory/);
  assert.equal(partnerHandoffUrl('https://evil.example', raw, options), null);
  assert.equal(partnerHandoffUrl('https://user:pass@coffee.example', raw, options), null);
  assert.equal(partnerHandoffUrl('javascript:alert(1)', raw, options), null);
  assert.equal(partnerHandoffUrl(origin, raw, { ...options, applied: false }), origin + '/');
  assert.equal(partnerHandoffUrl(origin, raw, { ...options, paused: true }), origin + '/');
});

test('receiver rejects malformed, oversized, unknown and noncanonical data', () => {
  const clean = { version: 1, preferences: preferenceSharingPayload(selection) };
  for (const change of [
    (x) => x.version = 2,
    (x) => x.identity = 'private',
    (x) => x.preferences.email = 'private@example.org',
    (x) => x.preferences.feedStyle = 'evil',
    (x) => x.preferences.category = 'watches',
    (x) => x.preferences.maxPrice = 100,
    (x) => x.preferences.intent.attributes.secret = 'private',
    (x) => x.preferences.rules.push({ text: 'private raw prompt', scope: 'everywhere', category: '' }),
  ]) {
    const input = structuredClone(clean); change(input);
    assert.equal(readPreferenceHandoff(fragment(input)), null);
  }
  for (const hash of ['', '#product', '#jb_preferences=%ZZ', fragment(null), '#jb_preferences=' + 'x'.repeat(12000)]) assert.equal(readPreferenceHandoff(hash), null);
});

test('self-serve preview maps only canonical verticals to allowlisted member roots', () => {
  const origins = { petsupply: 'https://pet.example', coffee: origin, watch: 'https://watch.example' };
  for (const [category, partnerId] of [['dog gear', 'petsupply'], ['coffee', 'coffee'], ['watches', 'watch']]) {
    const preview = previewPartnerHandoff({ ...selection, category }, origins, {
      origins: Object.values(origins), applied: true,
    });
    assert.equal(preview.partnerId, partnerId);
    assert.equal(new URL(preview.href).origin, origins[partnerId]);
    assert.equal(readPreferenceHandoff(new URL(preview.href).hash).category, category);
  }
  assert.equal(previewPartnerHandoff({ ...selection, category: 'unsupported' }, origins, { origins: Object.values(origins), applied: true }), null);
  assert.equal(previewPartnerHandoff(selection, origins, { origins: Object.values(origins), applied: false }), null);
  assert.equal(previewPartnerHandoff(selection, origins, { origins: Object.values(origins), applied: true, paused: true }), null);
});

test('category, inclusive/exclusive budget, zero budget and availability constrain visible offers', () => {
  const deal = { category: 'coffee', dealPrice: 20 };
  const plane = readPreferenceHandoff(new URL(handoff()).hash);
  assert.equal(eligibleStorefrontOffer(deal, plane), true);
  assert.equal(eligibleStorefrontOffer({ ...deal, category: 'watches' }, plane), false);
  const dog = readPreferenceHandoff(new URL(handoff({ ...selection, category: 'dog gear' })).hash);
  assert.equal(eligibleStorefrontOffer({ name: 'Waterproof Dog Collar', category: 'collar', dealPrice: 18 }, dog), true);
  assert.equal(eligibleStorefrontOffer({ name: 'Everyday Cat Collar', category: 'cat collar', dealPrice: 18 }, dog), false);
  assert.equal(eligibleStorefrontOffer({ name: 'Gift Card', category: 'gift card', dealPrice: 10 }, dog), false);
  assert.equal(eligibleStorefrontOffer({ ...deal, dealPrice: 21 }, plane), false);
  assert.equal(eligibleStorefrontOffer({ ...deal, availability: 'out-of-stock' }, plane), false);
  const strict = readPreferenceHandoff(new URL(handoff({ ...selection, maxPriceInclusive: false })).hash);
  assert.equal(eligibleStorefrontOffer(deal, strict), false);
  const zero = readPreferenceHandoff(new URL(handoff({ ...selection, maxPrice: 0, maxPriceInclusive: false })).hash);
  assert.equal(eligibleStorefrontOffer({ ...deal, dealPrice: 0 }, zero), false);
  const unknown = readPreferenceHandoff(new URL(handoff({ ...selection, category: 'unsupported' })).hash);
  assert.equal(eligibleStorefrontOffer(deal, unknown), false);
});

// Execute the real renderer against a small DOM, without WebMCP or network.
class Node {
  constructor(tag = '') { this.tag = tag; this.children = []; this.dataset = {}; this.attributes = {}; this.hidden = false; }
  append(...items) { this.children.push(...items); }
  replaceChildren(...items) { this.children = items; }
  setAttribute(key, value) { this.attributes[key] = value; }
  removeAttribute(key) { delete this.attributes[key]; }
  toggleAttribute(key, value) { if (value) this.attributes[key] = ''; else delete this.attributes[key]; }
  addEventListener(name, listener) { this.listeners ??= {}; this.listeners[name] = listener; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  get childElementCount() { return this.children.length; }
}
const textOf = (node) => [node.textContent || '', ...node.children.map(textOf)].join(' ');
const nodesWithClass = (node, name) => [...((node.className || '').split(' ').includes(name) ? [node] : []), ...node.children.flatMap((child) => nodesWithClass(child, name))];
async function storefront(preferences, nativePlane = null, hashOverride, options = {}) {
  const grid = new Node(), banner = new Node(), actionPreview = new Node();
  actionPreview.hidden = true;
  const url = new URL(handoff(preferences));
  if (hashOverride !== undefined) url.hash = hashOverride;
  if (options.search) url.search = options.search;
  const replacements = [], events = {};
  const catalog = options.catalog || [
    { sku: 'cheap', name: 'Cheap coffee', category: 'coffee', dealPrice: 8 },
    { sku: 'LGLIGT10', name: 'Story coffee', category: 'coffee', dealPrice: 15 },
    { sku: 'costly', name: 'Costly coffee', category: 'coffee', dealPrice: 25 },
    { sku: 'watch', name: 'Watch', category: 'watches', dealPrice: 10 },
  ];
  let fetches = 0;
  const windowObject = { location: url, history: { replaceState: (...args) => { replacements.push(args); url.hash = ''; } }, addEventListener: (name, fn) => events[name] = fn, setTimeout, clearTimeout };
  windowObject.self = windowObject;
  windowObject.top = options.embedded ? {} : windowObject;
  const context = vm.createContext({
    URL, URLSearchParams, Intl, AbortController, readPreferenceHandoff, eligibleStorefrontOffer,
    __JB_CATALOG_TIMEOUT_MS__: options.timeoutMs,
    document: { getElementById: (id) => ({ grid, banner, 'action-chain-preview': actionPreview })[id], body: { dataset: { partnerName: options.partnerName || 'Coffee Co' } }, createElement: (tag) => new Node(tag) },
    window: windowObject,
    fetch: async (...args) => { fetches += 1; return options.fetchImpl ? options.fetchImpl(...args) : { ok: true, json: async () => catalog }; },
  });
  const source = readFileSync(new URL('../shared/storefront.js', import.meta.url), 'utf8').replace(/^import .*;$/m, '');
  vm.runInContext(source, context);
  await new Promise((resolve) => options.waitMs ? setTimeout(resolve, options.waitMs) : setImmediate(resolve));
  if (nativePlane) { context.__JB_PARTNER_CONTEXT__.preferencePlane = nativePlane; events['jb:preference-plane'](); await new Promise(setImmediate); }
  return { grid, banner, actionPreview, replacements, context, fetches };
}

test('visible navigation hydrates before render, filters, ranks stories first and hides urgency', async () => {
  const result = await storefront(selection);
  assert.equal(result.grid.children.length, 2);
  assert.match(textOf(result.grid.children[0]), /Story coffee/);
  assert.equal(nodesWithClass(result.grid, 'expiry').length, 0);
  assert.match(textOf(result.banner), /2 eligible offers.*visual.*coffee.*20/);
  assert.equal(result.replacements.length, 1);
  assert.equal(result.replacements[0][2], '/');
  assert.equal(result.grid.dataset.feedStyle, 'visual');
  const compare = await storefront({ ...selection, feedStyle: 'compare', formats: ['price-proof'], maxPrice: 10 });
  assert.equal(compare.grid.children.length, 1);
  assert.match(textOf(compare.grid), /Cheap coffee/);
  assert.equal(compare.grid.dataset.feedStyle, 'compare');
  assert.equal(nodesWithClass(compare.grid, 'expiry').length, 1);
  const empty = await storefront({ ...selection, maxPrice: 0, maxPriceInclusive: false });
  assert.match(textOf(empty.grid), /No offers match/);
  const fixedNow = Date.parse('2030-01-01T00:00:00Z');
  assert.equal(eligibleStorefrontOffer({ ...catalogDeal(), expiresAt: '2029-12-31T23:59:59Z' }, planeForEligibility(), fixedNow), false);
});

function catalogDeal() { return { name: 'Coffee', category: 'coffee', dealPrice: 10, availability: 'in-stock' }; }
function planeForEligibility() { return { category: 'coffee', maxPrice: 20 }; }

test('Watch storefront mirrors testimonial ranking and bounds the first render', async () => {
  const watchCatalog = [
    { sku: 'NIV-77007Q45', name: 'Nivada story watch', category: 'watches', dealPrice: 1088 },
    ...Array.from({ length: 29 }, (_, index) => ({ sku: `watch-${index}`, name: `Watch ${index}`, category: 'watches', dealPrice: 400 + index })),
  ];
  const result = await storefront({ ...selection, category: 'watches', maxPrice: 1200 }, null, undefined, { catalog: watchCatalog, partnerName: 'Watch Co' });
  assert.equal(result.grid.children.length, 25, 'first render contains 24 cards plus one load-more control');
  assert.match(textOf(result.grid.children[0]), /Nivada story watch.*finishing and dial detail/i);
  assert.match(textOf(result.grid.children[24]), /Showing 24 of 30.*Show 6 more/i);
});

test('embedded discovery frames do not render or fetch a second catalog', async () => {
  const result = await storefront(selection, null, '', { embedded: true });
  assert.equal(result.fetches, 0);
});

test('expired action-chain deep links stay hidden', async () => {
  const expired = { sku: 'expired', name: 'Expired coffee', category: 'coffee', dealPrice: 8, availability: 'in-stock', expiresAt: '2000-01-01T00:00:00Z' };
  const result = await storefront(selection, null, '', { catalog: [expired], search: '?jb_action=chain&jb_sku=expired' });
  assert.equal(result.actionPreview.hidden, true);
});

test('a stalled catalog request aborts and exposes a retry action', async () => {
  const fetchImpl = (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
  });
  const result = await storefront(selection, null, '', { fetchImpl, timeoutMs: 5, waitMs: 20 });
  assert.equal(result.grid.attributes['aria-busy'], 'false');
  assert.match(textOf(result.grid), /did not load within 10 seconds.*Try loading the catalog again/);
  const retry = nodesWithClass(result.grid, 'bl-button')[0];
  assert.equal(typeof retry?.listeners?.click, 'function');
});

test('malformed handoff is scrubbed with visible rejection; native context events still work', async () => {
  const rejected = await storefront(selection, null, '#jb_preferences=%ZZ');
  assert.match(textOf(rejected.banner), /could not be applied/);
  assert.equal(rejected.replacements.length, 1);
  const native = await storefront(selection, { ...selection, maxPrice: 9, formats: [], feedStyle: 'balanced' });
  assert.equal(native.grid.children.length, 1);
  assert.match(textOf(native.grid), /Cheap coffee/);
});
