import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import {
  executeCommand,
  parseMonitorArguments,
  runProductionMonitor,
} from "./monitor-production.mjs";

const execFileAsync = promisify(execFile);
const SHA = "0123456789abcdef0123456789abcdef01234567";
const TAG = "v1.2.3";

async function runGit(root, ...args) {
  return execFileAsync("git", args, {
    cwd: root,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
    encoding: "utf8",
  });
}

async function releaseFixture({ annotated = true, includeIndex = true } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "jumping-beans-monitor-"));
  await mkdir(path.join(root, "scripts"), { recursive: true });
  await mkdir(path.join(root, "engine", "inventory-assets"), { recursive: true });
  await writeFile(path.join(root, ".gitignore"), "/engine/inventory-assets/\n");
  await writeFile(path.join(root, "release.txt"), "immutable release\n");
  await writeFile(path.join(root, "scripts", "check-product.mjs"), "console.log('fixture product gate passed');\n");
  await writeFile(
    path.join(root, "scripts", "production-smoke.mjs"),
    "const args = process.argv.slice(2); if (args.length && args.join(' ') !== '--readiness-only') process.exit(2); console.log(args.length ? 'fixture readiness passed' : 'fixture exact smoke passed');\n",
  );
  if (includeIndex) {
    await writeFile(path.join(root, "engine", "inventory-assets", "catalog-index.json"), '{"version":1,"items":[]}');
  }
  await runGit(root, "init", "--quiet");
  await runGit(root, "add", ".");
  await runGit(root, "-c", "user.name=Jumping Beans Test", "-c", "user.email=test@example.invalid", "commit", "--quiet", "-m", "release fixture");
  const releaseSha = (await runGit(root, "rev-parse", "HEAD")).stdout.trim();
  if (annotated) {
    await runGit(root, "-c", "user.name=Jumping Beans Test", "-c", "user.email=test@example.invalid", "tag", "-a", TAG, "-m", "fixture release");
  } else {
    await runGit(root, "tag", TAG);
  }
  return { root, releaseSha, releaseTag: TAG };
}

async function fileSnapshot(root) {
  const snapshot = {};
  async function walk(directory) {
    for (const name of (await readdir(directory)).sort()) {
      if (name === ".git") continue;
      const absolute = path.join(directory, name);
      const info = await stat(absolute);
      if (info.isDirectory()) await walk(absolute);
      else {
        const relative = path.relative(root, absolute);
        snapshot[relative] = {
          mode: info.mode & 0o777,
          sha256: createHash("sha256").update(await readFile(absolute)).digest("hex"),
        };
      }
    }
  }
  await walk(root);
  return snapshot;
}

test("requires an exact lowercase SHA and explicit version tag", () => {
  assert.deepEqual(parseMonitorArguments([
    "--release-sha", SHA,
    "--release-tag", TAG,
  ]), { releaseSha: SHA, releaseTag: TAG });
  assert.throws(() => parseMonitorArguments(["--release-tag", TAG]), /--release-sha/);
  assert.throws(() => parseMonitorArguments(["--release-sha", SHA.toUpperCase(), "--release-tag", TAG]), /lowercase/);
  assert.throws(() => parseMonitorArguments(["--release-sha", SHA, "--release-tag", "latest"]), /version tag/);
  assert.throws(() => parseMonitorArguments(["--release-sha", SHA, "--release-tag", TAG, "--release-tag", TAG]), /only once/);
  assert.throws(() => parseMonitorArguments(["--release-sha", SHA, "--release-tag", TAG, "--deploy"]), /Unknown argument/);
});

test("runs only the product gate, exact production smoke, and readiness smoke in that order", async () => {
  const calls = [];
  const gitReplies = new Map([
    ["rev-parse HEAD", `${SHA}\n`],
    ["status --porcelain=v1 --untracked-files=all --ignore-submodules=none", ""],
    [`cat-file -t refs/tags/${TAG}`, "tag\n"],
    [`rev-list -n 1 refs/tags/${TAG}`, `${SHA}\n`],
    ["check-ignore --quiet -- engine/inventory-assets/catalog-index.json", ""],
  ]);
  const execute = async (command, args, options) => {
    calls.push({ command, args: [...args], options });
    if (command === "git") return { stdout: gitReplies.get(args.join(" ")) || "", stderr: "" };
    return { stdout: "", stderr: "" };
  };
  await runProductionMonitor({ releaseSha: SHA, releaseTag: TAG }, {
    root: "/fixture",
    execute,
    readFileImpl: async () => Buffer.from("prebuilt-index"),
    environment: {
      PATH: process.env.PATH,
      JB_ENGINE_ORIGIN: "https://staging.invalid",
      JB_PETSUPPLY_ORIGIN: "https://staging.invalid",
    },
  });

  const nodeCalls = calls.filter(({ command }) => command === process.execPath);
  assert.deepEqual(nodeCalls.map(({ args }) => args), [
    ["/fixture/scripts/check-product.mjs"],
    ["/fixture/scripts/production-smoke.mjs"],
    ["/fixture/scripts/production-smoke.mjs", "--readiness-only"],
  ]);
  assert.ok(nodeCalls.every(({ options }) => !Object.keys(options.env).some((name) => name.endsWith("_ORIGIN"))));
  assert.ok(!calls.some(({ args }) => /build|refresh|publish|deploy|wrangler/i.test(args.join(" "))));
});

