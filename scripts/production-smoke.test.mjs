import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  monitorProductionReadiness,
  originTrialRegistration,
  PRODUCTION_UNITS,
  smokeUnit,
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

function assetContentType(asset) {
  if (/\.m?js$/.test(asset)) return 'application/javascript; charset=utf-8';
  if (asset.endsWith('.css')) return 'text/css; charset=utf-8';
  if (asset.endsWith('.json')) return 'application/json; charset=utf-8';
  if (asset.endsWith('.svg')) return 'image/svg+xml';
  return 'application/octet-stream';
}

function petsupplyDeploymentFetch(unit, { rootBody, failPath, seen = [] } = {}) {
  return async (input) => {
    const url = new URL(input);
    seen.push(url.pathname);
    if (url.pathname === '/index.html') {
      throw new TypeError('fetch failed', { cause: new Error('unexpected redirect') });
    }
    if (url.pathname === failPath) {
      const cause = Object.assign(new Error('unexpected redirect'), { code: 'ERR_REDIRECT' });
      throw new TypeError('fetch failed', { cause });
    }
    if (url.pathname === '/') {
      const body = rootBody ?? await readFile(new URL('../partners/petsupply/index.html', import.meta.url));
      return new Response(body, {
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'cross-origin-opener-policy': 'same-origin',
          'cross-origin-embedder-policy': 'require-corp',
          'cross-origin-resource-policy': 'cross-origin',
          'origin-trial': token(unit.origin),
        },
      });
    }
    const asset = url.pathname.slice(1);
    const body = await readFile(new URL(`../partners/petsupply/${asset}`, import.meta.url));
    return new Response(body, { headers: { 'content-type': assetContentType(asset) } });
  };
}

test('production smoke verifies the canonical root as index.html without requesting the redirecting path', async () => {
  const unit = { ...PRODUCTION_UNITS.petsupply, origin: 'https://demo.example' };
  const seen = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = petsupplyDeploymentFetch(unit, { seen });
  try {
    const result = await smokeUnit('petsupply', unit, { attempts: 1 });
    assert.equal(result.assets, unit.assets.length);
    assert.ok(seen.includes('/'));
    assert.ok(!seen.includes('/index.html'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('production smoke rejects canonical root byte drift', async () => {
  const unit = { ...PRODUCTION_UNITS.petsupply, origin: 'https://demo.example' };
  const expected = await readFile(new URL('../partners/petsupply/index.html', import.meta.url), 'utf8');
  const originalFetch = globalThis.fetch;
  globalThis.fetch = petsupplyDeploymentFetch(unit, { rootBody: expected.replace('</body>', '<!-- drift --></body>') });
  try {
    await assert.rejects(smokeUnit('petsupply', unit, { attempts: 1 }), /petsupply\/index\.html does not match this checkout/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('production smoke reports the failing asset URL and fetch cause', async () => {
  const unit = { ...PRODUCTION_UNITS.petsupply, origin: 'https://demo.example' };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = petsupplyDeploymentFetch(unit, { failPath: '/tool.js' });
  try {
    await assert.rejects(
      smokeUnit('petsupply', unit, { attempts: 1 }),
      /https:\/\/demo\.example\/tool\.js\?jb_smoke=\d+ fetch failed \(ERR_REDIRECT: unexpected redirect\)/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('production smoke verifies nested index assets through canonical directory URLs', async () => {
  const unit = {
    ...PRODUCTION_UNITS.watch,
    origin: 'https://demo.example',
    assets: ['index.html', 'merchant/index.html'],
  };
  const seen = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, options) => {
    const url = new URL(input);
    seen.push(url.pathname);
    assert.equal(options.redirect, 'error');
    if (url.pathname === '/') {
      return new Response(await readFile(new URL('../partners/watch/index.html', import.meta.url)), {
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'cross-origin-opener-policy': 'same-origin',
          'cross-origin-embedder-policy': 'require-corp',
          'cross-origin-resource-policy': 'cross-origin',
          'origin-trial': token(unit.origin),
        },
      });
    }
    if (url.pathname === '/merchant/') {
      return new Response(await readFile(new URL('../partners/watch/merchant/index.html', import.meta.url)), {
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    }
    if (url.pathname === '/api/interest-summary') {
      return new Response(JSON.stringify({ product: 'NIV-77007Q45', count: 0 }), {
        headers: { 'content-type': 'application/json' },
      });
    }
    throw new Error(`unexpected URL ${url.href}`);
  };
  try {
    const result = await smokeUnit('watch', unit, { attempts: 1 });
    assert.equal(result.assets, 2);
    assert.deepEqual(seen, ['/', '/merchant/', '/api/interest-summary']);
  } finally {
    globalThis.fetch = originalFetch;
  }
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
