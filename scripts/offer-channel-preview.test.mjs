import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../engine/app.js", import.meta.url), "utf8");
assert.match(source, /PRODUCT_SECTION_HASHES = new Set\(\["offer-preview", "find-offers", "partners"\]\)/, "product-section fragments are recognized as routes");
assert.match(source, /if \(productSection\) scrollToProductSection\(productSection\)/, "product-section routes scroll after revealing the product view");
const start = source.indexOf("function updateOfferChannel(");
const end = source.indexOf("function renderProductShell(", start);
assert.ok(start >= 0 && end > start, "offer-channel behavior remains independently testable");

const buttons = ["email", "site", "text", "chatgpt"].map((offerChannel) => ({
  dataset: { offerChannel },
  pressed: "false",
  setAttribute(name, value) {
    if (name === "aria-pressed") this.pressed = value;
  },
}));
const panels = buttons.map(({ dataset: { offerChannel } }) => ({
  dataset: { channelPanel: offerChannel },
  hidden: true,
}));
const context = vm.createContext({
  Set,
  document: {
    querySelectorAll(selector) {
      if (selector === "[data-offer-channel]") return buttons;
      if (selector === "[data-channel-panel]") return panels;
      return [];
    },
  },
});

vm.runInContext(source.slice(start, end), context);

for (const channel of ["email", "site", "text", "chatgpt"]) {
  context.updateOfferChannel(channel);
  assert.deepEqual(buttons.map((button) => button.pressed), buttons.map((button) => String(button.dataset.offerChannel === channel)));
  assert.deepEqual(panels.map((panel) => panel.hidden), panels.map((panel) => panel.dataset.channelPanel !== channel));
}

context.updateOfferChannel("unsupported");
assert.equal(buttons[0].pressed, "true", "unsupported channels return to the email preview");
assert.equal(panels[0].hidden, false, "the email panel remains the safe default");

console.log("Offer channel previews switch exclusively and default safely");
