import {
  INTEREST_PRODUCTS,
  INTEREST_RETENTION_DAYS,
  LOCAL_INTEREST_KEY,
  activeInterestRecords,
} from "../interest-products.js";

const rows = document.getElementById("demand-rows");
const status = document.getElementById("refresh-status");
const money = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" });

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function readLocal() {
  try {
    return activeInterestRecords(JSON.parse(localStorage.getItem(LOCAL_INTEREST_KEY) || "[]"));
  } catch {
    return [];
  }
}

function summarize(records, product) {
  const prices = records
    .filter((record) => record.product === product)
    .map(({ pricePoint }) => pricePoint)
    .sort((a, b) => a - b);
  const mid = Math.floor(prices.length / 2);
  return {
    count: prices.length,
    medianPrice: prices.length
      ? prices.length % 2 ? prices[mid] : (prices[mid - 1] + prices[mid]) / 2
      : null,
    minPrice: prices[0] ?? null,
    maxPrice: prices.at(-1) ?? null,
    window: `last-${INTEREST_RETENTION_DAYS}-days`,
  };
}

async function getSummary(product, localRecords) {
  try {
    const response = await fetch(`/api/interest-summary?product=${encodeURIComponent(product)}`);
    if (response.ok) return { ...await response.json(), source: "deployed D1-backed storage" };
  } catch {
    // The deterministic local server has no API; use same-origin browser data.
  }
  return { ...summarize(localRecords, product), source: "this browser" };
}

function renderCard(product, summary) {
  const item = element("li", "bl-card demand-card");
  const heading = element("h2", "", product.name);
  const count = element("p", "demand-count");
  count.append(
    element("strong", "", String(summary.count)),
    document.createTextNode(` shopper signal${summary.count === 1 ? "" : "s"} in the last ${INTEREST_RETENTION_DAYS} days`),
  );
  const range = element(
    "p",
    "demand-range",
    summary.count
      ? `Median target ${money.format(summary.medianPrice)} · range ${money.format(summary.minPrice)}–${money.format(summary.maxPrice)} · source: ${summary.source}`
      : `No active signals · source: ${summary.source}`,
  );
  const meter = element("div", "demand-meter");
  meter.setAttribute("aria-hidden", "true");
  const percent = summary.medianPrice && product.currentPrice
    ? Math.min(100, Math.round((summary.medianPrice / product.currentPrice) * 100))
    : 0;
  meter.style.setProperty("--demand-percent", `${percent}%`);
  item.append(heading, count, range, meter);
  return item;
}

async function refresh() {
  rows.setAttribute("aria-busy", "true");
  const localRecords = readLocal();
  try {
    const summaries = await Promise.all(
      INTEREST_PRODUCTS.map(({ sku }) => getSummary(sku, localRecords)),
    );
    rows.replaceChildren(...INTEREST_PRODUCTS.map((product, index) => renderCard(product, summaries[index])));
    status.textContent = `Showing active signals retained for at most ${INTEREST_RETENTION_DAYS} days. Refreshes every five seconds.`;
  } catch {
    const empty = element("li", "bl-callout demand-empty", "Aggregate demand could not be loaded. No records were changed.");
    empty.dataset.tone = "danger";
    rows.replaceChildren(empty);
    status.textContent = "Aggregate demand is temporarily unavailable.";
  } finally {
    rows.setAttribute("aria-busy", "false");
  }
}

refresh();
window.setInterval(refresh, 5000);
