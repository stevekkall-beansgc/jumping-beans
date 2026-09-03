import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';

export const fixturePath = fileURLToPath(new URL('./corpus.json', import.meta.url));
export const defaultRoot = fileURLToPath(new URL('../../', import.meta.url));
const partners = ['petsupply', 'coffee', 'watch'];
const names = { petsupply: 'Petsupply', coffee: 'Coffee Co', watch: 'Watch Co' };
const origin = (partner) => `https://${partner}.example`;
const sourceFiles = [
  'engine/preference-canvas.mjs', 'engine/preference-plane.mjs', 'engine/p0.js',
  'engine/shopping-intent.mjs',
  'engine/app.js', ...partners.map((partner) => `partners/${partner}/tool.js`),
];
const hash = (value) => createHash('sha256').update(value).digest('hex');
const mean = (values) => {
  const applicable = values.filter((value) => value !== null);
  return applicable.length ? applicable.reduce((a, b) => a + b, 0) / applicable.length : null;
};

export async function loadCorpus() {
  const corpus = JSON.parse(await readFile(fixturePath, 'utf8'));
  validateCorpus(corpus);
  return corpus;
}

// This is an evaluation oracle over authored facts, never a production matcher.
export function hardViolations(deal, product, constraints = {}) {
  if (!product) return ['unknown-product'];
  const failures = [];
  if (constraints.categories && !constraints.categories.includes(deal.category)) failures.push('category');
  if (!Number.isFinite(deal.dealPrice) || deal.dealPrice < 0) failures.push('invalid-price');
  if (constraints.maxPrice != null && deal.dealPrice > constraints.maxPrice) failures.push('max-price');
  if (constraints.belowPrice != null && deal.dealPrice >= constraints.belowPrice) failures.push('exclusive-price');
  for (const [key, value] of Object.entries(constraints.equals || {})) {
    if (product.facts[key] !== value) failures.push(`required:${key}`);
  }
  for (const [key, value] of Object.entries(constraints.notEquals || {})) {
    // Absence is not evidence of absence: exclude rows with unknown fact values.
    if (!Object.hasOwn(product.facts, key) || product.facts[key] === value) failures.push(`excluded:${key}`);
  }
  for (const [key, values] of Object.entries(constraints.contains || {})) {
    if (!Array.isArray(product.facts[key]) || !values.every((v) => product.facts[key].includes(v))) failures.push(`missing:${key}`);
  }
  return failures;
}

export function rankingMetrics(ids, grades, k) {
  assert.ok(Number.isInteger(k) && k > 0, 'K must be a positive integer');
  const relevant = Object.keys(grades).filter((id) => grades[id] > 0);
  if (!relevant.length) return { recall: null, ndcg: null };
  const seen = new Set();
  let hits = 0;
  const dcg = ids.slice(0, k).reduce((sum, id, index) => {
    const grade = seen.has(id) ? 0 : (grades[id] || 0);
    seen.add(id);
    if (grade > 0) hits++;
    return sum + (2 ** grade - 1) / Math.log2(index + 2);
  }, 0);
  const ideal = Object.values(grades).filter((g) => g > 0).sort((a, b) => b - a).slice(0, k)
    .reduce((sum, grade, index) => sum + (2 ** grade - 1) / Math.log2(index + 2), 0);
  return { recall: hits / relevant.length, ndcg: dcg / ideal };
}

export function validateCorpus(corpus) {
  assert.equal(corpus.schemaVersion, 1);
  assert.ok(corpus.k.length && corpus.k.every((k) => Number.isInteger(k) && k > 0));
  assert.equal(new Set(corpus.k).size, corpus.k.length);
  const products = new Map();
  for (const product of corpus.products) {
    assert.ok(partners.includes(product.partner));
    assert.ok(!products.has(product.offer.sku), 'product IDs must be globally unique in this fixture');
    assert.ok(/^[PCW]\d{2}$/.test(product.offer.sku));
    products.set(product.offer.sku, product);
    for (const key of ['imageUrl', 'landing']) assert.equal(new URL(product.offer[key]).hostname, `${product.partner}.example`);
    assert.equal(product.offer.source, 'synthetic evaluation catalog');
  }
  const ids = new Set();
  const tags = new Set();
  for (const entry of corpus.cases) {
    assert.ok(!ids.has(entry.id)); ids.add(entry.id);
    assert.ok(['words', 'native'].includes(entry.mode));
    assert.ok([...partners, 'all'].includes(entry.partner));
    assert.equal(typeof entry.prompt, 'string');
    assert.ok(entry.prompt.length <= 240);
    assert.ok(!/https?:|@|bearer\s|cookie:|password|api[_ -]?key/i.test(entry.prompt), 'prompts must contain only synthetic shopping intent');
    assert.ok(['results', 'no-match', 'clarification'].includes(entry.expected.outcome));
    for (const tag of entry.tags) tags.add(tag);
    for (const [id, grade] of Object.entries(entry.expected.grades)) {
      const product = products.get(id);
      assert.ok(product, `${entry.id}: unknown judgment ${id}`);
      assert.ok(Number.isInteger(grade) && grade >= 1 && grade <= 3);
      assert.deepEqual(hardViolations(product.offer, product, entry.expected.hard), [], `${entry.id}: relevant row violates hard constraints`);
    }
    assert.equal(Object.keys(entry.expected.grades).length > 0, entry.expected.outcome === 'results');
    if (entry.mode === 'native') assert.ok(Object.hasOwn(entry, 'input'));
  }
  for (const tag of ['alias', 'attribute', 'use-case', 'exclusion', 'bundle', 'budget', 'unknown-category', 'malformed', 'conflicting']) assert.ok(tags.has(tag));
  // Reject sensitive-shaped fields anywhere, including accidentally copied outputs.
  function inspect(value) {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      assert.ok(!/identity|account|credential|receipt|session|token|persona|email|password|authorization/i.test(key), `forbidden fixture key: ${key}`);
      inspect(child);
    }
  }
  inspect(corpus);
}

