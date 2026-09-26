import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { eligibleStorefrontOffer, previewPartnerHandoff, readPreferenceHandoff } from '../engine/preference-handoff.mjs';
import { originTrialRegistration } from './production-smoke.mjs';
import { SELF_SERVE_SCENARIOS } from './demo-scenarios.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const REFERENCE_NOW = Date.now();
const DAY_MS = 24 * 60 * 60 * 1000;
const TOKEN_MARGIN_MS = 30 * DAY_MS;
const INVENTORY_MARGIN_MS = 14 * DAY_MS;

const PRODUCTION_ORIGINS = Object.freeze({
  engine: 'https://jumping-beans-engine.steve-k-kall.workers.dev',
  petsupply: 'https://petsupply.pages.dev',
  coffee: 'https://coffee-amk.pages.dev',
  watch: 'https://watch-ce8.pages.dev',
});

const DEMO_LANES = SELF_SERVE_SCENARIOS;

const read = (relative) => readFile(path.join(ROOT, relative), 'utf8');

function evaluatedProductionOrigins(source, filename) {
  const context = vm.createContext({
    document: {},
    location: new URL(PRODUCTION_ORIGINS.engine),
  });
  const originContract = source.slice(0, source.indexOf('export const ORIGINS'));
  const executable = `${originContract.replace(/^import .*;\s*$/gm, '').replace(/^export\s+/gm, '')}\n;globalThis.__productionOrigins = ORIGIN_SETS.production;`;
  vm.runInContext(executable, context, { filename, timeout: 1000 });
  return JSON.parse(JSON.stringify(context.__productionOrigins));
}

function captured(source, pattern, label) {
  const match = source.match(pattern);
  assert.ok(match, `${label} is missing`);
  return match[1];
}

function headerValue(source, name, label) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return captured(source, new RegExp(`^\\s*${escaped}:\\s*(\\S+)\\s*$`, 'mi'), `${label} ${name} header`);
}

function assertTrial(token, expectedOrigin, label, now = REFERENCE_NOW) {
  const trial = originTrialRegistration(token);
  assert.ok(trial, `${label} must contain a decodable Origin-Trial token`);
  assert.equal(trial.origin, expectedOrigin, `${label} token origin`);
  assert.equal(trial.feature, 'WebMCP', `${label} token feature`);
  assert.ok(
    Date.parse(trial.expiresAt) >= now + TOKEN_MARGIN_MS,
    `${label} token expires ${trial.expiresAt}; release requires at least 30 days`,
  );
  return trial;
}

