import { isCompatibilityInputError } from '../engine/p0.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { normalizePreferencePlane, reviewPreferencePlane, selectStarterStyle, STARTER_STYLES } from '../engine/preference-plane.mjs';
import { canvasDraft, interpretPreferenceWords, selectionSummary, canvasResultState } from '../engine/preference-canvas.mjs';

const parsed = interpretPreferenceWords('Show repair options first under $200');
assert.equal(parsed.maxPrice, 200);
assert.equal(parsed.remainder, 'Show repair options first');
assert.deepEqual(interpretPreferenceWords('Shopping for watches under $200'), { category: 'watches', maxPrice: 200, maxPriceInclusive: false, remainder: '', clarification: '' });
assert.equal(interpretPreferenceWords('Show watches I can repair').category, 'watches', 'explicit product nouns identify a vertical');
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
assert.equal(interpretPreferenceWords('shopping for coffee grinders').category, 'coffee');
const oldSaved = normalizePreferencePlane({ maxPrice: 200, maxPriceInclusive: false, category: 'watches', rules: [{id:'old',text:'Show repair options first under $200',scope:'everywhere'}] });
assert.equal(canvasDraft(oldSaved).rules[0].text, 'Show repair options first');
assert.equal(oldSaved.rules[0].text, 'Show repair options first under $200', 'migration edits only the draft copy');
assert.equal(canvasDraft({...oldSaved,maxPrice:100}).rules[0].text, oldSaved.rules[0].text, 'conflicting older rule needs explicit review');

