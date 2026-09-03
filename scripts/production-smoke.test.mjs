import assert from 'node:assert/strict';
import test from 'node:test';
import {
  monitorProductionReadiness,
  originTrialRegistration,
  PRODUCTION_UNITS,
  validateEnginePermissionsPolicy,
  validateRootResponse,
} from './production-smoke.mjs';

function token(origin, expiry = 2_000_000_000) {
  const payload = JSON.stringify({ origin, feature: 'WebMCP', expiry, isSubdomain: true });
  return Buffer.from(`binary-prefix${payload}`, 'latin1').toString('base64');
}

function root(origin, headers = {}) {
  return new Response('<html><title>Jumping Beans</title></html>', {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cross-origin-opener-policy': 'same-origin',
      'cross-origin-embedder-policy': 'require-corp',
      'cross-origin-resource-policy': 'cross-origin',
      'origin-trial': token(origin),
      ...headers,
    },
  });
}

test('origin-trial registration extracts only the public registration contract', () => {
  assert.deepEqual(originTrialRegistration(token('https://demo.example:443')), {
    origin: 'https://demo.example', feature: 'WebMCP', expiresAt: '2033-05-18T03:33:20.000Z',
  });
  assert.equal(originTrialRegistration('not-base64'), null);
});

test('root validation accepts the required deploy headers and matching token', async () => {
  const response = root('https://demo.example');
  assert.equal(validateRootResponse(response, await response.clone().text(), {
    origin: 'https://demo.example', rootMarker: 'Jumping Beans',
  }, Date.parse('2030-01-01')).origin, 'https://demo.example');
});

test('root validation rejects header, origin, expiry, and content drift', async () => {
  const cases = [
    [root('https://other.example'), '<title>Jumping Beans</title>'],
    [root('https://demo.example', { 'cross-origin-embedder-policy': 'unsafe-none' }), '<title>Jumping Beans</title>'],
    [root('https://demo.example', { 'origin-trial': token('https://demo.example', 1) }), '<title>Jumping Beans</title>'],
    [root('https://demo.example'), '<title>Wrong site</title>'],
  ];
  for (const [response, body] of cases) assert.throws(() => validateRootResponse(response, body, {
    origin: 'https://demo.example', rootMarker: 'Jumping Beans',
  }, Date.parse('2030-01-01')));
});

test('Engine Permissions-Policy is the exact three-origin allowlist', () => {
  const origins = ['https://pet.example', 'https://coffee.example', 'https://watch.example'];
  const policy = 'tools=(self "https://pet.example" "https://coffee.example" "https://watch.example")';
  assert.equal(validateEnginePermissionsPolicy(policy, origins), policy);
  assert.throws(() => validateEnginePermissionsPolicy(`${policy.slice(0, -1)} "https://extra.example")`, origins));
  assert.throws(() => validateEnginePermissionsPolicy('tools=(self "https://pet.example")', origins));
});

function readinessFetch(now, overrides = {}) {
  const partnerOrigins = Object.values(PRODUCTION_UNITS).slice(1).map(({ origin }) => origin);
  const catalogs = {
    petsupply: [{ name: 'Dog lead', category: 'dog gear', dealPrice: 49, availability: 'in-stock' }],
    coffee: [{ name: 'Light coffee', category: 'coffee', dealPrice: 14, availability: 'in-stock' }],
    watch: [{ name: 'Field watch', category: 'watches', dealPrice: 499, availability: 'in-stock' }],
    ...overrides,
  };
  return async (input) => {
    const url = new URL(input);
    const [unitId, unit] = Object.entries(PRODUCTION_UNITS).find(([, candidate]) => candidate.origin === url.origin) || [];
    assert.ok(unit, `unexpected readiness URL ${url.href}`);
    const headers = {
      'content-type': url.pathname === '/' ? 'text/html; charset=utf-8' : 'application/json',
      'cross-origin-opener-policy': 'same-origin',
      'cross-origin-embedder-policy': 'require-corp',
      'cross-origin-resource-policy': 'cross-origin',
      'origin-trial': token(unit.origin),
      ...(unitId === 'engine' ? { 'permissions-policy': `tools=(self ${partnerOrigins.map((origin) => `"${origin}"`).join(' ')})` } : {}),
    };
    if (url.pathname === '/') return new Response(`<title>${unit.rootMarker}</title>`, { headers });
    const catalog = catalogs[unitId].map((deal) => ({
      ...deal,
      expiresAt: deal.expiresAt || new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }));
    return new Response(JSON.stringify(catalog), { headers });
  };
}

test('readiness monitor proves every canonical product has token and inventory runway', async () => {
  const now = Date.parse('2030-01-01T00:00:00.000Z');
  const originalFetch = globalThis.fetch;
  globalThis.fetch = readinessFetch(now);
  try {
    const results = await monitorProductionReadiness({ attempts: 1, now });
    assert.deepEqual(results.map(({ unit }) => unit), ['engine', 'petsupply', 'coffee', 'watch']);
    assert.ok(results.slice(1).every(({ readyOffers }) => readyOffers === 1));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('readiness monitor rejects an exact-price offer for an “under” recipe', async () => {
  const now = Date.parse('2030-01-01T00:00:00.000Z');
  const originalFetch = globalThis.fetch;
  globalThis.fetch = readinessFetch(now, {
    coffee: [{ name: 'Boundary coffee', category: 'coffee', dealPrice: 15, availability: 'in-stock' }],
  });
  try {
    await assert.rejects(
      monitorProductionReadiness({ attempts: 1, now }),
      /coffee has no coffee offer under \$15/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
