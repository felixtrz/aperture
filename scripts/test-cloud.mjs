import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import * as fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("../", import.meta.url));
const scratchRoots = [
  "/workspace/scratch/0190a8c72f8a/aperture-tmp",
  "/workspace/shared/aperture-tmp",
];
const recorder =
  "benchmarks/crane-live-edits-20261003/harness/recorder.test.mjs";

function within(root, target) {
  const relative = path.relative(root, target);
  return (
    relative === "" ||
    (!path.isAbsolute(relative) &&
      relative !== ".." &&
      !relative.startsWith(`..${path.sep}`))
  );
}

/** Fail before either runner can fall back to an unapproved browser route. */
export async function verifyCloudTestEnvironment(env = process.env, io = fs) {
  assert.equal(
    env.APERTURE_TMP_ROOT,
    scratchRoots[0],
    "Use the adopted cloud cleanup lifecycle root",
  );
  assert.match(
    env.APERTURE_TMP_RUN_ID ?? "",
    /^run-[a-f0-9]{32}$/,
    "Missing adopted lifecycle identity",
  );
  assert.match(
    env.APERTURE_TMP_LOCK_FD ?? "",
    /^\d+$/,
    "Missing inherited lifecycle lock",
  );
  const run = path.join(env.APERTURE_TMP_ROOT, env.APERTURE_TMP_RUN_ID);
  assert.equal(env.APERTURE_TMP_RUN, run, "Lifecycle run path mismatch");
  assert.equal(
    await io.realpath(run),
    run,
    "Lifecycle run path must not be redirected",
  );
  assert.equal(
    await io.realpath(`/proc/self/fd/${env.APERTURE_TMP_LOCK_FD}`),
    path.join(env.APERTURE_TMP_ROOT, ".lifecycle.lock"),
    "Inherited lifecycle lock mismatch; invoke this entrypoint directly under the wrapper",
  );
  const manifest = JSON.parse(
    await io.readFile(path.join(run, ".manifest.json"), "utf8"),
  );
  assert.equal(manifest.schema, "aperture.disposable-run.v2");
  assert.equal(manifest.run_id, env.APERTURE_TMP_RUN_ID);
  assert.equal(
    manifest.state,
    "active",
    "Cloud tests require an active cleanup lifecycle",
  );
  for (const name of [
    "APERTURE_WEBGPU_RUNTIME",
    "APERTURE_TEST_CLOUD_RENDER_OUTPUT",
  ]) {
    assert.ok(
      typeof env[name] === "string" && path.isAbsolute(env[name]),
      `${name} must be an explicit absolute path`,
    );
    assert.ok(
      (await io.stat(env[name])).isDirectory(),
      `${name} must be an existing directory`,
    );
  }
  const output = await io.realpath(env.APERTURE_TEST_CLOUD_RENDER_OUTPUT);
  assert.ok(
    scratchRoots.every((root) => !within(root, output)),
    "Cloud render evidence must be outside disposable scratch",
  );
}

export function cloudTestCommands(args = []) {
  assert.ok(
    !args.some((arg) => /^(?:--cache(?:=|$)|--configLoader(?:=|$))/.test(arg)),
    "Cloud tests require disabled cache and the runner config loader",
  );
  return [
    [process.execPath, ["--test", recorder]],
    [
      process.execPath,
      [
        path.join(repo, "node_modules/vitest/vitest.mjs"),
        "run",
        "--no-cache",
        "--configLoader",
        "runner",
        ...args,
      ],
    ],
  ];
}

/** The caller owns lifecycle setup and evidence retention; this adds no authority. */
export async function runCloudTests(
  args = [],
  { env = process.env, io = fs, spawn = spawnSync } = {},
) {
  await verifyCloudTestEnvironment(env, io);
  for (const [command, argv] of cloudTestCommands(args)) {
    const result = spawn(command, argv, { cwd: repo, env, stdio: "inherit" });
    if (result.error) throw result.error;
    if (result.status !== 0) return result.status ?? 1;
  }
  return 0;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    process.exitCode = await runCloudTests(process.argv.slice(2));
  } catch (error) {
    console.error(`Cloud test preflight failed: ${error.message}`);
    process.exitCode = 1;
  }
}
