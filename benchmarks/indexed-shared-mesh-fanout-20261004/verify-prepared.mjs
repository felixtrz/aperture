/** Revalidate exact prepared artifact bytes without native execution or mutation. */
import assert from "node:assert/strict";
import { readFile, readlink } from "node:fs/promises";
import { resolve } from "node:path";
import { here, repo, sha256 } from "./inputs.mjs";
const prefix = process.argv[2];
assert(/^prepared-\d{3}$/.test(prefix ?? ""));
const report = JSON.parse(
  await readFile(resolve(here, `${prefix}-report.json`)),
);
for (const [name, pin] of Object.entries(report.artifacts)) {
  const bytes = await readFile(resolve(here, name));
  assert.equal(bytes.length, pin.bytes, name);
  assert.equal(sha256(bytes), pin.sha256, name);
}
const pins = JSON.parse(await readFile(resolve(here, `${prefix}-inputs.json`)));
assert.equal(pins.status, "prepared-unfrozen");
for (const [name, pin] of Object.entries(pins.files)) {
  const bytes = await readFile(resolve(repo, name));
  assert.equal(bytes.length, pin.bytes, name);
  assert.equal(sha256(bytes), pin.sha256, name);
}
for (const [name, target] of Object.entries(pins.runtimeSymlinks))
  assert.equal(await readlink(resolve(repo, name)), target, name);
console.log(
  JSON.stringify({
    status: "verified-prepared-unfrozen",
    files: Object.keys(pins.files).length,
    artifacts: Object.keys(report.artifacts).length,
    browsersLaunched: 0,
    nativeActivation: "unrun",
  }),
);