export async function loadPartner(root, partner, products) {
  const source = await readFile(path.join(root, `partners/${partner}/tool.js`), 'utf8');
  let tool;
  const context = vm.createContext({
    location: { hostname: `${partner}.example`, protocol: 'https:' },
    console: { log() {} },
    window: { dispatchEvent() {} },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
    catalogJSON: JSON.stringify(products.filter((p) => p.partner === partner).map((p) => p.offer)),
    capture: (registered) => { assert.equal(tool, undefined); tool = registered; },
  });
  // Parse inside the realm so Watch's plain-record guard is exercised faithfully.
  vm.runInContext(`globalThis.fetch = async (url) => {
    if (url !== '/catalog.json') throw new Error('evaluation blocks all other fetches');
    return { json: async () => JSON.parse(catalogJSON) };
  };
  globalThis.document = { modelContext: { registerTool: async (tool) => { globalThis.registeredTool = tool; capture(tool); } } };`, context);
  await vm.runInContext(`(async () => {\n${source}\n})()`, context, { filename: `partners/${partner}/tool.js`, timeout: 1000 });
  assert.equal(tool?.name, 'get_matching_deals');
  return {
    async execute(input) {
      context.inputJSON = JSON.stringify(input);
      const result = await vm.runInContext('registeredTool.execute(JSON.parse(inputJSON))', context, { timeout: 1000 });
      return JSON.parse(JSON.stringify(result));
    },
  };
}

export async function createAdapter(root = defaultRoot, corpus) {
  const [{ interpretPreferenceWords }, plane, engine] = await Promise.all([
    import(pathToFileURL(path.join(root, 'engine/preference-canvas.mjs'))),
    import(pathToFileURL(path.join(root, 'engine/preference-plane.mjs'))),
    import(pathToFileURL(path.join(root, 'engine/p0.js'))),
  ]);
  const adapters = Object.fromEntries(await Promise.all(partners.map(async (p) => [p, await loadPartner(root, p, corpus.products)])));
  return async (entry) => {
    if (entry.mode === 'native') {
      try {
        const result = await adapters[entry.partner].execute(entry.input);
        if (!engine.validatePartnerEnvelope(result)) return { status: 'invalid', deals: [], rawDeals: [], input: entry.input };
        return { status: result.deals.length ? 'results' : 'no-match', deals: result.deals, rawDeals: result.deals, input: entry.input };
      } catch {
        return { status: 'error', deals: [], rawDeals: [], input: entry.input };
      }
    }
    const parsed = interpretPreferenceWords(entry.prompt);
    const interpretation = { category: parsed.category ?? null, maxPrice: parsed.maxPrice ?? null, clarification: Boolean(parsed.clarification) };
    // Mirrors the first anonymous canvas edit followed by its commitment guard.
    // No seeded demo category, manual correction, persisted state or inferred consent.
    if (parsed.clarification) return { status: 'clarification', deals: [], rawDeals: [], interpretation };
    const preferences = plane.normalizePreferencePlane({
      feedStyle: 'balanced', category: '', maxPrice: null, formats: [], ...entry.manual,
      ...(parsed.category === undefined ? {} : { category: parsed.category }),
      ...(parsed.maxPrice === undefined ? {} : { maxPrice: parsed.maxPrice }),
      ...(parsed.maxPriceInclusive === undefined ? {} : { maxPriceInclusive: parsed.maxPriceInclusive }),
      rules: parsed.remainder ? [{ id: 'synthetic-priority', text: parsed.remainder, scope: 'everywhere', category: '', active: true }] : [],
    });
    const context = engine.createContextSnapshot({ profile: null, preferences, applied: true });
    const rawDeals = [];
    const inputs = {};
    const result = await engine.resolvePartnerTools({
      tools: partners.map((p) => ({ name: 'get_matching_deals', origin: origin(p) })),
      allowedOrigins: partners.map(origin), timeoutMs: 25,
      inputForOrigin: (o) => (inputs[o] = engine.projectPartnerContext(context, o).fields),
      execute: async (tool, input) => {
        const partner = partners.find((p) => origin(p) === tool.origin);
        const response = await adapters[partner].execute(input);
        rawDeals.push(...(response.deals || []));
        return response;
      },
    });
    const resolved = engine.resolveOfferDeals(result.deals, { profile: null, preferences });
    const statuses = Object.values(result.originOutcomes).map((o) => o.status);
    const status = statuses.some((s) => !['ready', 'no-match'].includes(s)) ? 'invalid' : resolved.exposed.length ? 'results' : 'no-match';
    return { status, deals: resolved.exposed, rawDeals, interpretation, inputs };
  };
}

