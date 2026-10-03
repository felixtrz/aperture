/** Freeze once after checks. Existing manifests are never overwritten. */
import { readFile, readdir, realpath, writeFile } from "node:fs/promises";
import { resolve, dirname, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import {
  ENGINE_SOURCE,
  ENGINE_VERSION,
  THREE_REVISION,
  SCHEMA,
  SESSION_IDS,
  statesFor,
  BUDGETS,
  SEMANTICS,
  WORKER_SETTINGS,
  VIEW,
} from "./contract.mjs";
const directory = dirname(fileURLToPath(import.meta.url)),
  repo = resolve(directory, "../.."),
  hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
export async function collectPins() {
  const inheritedPath =
    "benchmarks/worker-shadow-light-matrix-20261003/source-pins.json";
  const inherited = JSON.parse(
    await readFile(resolve(repo, inheritedPath), "utf8"),
  );
  if (
    inherited.engineSourceCommit !== ENGINE_SOURCE ||
    inherited.engineVersion !== ENGINE_VERSION
  )
    throw Error("Retained engine provenance changed");
  const files = {};
  for (const [name, expected] of Object.entries(inherited.files)) {
    const bytes = await readFile(resolve(repo, name));
    if (bytes.length !== expected.bytes || hash(bytes) !== expected.sha256)
      throw Error(`Retained pin mismatch: ${name}`);
    files[name] = expected;
  }
  async function pin(path) {
    const actual = await realpath(path),
      bytes = await readFile(actual);
    files[relative(repo, actual)] = {
      bytes: bytes.length,
      sha256: hash(bytes),
    };
  }
  async function visit(path) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw Error("Source symlink: " + entry.name);
      const next = resolve(path, entry.name);
      if (entry.isDirectory()) {
        if (!["renders", "lifecycle-audits"].includes(entry.name))
          await visit(next);
      } else if (
        /\.(mjs|py|html|diff)$/.test(entry.name) ||
        [
          "README.md",
          "derivation.json",
          "frozen-contract.json",
          "source-audit.json",
        ].includes(entry.name)
      )
        await pin(next);
    }
  }
  await visit(directory);
  for (const item of JSON.parse(
    await readFile(resolve(directory, "derivation.json"), "utf8"),
  ).files)
    await pin(resolve(repo, item.source));
  for (const name of [
    inheritedPath,
    "benchmarks/worker-shadow-light-matrix-20261003/engine-provenance.json",
    "benchmarks/crane-live-edits-20261003/ANALYSIS.md",
    "benchmarks/next-benchmark-audit-20261003/REPORT.md",
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "shadow-lab/src/compare/three.core.js",
    "shadow-lab/src/compare/three.webgpu.js",
    "tools/recovery/cleanup.py",
    "tools/recovery/runtime_pressure.py",
    "tools/recovery/runtime/package.json",
    "tools/recovery/runtime/pnpm-lock.yaml",
  ])
    await pin(resolve(repo, name));
  for (const [engine, attempt] of [
    ["aperture", "attempt-005"],
    ["threejs", "attempt-001"],
  ])
    for (const name of [
      "outcome.json",
      "recorder-summary.json",
      "states/s00-baseline.json",
      "states/s00-baseline.png",
    ])
      await pin(
        resolve(
          repo,
          `benchmarks/crane-live-edits-20261003/renders/${engine}/${attempt}/${name}`,
        ),
      );
  const provenance = JSON.parse(
    await readFile(
      resolve(
        repo,
        "benchmarks/worker-shadow-light-matrix-20261003/engine-provenance.json",
      ),
      "utf8",
    ),
  );
  if (
    provenance.status !== "passed" ||
    provenance.engineSourceCommit !== ENGINE_SOURCE ||
    provenance.mismatches.length
  )
    throw Error("Unverified engine source provenance");
  for (const entry of provenance.sourceFiles) {
    const bytes = await readFile(resolve(repo, entry.path));
    if (bytes.length !== entry.bytes || hash(bytes) !== entry.sha256)
      throw Error("Actual engine source changed: " + entry.path);
  }
  return {
    schema: SCHEMA + ".inputs",
    engineSourceCommit: ENGINE_SOURCE,
    engineVersion: ENGINE_VERSION,
    threeRevision: THREE_REVISION,
    preparationCheckpoint: "509f25caf9dedf53bb93d04a3eb18f6b39222431",
    preparationTree: "4a20375e6fde1a2a4b99124a04c856a7cea11602",
    predecessorEvidenceCommit: "f852039fbc55289f1edab85003b7a79f42377e92",
    localHeadUsedAsProvenance: false,
    scope:
      "Post-author combined-parameter regression. CPU prepared; native admission separate. No original author score or performance claim.",
    engineProvenance: {
      sourceFilesVerified: provenance.sourceFiles.length,
      inheritedPinsVerified: Object.keys(inherited.files).length,
      compiled:
        "Actual dist files equal the retained worker/component native pins; this preparation performed no build or reconciliation.",
    },
    sessions: Object.fromEntries(SESSION_IDS.map((s) => [s, statesFor(s)])),
    budgets: BUDGETS,
    semantics: SEMANTICS,
    workerSettings: WORKER_SETTINGS,
    view: VIEW,
    files: Object.fromEntries(
      Object.entries(files).sort(([a], [b]) => a.localeCompare(b)),
    ),
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  if (process.argv.includes("--check")) {
    const { checkPins } = await import("./run.mjs");
    const checked = await checkPins();
    console.log(
      JSON.stringify({
        status: "verified",
        files: Object.keys(checked.pins.files).length,
        sha256: checked.sha256,
      }),
    );
  } else {
    const pins = await collectPins();
    const text = JSON.stringify(pins, null, 2) + "\n";
    await writeFile(resolve(directory, "source-pins.json"), text, {
      flag: "wx",
    });
    console.log(
      JSON.stringify({
        status: "frozen",
        files: Object.keys(pins.files).length,
        sha256: hash(text),
      }),
    );
  }
}
