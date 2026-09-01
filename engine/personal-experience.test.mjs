import assert from "node:assert/strict";
import { accountJourneyAfterLogout, accountJourneyHydration, accountMemoryAfterForget } from "./personal-experience.js";

const defaults = { formats: ["price-proof"], tone: "calm", maxPrice: null };
const localNote = [{ key: "local", title: "Local note" }];
const hosted = {
  signedIn: true,
  hasPreferences: true,
  hasMemory: true,
  preferences: { formats: ["video"], maxPrice: 45 },
  memory: [{ key: "watch", title: "Watch Co offer", detail: "Target below $45" }],
};

// First login, a new-browser reload, and an explicit import restore hosted data.
for (const label of ["first-login", "new-browser-reload", "explicit-import"]) {
  const hydrated = accountJourneyHydration({ account: hosted, hasBrowserPersistence: false, requestDraftRevision: 0, currentDraftRevision: 0, preferences: defaults, memory: [] });
  assert.equal(hydrated.preferences.formats[0], "video", label);
  assert.equal(hydrated.memory[0].key, "watch", label);
  assert.equal(hydrated.preferenceSource, "account", label);
}

// Saving account preferences alone restores them without replacing current
// notes, while an account forget removes only hosted notes.
const savedPreferences = accountJourneyHydration({ account: { ...hosted, hasMemory: false, memory: [] }, hasBrowserPersistence: false, requestDraftRevision: 0, currentDraftRevision: 0, preferences: defaults, memory: localNote });
assert.equal(savedPreferences.preferences.formats[0], "video", "save");
assert.deepEqual(savedPreferences.memory, localNote, "save");

// Existing browser storage and any edits made while the account request was in
// flight win; neither case silently overwrites an unsaved local draft.
assert.equal(accountJourneyHydration({ account: hosted, hasBrowserPersistence: true, requestDraftRevision: 0, currentDraftRevision: 0, preferences: defaults, memory: localNote }), null);
assert.equal(accountJourneyHydration({ account: hosted, hasBrowserPersistence: false, requestDraftRevision: 0, currentDraftRevision: 1, preferences: defaults, memory: localNote }), null);

// Forget only clears account-backed notes; browser notes stay browser-local.
assert.deepEqual(accountMemoryAfterForget({ memorySource: "account", memory: hosted.memory }), []);
assert.deepEqual(accountMemoryAfterForget({ memorySource: "browser", memory: localNote }), localNote);

// Logout removes account-hydrated data from the active journey but retains a
// browser-only draft, so it never writes or silently imports local memory.
const loggedOut = accountJourneyAfterLogout({ preferenceSource: "account", memorySource: "account", preferences: hosted.preferences, memory: hosted.memory, anonymousPreferences: defaults, hasSavedPreferences: true });
assert.deepEqual(loggedOut.preferences, defaults);
assert.deepEqual(loggedOut.memory, []);
const browserDraftAfterLogout = accountJourneyAfterLogout({ preferenceSource: "browser", memorySource: "browser", preferences: { formats: ["testimonial"], maxPrice: 12 }, memory: localNote, anonymousPreferences: defaults, hasSavedPreferences: true });
assert.equal(browserDraftAfterLogout.preferences.formats[0], "testimonial");
assert.deepEqual(browserDraftAfterLogout.memory, localNote);

console.log("personal experience hydration contracts pass");
