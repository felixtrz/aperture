/** CPU-only one-time freeze. Source/history provenance is pinned independently of stale local HEAD. */
import { readFile, readdir, writeFile, readlink } from "node:fs/promises";
import { resolve, dirname, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import * as contract from "./contract.mjs";
const here = dirname(fileURLToPath(import.meta.url)),
  repo = resolve(here, "../.."),
  prior = resolve(repo, "benchmarks/crane-topology-regression-20261003");
const hash = (b) => createHash("sha256").update(b).digest("hex");
export async function collectPins() {
  const inherited = JSON.parse(
      await readFile(resolve(prior, "source-pins.json")),
    ),
    files = {};
  if (
    inherited.engineSourceCommit !== contract.ENGINE_SOURCE ||
    inherited.engineVersion !== contract.ENGINE_VERSION
  )
    throw Error("Wrong inherited engine freeze");
  for (const [path, pin] of Object.entries(inherited.files)) {
    const bytes = await readFile(resolve(repo, path));
    if (bytes.length !== pin.bytes || hash(bytes) !== pin.sha256)
      throw Error("Inherited input changed: " + path);
    files[path] = pin;
  }
  for (const [path, target] of Object.entries(inherited.runtimeSymlinks))
    if ((await readlink(resolve(repo, path))) !== target)
      throw Error("Runtime symlink changed");
  async function pin(path) {
    const b = await readFile(path);
    files[relative(repo, path)] = { bytes: b.length, sha256: hash(b) };
  }
  async function visit(path) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw Error("Fixture symlink");
      const p = resolve(path, entry.name);
      if (entry.isDirectory()) {
        if (
          !["renders", "lifecycle-audits", "lifecycle-audits-native"].includes(
            entry.name,
          )
        )
          await visit(p);
      } else if (
        /\.(mjs|py|html|md)$/.test(entry.name) ||
        [
          "derivation.json",
          "frozen-contract.json",
          "source-audit.json",
          "CPU_REPORT.json",
          "SOURCE_TRACE.json",
          "PARENT_NATIVE_COMMANDS.json",
        ].includes(entry.name)
      )
        await pin(p);
    }
  }
  await visit(here);
  for (const [name, want] of [
    [
      "tools/recovery/cleanup.py",
      "1c30bc42425c8ee112e7daf42e6a19e80c0f76949f2161590bc74c33b2f8d00d",
    ],
    [
      "tools/recovery/runtime_pressure.py",
      "89b5819db930e2bebe72818ee199de26306550327db358e7319f2d67c5aedf8a",
    ],
  ]) {
    const path = resolve(repo, name);
    if (hash(await readFile(path)) !== want)
      throw Error("Adopted helper mismatch: " + name);
    await pin(path);
  }

  await pin(resolve(prior, "source-pins.json"));
  await pin(resolve(prior, "NATIVE_RESULT.json"));
  await pin(
    resolve(
      repo,
      "benchmarks/topology-native-audit-20261003/NEXT_REGRESSION.json",
    ),
  );
  await pin(
    resolve(repo, "benchmarks/topology-native-audit-20261003/REPORT.md"),
  );
  const derivation = JSON.parse(
      await readFile(resolve(here, "derivation.json")),
    ),
    checked = [];
  for (const entry of derivation.files) {
    const original = await readFile(resolve(repo, entry.source)),
      expected = execFileSync(
        "git",
        ["show", `7c4b867ac432bfbb132c58066b809c530e785032:${entry.source}`],
        { cwd: repo, maxBuffer: 16 * 1024 * 1024 },
      ),
      derived = await readFile(resolve(repo, entry.destination));
    if (
      !original.equals(expected) ||
      hash(original) !== entry.sourceSha256 ||
      hash(derived) !== entry.derivedSha256
    )
      throw Error("Derivation provenance differs: " + entry.source);
    checked.push(entry.destination);
    await pin(resolve(repo, entry.source));
  }
  return {
    schema: contract.SCHEMA + ".inputs",
    engineSourceCommit: contract.ENGINE_SOURCE,
    engineVersion: contract.ENGINE_VERSION,
    predecessorSourceCommit: "7c4b867ac432bfbb132c58066b809c530e785032",
    predecessorNativeCommit: "8a2e900edd794d0392b133c332a3f1ba161f8302",
    auditIntentCommit: "b2051f0c0e5ce55ff7569f1da996f9656da54542",
    localHeadUsedAsProvenance: false,
    runtimeRoot: inherited.runtimeRoot,
    runtimeSymlinks: inherited.runtimeSymlinks,
    compiledProvenance:
      "Inherited byte pins; no new build or independent source-to-compiled reproduction",
    helperSha256:
      "1c30bc42425c8ee112e7daf42e6a19e80c0f76949f2161590bc74c33b2f8d00d",
    nativeWrapperSha256:
      "89b5819db930e2bebe72818ee199de26306550327db358e7319f2d67c5aedf8a",
    sessions: Object.fromEntries(
      contract.SESSION_IDS.map((s) => [s, contract.statesFor(s)]),
    ),
    budgets: contract.BUDGETS,
    workerSettings: contract.WORKER_SETTINGS,
    transforms: contract.INSTANCE_TRANSLATIONS,
    view: contract.VIEW,
    light: contract.LIGHT,
    derivationsVerified: checked,
    scope:
      "CPU-prepared bounded exploratory shared-mesh regression; native not run; authentic author/model gates missing",
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
        sha256: result.sha256,
        files: Object.keys(result.pins.files).length,
      }),
    );
  } else {
    const pins = await collectPins(),
      bytes = JSON.stringify(pins, null, 2) + "\n";
    await writeFile(resolve(here, "source-pins.json"), bytes, { flag: "wx" });
    console.log(
      JSON.stringify({
        status: "frozen",
        sha256: hash(bytes),
        files: Object.keys(pins.files).length,
      }),
    );
  }
}