export function provenanceViolations(deal, product, mode) {
  if (!product) return ['unknown-product'];
  const failures = [];
  for (const key of ['name', 'category', 'dealPrice', 'source', 'imageUrl', 'landing', 'listPrice', 'listPriceSource']) {
    if (deal[key] !== product.offer[key]) failures.push(`changed:${key}`);
  }
  if (deal.partnerId !== product.partner) failures.push('partner-id');
  if (deal.partnerName !== names[product.partner]) failures.push('partner-name');
  if (mode === 'native') {
    if (deal.provenance?.actor !== names[product.partner]) failures.push('actor');
    if (deal.provenance?.source !== product.offer.source) failures.push('source');
    if (deal.provenance?.verification !== 'partner-provided; not independently verified by Jumping Beans') failures.push('verification');
  } else {
    if (deal.provenance?.origin !== origin(product.partner)) failures.push('origin');
    if (deal.provenance?.sourceType !== 'opted-in partner') failures.push('source-type');
    if (deal.provenance?.sourceLabel !== 'WebMCP offer tool') failures.push('source-label');
    if (deal.provenance?.verification !== 'Partner-provided through WebMCP; not independently verified by Jumping Beans') failures.push('verification');
    if (!Number.isFinite(Date.parse(deal.provenance?.observedAt))) failures.push('observed-at');
  }
  return failures;
}

export function scoreCase(entry, result, corpus) {
  const products = new Map(corpus.products.map((p) => [p.offer.sku, p]));
  const violations = [];
  const provenance = [];
  const seen = new Set();
  for (const deal of result.deals) {
    const reasons = hardViolations(deal, products.get(deal.sku), entry.expected.hard);
    if (entry.expected.outcome !== 'results') reasons.push('unexpected-result');
    if (seen.has(deal.sku)) reasons.push('duplicate');
    seen.add(deal.sku);
    if (reasons.length) violations.push({ sku: deal.sku, reasons });
    const missing = provenanceViolations(deal, products.get(deal.sku), entry.mode);
    if (missing.length) provenance.push({ sku: deal.sku, reasons: missing });
  }
  // Inspect native source disclosure as well as the engine's final projection.
  if (entry.mode === 'words') for (const deal of result.rawDeals) {
    const missing = provenanceViolations(deal, products.get(deal.sku), 'native');
    if (missing.length) provenance.push({ sku: deal.sku, stage: 'native', reasons: missing });
  }
  const ids = result.deals.map((d) => d.sku);
  const ranking = Object.fromEntries(corpus.k.map((k) => [k, rankingMetrics(ids, entry.expected.grades, k)]));
  const largestK = Math.max(...corpus.k);
  const totalRelevant = Object.keys(entry.expected.grades).length;
  const attainableRecall = totalRelevant ? Math.min(largestK, totalRelevant) / totalRelevant : null;
  const outcomeCorrect = result.status === entry.expected.outcome;
  return {
    id: entry.id, partner: entry.partner, mode: entry.mode, tags: entry.tags,
    expectedOutcome: entry.expected.outcome, actualOutcome: result.status, outcomeCorrect,
    ...(result.interpretation ? { interpretation: result.interpretation } : {}),
    returned: ids, relevantCount: totalRelevant, ranking,
    hardFilterViolations: violations,
    hardFilterPrecision: ids.length ? (ids.length - violations.length) / ids.length : null,
    provenanceViolations: provenance,
    provenanceApplicable: result.deals.length > 0 || result.rawDeals.length > 0,
    qualityPass: outcomeCorrect && !violations.length && !provenance.length
      && (!totalRelevant || (ranking[largestK].recall >= attainableRecall && ranking[largestK].ndcg >= 1 - 1e-12)),
  };
}

