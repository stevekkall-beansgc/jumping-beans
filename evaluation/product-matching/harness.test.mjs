import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  loadCorpus, validateCorpus, rankingMetrics, hardViolations, provenanceViolations,
  loadPartner, defaultRoot, createAdapter, scoreCase, evaluate, compareReports,
} from './harness.mjs';

const corpus = await loadCorpus();
const baseline = JSON.parse(await readFile(new URL('./baseline.json', import.meta.url), 'utf8'));
const report = await evaluate({ corpus });
const run = await createAdapter(defaultRoot, corpus);

// Hand-calculated metric examples test the measurement independently of matching.
test('Recall uses all relevant products as denominator, not only the retrieved set', () => {
  assert.deepEqual(rankingMetrics(['a', 'x', 'b'], { a: 1, b: 1, c: 1, d: 1 }, 3), {
    recall: 0.5, ndcg: 1.5 / (1 + 1 / Math.log2(3) + 0.5),
  });
});
test('graded NDCG rewards the better order using exponential gain and log discount', () => {
  const grades = { a: 3, b: 1 };
  assert.equal(rankingMetrics(['a', 'b'], grades, 2).ndcg, 1);
  const swapped = rankingMetrics(['b', 'a'], grades, 2).ndcg;
  assert.ok(Math.abs(swapped - (1 + 7 / Math.log2(3)) / (7 + 1 / Math.log2(3))) < 1e-12);
  assert.ok(swapped < 1);
});
test('empty retrieval fails positive queries; empty gold is not an automatic ranking success', () => {
  assert.deepEqual(rankingMetrics([], { a: 3 }, 5), { recall: 0, ndcg: 0 });
  assert.deepEqual(rankingMetrics([], {}, 5), { recall: null, ndcg: null });
  assert.deepEqual(rankingMetrics(['x'], {}, 5), { recall: null, ndcg: null });
  assert.throws(() => rankingMetrics([], {}, 0));
});
test('duplicates cannot inflate recall or NDCG and unjudged products gain zero', () => {
  const result = rankingMetrics(['a', 'a', 'unknown'], { a: 1, b: 1 }, 3);
  assert.equal(result.recall, 0.5);
  assert.equal(result.ndcg, 1 / (1 + 1 / Math.log2(3)));
});
test('hard oracle covers category, inclusive/exclusive prices, attributes, exclusions and complete bundles', () => {
  const product = corpus.products.find((p) => p.offer.sku === 'P04');
  assert.deepEqual(hardViolations(product.offer, product, { maxPrice: 40, equals: { bundle: true }, contains: { components: ['lead', 'harness'] } }), []);
  assert.deepEqual(hardViolations(product.offer, product, { categories: ['coffee'], belowPrice: 40, equals: { material: 'leather' }, notEquals: { bundle: true }, contains: { components: ['bowl'] } }), ['category', 'exclusive-price', 'required:material', 'excluded:bundle', 'missing:components']);
  assert.deepEqual(hardViolations(product.offer, product, { notEquals: { unknownFact: 'value' } }), ['excluded:unknownFact']);
  assert.deepEqual(hardViolations(product.offer, null, {}), ['unknown-product']);
});
test('fixture judgments are complete for positive queries and cannot include impossible or unknown products', () => {
  validateCorpus(corpus);
  const invalid = structuredClone(corpus);
  invalid.cases[0].expected.grades.missing = 3;
  assert.throws(() => validateCorpus(invalid));
  const contradiction = structuredClone(corpus);
  contradiction.cases[0].expected.hard.maxPrice = 0;
  assert.throws(() => validateCorpus(contradiction));
});
test('fixture lint rejects sensitive-shaped fields and non-synthetic URL hosts', () => {
  const invalid = structuredClone(corpus);
  invalid.cases[0].session = 'synthetic-forbidden-field';
  assert.throws(() => validateCorpus(invalid));
  const remote = structuredClone(corpus);
  remote.products[0].offer.landing = 'https://invalid.test/product';
  assert.throws(() => validateCorpus(remote));
});
test('all partners enforce exact canonical categories and inclusive ceilings using unchanged code', async () => {
  for (const [partner, category, maxPrice] of [['petsupply', 'dog gear', 20], ['coffee', 'coffee', 20], ['watch', 'watches', 200]]) {
    const adapter = await loadPartner(defaultRoot, partner, corpus.products);
    const result = await adapter.execute({ categories: [category], maxPrice });
    const gold = corpus.products.filter((p) => p.partner === partner && p.offer.category === category && p.offer.dealPrice <= maxPrice).map((p) => p.offer.sku).sort();
    assert.deepEqual(result.deals.map((d) => d.sku).sort(), gold);
    assert.ok(result.deals.some((d) => d.dealPrice === maxPrice), 'boundary fixture must be exercised');
  }
});
test('unknown categories yield no rows and mixed unknown/known input does not widen category', async () => {
  for (const entry of corpus.cases.filter((c) => c.tags.includes('unknown-category'))) {
    const scored = scoreCase(entry, await run(entry), corpus);
    assert.equal(scored.outcomeCorrect, true, entry.id);
    assert.deepEqual(scored.hardFilterViolations, [], entry.id);
  }
});
test('explicit conflicting budgets/categories stop with clarification and no partner output', async () => {
  for (const id of ['coffee-conflict', 'petsupply-conflict', 'watch-conflict', 'conflicting-categories']) {
    const result = await run(corpus.cases.find((entry) => entry.id === id));
    assert.equal(result.status, 'clarification');
    assert.deepEqual(result.deals, []);
    assert.deepEqual(result.rawDeals, []);
  }
});
test('native and engine provenance preserve fixture facts without claiming independent verification', async () => {
  for (const id of ['petsupply-canonical', 'coffee-canonical', 'watch-canonical']) {
    const entry = corpus.cases.find((c) => c.id === id);
    const result = await run(entry);
    assert.ok(result.deals.length);
    assert.deepEqual(scoreCase(entry, result, corpus).provenanceViolations, []);
    const deal = result.deals[0];
    const product = corpus.products.find((p) => p.offer.sku === deal.sku);
    assert.ok(provenanceViolations({ ...deal, provenance: {} }, product, 'words').length >= 4);
    assert.ok(provenanceViolations({ ...deal, dealPrice: 0 }, product, 'words').includes('changed:dealPrice'));
    for (const input of Object.values(result.inputs)) {
      assert.deepEqual(Object.keys(input).sort(), ['categories', 'preferencePlane']);
      for (const rule of input.preferencePlane.rules) assert.deepEqual(Object.keys(rule).sort(), ['category', 'scope', 'text']);
    }
  }
});
test('scoring fails hallucinated products, duplicated rows, missing provenance and fail-open invalid intent', async () => {
  const entry = corpus.cases.find((c) => c.id === 'coffee-canonical');
  const result = await run(entry);
  const mutated = structuredClone(result);
  mutated.deals.push({ ...mutated.deals[0] }, { ...mutated.deals[0], sku: 'unknown' });
  delete mutated.deals[0].provenance;
  const scored = scoreCase(entry, mutated, corpus);
  assert.equal(scored.qualityPass, false);
  assert.equal(scored.hardFilterViolations.length, 2);
  assert.ok(scored.provenanceViolations.length >= 2);
  const noMatch = corpus.cases.find((c) => c.id === 'coffee-unknown');
  assert.ok(scoreCase(noMatch, result, corpus).hardFilterViolations.every((v) => v.reasons.includes('unexpected-result')));
});
test('missing results never pass quality even though no returned row violates a hard filter', () => {
  const scored = scoreCase(corpus.cases[0], { status: 'no-match', deals: [], rawDeals: [] }, corpus);
  assert.equal(scored.hardFilterPrecision, null);
  assert.equal(scored.qualityPass, false);
  assert.equal(scored.ranking[5].recall, 0);
});
test('repeated evaluation is byte deterministic without retaining clocks or generated context IDs', async () => {
  assert.equal(JSON.stringify(await evaluate({ corpus })), JSON.stringify(report));
});
test('frozen baseline reproduces exactly for its recorded production source hashes', (t) => {
  if (JSON.stringify(report.sourceSha256) !== JSON.stringify(baseline.sourceSha256)) {
    t.skip('Production sources changed: use --compare baseline.json to measure the candidate; historical failures are not required behavior.');
    return;
  }
  assert.deepEqual(report, baseline);
});
test('comparison uses identical cases and judgments and detects changed quality', () => {
  const comparison = compareReports(report, report);
  assert.equal(comparison.qualityPassedDelta, 0);
  assert.deepEqual(comparison.changedCases, []);
  assert.throws(() => compareReports(report, { ...report, corpusSha256: 'changed' }));
  assert.throws(() => compareReports(report, { ...report, harnessSha256: 'changed' }));
  assert.throws(() => compareReports(report, { ...report, k: [9] }));
  const altered = structuredClone(report);
  altered.summary.qualityPassed++;
  assert.equal(compareReports(report, altered).qualityPassedDelta, 1);
});
