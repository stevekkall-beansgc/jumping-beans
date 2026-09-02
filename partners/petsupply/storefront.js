// GENERATED from shared/storefront.js. Run node scripts/sync-static-ui.mjs; do not edit.
// Shared renderer for the three independently deployed partner storefronts.

const grid = document.getElementById("grid");
const banner = document.getElementById("banner");
const partnerName = document.body.dataset.partnerName || "Partner shop";
const partnerState = globalThis.__JB_PARTNER_CONTEXT__ ??= { preferencePlane: null };
const ALLOWED_FORMATS = new Set(["testimonial", "price-proof", "video", "no-urgency"]);
const ALLOWED_FEED_STYLES = new Set(["visual", "balanced", "compare", "custom"]);
const formatLabels = {
  testimonial: "testimonials first",
  video: "a short video first",
  "price-proof": "price proof first",
  "no-urgency": "no urgency",
};

const money = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" });

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function normalizePreferencePlane(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const formats = Array.isArray(value.formats)
    ? [...new Set(value.formats.filter((format) => ALLOWED_FORMATS.has(format)))]
    : [];
  const rules = Array.isArray(value.rules)
    ? value.rules
        .filter((rule) => rule && typeof rule === "object" && !Array.isArray(rule))
        .map((rule) => {
          const text = typeof rule.text === "string" ? rule.text.trim().slice(0, 240) : "";
          const scope = rule.scope === "category" ? "category" : "everywhere";
          const category = typeof rule.category === "string" ? rule.category.trim().slice(0, 80) : "";
          return text ? { text, scope, category: scope === "category" ? category : "" } : null;
        })
        .filter(Boolean)
    : [];
  return {
    feedStyle: ALLOWED_FEED_STYLES.has(value.feedStyle) ? value.feedStyle : "balanced",
    category: typeof value.category === "string" ? value.category.trim().slice(0, 80) : "",
    maxPrice: Number.isFinite(value.maxPrice) && value.maxPrice >= 0 ? value.maxPrice : null,
    formats,
    rules,
  };
}

function currentPreferencePlane() {
  partnerState.preferencePlane = normalizePreferencePlane(partnerState.preferencePlane);
  return partnerState.preferencePlane;
}

function formatPreferencePlane(plane) {
  if (!plane) return null;
  const parts = [];
  if (plane.feedStyle) parts.push(`feed style ${plane.feedStyle}`);
  if (plane.category) parts.push(`category ${plane.category}`);
  if (Number.isFinite(plane.maxPrice)) parts.push(`max price ${money.format(plane.maxPrice)}`);
  if (plane.formats.length) {
    const formats = plane.formats.map((format) => formatLabels[format]).filter(Boolean).join(" · ");
    if (formats) parts.push(formats);
  }
  return parts.join(" · ");
}

function relevantRules(plane) {
  if (!plane?.rules?.length) return [];
  const categoryKey = String(plane.category || "").trim().toLocaleLowerCase();
  return plane.rules.filter((rule) => {
    if (rule.scope === "everywhere") return true;
    return categoryKey && String(rule.category || "").trim().toLocaleLowerCase() === categoryKey;
  });
}

function safeHttpUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url : null;
  } catch {
    return null;
  }
}

