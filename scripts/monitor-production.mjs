#!/usr/bin/env node
// Release-pinned, production-read-only scheduler entry point. Provisioning
// creates the ignored inventory index once; this monitor only verifies the
// release checkout and runs deterministic checks against canonical production.

import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

const execFileAsync = promisify(execFile);
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const INDEX_RELATIVE_PATH = "engine/inventory-assets/catalog-index.json";
const RELEASE_SHA_PATTERN = /^[0-9a-f]{40}$/;
const RELEASE_TAG_PATTERN = /^v[0-9]+\.[0-9]+\.[0-9]+(?:[.-][0-9A-Za-z.-]+)?$/;
const ORIGIN_OVERRIDE_NAMES = [
  "JB_ENGINE_ORIGIN",
  "JB_PETSUPPLY_ORIGIN",
  "JB_COFFEE_ORIGIN",
  "JB_WATCH_ORIGIN",
];

function usage() {
  return "Usage: node scripts/monitor-production.mjs --release-sha <40-character-lowercase-sha> --release-tag <version-tag>";
}

export function validateReleasePin({ releaseSha, releaseTag } = {}) {
  if (!RELEASE_SHA_PATTERN.test(releaseSha || "")) {
    throw new Error(`--release-sha must be a full 40-character lowercase commit SHA. ${usage()}`);
  }
  if (!RELEASE_TAG_PATTERN.test(releaseTag || "")) {
    throw new Error(`--release-tag must be a version tag such as v1.2.3. ${usage()}`);
  }
  return { releaseSha, releaseTag };
}

export function parseMonitorArguments(argv) {
  const values = {};
  const flags = new Map([
    ["--release-sha", "releaseSha"],
    ["--release-tag", "releaseTag"],
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const key = flags.get(flag);
    if (!key) throw new Error(`Unknown argument ${JSON.stringify(flag)}. ${usage()}`);
    if (Object.hasOwn(values, key)) throw new Error(`${flag} may be supplied only once. ${usage()}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value. ${usage()}`);
    values[key] = value;
    index += 1;
  }
  return validateReleasePin(values);
}

function commandText(command, args) {
  return [command, ...args].map((value) => JSON.stringify(String(value))).join(" ");
}

export async function executeCommand(command, args, { cwd, capture = false, env = process.env } = {}) {
  try {
    const result = await execFileAsync(command, args, {
      cwd,
      env,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    });
    if (!capture && result.stdout) process.stdout.write(result.stdout);
    if (!capture && result.stderr) process.stderr.write(result.stderr);
    return result;
  } catch (error) {
    const detail = String(error.stderr || error.stdout || error.message || error).trim();
    throw new Error(`${commandText(command, args)} failed${detail ? `: ${detail}` : ""}`, { cause: error });
  }
}

async function captured(execute, command, args, options) {
  const result = await execute(command, args, { ...options, capture: true });
  return String(result?.stdout || "").trim();
}

async function verifyReleaseIdentity(pin, { root, execute, environment }) {
  const options = {
    cwd: root,
    env: { ...environment, GIT_OPTIONAL_LOCKS: "0" },
  };
  const head = await captured(execute, "git", ["rev-parse", "HEAD"], options);
  if (head !== pin.releaseSha) {
    throw new Error(`Checkout HEAD ${head || "<unknown>"} does not match --release-sha ${pin.releaseSha}`);
  }

  const status = await captured(
    execute,
    "git",
    ["status", "--porcelain=v1", "--untracked-files=all", "--ignore-submodules=none"],
    options,
  );
  if (status) throw new Error(`Release checkout is not clean:\n${status}`);

  const tagRef = `refs/tags/${pin.releaseTag}`;
  const tagType = await captured(execute, "git", ["cat-file", "-t", tagRef], options);
  if (tagType !== "tag") throw new Error(`Release tag ${pin.releaseTag} must be an annotated tag`);

  const taggedCommit = await captured(execute, "git", ["rev-list", "-n", "1", tagRef], options);
  if (taggedCommit !== pin.releaseSha) {
    throw new Error(`Release tag ${pin.releaseTag} points to ${taggedCommit || "<unknown>"}, not ${pin.releaseSha}`);
  }
}

async function inventoryIndexDigest({ root, execute, readFileImpl, environment }) {
  try {
    await execute("git", ["check-ignore", "--quiet", "--", INDEX_RELATIVE_PATH], {
      cwd: root,
      capture: true,
      env: { ...environment, GIT_OPTIONAL_LOCKS: "0" },
    });
  } catch (error) {
    throw new Error(`${INDEX_RELATIVE_PATH} must remain an ignored deployment artifact`, { cause: error });
  }

  let contents;
  try {
    contents = await readFileImpl(path.join(root, INDEX_RELATIVE_PATH));
  } catch (error) {
    throw new Error(`Prebuilt ${INDEX_RELATIVE_PATH} is required; provision the detached release checkout before scheduling this monitor`, { cause: error });
  }
  return createHash("sha256").update(contents).digest("hex");
}

function canonicalProductionEnvironment(environment) {
  const canonical = { ...environment };
  for (const name of ORIGIN_OVERRIDE_NAMES) delete canonical[name];
  return canonical;
}

async function runNode(execute, root, relative, args, environment) {
  await execute(process.execPath, [path.join(root, relative), ...args], {
    cwd: root,
    env: canonicalProductionEnvironment(environment),
  });
}

export async function runProductionMonitor(pinInput, {
  root = ROOT,
  execute = executeCommand,
  readFileImpl = readFile,
  environment = process.env,
} = {}) {
  const pin = validateReleasePin(pinInput);
  await verifyReleaseIdentity(pin, { root, execute, environment });
  const indexBefore = await inventoryIndexDigest({ root, execute, readFileImpl, environment });

  let runError;
  try {
    await runNode(execute, root, "scripts/check-product.mjs", [], environment);
    await runNode(execute, root, "scripts/production-smoke.mjs", [], environment);
    await runNode(execute, root, "scripts/production-smoke.mjs", ["--readiness-only"], environment);
  } catch (error) {
    runError = error;
  }

  let integrityError;
  try {
    await verifyReleaseIdentity(pin, { root, execute, environment });
    const indexAfter = await inventoryIndexDigest({ root, execute, readFileImpl, environment });
    if (indexAfter !== indexBefore) {
      throw new Error(`${INDEX_RELATIVE_PATH} changed during the read-only production monitor`);
    }
  } catch (error) {
    integrityError = error;
  }

  if (runError && integrityError) {
    throw new AggregateError(
      [runError, integrityError],
      `Production checks failed (${runError.message}); the final checkout integrity audit also failed (${integrityError.message})`,
    );
  }
  if (runError) throw runError;
  if (integrityError) throw integrityError;
  return { ...pin, inventoryIndexSha256: indexBefore };
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invoked) {
  try {
    const pin = parseMonitorArguments(process.argv.slice(2));
    const result = await runProductionMonitor(pin);
    console.log(`✓ ${result.releaseTag} at ${result.releaseSha}: product gate, exact production smoke, and readiness passed read-only`);
  } catch (error) {
    console.error(`production monitor failed: ${error.message}`);
    process.exitCode = 1;
  }
}
