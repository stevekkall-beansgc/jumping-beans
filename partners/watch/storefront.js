const GRID = document.getElementById("grid");
const BANNER = document.getElementById("banner");

const priceDate = (s) => {
  const d = new Date(s);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  if (d.getTime() === today.getTime()) return "⚡ Expires today";
  const days = Math.round((d - today) / 864e5);
  return days === 1 ? "Expires tomorrow" : `Expires in ${days} days`;
};

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
BANNER.textContent = `${"Watch Co"} — today's specials`;
GRID.innerHTML = catalog.map(card).join("");
