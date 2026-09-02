import { isCompatibilityInputError } from '../engine/p0.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { normalizePreferencePlane, reviewPreferencePlane, selectStarterStyle, STARTER_STYLES } from '../engine/preference-plane.mjs';
import { canvasDraft, interpretPreferenceWords, selectionSummary, canvasResultState } from '../engine/preference-canvas.mjs';

const parsed = interpretPreferenceWords('Show repair options first under $200');
assert.equal(parsed.maxPrice, 200);
assert.equal(parsed.remainder, 'Show repair options first');
assert.deepEqual(interpretPreferenceWords('Shopping for watches under $200'), { category: 'watches', maxPrice: 200, remainder: '', clarification: '' });
assert.equal(interpretPreferenceWords('Show watches I can repair').category, undefined, 'do not guess categories');
assert.equal(interpretPreferenceWords('under 40 inches').maxPrice, undefined, 'do not guess money from measurements');
assert.equal(interpretPreferenceWords('under $1,200.50').maxPrice, 1200.50);
assert.ok(interpretPreferenceWords('under $200 or below $80').clarification);
assert.ok(interpretPreferenceWords('under $10000001').clarification);
assert.ok(interpretPreferenceWords('shopping for watches and category: coffee').clarification);
assert.equal(interpretPreferenceWords('under $200 and below $200').maxPrice, 200);

for (const words of ['under $200.', 'under $200,', 'under $200!']) assert.equal(interpretPreferenceWords(words).maxPrice, 200);
assert.equal(interpretPreferenceWords('Not shopping for watches').category, undefined);
assert.equal(interpretPreferenceWords('Not category: watches').category, undefined);
assert.ok(interpretPreferenceWords('shopping for watches and coffee').clarification);
assert.equal(interpretPreferenceWords('shopping for coffee grinders').category, undefined);
const oldSaved = normalizePreferencePlane({ maxPrice: 200, category: 'watches', rules: [{id:'old',text:'Show repair options first under $200',scope:'everywhere'}] });
assert.equal(canvasDraft(oldSaved).rules[0].text, 'Show repair options first');
assert.equal(oldSaved.rules[0].text, 'Show repair options first under $200', 'migration edits only the draft copy');
assert.equal(canvasDraft({...oldSaved,maxPrice:100}).rules[0].text, oldSaved.rules[0].text, 'conflicting older rule needs explicit review');

