/** Exclusive source/dependency/settings freeze. Never refresh after admission. */
import {
  readFile,
  readdir,
  writeFile,
  readlink,
  realpath,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, dirname, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  SCHEMA,
  ENGINE_SOURCE,
  ENGINE_VERSION,
  THREE_REVISION,
  SESSION_IDS,
  statesFor,
  BUDGETS,
  VIEW,
  TOPOLOGIES,
  WORKER_SETTINGS,
  SEMANTICS,
} from "./contract.mjs";
const here = dirname(fileURLToPath(import.meta.url)),
  repo = resolve(here, "../.."),
  old = resolve(repo, "benchmarks/crane-combined-edits-20261003");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
export async function collectPins() {
  const runtimeRoot = ".aperture-env/render-runtime",
    runtimeSymlinks = {};
  const inherited = JSON.parse(
      await readFile(resolve(old, "source-pins.json")),
    ),
    files = {};
  if (
    inherited.engineSourceCommit !== ENGINE_SOURCE ||
    inherited.engineVersion !== ENGINE_VERSION
  )
    throw Error("Engine provenance mismatch");
  for (const [name, pin] of Object.entries(inherited.files)) {
    const bytes = await readFile(resolve(repo, name));
    if (bytes.length !== pin.bytes || hash(bytes) !== pin.sha256)
      throw Error("Inherited bytes changed: " + name);
    files[name] = pin;
  }
  async function pin(path) {
    const bytes = await readFile(path);
    files[relative(repo, path)] = { bytes: bytes.length, sha256: hash(bytes) };
  }
  async function visit(path, all = false) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw Error("Source symlink");
      const next = resolve(path, entry.name);
      if (entry.isDirectory()) {
        if (
          !["renders", "lifecycle-audits", "lifecycle-audits-native"].includes(
            entry.name,
          ) ||
          all
        )
          await visit(next, all);
      } else if (
        all ||
        /\.(mjs|py|html|diff|md)$/.test(entry.name) ||
        [
          "derivation.json",
          "frozen-contract.json",
          "source-audit.json",
          "source-audit-final.json",
          "SOURCE_TRACE.json",
          "CPU_REPORT.json",
        ].includes(entry.name)
      )
        await pin(next);
    }
  }
  await visit(here);
  async function visitRuntime(path) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const next = resolve(path, entry.name);
      if (entry.isSymbolicLink()) {
        const actual = await realpath(next);
        if (!actual.startsWith(resolve(repo, runtimeRoot) + "/"))
          throw Error("Runtime symlink escapes pinned runtime");
        runtimeSymlinks[relative(repo, next)] = await readlink(next);
      } else if (entry.isDirectory()) await visitRuntime(next);
      else await pin(next);
    }
  }
  await visitRuntime(resolve(repo, runtimeRoot));

  for (const name of [
    "source-pins.json",
    "comparison-001.json",
    "native-manifest.json",
    "native-cold-attempt001.json",
    "native-live-attempt001.json",
    "PREPARATION_REPORT.json",
  ])
    await pin(resolve(old, name));
  for (const engine of ["aperture", "threejs"])
    await visit(
      resolve(old, "renders", engine, "fresh-baseline", "attempt-001"),
      true,
    );
  for (const entry of JSON.parse(
    await readFile(resolve(here, "derivation.json")),
  ).files)
    await pin(resolve(repo, entry.source));
  const provenance = JSON.parse(
    await readFile(
      resolve(
        repo,
        "benchmarks/worker-shadow-light-matrix-20261003/engine-provenance.json",
      ),
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
      throw Error("Engine source changed: " + entry.path);
    await pin(resolve(repo, entry.path));
  }
  const comparison = JSON.parse(
    await readFile(resolve(old, "comparison-001.json")),
  );
  if (comparison.status !== "passed")
    throw Error("Combined control comparison did not pass");
  return {
    schema: SCHEMA + ".inputs",
    runtimeRoot,
    runtimeSymlinks,
    engineSourceCommit: ENGINE_SOURCE,
    engineVersion: ENGINE_VERSION,
    threeRevision: THREE_REVISION,
    currentMainAtAdmission: "1f04da792a38e259b51f5053b0731c5013a34c6b",
    predecessorEvidenceCommit: "df4b5b249d8966bb4f74b734a6b3f6fc3abd3786",
    alternateEvidenceCommit: "fe400624895c118396d8432d6d55bf50db54b48a",
    localHeadUsedAsProvenance: false,
    inheritedInputsVerified: Object.keys(inherited.files).length,
    engineSourceFilesVerified: provenance.sourceFiles.length,
    sessions: Object.fromEntries(SESSION_IDS.map((s) => [s, statesFor(s)])),
    budgets: BUDGETS,
    view: VIEW,
    topologies: TOPOLOGIES,
    workerSettings: WORKER_SETTINGS,
    semantics: SEMANTICS,
    scope:
      "CPU-prepared post-author engineering regression; native unrun; no score or performance claims",
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
    const result = await (await import("./run.mjs")).checkPins();
    console.log(
      JSON.stringify({
        status: "verified",
        files: Object.keys(result.pins.files).length,
        sha256: result.sha256,
      }),
    );
  } else {
    const pins = await collectPins(),
      raw = JSON.stringify(pins, null, 2) + "\n";
    await writeFile(resolve(here, "source-pins.json"), raw, { flag: "wx" });
    console.log(
      JSON.stringify({
        status: "frozen",
        files: Object.keys(pins.files).length,
        sha256: hash(raw),
      }),
    );
  }
}
