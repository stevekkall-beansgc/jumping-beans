// Fail-closed browser capability probe. A compatible method name alone is not
// native evidence: the document must be isolated and extension adapter members
// must be absent from the ModelContext object and its prototype chain.
export function modelContextMemberNames(modelContext) {
  if (!modelContext || (typeof modelContext !== "object" && typeof modelContext !== "function")) return [];
  const names = new Set();
  let current = modelContext;
  for (let depth = 0; current && depth < 6; depth += 1) {
    try {
      for (const name of Object.getOwnPropertyNames(current)) names.add(name);
      current = Object.getPrototypeOf(current);
    } catch {
      return [];
    }
  }
  return [...names].sort();
}

export function nativeWebMcpCapability(modelContext, isolated) {
  const members = modelContextMemberNames(modelContext);
  const nonNativeMembers = members.filter((member) => member.toLowerCase().startsWith("codex"));
  const methods = ["getTools", "executeTool", "registerTool"];
  const missingMethods = methods.filter((method) => typeof modelContext?.[method] !== "function");
  const available = isolated === true && nonNativeMembers.length === 0 && missingMethods.length === 0;
  return Object.freeze({ available, isolated: isolated === true, members, nonNativeMembers, missingMethods });
}