const source = readFileSync(new URL('../engine/app.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../engine/index.html', import.meta.url), 'utf8');
assert.doesNotMatch(html, /data-setup-path|preview-words-chat|See your results|Continue to review/);
assert.equal((html.match(/id="canvas-show-offers"/g) || []).length, 1);
assert.equal((html.match(/<h1\b/g) || []).length, 1);
assert.match(html, /id="canvas-visit"[^>]+checked/);
assert.match(html, /<details[^>]+id="product-builder"/);
assert.ok(html.indexOf('id="product-account-save"') > html.indexOf('id="canvas-results"'));
const nodes = new Map();
let context;
function node(id) {
  if (!nodes.has(id)) nodes.set(id, {
    id, value: '', hidden: false, checked: false, open: false, textContent: '', innerHTML: '', dataset: {}, attrs: {}, children: [], isConnected: true,
    setAttribute(key, value) { this.attrs[key] = value; },
    toggleAttribute(key, value) { if (value) this.attrs[key] = ''; else delete this.attrs[key]; },
    replaceChildren(...items) { this.children = items; }, append(...items) { this.children.push(...items); },
    querySelectorAll() { return []; }, reportValidity() { return context.valid; },
    focus(options) { assert.equal(options?.preventScroll, true); context.focused = id; context.document.activeElement = this; },
  });
  return nodes.get(id);
}
const els = Object.fromEntries([...source.matchAll(/(\w+): document.getElementById\("([^"]+)"\)/g)].map(([, key,id]) => [key,node(id)]));
const defaults = normalizePreferencePlane({ formats: ['price-proof'] });
const state = {
  preferences: defaults, appliedPreferences: defaults, applied: false, appliedMode: null,
  productStage: 'preview', productReviewState: 'idle', productDraftDirty: false,
  canvasRetention: 'once', canvasClarification: '', canvasRuleId: null,
  draftRevision: 0, appliedJourneyRevision: 0, memory: [], currentView: 'product',
  savedPreferences: null, hasSavedPreferences: false, originOutcomes: {}, sourceA: {},
};
const writes = []; const records = []; const saved = new Map();
let rule = 0; let resolveRead; let calls = 0;
context = vm.createContext({
  state, els, valid: true, DEFAULT_PREFERENCES: defaults, STARTER_STYLES,
  normalizePreferencePlane: (value) => normalizePreferencePlane(JSON.parse(JSON.stringify(value))),
  reviewPreferencePlane, selectStarterStyle, canvasDraft, interpretPreferenceWords, selectionSummary, canvasResultState,
  SUPPORTED: true, PARTNER_ORIGINS: ['one', 'two'], formatLabels: { 'price-proof': 'Price proof' },
  document: { activeElement: null, getElementById: node, createElement: () => node(`generated-${nodes.size}`) },
  window: { confirm: () => context.confirmed }, confirmed: true,
  localStorage: { removeItem(key) { saved.delete(key); }, setItem(key, value) { saved.set(key, JSON.parse(value)); } },
  STORAGE: { preferences: 'preferences', memory: 'memory', networkSharing: 'network' },
  hasStored: (key) => saved.has(key), readStored: (key, fallback) => saved.get(key) ?? fallback,
  writeStored: (key, value) => { writes.push([key, value]); if (context.storageDenied) return false; saved.set(key, value); return true; },
  setAgent() {}, showToast() {}, renderMemory() {}, createContextSnapshot: (value) => value,
  recordEvent: (type, payload) => records.push({ type, payload }),
  addMemory: () => !context.storageDenied, money: (value) => `$${Number(value).toFixed(2)}`,
  opaqueId: () => `rule-${++rule}`, escapeHtml: (value) => String(value),
  offerMarkup: (_deal, kind) => kind === 'open' ? 'Open inventory' : 'Opted-in partner', networkMarkup: () => 'Partner status',
  renderJourney: () => { context.renderProductShell(); context.renderProductNetwork(); },
  rerunAppliedJourney: async () => { state.appliedJourneyRevision++; calls++; await new Promise((resolve) => { resolveRead = resolve; }); },
  invalidateAppliedJourney: () => { state.capabilityResolution = null; state.originOutcomes = {}; },
});
function load(start, end) { const a=source.indexOf(start), b=source.indexOf(end,a); assert.ok(a>=0 && b>a); vm.runInContext(source.slice(a,b),context); }
load('function renderProductReview(', 'function ruleScopeLabel(');
load('function ruleScopeLabel(', 'function currentProductCategory(');
load('function productPreferenceDraft()', 'function renderOfferCard(');
load('function markDraftEdited(', 'function hydrateAccountJourney(');
load('async function applyPreferences(', 'function invalidateAppliedJourney(');
context.renderProductShell();
assert.equal(els.canvasDraft.hidden,false);
assert.equal(els.canvasVisit.checked,true);
assert.equal(writes.length,0);
els.canvasWords.value='Show repair options first under $200';
context.updateCanvasWords();
assert.equal(state.preferences.maxPrice,200);
assert.deepEqual(state.preferences.rules.map(r=>r.text),['Show repair options first']);
assert.equal((els.productReviewRules.innerHTML.match(/\$200/g)||[]).length,1);
assert.equal(calls,0,'draft never requests offers');
assert.equal(writes.length,0,'draft never persists');
context.editCanvasFact('budget');
assert.equal(context.focused,'product-max-price');
context.removeCanvasFact('budget');
assert.equal(state.preferences.maxPrice,null);
assert.equal(els.canvasWords.value,'Show repair options first','removed parsed amount cannot return from raw input');
context.editCanvasFact(state.preferences.rules[0].id);
els.canvasWords.value='Prefer repairable models'; context.updateCanvasWords();
assert.deepEqual(state.preferences.rules.map(r=>r.text),['Prefer repairable models']);
context.removeCanvasFact(state.preferences.rules[0].id);
assert.equal(state.preferences.rules.length,0);
assert.equal(els.canvasWords.value,'');

// Incremental typing, deletion and punctuation never leave stale extracted facts.
for (const words of ['under $200', 'under $200.', 'under $20', 'under $']) { els.canvasWords.value=words; context.updateCanvasWords(); }
assert.equal(state.preferences.maxPrice,null);
context.settleCanvasWords();
context.startFreshProductDraft();

// Capture the actual apply boundary; pause native resolution to inspect loading.
els.productCategory.value='watches'; state.preferences=context.productPreferenceDraft();
const visit=context.commitCanvasSelection();
assert.equal(state.productStage,'results');
assert.ok(state.draftRevision > 0, 'even default approval protects against late hydration');
assert.equal(els.canvasResults.hidden,false);
assert.equal(els.canvasResults.dataset.state,'loading');
assert.equal(state.appliedMode,'once');
assert.equal(calls,1);
assert.equal(writes.length,0,'visit-only creates no local preference or note');
assert.equal(context.focused,'canvas-results-title');
context.returnToProductEntry();
assert.equal(state.productStage,'results','busy transition cannot create a concurrent draft');
await context.commitCanvasSelection(); assert.equal(calls,1,'double submit cannot invoke twice');
context.focused='account-back'; state.currentView='account';
resolveRead(); await visit;
assert.equal(context.focused,'account-back','async completion never steals focus from Account');
assert.equal(els.canvasResults.dataset.state,'partial');
assert.equal(els.canvasSync.hidden,true);
state.currentView='product'; context.returnToProductEntry();
assert.equal(state.preferences.category,'watches');
state.preferences={...state.preferences, category:'coffee'}; context.markDraftEdited({preferences:true});
assert.equal(state.appliedPreferences.category,'watches','editing never mutates approved results');
context.discardCanvasDraft(); assert.equal(state.preferences.category,'');

state.preferences=normalizePreferencePlane({category:'watches',maxPrice:200,formats:['price-proof']});
state.canvasRetention='saved';
const local=context.commitCanvasSelection();
assert.equal(state.appliedMode,'saved');
assert.equal(saved.get('preferences').maxPrice,200);
resolveRead(); await local;
assert.equal(els.canvasSync.hidden,false);
context.returnToProductEntry();
state.preferences={...state.preferences,maxPrice:100}; context.markDraftEdited({preferences:true});
context.reviewSavedProductPreferences(); assert.equal(state.preferences.maxPrice,200);
context.startFreshProductDraft(); assert.equal(saved.get('preferences').maxPrice,200);
context.discardCanvasDraft(); assert.equal(state.preferences.maxPrice,200);

// Local storage failure must not claim a successful save or enable sync.
state.canvasRetention='saved'; state.preferences={...state.preferences,maxPrice:80}; context.storageDenied=true;
const denied=context.commitCanvasSelection(); assert.equal(state.appliedMode,'once');
resolveRead(); await denied;
assert.match(els.productReviewStatus.textContent,/could not save/);
assert.equal(els.canvasSync.hidden,true);
assert.equal(saved.get('preferences').maxPrice,200);
context.storageDenied=false;
context.confirmed=false; context.forgetSavedSelection(); assert.equal(saved.has('preferences'),true);
context.confirmed=true; context.forgetSavedSelection();
assert.equal(saved.has('preferences'),false); assert.equal(state.applied,false); assert.equal(state.savedPreferences,null);
assert.equal(state.preferences.rules.length,0); assert.equal(state.canvasRetention,'once');
assert.doesNotMatch(JSON.stringify(records),/repairable|repair options|private/,'events never collect raw words');

const base={applied:true,supported:true,outcomes:{one:{status:'ready'},two:{status:'no-match'}}};
assert.equal(canvasResultState({...base,deals:[]}).kind,'no-match');
assert.equal(canvasResultState({...base,deals:[{}]}).kind,'results');
assert.equal(canvasResultState({...base,outcomes:{one:{status:'ready'},two:{status:'timeout'}},deals:[{}]}).kind,'partial');
assert.equal(canvasResultState({...base,supported:false}).kind,'unavailable');
assert.equal(canvasResultState({...base,paused:true}).kind,'paused');
state.applied=true; state.productStage='results'; state.productReviewState='applied';
state.originOutcomes=base.outcomes;state.capabilityResolution={exposed:[]}; context.renderProductNetwork();
assert.equal(els.canvasResults.dataset.state,'no-match');
assert.match(els.canvasResultsFeed.innerHTML,/Open inventory/);
assert.doesNotMatch(els.canvasResultsFeed.innerHTML,/Opted-in partner/);
state.originOutcomes.two.status='timeout';state.capabilityResolution.exposed=[{}];context.renderProductNetwork();
assert.equal(els.canvasResults.dataset.state,'partial');
assert.match(els.canvasResultsFeed.innerHTML,/Opted-in partner/);
// The actual native discovery path must stop if Forget revokes while getTools waits.
load('async function discoverPartnerDeals(', 'function applyPartnerDiscovery(');
let finishDiscovery; let invocations=0;
context.document.modelContext={ getTools: async () => new Promise(resolve => {finishDiscovery=resolve;}) };
context.TOOL_NAMES={matchingDeals:'get_matching_deals'};
context.discoverGrant=()=>{invocations++; return {};};
context.executeTool=()=>{invocations++; return {};};
state.applied=true; state.appliedJourneyRevision++;
const pendingNative=context.discoverPartnerDeals();
state.applied=false;state.appliedJourneyRevision++;
finishDiscovery([{name:'get_matching_deals',origin:'one'}]);
await pendingNative;
assert.equal(invocations,0,'revoked discovery cannot invoke a native partner tool');

// The native serialized-argument compatibility retry has the same revocation boundary.
load('async function executeTool(', 'function discoverGrant(');
context.isCompatibilityInputError=isCompatibilityInputError;
let rejectNative; let nativeCalls=0;
context.document.modelContext.executeTool=async()=>{nativeCalls++; return new Promise((_resolve,reject)=>{rejectNative=reject;});};
state.applied=true;state.networkSharingPaused=false;
const initialNative=context.executeTool({name:'get_matching_deals'}, {maxPrice:200});
state.applied=false;state.appliedJourneyRevision++;
rejectNative(new Error('Failed to parse input arguments'));
await assert.rejects(initialNative);
assert.equal(nativeCalls,1,'revocation blocks serialized compatibility retry');

// A memory write failure leaves Forget retryable and does not imply deletion.
saved.set('preferences',oldSaved); saved.set('memory',[{kind:'preference'}]);
state.savedPreferences=oldSaved;state.hasSavedPreferences=true;state.applied=true;
const setItem=context.localStorage.setItem;
context.localStorage.setItem=()=>{throw new Error('storage unavailable');};
context.forgetSavedSelection();assert.equal(saved.has('preferences'),true);assert.equal(state.hasSavedPreferences,true);
context.localStorage.setItem=setItem;context.forgetSavedSelection();assert.equal(saved.has('preferences'),false);assert.equal(state.applied,false);

console.log('Preference canvas contracts pass (interpretation, one commitment, retention, loading/results, focus, saved/discard/Forget, partial/no-match, privacy)');
