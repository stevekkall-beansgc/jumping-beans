// Shared renderer for the three independently deployed partner storefronts.

const grid = document.getElementById("grid");
const banner = document.getElementById("banner");
const partnerName = document.body.dataset.partnerName || "Partner shop";
const params = new URLSearchParams(location.search);
const requestedFormats = params.get("jb_presentation")?.split(",").filter(Boolean) || [];
const formatLabels = {
  testimonial: "testimonials first",
  video: "a short video first",
  "price-proof": "price proof first",
  "no-urgency": "no urgency",
};
const adaptiveLabel = requestedFormats
  .map((format) => formatLabels[format])
  .filter(Boolean)
  .join(" · ");

const money = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" });

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
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

function productCard(deal, index) {
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
  const listPrice = Number(deal.listPrice || 0);
  const dealPrice = Number(deal.dealPrice || 0);
  const savedPercent = listPrice > 0
    ? Math.max(0, Math.round((1 - dealPrice / listPrice) * 100))
    : 0;

  const price = element("p", "offer-card__price");
  if (listPrice > dealPrice && dealPrice >= 0) {
    const listed = element("span", "list-price", money.format(listPrice));
    listed.setAttribute("aria-label", `Listed price ${money.format(listPrice)}`);
    price.append(listed);
  }
  const current = element("strong", "deal-price", money.format(dealPrice));
  current.setAttribute("aria-label", `Current catalog price ${money.format(dealPrice)}`);
  price.append(current);
  if (savedPercent > 0) price.append(element("span", "discount", `${savedPercent}% below list`));

  const expiry = element("p", "expiry");
  const time = element("time", "", expiryLabel(deal.expiresAt));
  if (deal.expiresAt) time.dateTime = deal.expiresAt;
  expiry.append(time);

  body.append(element("p", "bl-card__eyebrow category", category), heading, price, expiry);
  if (adaptiveLabel) {
    const adaptation = element("p", "bl-callout adaptation-note", `Adapted using this browser’s selected display rules: ${adaptiveLabel}.`);
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

function showAdaptation() {
  if (!banner || !adaptiveLabel) return;
  banner.replaceChildren(
    element("strong", "", "Opted-in partner preview"),
    element("span", "", `${partnerName} received scoped presentation context: ${adaptiveLabel}. Product facts still come from the catalog source named on each offer.`),
  );
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
    grid.replaceChildren(...catalog.map(productCard));
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

showAdaptation();
renderCatalog();