export function summarize(rows, ks) {
  const returned = rows.reduce((sum, row) => sum + row.returned.length, 0);
  const hardInvalid = rows.reduce((sum, row) => sum + row.hardFilterViolations.length, 0);
  const provenanceRows = rows.filter((row) => row.provenanceApplicable);
  const unknownRows = rows.filter((row) => row.tags.includes('unknown-category'));
  return {
    cases: rows.length, qualityPassed: rows.filter((row) => row.qualityPass).length,
    outcomeCorrect: rows.filter((row) => row.outcomeCorrect).length,
    returned, hardInvalid, hardFilterPrecision: returned ? (returned - hardInvalid) / returned : null,
    hardFilterCleanCases: rows.filter((row) => !row.hardFilterViolations.length).length,
    provenanceCases: provenanceRows.length,
    provenanceCorrectCases: provenanceRows.filter((row) => !row.provenanceViolations.length).length,
    unknownCases: unknownRows.length, unknownOutcomeCorrect: unknownRows.filter((row) => row.outcomeCorrect).length,
    rankingCases: rows.filter((row) => row.relevantCount > 0).length,
    ranking: Object.fromEntries(ks.map((k) => [k, {
      recall: mean(rows.map((row) => row.ranking[k].recall)),
      ndcg: mean(rows.map((row) => row.ranking[k].ndcg)),
    }])),
  };
}

export async function evaluate({ root = defaultRoot, corpus = null } = {}) {
  corpus ||= await loadCorpus();
  validateCorpus(corpus);
  const files = Object.fromEntries(await Promise.all(sourceFiles.map(async (file) => [file, hash(await readFile(path.join(root, file)))])));
  const run = await createAdapter(root, corpus);
  const rows = [];
  for (const entry of corpus.cases) rows.push(scoreCase(entry, await run(entry), corpus));
  return {
    schemaVersion: 1, harnessSha256: hash(await readFile(fileURLToPath(import.meta.url))),
    corpusSha256: hash(JSON.stringify(corpus)), sourceSha256: files,
    k: corpus.k, summary: summarize(rows, corpus.k),
    byPartner: Object.fromEntries([...partners, 'all'].map((p) => [p, summarize(rows.filter((r) => r.partner === p), corpus.k)])),
    byMode: Object.fromEntries(['words', 'native'].map((m) => [m, summarize(rows.filter((r) => r.mode === m), corpus.k)])),
    cases: rows,
  };
}

export function compareReports(baseline, candidate) {
  assert.equal(candidate.schemaVersion, baseline.schemaVersion, 'report schema differs');
  assert.equal(candidate.harnessSha256, baseline.harnessSha256, 'comparison requires identical harness semantics');
  assert.equal(candidate.corpusSha256, baseline.corpusSha256, 'comparison requires the identical fixture and judgments');
  assert.deepEqual(candidate.k, baseline.k, 'comparison requires identical K');
  assert.deepEqual(candidate.cases.map((r) => r.id), baseline.cases.map((r) => r.id), 'comparison requires identical case order');
  return {
    qualityPassedDelta: candidate.summary.qualityPassed - baseline.summary.qualityPassed,
    hardInvalidDelta: candidate.summary.hardInvalid - baseline.summary.hardInvalid,
    rankingDelta: Object.fromEntries(candidate.k.map((k) => [k, Object.fromEntries(['recall', 'ndcg'].map((metric) => [metric,
      candidate.summary.ranking[k][metric] === null || baseline.summary.ranking[k][metric] === null ? null
        : candidate.summary.ranking[k][metric] - baseline.summary.ranking[k][metric],
    ]))])),
    changedCases: candidate.cases.filter((row, i) => JSON.stringify(row) !== JSON.stringify(baseline.cases[i])).map((r) => r.id),
  };
}

async function main() {
  const args = process.argv.slice(2);
  let root = defaultRoot; let compare; let strict = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--root') { assert.ok(args[i + 1]); root = path.resolve(args[++i]); }
    else if (args[i] === '--compare') { assert.ok(args[i + 1]); compare = args[++i]; }
    else if (args[i] === '--strict') strict = true;
    else throw new Error(`Unknown argument: ${args[i]}`);
  }
  const report = await evaluate({ root });
  const comparison = compare ? compareReports(JSON.parse(await readFile(compare, 'utf8')), report) : null;
  process.stdout.write(JSON.stringify(comparison ? { report, comparison } : report, null, 2) + '\n');
  if (strict && report.summary.qualityPassed !== report.summary.cases) process.exitCode = 1;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
