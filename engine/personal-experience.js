// Pure account-to-journey rules. Keeping this outside the DOM makes the
// non-destructive hydration boundary deterministic and testable.

const clonePreferences = (value) => ({ ...value, formats: Array.isArray(value?.formats) ? [...value.formats] : [] });
const cloneMemory = (value) => Array.isArray(value) ? value.map((item) => ({ ...item })) : [];

export function accountJourneyHydration({ account, hasBrowserPersistence, requestDraftRevision, currentDraftRevision, preferences, memory }) {
  if (!account?.signedIn || hasBrowserPersistence || requestDraftRevision !== currentDraftRevision) return null;
  const hasPreferences = account.hasPreferences === true;
  const hasMemory = account.hasMemory === true;
  if (!hasPreferences && !hasMemory) return null;
  return {
    preferences: hasPreferences ? clonePreferences(account.preferences) : clonePreferences(preferences),
    appliedPreferences: hasPreferences ? clonePreferences(account.preferences) : clonePreferences(preferences),
    memory: hasMemory ? cloneMemory(account.memory) : cloneMemory(memory),
    preferenceSource: hasPreferences ? "account" : "browser",
    memorySource: hasMemory ? "account" : "browser",
    hasSavedPreferences: hasPreferences,
  };
}

export function accountMemoryAfterForget({ memorySource, memory }) {
  return memorySource === "account" ? [] : cloneMemory(memory);
}

export function accountJourneyAfterLogout({ preferenceSource, memorySource, preferences, memory, anonymousPreferences, hasSavedPreferences }) {
  const clearPreferences = preferenceSource === "account";
  return {
    preferences: clearPreferences ? clonePreferences(anonymousPreferences) : clonePreferences(preferences),
    appliedPreferences: clearPreferences ? clonePreferences(anonymousPreferences) : clonePreferences(preferences),
    memory: memorySource === "account" ? [] : cloneMemory(memory),
    preferenceSource: "browser",
    memorySource: "browser",
    hasSavedPreferences: clearPreferences ? false : Boolean(hasSavedPreferences),
  };
}
