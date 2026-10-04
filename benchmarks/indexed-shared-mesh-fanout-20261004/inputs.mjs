/** Capture current prepared inputs on CPU. This is not a native admission or freeze. */
import { readFile, readdir, realpath, readlink } from "node:fs/promises";
import { resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import * as contract from "./contract.mjs";
export const here = dirname(fileURLToPath(import.meta.url));
export const repo = resolve(here, "../..");
export const sha256 = (bytes) =>
  createHash("sha256").update(bytes).digest("hex");
export async function collectPins() {
  const files = {},
    runtimeSymlinks = {},
    engineSourceVerified = [];
  const pin = async (path) => {
    const actual = await realpath(path),
      name = relative(repo, actual);
    if (name.startsWith("../")) throw Error("Input escapes checkout: " + name);
    const bytes = await readFile(actual);
    files[name] = { bytes: bytes.length, sha256: sha256(bytes) };
  };
  async function visit(path, runtime = false) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const child = resolve(path, entry.name);
      if (entry.isSymbolicLink()) {
        if (runtime)
          runtimeSymlinks[relative(repo, child)] = await readlink(child);
        continue;
      }
      if (entry.isDirectory()) await visit(child, runtime);
      else if (entry.isFile()) await pin(child);
    }
  }
  const prior = JSON.parse(
    await readFile(
      resolve(
        repo,
        "benchmarks/shared-mesh-fanout-v2-20261003/source-pins.json",
      ),
    ),
  );
  if (
    prior.engineSourceCommit !== contract.ENGINE_SOURCE ||
    prior.engineVersion !== contract.ENGINE_VERSION
  )
    throw Error("Wrong retained engine provenance");
  for (const [name, expected] of Object.entries(prior.files)) {
    if (!/^packages\/[^/]+\/src\//.test(name)) continue;
    await pin(resolve(repo, name));
    if (JSON.stringify(files[name]) !== JSON.stringify(expected))
      throw Error("Engine source differs from retained d0333ac input: " + name);
    engineSourceVerified.push(name);
  }
  if (!engineSourceVerified.length) throw Error("No verified engine source");
  for (const entry of await readdir(resolve(repo, "packages"), {
    withFileTypes: true,
  })) {
    if (!entry.isDirectory()) continue;
    for (const folder of ["src", "dist"]) {
      try {
        await visit(resolve(repo, "packages", entry.name, folder));
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
    await pin(resolve(repo, "packages", entry.name, "package.json"));
  }
  for (const name of [
    "elics",
    "wgpu-matrix",
    "@preact/signals-core",
    "typescript",
  ]) {
    await visit(await realpath(resolve(repo, "node_modules", name)));
  }
  await visit(
    await realpath(
      resolve(
        repo,
        "packages/physics-rapier/node_modules/@dimforge/rapier3d-compat",
      ),
    ),
  );
  const runtimeRoot = ".aperture-env/render-runtime";
  await visit(resolve(repo, runtimeRoot), true);
  async function fixture(path) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const child = resolve(path, entry.name);
      if (entry.isSymbolicLink()) throw Error("Fixture symlink forbidden");
      if (entry.isDirectory()) {
        if (!["renders", "lifecycle-audits"].includes(entry.name))
          await fixture(child);
      } else if (/\.(mjs|py|html|md|sh)$/.test(entry.name)) await pin(child);
    }
  }
  await fixture(here);
  for (const name of [
    "package.json",
    "pnpm-lock.yaml",
    "tsconfig.base.json",
    "scripts/serve-examples.mjs",
    "scripts/verified-webgpu.mjs",
    "scripts/local-webgpu.mjs",
    "tools/recovery/cleanup.py",
    "tools/recovery/runtime_pressure.py",
    "benchmarks/worker-shadow-light-matrix-20261003/import-proof.mjs",
    "benchmarks/shared-mesh-fanout-v2-20261003/source-pins.json",
    "benchmarks/shared-mesh-native-audit-20261003/REPORT.md",
  ]) {
    await pin(resolve(repo, name));
  }
  if (
    files["tools/recovery/cleanup.py"].sha256 !==
    "1c30bc42425c8ee112e7daf42e6a19e80c0f76949f2161590bc74c33b2f8d00d"
  )
    throw Error("Cleanup helper changed");
  return {
    schema: contract.SCHEMA + ".inputs",
    status: "prepared-unfrozen",
    sourceHead: "1081ed5455bae4d9f5ead61b32de41b0c8b4bb6a",
    engineSourceCommit: contract.ENGINE_SOURCE,
    engineVersion: contract.ENGINE_VERSION,
    engineSourceVerified,
    compiledProvenance:
      "Current installed fresh-build bytes captured; preparation did not build or independently reproduce them",
    runtimeRoot,
    runtimeSymlinks,
    files: Object.fromEntries(
      Object.entries(files).sort(([a], [b]) => a.localeCompare(b)),
    ),
    nativeStatus: "unrun",
    formalBenchmarkStatus: "unrun",
  };
}
