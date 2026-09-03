#!/usr/bin/env node
// Read-only release smoke: prove each public origin serves this checkout's
// exact deployable assets and the headers required by native WebMCP.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { eligibleStorefrontOffer } from '../engine/preference-handoff.mjs';
import { SELF_SERVE_SCENARIOS, scenarioFor } from './demo-scenarios.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DESIGN_ASSETS = ['design-system/primitives.css', 'design-system/source.json', 'design-system/tokens.css', 'design-system/tokens.json'];
const HANDOFF_ASSETS = ['preference-handoff.mjs', 'preference-plane.mjs', 'shopping-intent.mjs'];
export const PRODUCTION_UNITS = Object.freeze({
  engine: {
    origin: process.env.JB_ENGINE_ORIGIN || 'https://jumping-beans-engine.steve-k-kall.workers.dev',
    rootMarker: 'Jumping Beans',
    assets: [
      'index.html', 'app.css', 'app.js', 'config.js', 'account-access.js', 'native-webmcp.mjs',
      'p0.js', 'personal-experience.js', 'preference-canvas.mjs', ...HANDOFF_ASSETS, ...DESIGN_ASSETS,
    ],
  },
  petsupply: {
    origin: process.env.JB_PETSUPPLY_ORIGIN || 'https://petsupply.pages.dev',
    rootMarker: 'Petsupply',
    assets: [
      'index.html', 'tool.js', 'storefront.js', 'storefront.css', ...HANDOFF_ASSETS, ...DESIGN_ASSETS,
      'catalog.json', 'img/kibble-12.svg', 'img/kibble-7.svg', 'img/litter-10.svg',
      'img/toys-3pk.svg', 'img/treats-2pk.svg', 'img/wet-cans-24.svg',
    ],
  },
  coffee: {
    origin: process.env.JB_COFFEE_ORIGIN || 'https://coffee-amk.pages.dev',
    rootMarker: 'Coffee Co',
    assets: [
      'index.html', 'tool.js', 'storefront.js', 'storefront.css', ...HANDOFF_ASSETS, ...DESIGN_ASSETS,
      'catalog.json', 'img/cold-brew-4.svg', 'img/espresso-1kg.svg', 'img/pour-over-kit.svg', 'img/single-origin-250.svg',
    ],
  },
  watch: {
    origin: process.env.JB_WATCH_ORIGIN || 'https://watch-ce8.pages.dev',
    rootMarker: 'Watch Co',
    assets: [
      'index.html', 'tool.js', 'storefront.js', 'storefront.css', 'interest.js', 'interest-products.js',
      'action-contract.js', 'merchant/index.html', 'merchant/merchant.css', 'merchant/merchant.js',
      ...HANDOFF_ASSETS, ...DESIGN_ASSETS, 'catalog.json', 'img/chrono-42.svg', 'img/dive-200.svg',
      'img/field-38.svg', 'img/quartz-36.svg',
    ],
  },
});

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function originTrialRegistration(token) {
  try {
    const decoded = Buffer.from(token, 'base64').toString('latin1');
    const start = decoded.indexOf('{"origin"');
    if (start < 0) return null;
    const payload = JSON.parse(decoded.slice(start));
    return {
      origin: new URL(payload.origin).origin,
      feature: payload.feature,
      expiresAt: new Date(payload.expiry * 1000).toISOString(),
    };
  } catch { return null; }
}

export function validateRootResponse(response, body, unit, now = Date.now(), minimumTokenRunwayMs = 30 * 24 * 60 * 60 * 1000) {
  assert.equal(response.status, 200, `${unit.origin} returned ${response.status}`);
  assert.match(response.headers.get('content-type') || '', /^text\/html\b/i, `${unit.origin} must serve HTML`);
  assert.match(body, new RegExp(unit.rootMarker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), `${unit.origin} root marker missing`);
  assert.equal(response.headers.get('cross-origin-opener-policy'), 'same-origin', `${unit.origin} COOP`);
  assert.equal(response.headers.get('cross-origin-embedder-policy'), 'require-corp', `${unit.origin} COEP`);
  assert.equal(response.headers.get('cross-origin-resource-policy'), 'cross-origin', `${unit.origin} CORP`);
  const trial = originTrialRegistration(response.headers.get('origin-trial') || '');
  assert.ok(trial, `${unit.origin} has no decodable Origin-Trial token`);
  assert.equal(trial.origin, new URL(unit.origin).origin, `${unit.origin} Origin-Trial token is registered to another origin`);
  assert.equal(trial.feature, 'WebMCP', `${unit.origin} Origin-Trial feature`);
  assert.ok(Date.parse(trial.expiresAt) >= now + minimumTokenRunwayMs, `${unit.origin} Origin-Trial token needs 30 days of release runway; expires ${trial.expiresAt}`);
  return trial;
}

