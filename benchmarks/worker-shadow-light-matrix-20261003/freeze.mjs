// Run only while preparing a new fixture revision. Never rewrite pins for an
// admitted or executed native attempt. The output is exclusive-create.
import { readFile, readdir, realpath, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CONFIG,
  WORKER_SETTINGS,
  ENGINE_SOURCE,
  MODES,
  STATES,
  CAMERA,
} from "./contract.mjs";
import { casterAsset } from "./fixture.mjs";
import { nativeMeshEvidence } from "../crane-live-edits-20261003/author-a/post-author-byte-diagnostic/native-evidence.mjs";

const directory = dirname(fileURLToPath(import.meta.url)),
  repo = resolve(directory, "../..");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const component = JSON.parse(
  await readFile(
    resolve(
      directory,
      "../native-shadow-light-matrix-v2-20261003/source-pins.json",
    ),
    "utf8",
  ),
);
const files = {};
for (const [name, expected] of Object.entries(component.files)) {
  const bytes = await readFile(resolve(repo, name));
  if (sha256(bytes) !== expected.sha256 || bytes.length !== expected.bytes)
    throw Error(`Retained component pin changed: ${name}`);
  files[name] = expected;
}
async function pin(name) {
  const bytes = await readFile(resolve(repo, name));
  files[name] = { bytes: bytes.length, sha256: sha256(bytes) };
}
for (const entry of await readdir(directory))
  if (/\.(mjs|py|html)$/.test(entry) || entry === "README.md")
    await pin(relative(repo, resolve(directory, entry)));
for (const name of [
  "benchmarks/crane-live-edits-20261003/author-a/post-author-byte-diagnostic/frame-proof.mjs",
  "benchmarks/native-shadow-light-matrix-v2-20261003/source-pins.json",
  "benchmarks/native-shadow-light-matrix-v2-20261003/native-manifest.json",
  "benchmarks/next-benchmark-audit-20261003/REPORT.md",
])
  await pin(name);
for (const mode of MODES)
  for (const variant of [
    "live",
    "fresh-baseline",
    "fresh-vertices",
    "fresh-indices",
  ]) {
    const path = `benchmarks/native-shadow-light-matrix-v2-20261003/renders/${mode}/${variant}/attempt-001`;
    for (const entry of await readdir(resolve(repo, path)))
      await pin(`${path}/${entry}`);
  }
const require = createRequire(import.meta.url);
await pin(relative(repo, await realpath(require.resolve("typescript"))));
await pin(
  relative(repo, await realpath(require.resolve("typescript/package.json"))),
);
const expectedMeshes = Object.fromEntries(
  ["baseline", "vertices", "indices"].map((shape) => [
    shape,
    nativeMeshEvidence(
      "matrix-caster",
      casterAsset(shape),
      [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    ),
  ]),
);
const result = {
  schema: "aperture.worker-shadow-light-matrix.inputs.v1",
  engineSourceCommit: ENGINE_SOURCE,
  engineVersion: "0.3.0",
  preparationCheckpoint: "cf1f08a53fb2a236e4998be5dc9f6f67903e26eb",
  preparationTree: "6a5ffffd92087c7ff34dbe34dd434d78698398b7",
  scope:
    "Worker/SAB/demand transport boundary only; native execution pending separate parent permit. No engine modifications.",
  config: CONFIG,
  workerSettings: WORKER_SETTINGS,
  sceneContract: {
    modes: MODES,
    states: STATES,
    camera: CAMERA,
    expectedMeshes,
  },
  provenance:
    "Actual bytes verified against all retained component pins; engine source identity is the published audit/component provenance, never local HEAD. No package build or compiled/source reconciliation performed by this worker.",
  files: Object.fromEntries(
    Object.entries(files).sort(([a], [b]) => a.localeCompare(b)),
  ),
};
await writeFile(
  resolve(directory, "source-pins.json"),
  JSON.stringify(result, null, 2) + "\n",
  { flag: "wx" },
);
console.log(
  JSON.stringify({
    status: "frozen",
    files: Object.keys(files).length,
    sourcePinsSha256: sha256(
      await readFile(resolve(directory, "source-pins.json")),
    ),
    engineSourceCommit: ENGINE_SOURCE,
    browsersLaunched: 0,
    serversStarted: 0,
  }),
);