test('production origins stay exact across engine, partners, and preference handoff', async () => {
  const [engineConfig, sharedConfig, workerSource] = await Promise.all([
    read('engine/config.js'),
    read('shared/config.js'),
    read('engine/index.mjs'),
  ]);

  assert.deepEqual(evaluatedProductionOrigins(engineConfig, 'engine/config.js'), PRODUCTION_ORIGINS);
  assert.deepEqual(evaluatedProductionOrigins(sharedConfig, 'shared/config.js'), PRODUCTION_ORIGINS);

  const policySource = captured(
    workerSource,
    /const permissionsPolicy\s*=\s*\[([\s\S]*?)\]\.join\(/,
    'engine permissions policy',
  );
  const policyOrigins = [...policySource.matchAll(/https:\/\/[^"']+/g)].map(([origin]) => origin).sort();
  assert.deepEqual(policyOrigins, Object.values(PRODUCTION_ORIGINS).slice(1).sort());
  assert.match(policySource, /["']self["']/, 'engine permissions policy must include self');

  for (const lane of DEMO_LANES) {
    const toolSource = await read(`partners/${lane.partner}/tool.js`);
    const engineOrigin = captured(
      toolSource,
      /production:\s*["']([^"']+)["']/,
      `${lane.partner} production engine origin`,
    );
    assert.equal(engineOrigin, PRODUCTION_ORIGINS.engine);
    assert.match(toolSource, /\{\s*exposedTo:\s*\[CONCIERGE_ORIGIN\]\s*\}/, `${lane.partner} must expose its tool only to its configured engine`);

    const plane = { feedStyle: 'visual', category: lane.category, maxPrice: lane.maxPrice, formats: ['testimonial'], rules: [] };
    const handoff = previewPartnerHandoff(plane, PRODUCTION_ORIGINS, {
      origins: Object.values(PRODUCTION_ORIGINS).slice(1),
      applied: true,
    });
    assert.ok(handoff, `${lane.category} must have a production preference handoff`);
    assert.equal(handoff.partnerId, lane.partner);
    assert.equal(new URL(handoff.href).origin, PRODUCTION_ORIGINS[lane.partner]);
    assert.equal(new URL(handoff.href).pathname, '/');
    const received = readPreferenceHandoff(new URL(handoff.href).hash);
    assert.equal(received?.category, lane.category);
    assert.equal(received?.maxPrice, lane.maxPrice);

    const untrustedOrigins = { ...PRODUCTION_ORIGINS, [lane.partner]: `https://${lane.partner}.example` };
    assert.equal(previewPartnerHandoff(plane, untrustedOrigins, {
      origins: Object.values(PRODUCTION_ORIGINS).slice(1),
      applied: true,
    }), null, `${lane.category} handoff must fail closed for an unlisted origin`);
  }

  const watchRequestSource = await read('partners/watch/functions/api/_request.js');
  assert.equal(
    captured(watchRequestSource, /const PRODUCTION_ORIGIN\s*=\s*["']([^"']+)["']/, 'Watch write origin'),
    PRODUCTION_ORIGINS.watch,
  );
});

test('every checked-in WebMCP token matches its exact origin with a 30-day release margin', async () => {
  const workerSource = await read('engine/index.mjs');
  const engineToken = captured(workerSource, /const TRIAL\s*=\s*["']([^"']+)["']/, 'engine Origin-Trial token');
  assertTrial(engineToken, PRODUCTION_ORIGINS.engine, 'engine');

  for (const partner of ['petsupply', 'coffee', 'watch']) {
    const [headers, html] = await Promise.all([
      read(`partners/${partner}/_headers`),
      read(`partners/${partner}/index.html`),
    ]);
    assert.equal(headerValue(headers, 'Cross-Origin-Opener-Policy', partner), 'same-origin');
    assert.equal(headerValue(headers, 'Cross-Origin-Embedder-Policy', partner), 'require-corp');
    assert.equal(headerValue(headers, 'Cross-Origin-Resource-Policy', partner), 'cross-origin');
    const headerToken = headerValue(headers, 'Origin-Trial', partner);
    assertTrial(headerToken, PRODUCTION_ORIGINS[partner], `${partner} header`);

    for (const [, metaToken] of html.matchAll(/<meta\b[^>]*\bhttp-equiv=["']Origin-Trial["'][^>]*\bcontent=["']([^"']+)["'][^>]*>/gi)) {
      assertTrial(metaToken, PRODUCTION_ORIGINS[partner], `${partner} HTML`);
    }
  }
});

test('each canonical self-serve lane has in-stock inventory for 14 more days', async () => {
  const validThrough = REFERENCE_NOW + INVENTORY_MARGIN_MS;
  for (const lane of DEMO_LANES) {
    const catalog = JSON.parse(await read(`partners/${lane.partner}/catalog.json`));
    const plane = lane;
    const ready = catalog.filter((offer) => (
      eligibleStorefrontOffer(offer, plane)
      && Number.isFinite(Date.parse(offer.expiresAt))
      && Date.parse(offer.expiresAt) >= validThrough
    ));
    assert.ok(
      ready.length > 0,
      `${lane.partner} needs an in-stock ${lane.category} offer at or below $${lane.maxPrice} valid through ${new Date(validThrough).toISOString()}`,
    );
  }
});