const source = readFileSync(new URL('../engine/app.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../engine/index.html', import.meta.url), 'utf8');
assert.doesNotMatch(html, /data-setup-path|preview-words-chat|See your results|Continue to review/);
assert.equal((html.match(/id="canvas-show-offers"/g) || []).length, 1);
assert.equal((html.match(/<h1\b/g) || []).length, 1);
assert.match(html, /<h1[^>]*>Tell me what you’re looking for<\/h1>/);
assert.match(html, /id="canvas-enter-manual"[^>]*>Enter in the manual form<\/button>/);
assert.match(html, /id="canvas-manual"[^>]*hidden/);
assert.match(html, /id="canvas-back-chat"[^>]*>Back to chat<\/button>/);
assert.match(html, /id="canvas-chat-form"/);
assert.match(html, /id="canvas-review-selection"[^>]*>Review selection<\/button>/);
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
    querySelectorAll() { return []; }, checkValidity() { return context.valid; }, reportValidity() { return context.valid; },
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
  connectedTools: [], discoveryComplete: false, networkSharingPaused: false,
};
const writes = []; const records = []; const saved = new Map();
let rule = 0; let resolveRead; let rejectRead; let calls = 0;
context = vm.createContext({
  state, els, valid: true, DEFAULT_PREFERENCES: defaults, STARTER_STYLES,
  normalizePreferencePlane: (value) => normalizePreferencePlane(JSON.parse(JSON.stringify(value))),
  reviewPreferencePlane, selectStarterStyle, canvasDraft, interpretPreferenceWords, selectionSummary, canvasResultState,
  SUPPORTED: true, PARTNER_ORIGINS: ['one', 'two'], formatLabels: { 'price-proof': 'Price proof' },
  document: { activeElement: null, getElementById: node, createElement: () => node(`generated-${nodes.size}`) },
  window: { confirm: () => context.confirmed, scrollX: 0, scrollY: 0,
    scrollTo({ left, top, behavior }) { assert.equal(behavior, 'instant'); this.scrollX = left; this.scrollY = top; },
  }, confirmed: true,
  localStorage: { removeItem(key) { saved.delete(key); }, setItem(key, value) { saved.set(key, JSON.parse(value)); } },
  STORAGE: { preferences: 'preferences', memory: 'memory', networkSharing: 'network' },
  hasStored: (key) => saved.has(key), readStored: (key, fallback) => saved.get(key) ?? fallback,
  writeStored: (key, value) => { writes.push([key, value]); if (context.storageDenied) return false; saved.set(key, value); return true; },
  setAgent() {}, showToast() {}, renderMemory() {}, createContextSnapshot: (value) => value,
  recordEvent: (type, payload) => records.push({ type, payload }),
  addMemory: () => !context.storageDenied, money: (value) => `$${Number(value).toFixed(2)}`,
  opaqueId: () => `rule-${++rule}`, escapeHtml: (value) => String(value),
  offerMarkup: (_deal, kind) => kind === 'open' ? 'Open inventory' : 'Opted-in partner', networkMarkup: () => 'Partner status',
  selfServePreviewMarkup: () => 'Open storefront preview',
  renderJourney: () => { context.renderProductShell(); context.renderProductNetwork(); },
  rerunAppliedJourney: async () => { state.appliedJourneyRevision++; state.discoveryComplete = false; state.originOutcomes = {}; calls++; await new Promise((resolve, reject) => { resolveRead = resolve; rejectRead = reject; }); },
  invalidateAppliedJourney: () => { state.capabilityResolution = null; state.originOutcomes = {}; },
});
function load(start, end) { const a=source.indexOf(start), b=source.indexOf(end,a); assert.ok(a>=0 && b>a); vm.runInContext(source.slice(a,b),context); }
load('function renderBrowserReadiness()', 'function createPartnerFrames(');
load('function renderProductReview(', 'function ruleScopeLabel(');
load('function ruleScopeLabel(', 'function currentProductCategory(');
load('function currentProductCategory(', 'function productPreferenceDraft(');
load('function productPreferenceDraft()', 'function renderOfferCard(');
load('function markDraftEdited(', 'function hydrateAccountJourney(');
load('async function applyPreferences(', 'function invalidateAppliedJourney(');
context.renderProductShell();
assert.equal(els.browserReadiness.children[0].textContent,'Native WebMCP check is available');
assert.equal(els.canvasDraft.hidden,false);
assert.equal(els.canvasChat.hidden,false);
assert.equal(els.canvasManual.hidden,true);
assert.equal(els.canvasReview.hidden,true);
assert.equal(els.canvasVisit.checked,true);
assert.equal(writes.length,0);
els.canvasWords.value='Show repair options first under $200';
context.updateCanvasWords();
assert.equal(state.preferences.maxPrice,200);
assert.deepEqual(state.preferences.rules.map(r=>r.text),['Show repair options first']);
assert.equal((els.productReviewRules.innerHTML.match(/\$200/g)||[]).length,1);
assert.equal(calls,0,'draft never requests offers');
assert.equal(writes.length,0,'draft never persists');
assert.equal(els.canvasReview.hidden,true,'typing cannot expose a commitment before review');
const chatDraft = els.canvasWords.value;
const draftPlane = JSON.stringify(state.preferences);
const draftRevision = state.draftRevision;
state.canvasRetention = 'saved';
context.setCanvasEntryMode('manual');
assert.equal(els.canvasChat.hidden,true);
assert.equal(els.canvasManual.hidden,false);
assert.equal(els.canvasEnterManual.attrs['aria-expanded'],'true');
assert.equal(context.focused,'product-category');
assert.equal(els.canvasReview.hidden,false);
context.setCanvasEntryMode('chat');
assert.equal(els.canvasWords.value,chatDraft,'switching preserves the exact chat draft');
assert.equal(JSON.stringify(state.preferences),draftPlane,'switching preserves interpreted preferences');
assert.equal(state.draftRevision,draftRevision,'switching is presentation only');
assert.equal(state.canvasRetention,'saved','switching preserves retention');
assert.equal(context.focused,'product-prompt-input');
context.reviewCanvasSelection();
assert.equal(els.canvasReview.hidden,false);
assert.equal(context.focused,'product-preview-title');
assert.equal(calls,0,'review and mode switches cannot invoke offers');
assert.equal(writes.length,0,'review and mode switches cannot save');
state.canvasRetention='once';
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
assert.equal(context.focused,'product-prompt-input');
assert.equal(state.canvasEntryMode,'chat');
assert.equal(els.canvasReview.hidden,true);

// Corrected manual fields win over unchanged facts in the preserved prose.
els.canvasWords.value='Shopping for watches under $200. Prefer repair options'; context.updateCanvasWords();
context.setCanvasEntryMode('manual');
state.preferences={...state.preferences,category:'coffee',maxPrice:80};
context.setCanvasEntryMode('chat');
els.canvasWords.value += ' first'; context.updateCanvasWords();
assert.equal(state.preferences.category,'coffee');
assert.equal(state.preferences.maxPrice,80);
els.canvasWords.value=els.canvasWords.value.replace('$200','$100'); context.updateCanvasWords();
assert.equal(state.preferences.maxPrice,100,'explicitly changed words can change the budget');
assert.equal(state.preferences.category,'coffee');
context.startFreshProductDraft();

