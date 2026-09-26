// Visit-only visible navigation. Only the existing canonical sharing plane is
// carried; fragments are not sent in HTTP requests or Referer headers.
import { normalizePreferencePlane, preferenceSharingPayload } from './preference-plane.mjs';
import { redactShoppingIntent, intentPolicyRules, partnerPriceCeiling } from './shopping-intent.mjs';

const PREFIX = '#jb_preferences=';
const MAX_FRAGMENT = 12000;
const CATEGORY_PARTNERS = Object.freeze({
  'dog gear': 'petsupply',
  coffee: 'coffee',
  watches: 'watch',
});

export function partnerHandoffUrl(destination, preferences, { origins = [], applied = false, paused = false } = {}) {
  try {
    const target = new URL(destination);
    if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password || !origins.includes(target.origin)) return null;
    // Never forward an incoming query, fragment, path, or merchant tracking URL.
    const url = new URL('/', target.origin);
    if (applied && !paused) {
      const shared = preferenceSharingPayload(preferences);
      const fragment = PREFIX + encodeURIComponent(JSON.stringify({ version: 1, preferences: shared }));
      if (fragment.length > MAX_FRAGMENT) return null;
      url.hash = fragment;
    }
    return url.href;
  } catch { return null; }
}

export function readPreferenceHandoff(fragment) {
  if (typeof fragment !== 'string' || !fragment.startsWith(PREFIX) || fragment.length > MAX_FRAGMENT) return null;
  try {
    const envelope = JSON.parse(decodeURIComponent(fragment.slice(PREFIX.length)));
    if (envelope.version !== 1 || Object.keys(envelope).sort().join() !== 'preferences,version') return null;
    const source = envelope.preferences;
    const normalized = normalizePreferencePlane(source);
    const intent = redactShoppingIntent(source.intent);
    const canonical = {
      feedStyle: normalized.feedStyle, category: intent.category || '',
      maxPrice: partnerPriceCeiling(intent.budget), formats: normalized.formats,
      rules: intentPolicyRules(intent), intent,
    };
    // Exact canonical shape rejects unknown fields, raw rules, invalid enums,
    // mismatched ceilings/categories, and sensitive data at every depth.
    const stable = (value) => JSON.stringify(value, function (key, item) {
      return item && typeof item === 'object' && !Array.isArray(item)
        ? Object.fromEntries(Object.keys(item).sort().map((name) => [name, item[name]])) : item;
    });
    return stable(source) === stable(canonical) ? canonical : null;
  } catch { return null; }
}

export function previewPartnerHandoff(preferences, origins, options = {}) {
  if (options.applied !== true || options.paused === true) return null;
  const normalized = normalizePreferencePlane(preferences);
  const partnerId = CATEGORY_PARTNERS[normalized.category.toLowerCase()];
  const destination = partnerId && origins?.[partnerId];
  if (!destination) return null;
  const href = partnerHandoffUrl(destination, normalized, options);
  return href ? { href, partnerId } : null;
}

export function eligibleStorefrontOffer(deal, plane, now = Date.now()) {
  if (deal.availability === 'out-of-stock') return false;
  if (deal.expiresAt != null) {
    const expiry = Date.parse(deal.expiresAt);
    if (!Number.isFinite(expiry) || expiry <= now) return false;
  }
  if (!plane) return true;
  if (plane.intent && ['unknown', 'clarification', 'empty'].includes(plane.intent.status)) return false;
  if (plane.category) {
    const requested = plane.category.toLowerCase();
    const local = String(deal.category || '').trim().toLowerCase();
    if (local !== requested) {
      const words = `${deal.name || ''} ${deal.category || ''}`.toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(/\s+/);
      // Petsupply owns a finer local category vocabulary. The canonical dog
      // gear vertical maps only to records that explicitly identify a dog;
      // cat and generic merchandise never widen into this preview.
      if (requested !== 'dog gear' || !words.includes('dog') || words.includes('cat')) return false;
    }
  }
  if (!Number.isFinite(deal.dealPrice) || deal.dealPrice < 0) return false;
  if (plane.maxPrice !== null && deal.dealPrice > plane.maxPrice) return false;
  if (plane.maxPriceInclusive === false && plane.maxPrice !== null && deal.dealPrice === plane.maxPrice) return false;
  const budget = plane.intent?.budget;
  if (budget?.minPrice != null && (deal.dealPrice < budget.minPrice || (deal.dealPrice === budget.minPrice && !budget.minInclusive))) return false;
  return true;
}
