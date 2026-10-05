import assert from "node:assert/strict";
import { readFile, realpath, readlink, readdir } from "node:fs/promises";
import { dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
export const here = dirname(fileURLToPath(import.meta.url)),
  repo = resolve(here, "../../..");
export const sha256 = (value) =>
  createHash("sha256").update(value).digest("hex");
export async function collectPins() {
  const prior = JSON.parse(
    await readFile(
      resolve(
        repo,
        "benchmarks/indexed-shared-mesh-fanout-20261004/source-pins.json",
      ),
      "utf8",
    ),
  );
  const preparation = JSON.parse(
    await readFile(resolve(here, "preparation-inputs.json"), "utf8"),
  );
  const files = { ...prior.files, ...preparation.priorCpuEvidence };
  async function pin(path) {
    const actual = await realpath(path),
      name = relative(repo, actual);
    assert(!name.startsWith("../"));
    const bytes = await readFile(actual);
    files[name] = { bytes: bytes.length, sha256: sha256(bytes) };
  }
  for (const entry of await readdir(here, { withFileTypes: true }))
    if (entry.isFile() && /\.(mjs|md|html|py)$/.test(entry.name))
      await pin(resolve(here, entry.name));
  await pin(resolve(here, "preparation-inputs.json"));
  for (const [name, expected] of Object.entries(files)) {
    const bytes = await readFile(resolve(repo, name));
    assert.equal(bytes.length, expected.bytes, name);
    assert.equal(sha256(bytes), expected.sha256, name);
  }
  for (const [name, expected] of Object.entries(prior.runtimeSymlinks))
    assert.equal(await readlink(resolve(repo, name)), expected);
  return {
    schema: "aperture.sideband-native.v1.inputs",
    status: "frozen-candidate-awaiting-review-and-native-permit",
    engineSourceCommit: prior.engineSourceCommit,
    engineVersion: prior.engineVersion,
    runtimeRoot: prior.runtimeRoot,
    runtimeSymlinks: prior.runtimeSymlinks,
    files: Object.fromEntries(
      Object.entries(files).sort(([a], [b]) => a.localeCompare(b)),
    ),
    nativeStatus: "unrun",
    provenance:
      "Exact current compiled/source/runtime bytes inherited from the verified indexed inputs; no independent rebuild",
  };
}
export async function checkPins(pinsPath = resolve(here, "source-pins.json")) {
  const raw = await readFile(pinsPath),
    pins = JSON.parse(raw);
  assert.equal(pins.schema, "aperture.sideband-native.v1.inputs");
  assert.equal(
    pins.engineSourceCommit,
    "d0333acdd4443ed9a4a0239d24184755b812b447",
  );
  for (const [name, expected] of Object.entries(pins.files)) {
    const bytes = await readFile(resolve(repo, name));
    assert.equal(bytes.length, expected.bytes, name);
    assert.equal(sha256(bytes), expected.sha256, name);
  }
  for (const [name, expected] of Object.entries(pins.runtimeSymlinks))
    assert.equal(await readlink(resolve(repo, name)), expected);
  return { pins, sha256: sha256(raw) };
}