// Inequalities travel with the amount through manual corrections and edits.
els.canvasWords.value='Shopping for watches under $200'; context.updateCanvasWords();
assert.equal(state.preferences.maxPriceInclusive,false);
assert.match(els.productReviewRules.innerHTML,/Under \$200/);
state.preferences={...state.preferences,maxPrice:80};
delete state.preferences.maxPriceInclusive;
els.canvasWords.value += ' please'; context.updateCanvasWords();
assert.equal(state.preferences.maxPrice,80);
assert.equal(state.preferences.maxPriceInclusive,undefined);
els.canvasWords.value=els.canvasWords.value.replace('$200','$100'); context.updateCanvasWords();
assert.equal(state.preferences.maxPrice,100);
assert.equal(state.preferences.maxPriceInclusive,false);
els.canvasWords.value=els.canvasWords.value.replace('under','up to'); context.updateCanvasWords();
assert.equal(state.preferences.maxPrice,100);
assert.equal(state.preferences.maxPriceInclusive,undefined);
assert.match(els.productReviewRules.innerHTML,/Up to \$100/);
context.removeCanvasFact('budget');
assert.equal(state.preferences.maxPrice,null);
assert.equal(state.preferences.maxPriceInclusive,undefined);
context.startFreshProductDraft();

els.canvasWords.value='Show repair options first under $200'; context.updateCanvasWords();
const editedRule=state.canvasRuleId;
context.updateDraftRule(editedRule,{text:'Show warranty terms first',scope:'everywhere'});
els.canvasWords.value += ' please'; context.updateCanvasWords();
assert.equal(state.preferences.rules[0].text,'Show warranty terms first please','chat cannot resurrect an advanced edit');
context.forgetDraftRule(editedRule);
assert.equal(els.canvasWords.value,'','forgotten priority cannot return from stale chat text');
context.startFreshProductDraft();

// Ambiguity never grants sharing; validation reveals the relevant entry pane.
els.canvasWords.value='under $200 or below $80'; context.updateCanvasWords();
context.setCanvasEntryMode('manual');
await context.commitCanvasSelection();
assert.equal(state.canvasEntryMode,'chat');
assert.equal(context.focused,'product-prompt-input');
assert.equal(calls,0);
context.startFreshProductDraft();
context.valid=false;
els.productMaxPrice.value='-1';
els.productMaxPrice.validity={valid:false};
context.setCanvasEntryMode('manual');
context.setCanvasEntryMode('chat');
assert.equal(els.productMaxPrice.value,'-1','mode switches preserve invalid raw budgets for correction');
await context.commitCanvasSelection();
assert.equal(state.canvasEntryMode,'manual','invalid hidden manual field is exposed before native validation');
assert.equal(calls,0);
assert.equal(els.productMaxPrice.value,'-1');
context.valid=true;
els.productMaxPrice.validity={valid:true};
context.startFreshProductDraft();

// Category-scoped rule validation must expose the now-hidden category field.
context.reviewCanvasSelection();
assert.equal(context.addDraftRule({text:'Repair first',scope:'category'}),false);
assert.equal(state.canvasEntryMode,'manual');
assert.equal(context.focused,'product-category');
assert.match(els.productReviewStatus.textContent,/Enter a category/);
assert.equal(state.preferences.rules.length,0);
state.preferences={...state.preferences,rules:[{id:'scope-test',text:'Repair first',scope:'everywhere',category:'',active:true}]};
context.setCanvasEntryMode('chat');
context.updateDraftRule('scope-test',{scope:'category'});
assert.equal(state.canvasEntryMode,'manual');
assert.equal(state.preferences.rules[0].scope,'everywhere');
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
assert.equal(records.some(({type,payload})=>type==='journey.outcome'&&payload.outcomeType==='preference_applied'),false,'a failed or unacknowledged lookup cannot claim preferences were applied');
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
assert.equal(canvasResultState({...base,applied:false,paused:false}).kind,'idle');
state.applied=true; state.productStage='results'; state.productReviewState='applied';
state.originOutcomes=base.outcomes;state.capabilityResolution={exposed:[]}; context.renderProductNetwork();
assert.equal(els.canvasResults.dataset.state,'no-match');
assert.match(els.canvasResultsFeed.innerHTML,/Open inventory/);
assert.match(els.canvasResultsFeed.innerHTML,/Open storefront preview/);
assert.doesNotMatch(els.canvasResultsFeed.innerHTML,/Opted-in partner/);
state.originOutcomes.two.status='timeout';state.capabilityResolution.exposed=[{}];context.renderProductNetwork();
assert.equal(els.canvasResults.dataset.state,'partial');
assert.match(els.canvasResultsFeed.innerHTML,/Opted-in partner/);
// The persistent readiness callout must reflect the current result, retry, and
// pause states instead of retaining an earlier green verdict.
state.originOutcomes={one:{status:'ready'},two:{status:'no-match'}};
state.connectedTools=[{origin:'one'},{origin:'two'}];
state.discoveryComplete=true;
state.productReviewState='applied';
context.renderProductShell();
assert.equal(els.browserReadiness.dataset.tone,'success');
assert.equal(els.browserReadiness.children[0].textContent,'Native WebMCP verified with all 2 member sites');
state.productReviewState='applying';
context.renderProductShell();
assert.equal(els.browserReadiness.children[0].textContent,'Checking native WebMCP');
state.productReviewState='applied';state.networkSharingPaused=true;state.originOutcomes={};
context.renderProductShell();
assert.equal(els.browserReadiness.dataset.tone,'info');
assert.equal(els.browserReadiness.children[0].textContent,'Native WebMCP sharing is paused');
state.networkSharingPaused=false;
state.applied=true;state.productReviewState='applied';state.discoveryComplete=true;
state.originOutcomes={one:{status:'ready'},two:{status:'no-match'}};
const failedRetry=context.retryCanvasResults();
assert.equal(els.browserReadiness.children[0].textContent,'Checking native WebMCP');
rejectRead(new Error('partner discovery failed'));
await failedRetry;
assert.equal(state.discoveryComplete,true);
assert.deepEqual(Object.values(state.originOutcomes).map(({status})=>status),['failed','failed']);
assert.equal(els.browserReadiness.children[0].textContent,'Native member check is incomplete');
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