export function validateEnginePermissionsPolicy(policy, partnerOrigins) {
  const expected = `tools=(self ${partnerOrigins.map((origin) => `"${new URL(origin).origin}"`).join(' ')})`;
  assert.equal(policy, expected, `Engine Permissions-Policy must equal ${expected}`);
  return expected;
}

async function fetchText(url, timeoutMs) {
  const requested = new URL(url);
  const response = await fetch(url, {
    cache: 'no-store',
    headers: { accept: '*/*', 'cache-control': 'no-cache' },
    redirect: 'error',
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (response.url) {
    const effective = new URL(response.url);
    assert.equal(effective.origin, requested.origin, `${requested.href} resolved to another origin`);
    assert.equal(effective.pathname, requested.pathname, `${requested.href} resolved to another path`);
  }
  return { response, body: await response.text() };
}

async function expectedAsset(unitId, asset) {
  return readFile(path.join(ROOT, unitId === 'engine' ? 'engine' : `partners/${unitId}`, asset));
}

export async function smokeUnit(unitId, unit, { attempts = 8, delayMs = 4000, timeoutMs = 15000 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const root = await fetchText(`${unit.origin}/?jb_smoke=${Date.now()}`, timeoutMs);
      const trial = validateRootResponse(root.response, root.body, unit);
      if (unitId === 'engine') {
        const policy = root.response.headers.get('permissions-policy') || '';
        validateEnginePermissionsPolicy(
          policy,
          Object.values(PRODUCTION_UNITS).slice(1).map((partner) => partner.origin),
        );
      }
      for (const asset of unit.assets) {
        const remote = await fetchText(`${unit.origin}/${asset}?jb_smoke=${Date.now()}`, timeoutMs);
        assert.equal(remote.response.status, 200, `${unitId}/${asset} returned ${remote.response.status}`);
        const expected = await expectedAsset(unitId, asset);
        assert.equal(sha256(remote.body), sha256(expected), `${unitId}/${asset} does not match this checkout`);
        const contentType = remote.response.headers.get('content-type') || '';
        if (/\.(?:m?js)$/.test(asset)) assert.match(contentType, /javascript/i, `${unitId}/${asset} MIME`);
        if (asset.endsWith('.html')) assert.match(contentType, /^text\/html\b/i, `${unitId}/${asset} MIME`);
        if (asset.endsWith('.css')) assert.match(contentType, /^text\/css\b/i, `${unitId}/${asset} MIME`);
        if (asset.endsWith('.json')) assert.match(contentType, /application\/json/i, `${unitId}/${asset} MIME`);
        if (asset === 'catalog.json') {
          const catalog = JSON.parse(remote.body);
          assert.ok(Array.isArray(catalog) && catalog.some((deal) => deal.availability !== 'out-of-stock'), `${unitId} needs in-stock catalog inventory`);
        }
      }
      if (unitId === 'engine') {
        const scenario = scenarioFor('coffee');
        const inventory = await fetchText(`${unit.origin}/api/inventory/catalog?category=${encodeURIComponent(scenario.category)}&maxPrice=${scenario.maxPrice}&max=3`, timeoutMs);
        assert.equal(inventory.response.status, 200, 'Engine catalog API must be ready');
        const payload = JSON.parse(inventory.body);
        assert.ok(Array.isArray(payload.items), 'Engine catalog API must return a bounded item array');
        assert.ok(payload.items.every((item) => item.dealPrice <= scenario.maxPrice), 'Engine catalog API must enforce the demo budget');
        assert.ok(Array.isArray(payload.meta?.sources), 'Engine catalog API must report source health');
        const localIndex = JSON.parse(await readFile(path.join(ROOT, 'engine/inventory-assets/catalog-index.json'), 'utf8'));
        assert.equal(payload.meta.generatedAt, localIndex.generatedAt, 'Engine catalog API must use this checkout\'s generated index');
        assert.deepEqual(
          payload.meta.sources.map(({ id, status, itemCount, expiresAt }) => ({ id, status, itemCount, expiresAt })),
          localIndex.sources.map(({ id, status, itemCount, expiresAt }) => ({ id, status, itemCount, expiresAt })),
          'Engine catalog source manifest must match this checkout',
        );
      }
      if (unitId === 'watch') {
        const summary = await fetchText(`${unit.origin}/api/interest-summary?product=NIV-77007Q45`, timeoutMs);
        assert.equal(summary.response.status, 200, 'Watch read-only demand summary must be ready');
        const payload = JSON.parse(summary.body);
        assert.equal(payload.product, 'NIV-77007Q45', 'Watch summary must preserve the requested product');
        assert.ok(Number.isInteger(payload.count) && payload.count >= 0, 'Watch summary must return a bounded aggregate count');
      }
      return { unit: unitId, origin: unit.origin, tokenExpiresAt: trial.expiresAt, assets: unit.assets.length };
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(delayMs);
    }
  }
  throw lastError;
}

export async function smokeProduction({ units = Object.keys(PRODUCTION_UNITS), ...options } = {}) {
  const results = [];
  for (const unitId of units) {
    const unit = PRODUCTION_UNITS[unitId];
    assert.ok(unit, `Unknown production unit: ${unitId}`);
    assert.equal(new URL(unit.origin).protocol, 'https:', `${unitId} production origin must be HTTPS`);
    results.push(await smokeUnit(unitId, unit, options));
  }
  return results;
}

export async function monitorProductionReadiness({ attempts = 3, delayMs = 2000, timeoutMs = 15000, now = Date.now() } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const results = [];
      for (const [unitId, unit] of Object.entries(PRODUCTION_UNITS)) {
        const root = await fetchText(`${unit.origin}/?jb_readiness=${now}`, timeoutMs);
        const trial = validateRootResponse(root.response, root.body, unit, now);
        if (unitId === 'engine') {
          validateEnginePermissionsPolicy(
            root.response.headers.get('permissions-policy') || '',
            Object.values(PRODUCTION_UNITS).slice(1).map((partner) => partner.origin),
          );
          results.push({ unit: unitId, origin: unit.origin, tokenExpiresAt: trial.expiresAt });
          continue;
        }
        const catalogResponse = await fetchText(`${unit.origin}/catalog.json?jb_readiness=${now}`, timeoutMs);
        assert.equal(catalogResponse.response.status, 200, `${unitId} readiness catalog returned ${catalogResponse.response.status}`);
        const catalog = JSON.parse(catalogResponse.body);
        const scenario = scenarioFor(unitId);
        const validThrough = now + 14 * 24 * 60 * 60 * 1000;
        const ready = Array.isArray(catalog) && catalog.filter((deal) => (
          eligibleStorefrontOffer(deal, scenario, now)
          && Number.isFinite(Date.parse(deal.expiresAt))
          && Date.parse(deal.expiresAt) >= validThrough
        ));
        assert.ok(ready?.length, `${unitId} has no ${scenario.category} offer under $${scenario.maxPrice} with 14 days of runway`);
        results.push({ unit: unitId, origin: unit.origin, tokenExpiresAt: trial.expiresAt, readyOffers: ready.length });
      }
      assert.equal(results.length, SELF_SERVE_SCENARIOS.length + 1);
      return results;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(delayMs);
    }
  }
  throw lastError;
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invoked) {
  const unitFlag = process.argv.indexOf('--unit');
  const units = unitFlag >= 0 ? [process.argv[unitFlag + 1]] : Object.keys(PRODUCTION_UNITS);
  try {
    const attempts = Number(process.env.JB_SMOKE_ATTEMPTS || 8);
    const delayMs = Number(process.env.JB_SMOKE_DELAY_MS || 4000);
    const timeoutMs = Number(process.env.JB_SMOKE_TIMEOUT_MS || 15000);
    assert.ok(Number.isInteger(attempts) && attempts > 0 && attempts <= 20, 'JB_SMOKE_ATTEMPTS must be 1-20');
    assert.ok(Number.isFinite(delayMs) && delayMs >= 0 && delayMs <= 60000, 'JB_SMOKE_DELAY_MS must be 0-60000');
    assert.ok(Number.isFinite(timeoutMs) && timeoutMs >= 1000 && timeoutMs <= 60000, 'JB_SMOKE_TIMEOUT_MS must be 1000-60000');
    if (process.argv.includes('--readiness-only')) {
      assert.equal(unitFlag, -1, '--readiness-only cannot be combined with --unit');
      const results = await monitorProductionReadiness({ attempts, delayMs, timeoutMs });
      for (const result of results) console.log(`✓ ${result.unit}: production readiness current; WebMCP token valid through ${result.tokenExpiresAt}${result.readyOffers ? `; ${result.readyOffers} scenario offers` : ''}`);
    } else {
      const results = await smokeProduction({ units, attempts, delayMs, timeoutMs });
      for (const result of results) console.log(`✓ ${result.unit}: exact ${result.assets}-asset release match; WebMCP token valid through ${result.tokenExpiresAt}`);
    }
  } catch (error) {
    console.error(`production smoke failed: ${error.message}`);
    process.exitCode = 1;
  }
}