function expiryLabel(value) {
  const expiry = new Date(value);
  if (Number.isNaN(expiry.getTime())) return "Offer end date unavailable";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(expiry);
  day.setHours(0, 0, 0, 0);
  const days = Math.round((day - today) / 864e5);
  if (days < 0) return "Listed offer end date has passed";
  if (days === 0) return "Listed offer ends today";
  if (days === 1) return "Listed offer ends tomorrow";
  return `Listed offer ends ${expiry.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
}

function collateralForDeal(deal) {
  const hasMerchantListPrice = deal.listPriceSource === "merchant"
    && Number.isFinite(deal.listPrice)
    && deal.listPrice > deal.dealPrice;
  const collateral = [
    { type: "image", url: deal.imageUrl, label: "Merchant product image" },
    ...(hasMerchantListPrice
      ? [{
          type: "price-proof",
          text: `${Math.round((1 - deal.dealPrice / deal.listPrice) * 100)}% below merchant comparison price`,
          source: `${partnerName} catalog compare-at price`,
        }]
      : []),
  ];
  if (deal.sku === "WO-CLR-WV-S-BLK") {
    collateral.push({
      type: "testimonial",
      text: "The quick-release collar is simple, sturdy, and easy to use every day.",
      source: "Petsupply customer story",
    });
  }
  if (deal.sku === "LGLIGT10") {
    collateral.push({
      type: "testimonial",
      text: "A bright, easy everyday roast with a smooth finish.",
      source: "Coffee Co customer story",
    });
  }
  return collateral;
}

function normalizeCatalog(catalog) {
  return catalog.map((deal) => ({ ...deal, collateral: collateralForDeal(deal) }));
}

function presentationScore(deal, plane) {
  if (!plane) return 0;
  let score = 0;
  const requestedFormats = new Set(plane.formats || []);
  const collateralTypes = new Set((deal.collateral || []).map((item) => item.type));
  if (plane.category && String(deal.category || "").trim().toLocaleLowerCase() === String(plane.category).trim().toLocaleLowerCase()) score += 3;
  if (plane.feedStyle === "visual" && collateralTypes.has("testimonial")) score += 2;
  if (plane.feedStyle === "compare" && collateralTypes.has("price-proof")) score += 2;
  if (requestedFormats.has("testimonial") && collateralTypes.has("testimonial")) score += 4;
  if (requestedFormats.has("price-proof") && collateralTypes.has("price-proof")) score += 4;
  if (requestedFormats.has("video") && collateralTypes.has("video")) score += 4;
  if (requestedFormats.has("no-urgency")) score += 1;
  return score;
}

function preferenceNotes(deal, plane) {
  if (!plane) return [];
  const requestedFormats = new Set(plane.formats || []);
  const testimonial = (deal.collateral || []).find((item) => item.type === "testimonial");
  return requestedFormats.has("testimonial") && testimonial?.text ? [testimonial.text] : [];
}

function provenanceDetails(deal, destination) {
  const details = element("details", "bl-disclosure provenance");
  details.append(element("summary", "bl-disclosure__summary", "Source and verification"));
  const body = element("div", "bl-disclosure__body");
  const list = document.createElement("dl");
  list.className = "bl-provenance__facts";
  const rows = [
    ["What", `Catalog offer ${deal.sku || "without a supplied SKU"}`],
    ["Who", `${partnerName} surfaced this record; ${deal.vendor || "the catalog vendor"} supplied the product listing`],
    ["Source", deal.source === "shopify" ? "Shopify public product feed" : deal.source || "Partner catalog"],
    ["When", "The source capture time is not included in this catalog record"],
    ["Verification", "Not independently verified by Jumping Beans"],
    ["Evidence", destination ? `Catalog record links to ${destination.hostname}` : "No merchant destination was supplied"],
  ];
  for (const [term, description] of rows) {
    const row = document.createElement("div");
    row.append(element("dt", "", term), element("dd", "", description));
    list.append(row);
  }
  body.append(list);
  details.append(body);
  return details;
}

function productCard(deal, index, plane) {
  const item = document.createElement("li");
  const article = element("article", "bl-card offer-card");
  const headingId = `offer-${index}`;
  article.setAttribute("aria-labelledby", headingId);

  const image = element("img", "offer-card__media");
  image.src = deal.imageUrl || "";
  image.alt = "";
  image.loading = "lazy";
  image.crossOrigin = "anonymous";

  const body = element("div", "bl-card__body offer-card__body");
  const category = String(deal.category || "Offer").replaceAll("-", " ");
  const heading = element("h2", "", deal.name || "Unnamed offer");
  heading.id = headingId;
  const dealPrice = Number(deal.dealPrice || 0);
  const hasMerchantListPrice = deal.listPriceSource === "merchant"
    && Number.isFinite(deal.listPrice)
    && deal.listPrice > dealPrice;
  const savedPercent = hasMerchantListPrice
    ? Math.round((1 - dealPrice / deal.listPrice) * 100)
    : null;

  const price = element("p", "offer-card__price");
  if (hasMerchantListPrice) {
    const listed = element("span", "list-price", money.format(deal.listPrice));
    listed.setAttribute("aria-label", `Merchant comparison price ${money.format(deal.listPrice)}`);
    price.append(listed);
  }
  const current = element("strong", "deal-price", money.format(dealPrice));
  current.setAttribute("aria-label", `Current catalog price ${money.format(dealPrice)}`);
  price.append(current);
  if (savedPercent > 0) price.append(element("span", "discount", `${savedPercent}% below merchant comparison price`));

  const expiry = element("p", "expiry");
  const time = element("time", "", expiryLabel(deal.expiresAt));
  if (deal.expiresAt) time.dateTime = deal.expiresAt;
  expiry.append(time);

  body.append(element("p", "bl-card__eyebrow category", category), heading, price, expiry);
  const notes = preferenceNotes(deal, plane);
  if (notes.length) {
    const adaptation = element("p", "bl-callout adaptation-note", notes.join(" "));
    adaptation.dataset.tone = "info";
    body.append(adaptation);
  }

  const destination = safeHttpUrl(deal.landing);
  const footer = element("div", "bl-card__footer bl-actions");
  if (destination) {
    const link = element("a", "bl-button product-link", `View offer at ${deal.vendor || destination.hostname}`);
    link.href = destination.href;
    link.target = "_top";
    link.rel = "noopener noreferrer";
    link.dataset.variant = "secondary";
    footer.append(link);
  }
  article.append(image, body);
  if (footer.childElementCount) article.append(footer);
  article.append(provenanceDetails(deal, destination));
  item.append(article);
  return item;
}

function showAdaptation(plane) {
  if (!banner) return;
  if (!plane) {
    banner.replaceChildren(
      element("strong", "", "Opted-in partner, public-feed inventory"),
      element("span", "", `${partnerName} exposes structured offers through WebMCP. The underlying catalog records came from a public feed and are not independently verified by Jumping Beans.`),
    );
    return;
  }
  const summary = formatPreferencePlane(plane);
  const rules = relevantRules(plane).slice(0, 3);
  banner.replaceChildren(
    element("strong", "", "Opted-in partner preview"),
    element("span", "", `${partnerName} received scoped presentation context: ${summary}. Product facts still come from the catalog source named on each offer.`),
  );
  if (rules.length) {
    banner.append(
      element(
        "p",
        "bl-callout adaptation-note",
        `Relevant rules: ${rules.map((rule) => rule.scope === "category" && rule.category ? `${rule.text} (${rule.category})` : rule.text).join(" · ")}`,
      ),
    );
  }
}

async function renderCatalog() {
  grid.setAttribute("aria-busy", "true");
  try {
    const response = await fetch("./catalog.json");
    if (!response.ok) throw new Error(`Catalog request returned ${response.status}`);
    const catalog = await response.json();
    if (!Array.isArray(catalog) || !catalog.length) {
      grid.replaceChildren(element("li", "bl-callout offer-grid__state", "No catalog offers are available right now."));
      return;
    }
    const plane = currentPreferencePlane();
    showAdaptation(plane);
    const ranked = normalizeCatalog(catalog)
      .sort((a, b) => presentationScore(b, plane) - presentationScore(a, plane) || Number(a.dealPrice || 0) - Number(b.dealPrice || 0));
    grid.replaceChildren(...ranked.map((deal, index) => productCard(deal, index, plane)));
  } catch {
    grid.replaceChildren(
      (() => {
        const error = element("li", "bl-callout offer-grid__state", "The catalog did not load. No order or payment was attempted. Refresh the page to try again.");
        error.dataset.tone = "danger";
        return error;
      })(),
    );
  } finally {
    grid.setAttribute("aria-busy", "false");
  }
}

showAdaptation(currentPreferencePlane());
window.addEventListener("jb:preference-plane", () => {
  void renderCatalog();
});
renderCatalog();
