/** One-time CPU-only V2 freeze. No build or dependency reconciliation. */
import { readFile, readdir, writeFile, readlink } from "node:fs/promises";
import { resolve, dirname, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as contract from "./contract.mjs";
import { repo, sha256 } from "./archive-verification.mjs";
const here = dirname(fileURLToPath(import.meta.url)),
  prior = resolve(repo, "benchmarks/shared-mesh-fanout-20261003");
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
    if (bytes.length !== pin.bytes || sha256(bytes) !== pin.sha256)
      throw Error("Inherited input changed: " + path);
    files[path] = pin;
  }
  for (const [path, target] of Object.entries(inherited.runtimeSymlinks))
    if ((await readlink(resolve(repo, path))) !== target)
      throw Error("Runtime symlink changed");
  const pin = async (path) => {
    const bytes = await readFile(path);
    files[relative(repo, path)] = {
      bytes: bytes.length,
      sha256: sha256(bytes),
    };
  };
  const archives = JSON.parse(
    await readFile(resolve(here, "PRESERVATION.json")),
  );
  for (const archive of Object.values(archives))
    for (const [name, expected] of Object.entries(archive.files)) {
      const bytes = await readFile(resolve(repo, name));
      if (bytes.length !== expected.bytes || sha256(bytes) !== expected.sha256)
        throw Error("Preserved archive changed: " + name);
      await pin(resolve(repo, name));
    }
  const derivation = JSON.parse(
    await readFile(resolve(here, "derivation.json")),
  );
  for (const entry of derivation.files) {
    const source = await readFile(resolve(repo, entry.source)),
      derived = await readFile(resolve(repo, entry.destination));
    if (
      sha256(source) !== entry.sourceSha256 ||
      sha256(derived) !== entry.derivedSha256
    )
      throw Error("Derivation bytes changed: " + entry.destination);
  }
  async function visit(path) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw Error("Fixture symlink");
      const p = resolve(path, entry.name);
      if (entry.isDirectory()) {
        if (
          entry.name !== "renders" &&
          !entry.name.startsWith("lifecycle-audits")
        )
          await visit(p);
      } else if (
        /\.(mjs|py|html|md)$/.test(entry.name) ||
        [
          "derivation.json",
          "frozen-contract.json",
          "CPU_REPORT.json",
          "SOURCE_TRACE.json",
          "PARENT_NATIVE_COMMANDS.json",
          "PRESERVATION.json",
        ].includes(entry.name)
      )
        await pin(p);
    }
  }
  await visit(here);
  for (const [name, expected] of [
    [
      "tools/recovery/cleanup.py",
      "1c30bc42425c8ee112e7daf42e6a19e80c0f76949f2161590bc74c33b2f8d00d",
    ],
    [
      "tools/recovery/runtime_pressure.py",
      "89b5819db930e2bebe72818ee199de26306550327db358e7319f2d67c5aedf8a",
    ],
  ]) {
    if (sha256(await readFile(resolve(repo, name))) !== expected)
      throw Error("Adopted helper mismatch");
    await pin(resolve(repo, name));
  }
  return {
    ...inherited,
    schema: contract.SCHEMA + ".inputs",
    predecessorSourceCommit: "d0868fbae24d6cd70794d9c4914249ed634df303",
    predecessorNativeCommit: "6f3ca39472e896573c0ab0bc59d381ba3cf4f75f",
    predecessorNativeOutcome:
      "failed before accepted baseline; three indirect methods observed but arguments missing",
    derivationsVerified: derivation.files.map((e) => e.destination),
    scope:
      "V2 indirect evidence correction; CPU only, seven native sessions and fourteen captures separately pending",
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
        sha256: sha256(bytes),
        files: Object.keys(pins.files).length,
      }),
    );
  }
}
