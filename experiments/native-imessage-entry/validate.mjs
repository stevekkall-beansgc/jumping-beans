#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const model = await readFile(path.join(directory, "NativeActionModel.swift"), "utf8");
const controller = await readFile(path.join(directory, "MessagesViewController.swift"), "utf8");
const modelTestsPath = path.join(directory, "NativeActionModelTests.swift");
const swiftEnvironment = {
  ...process.env,
  CLANG_MODULE_CACHE_PATH: path.join(os.tmpdir(), "jumping-beans-swift-module-cache"),
};
const targetDirectory = path.join(directory, "JumpingBeansMessages", "JumpingBeansMessages MessagesExtension");
const sourcePlistPath = path.join(directory, "Info.plist");
const targetPlistPath = path.join(targetDirectory, "Info.plist");
const targetPlist = await readFile(targetPlistPath, "utf8");
const targetModelPath = path.join(targetDirectory, "NativeActionModel.swift");
const targetControllerPath = path.join(targetDirectory, "MessagesViewController.swift");
const targetModel = await readFile(targetModelPath, "utf8");
const targetController = await readFile(targetControllerPath, "utf8");
for (const plistPath of [sourcePlistPath, targetPlistPath]) {
  const plist = spawnSync("plutil", ["-lint", plistPath], { encoding: "utf8" });
  if (plist.status !== 0) throw new Error(`${plistPath} failed validation: ${plist.stderr || plist.stdout}`);
}

const swift = spawnSync("swiftc", ["-parse", path.join(directory, "NativeActionModel.swift"), path.join(directory, "MessagesViewController.swift")], { encoding: "utf8", env: swiftEnvironment });
if (swift.status !== 0) throw new Error(`Swift parse failed: ${swift.stderr || swift.stdout}`);
const targetSwift = spawnSync("swiftc", ["-parse", targetModelPath, targetControllerPath], { encoding: "utf8", env: swiftEnvironment });
if (targetSwift.status !== 0) throw new Error(`Extension Swift parse failed: ${targetSwift.stderr || targetSwift.stdout}`);
const testBinary = path.join(os.tmpdir(), `jumping-beans-native-action-model-${process.pid}`);
const modelTests = spawnSync("swiftc", [targetModelPath, modelTestsPath, "-o", testBinary], { encoding: "utf8", env: swiftEnvironment });
if (modelTests.status !== 0) throw new Error(`Swift model tests failed to compile: ${modelTests.stderr || modelTests.stdout}`);
const modelTestRun = spawnSync(testBinary, [], { encoding: "utf8" });
if (modelTestRun.status !== 0) throw new Error(`Swift model tests failed: ${modelTestRun.stderr || modelTestRun.stdout}`);

const source = `${targetModel}\n${targetController}`;
const checks = [
  [model === targetModel && controller === targetController, "source and Xcode target Swift files are identical"],
  [targetController.includes("MSMessagesAppViewController"), "native Messages controller is present"],
  [targetController.includes("willBecomeActive") && targetController.includes("didReceive"), "Messages lifecycle entry points are present"],
  [targetModel.includes("case compare") && targetModel.includes("case adapt") && targetModel.includes("case previewHandoff"), "allowable action vocabulary is bounded"],
  [targetModel.includes("static let maxMSMessageURLLength = 5_000"), "MSMessage URL limit is enforced"],
  [targetModel.includes('messageURLBase = "https://message.jumpingbeans.example/review"'), "MSMessage URL uses the supported HTTPS contract"],
  [targetModel.includes("struct ReviewPayload") && targetModel.includes("Set(allKeys) == Set(CodingKeys.allCases.map"), "review payload schema is allowlisted"],
  [targetModel.includes("components.user == nil") && targetModel.includes("components.port == nil") && targetModel.includes("fragment.utf8.allSatisfy"), "review URL shape and base64url alphabet are allowlisted"],
  [targetModel.includes("reviewPayload(from url: URL)") && targetController.includes("ActionPlanner.reviewPayload(from: url)"), "native message payload is parsed before review"],
  [targetController.includes("MSMessageTemplateLayout") && targetController.includes("MSMessageLiveLayout"), "template and live layouts are both created"],
  [targetController.includes("conversation.insert(message)"), "message is staged in the composer"],
  [!targetController.includes("conversation.send") && !targetController.includes("send(message"), "extension does not auto-send"],
  [source.includes("not independently verified") && source.includes("Provenance was carried"), "provenance and verification boundaries are visible"],
  [source.includes("did not discover or invoke WebMCP"), "native surface does not claim WebMCP execution"],
  [["URLSession", "WKWebView", "postMessage", "fetch("].some((marker) => source.includes(marker)) === false, "no HTTPS/browser bridge is present"],
  [targetModel.includes("Set(requiredApprovalFields).isSubset") && targetController.includes("isFullyApproved"), "explicit approval gates staging"],
  [targetController.includes("message.accessibilityLabel") && targetController.includes("isAccessibilityCategory"), "message and large-text controls expose accessibility behavior"],
  [targetPlist.includes("MSMessagesAppPresentationContextMessages"), "target plist supports Messages presentation"],
  [targetPlist.includes("NSExtensionPrincipalClass") && targetPlist.includes("$(PRODUCT_MODULE_NAME).MessagesViewController"), "target plist loads the real Swift controller"],
];

for (const [passed, label] of checks) {
  if (!passed) throw new Error(`FAIL: ${label}`);
  console.log(`✓ ${label}`);
}
console.log(`\n${checks.length} native iMessage prototype checks passed.`);
console.log(modelTestRun.stdout.trim());
