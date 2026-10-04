/** Reproduce only the bounded CPU probe. Run under the adopted cleanup wrapper. */
import assert from "node:assert/strict";
import { readFile, writeFile, realpath } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../..");
const stem = process.argv[2];
assert.match(stem ?? "", /^[a-z][a-z0-9-]*$/);
const root = "/workspace/scratch/0190a8c72f8a/aperture-tmp";
assert.equal(process.env.APERTURE_TMP_ROOT, root);
assert.match(process.env.APERTURE_TMP_RUN_ID ?? "", /^run-[a-f0-9]{32}$/);
assert.equal(
  process.env.APERTURE_TMP_RUN,
  path.join(root, process.env.APERTURE_TMP_RUN_ID),
);
assert.equal(
  await realpath(`/proc/self/fd/${process.env.APERTURE_TMP_LOCK_FD}`),
  path.join(root, ".lifecycle.lock"),
);
const manifest = JSON.parse(
  await readFile(
    path.join(process.env.APERTURE_TMP_RUN, ".manifest.json"),
    "utf8",
  ),
);
assert.equal(manifest.state, "active");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
assert.equal(
  hash(await readFile(path.join(repo, "tools/recovery/cleanup.py"))),
  "1c30bc42425c8ee112e7daf42e6a19e80c0f76949f2161590bc74c33b2f8d00d",
);
const pinsBytes = await readFile(path.join(here, "source-pins.json"));
const pins = JSON.parse(pinsBytes);
async function verify() {
  const frozenBytes = await readFile(
    path.join(repo, pins.frozenSourcePins.path),
  );
  assert.equal(hash(frozenBytes), pins.frozenSourcePins.sha256);
  const frozen = JSON.parse(frozenBytes).files;
  for (const [name, pin] of Object.entries({
    ...frozen,
    ...pins.protectedFiles,
  })) {
    const data = await readFile(path.join(repo, name));
    assert.equal(data.byteLength, pin.bytes, `size: ${name}`);
    assert.equal(hash(data), pin.sha256, `hash: ${name}`);
  }
  return {
    frozenFiles: Object.keys(frozen).length,
    protectedFiles: Object.keys(pins.protectedFiles).length,
    verified: true,
  };
}
const before = await verify();
const argv = [
  "node_modules/vitest/vitest.mjs",
  "run",
  "--config",
  "benchmarks/sideband-delivery-probe-20261004/vitest.config.mjs",
  "--no-cache",
  "--configLoader",
  "runner",
  "--disableConsoleIntercept",
  "--silent=false",
];
const fixtureFiles = [
  "run.mjs",
  "probe.test.mjs",
  "cpu-harness.mjs",
  "base-harness.mjs",
  "vitest.config.mjs",
];
const fixturePins = {};
for (const name of fixtureFiles) {
  const data = await readFile(path.join(here, name));
  fixturePins[name] = { bytes: data.length, sha256: hash(data) };
}
const result = spawnSync(process.execPath, argv, {
  cwd: repo,
  encoding: "utf8",
  maxBuffer: 16 * 1024 * 1024,
});
const output = (result.stdout ?? "") + (result.stderr ?? "");
await writeFile(path.join(here, `${stem}.log`), output, { flag: "wx" });
const records = output
  .split("\n")
  .filter((line) => line.startsWith("SIDEBAND_EVIDENCE "))
  .map((line) => JSON.parse(line.slice("SIDEBAND_EVIDENCE ".length)));
const after = await verify();
const report = {
  schema: "aperture.sideband-probe.cpu.v1",
  status: result.status === 0 && records.length === 6 ? "passed" : "failed",
  exitCode: result.status,
  error: result.error?.message ?? null,
  runId: process.env.APERTURE_TMP_RUN_ID,
  node: process.version,
  argv,
  sourcePinsSha256: hash(pinsBytes),
  before,
  after,
  fixturePins,
  records,
  limitations: [
    "Controlled CPU mock device and message/RAF delivery; no actual worker thread or browser launched",
    "No shader execution, pixels, native WebGPU, GPU readback or performance claim",
    "Same-SAB-frame rerender on late sideband is characterized, not asserted as an existing guarantee",
    "Snapshot cadence requires a legitimate snapshot wake",
  ],
};
await writeFile(
  path.join(here, `${stem}.json`),
  JSON.stringify(report, null, 2) + "\n",
  { flag: "wx" },
);
console.log(
  JSON.stringify({
    status: report.status,
    exitCode: report.exitCode,
    records: records.length,
    before,
    after,
    output: `${stem}.json`,
  }),
);
assert.equal(report.status, "passed");
