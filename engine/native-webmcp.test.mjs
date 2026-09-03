import assert from "node:assert/strict";
import test from "node:test";
import { nativeWebMcpCapability } from "./native-webmcp.mjs";

const nativeContext = () => ({
  getTools() {},
  executeTool() {},
  registerTool() {},
  addEventListener() {},
});

test("accepts only an isolated browser-native ModelContext surface", () => {
  assert.equal(nativeWebMcpCapability(nativeContext(), true).available, true);
  assert.equal(nativeWebMcpCapability(nativeContext(), false).available, false);
  assert.equal(nativeWebMcpCapability({ getTools() {}, executeTool() {} }, true).available, false);
});

test("rejects extension adapter members on the object or its prototype", () => {
  const direct = Object.assign(nativeContext(), { codexGetTools() {} });
  assert.equal(nativeWebMcpCapability(direct, true).available, false);
  const inherited = Object.assign(Object.create({ codexExecuteTool() {} }), nativeContext());
  const result = nativeWebMcpCapability(inherited, true);
  assert.equal(result.available, false);
  assert.deepEqual(result.nonNativeMembers, ["codexExecuteTool"]);
});