test("accepts a clean annotated release fixture without changing any project file", async (t) => {
  const fixture = await releaseFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  const before = await fileSnapshot(fixture.root);
  const commands = [];
  const execute = async (command, args, options) => {
    commands.push([command, ...args]);
    return executeCommand(command, args, options);
  };

  const result = await runProductionMonitor(fixture, { root: fixture.root, execute });
  assert.equal(result.releaseSha, fixture.releaseSha);
  assert.equal(result.releaseTag, fixture.releaseTag);
  assert.deepEqual(await fileSnapshot(fixture.root), before);
  assert.equal((await runGit(fixture.root, "status", "--porcelain=v1", "--untracked-files=all")).stdout, "");
  assert.ok(!commands.some((parts) => /build|refresh|publish|deploy|wrangler/i.test(parts.join(" "))));
});

test("rejects a dirty checkout and a lightweight tag before running repository code", async (t) => {
  const dirty = await releaseFixture();
  const lightweight = await releaseFixture({ annotated: false });
  t.after(() => Promise.all([
    rm(dirty.root, { recursive: true, force: true }),
    rm(lightweight.root, { recursive: true, force: true }),
  ]));
  await writeFile(path.join(dirty.root, "release.txt"), "changed after release\n");

  for (const [fixture, expected] of [[dirty, /not clean/], [lightweight, /annotated tag/]]) {
    const commands = [];
    const execute = async (command, args, options) => {
      commands.push(command);
      return executeCommand(command, args, options);
    };
    await assert.rejects(runProductionMonitor(fixture, { root: fixture.root, execute }), expected);
    assert.ok(!commands.includes(process.execPath), "repository Node scripts must not run before provenance passes");
  }
});

test("rejects a mismatched HEAD or annotated tag before running repository code", async (t) => {
  const fixture = await releaseFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  const commands = [];
  const execute = async (command, args, options) => {
    commands.push(command);
    return executeCommand(command, args, options);
  };

  await assert.rejects(runProductionMonitor({
    ...fixture,
    releaseSha: "f".repeat(40),
  }, { root: fixture.root, execute }), /does not match --release-sha/);

  await writeFile(path.join(fixture.root, "release.txt"), "second clean commit\n");
  await runGit(fixture.root, "add", "release.txt");
  await runGit(fixture.root, "-c", "user.name=Jumping Beans Test", "-c", "user.email=test@example.invalid", "commit", "--quiet", "-m", "move HEAD past tag");
  const laterSha = (await runGit(fixture.root, "rev-parse", "HEAD")).stdout.trim();
  await assert.rejects(runProductionMonitor({
    ...fixture,
    releaseSha: laterSha,
  }, { root: fixture.root, execute }), /points to .* not/);
  assert.ok(!commands.includes(process.execPath), "repository Node scripts must not run before provenance passes");
});

test("requires the ignored prebuilt index before running repository code", async (t) => {
  const fixture = await releaseFixture({ includeIndex: false });
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  const commands = [];
  const execute = async (command, args, options) => {
    commands.push(command);
    return executeCommand(command, args, options);
  };
  await assert.rejects(runProductionMonitor(fixture, { root: fixture.root, execute }), /Prebuilt .*catalog-index\.json is required/);
  assert.ok(!commands.includes(process.execPath));
});

test("stops after a failed gate and still performs the final integrity audit", async () => {
  const calls = [];
  let statusChecks = 0;
  const execute = async (command, args) => {
    calls.push([command, ...args]);
    if (command === "git") {
      const key = args.join(" ");
      if (key === "rev-parse HEAD" || key === `rev-list -n 1 refs/tags/${TAG}`) return { stdout: `${SHA}\n` };
      if (key === `cat-file -t refs/tags/${TAG}`) return { stdout: "tag\n" };
      if (key.startsWith("status ")) {
        statusChecks += 1;
        return { stdout: "" };
      }
      return { stdout: "" };
    }
    throw new Error("fixture product gate failed");
  };
  await assert.rejects(runProductionMonitor({ releaseSha: SHA, releaseTag: TAG }, {
    root: "/fixture",
    execute,
    readFileImpl: async () => Buffer.from("prebuilt-index"),
  }), /fixture product gate failed/);
  assert.equal(calls.filter(([command]) => command === process.execPath).length, 1);
  assert.equal(statusChecks, 2, "checkout integrity must be checked before and after a failed gate");
});

test("detects any change to the ignored prebuilt index", async () => {
  let indexReads = 0;
  const execute = async (command, args) => {
    if (command !== "git") return { stdout: "" };
    const key = args.join(" ");
    if (key === "rev-parse HEAD" || key === `rev-list -n 1 refs/tags/${TAG}`) return { stdout: `${SHA}\n` };
    if (key === `cat-file -t refs/tags/${TAG}`) return { stdout: "tag\n" };
    return { stdout: "" };
  };
  await assert.rejects(runProductionMonitor({ releaseSha: SHA, releaseTag: TAG }, {
    root: "/fixture",
    execute,
    readFileImpl: async () => Buffer.from(indexReads++ === 0 ? "before" : "after"),
  }), /catalog-index\.json changed during the read-only production monitor/);
});
