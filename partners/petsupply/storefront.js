// Petsupply storefront — renders the catalog as a normal shop grid.
// This keeps the page fully usable for people/browsers without WebMCP
// (an OpenAI requirement for the challenge).

const grid = document.getElementById("grid");

function priceDate(iso) {
  const d = new Date(iso);
  const today = new Date();
  const ms = d - today;
  if (ms < 0) return "Ended today";
  const hours = Math.round(ms / 3600000);
  if (hours < 24) return `Ends in ~${hours}h`;
  return `Ends ${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

function card(d) {
  const pct = Math.round((1 - d.dealPrice / d.listPrice) * 100);
  return `
    <div class="card">
      <img class="thumb" src="${d.imageUrl}" alt="${d.name}" loading="lazy">
      <div class="cat">${d.category.replace("-", " ")}</div>
      <h3>${d.name}</h3>
      <div class="price">
        <span class="list">$${d.listPrice.toFixed(2)}</span>
        <span class="deal">$${d.dealPrice.toFixed(2)}</span>
        <span class="save">${pct}% off</span>
      </div>
      <div class="expiry">${priceDate(d.expiresAt)}</div>
    </div>`;
}

const catalog = await fetch("/catalog.json").then((r) => r.json());
grid.innerHTML = catalog.map(card).join("");