// A completed discovery must refresh its derived origin state before the
// decision receipt and capability.decision event are created.
load('function applyPartnerDiscovery(', 'let nativeToolchangeReconciliationQueued');
state.connectedTools=[{origin:'one'},{origin:'two'},{origin:'two'}];
state.connectedOrigins=[];
state.selectedWatchOfferId=null;
let originsSeenByDecision;
context.choosePartnerOffer=()=>{originsSeenByDecision=[...state.connectedOrigins];return null;};
context.watchHandoffOffers=()=>[];
context.updateConnections=()=>{};
context.renderJourney=()=>{};
context.applyPartnerDiscovery({deals:[],originOutcomes:{one:{status:'ready'},two:{status:'no-match'}}});
assert.equal(JSON.stringify(originsSeenByDecision),'["one","two"]','decision evidence sees every unique origin from the current native discovery');
assert.equal(JSON.stringify(state.connectedOrigins),'["one","two"]');

// Chrome's native API receives JSON text first, while the legacy-object
// compatibility retry keeps the same revocation boundary.
load('async function executeTool(', 'function discoverGrant(');
context.isCompatibilityInputError=isCompatibilityInputError;
let rejectNative; let nativeCalls=0;
let nativeInputs=[];
context.document.modelContext.executeTool=async(_tool,input)=>{nativeCalls++; nativeInputs.push(input); return new Promise((_resolve,reject)=>{rejectNative=reject;});};
state.applied=true;state.networkSharingPaused=false;
const initialNative=context.executeTool({name:'get_matching_deals'}, {maxPrice:200});
assert.equal(nativeInputs[0],'{"maxPrice":200}','native Chrome input is serialized first');
state.applied=false;state.appliedJourneyRevision++;
rejectNative(new TypeError("parameter 2 is not of type 'object'"));
await assert.rejects(initialNative);
assert.equal(nativeCalls,1,'revocation blocks serialized compatibility retry');

// A recognized legacy input-type error may retry once with the object while
// the consent boundary is still valid.
nativeInputs=[];nativeCalls=0;state.applied=true;
context.document.modelContext.executeTool=async(_tool,input)=>{nativeCalls++;nativeInputs.push(input);if(typeof input==='string')throw new TypeError("parameter 2 is not of type 'object'");return JSON.stringify({deals:[]});};
assert.equal(JSON.stringify(await context.executeTool({name:'get_matching_deals'}, {maxPrice:200})),'{"deals":[]}');
assert.equal(nativeCalls,2);
assert.equal(nativeInputs[0],'{"maxPrice":200}');
assert.equal(nativeInputs[1].maxPrice,200);

// A memory write failure leaves Forget retryable and does not imply deletion.
saved.set('preferences',oldSaved); saved.set('memory',[{kind:'preference'}]);
state.savedPreferences=oldSaved;state.hasSavedPreferences=true;state.applied=true;
const setItem=context.localStorage.setItem;
context.localStorage.setItem=()=>{throw new Error('storage unavailable');};
context.forgetSavedSelection();assert.equal(saved.has('preferences'),true);assert.equal(state.hasSavedPreferences,true);
context.localStorage.setItem=setItem;context.forgetSavedSelection();assert.equal(saved.has('preferences'),false);assert.equal(state.applied,false);

console.log('Preference canvas contracts pass (interpretation, one commitment, retention, loading/results, focus, saved/discard/Forget, partial/no-match, privacy)');
