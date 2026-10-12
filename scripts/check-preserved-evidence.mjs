import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import * as fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
export const inventoryPath = new URL(
  "./preserved-evidence.json",
  import.meta.url,
);
export const experimentRegistryPath = new URL(
  "./experiment-freezes.json",
  import.meta.url,
);
const recorderFreeze =
  "benchmarks/crane-live-edits-20261003/harness/freeze-006.json";

export function evidencePath(value) {
  assert.ok(
    typeof value === "string" &&
      // Literal package/store filenames may include + and @. Glob operators,
      // whitespace, escapes and traversal remain outside this grammar.
      /^[A-Za-z0-9_./+@-]+$/.test(value) &&
      value.split("/").every((part) => part && part !== "." && part !== ".."),
    `Invalid evidence path: ${value}`,
  );
}

function preservedPath(value) {
  assert.ok(
    typeof value === "string" &&
      /^[A-Za-z0-9_./-]+$/.test(value) &&
      value.split("/").every((part) => part && part !== "." && part !== "..") &&
      (value.startsWith("benchmarks/") ||
        value.startsWith("tools/coordination/evidence/") ||
        value === "tools/coordination/checkpoints/recovery-20261002.json"),
    `Invalid preserved evidence path: ${value}`,
  );
}

export async function inspectEvidenceFile(root, relative) {
  evidencePath(relative);
  const target = path.join(root, relative);
  assert.equal(
    await fs.realpath(target),
    target,
    `Redirected evidence: ${relative}`,
  );
  const before = await fs.stat(target, { bigint: true });
  assert.ok(before.isFile(), `Not a regular evidence file: ${relative}`);
  const hash = createHash("sha256");
  let bytes = 0n;
  for await (const chunk of createReadStream(target)) {
    hash.update(chunk);
    bytes += BigInt(chunk.length);
  }
  const after = await fs.stat(target, { bigint: true });
  for (const field of ["dev", "ino", "size", "mtimeNs", "ctimeNs"]) {
    assert.equal(
      before[field],
      after[field],
      `Evidence changed while reading: ${relative}`,
    );
  }
  assert.equal(bytes, before.size, `Incomplete evidence read: ${relative}`);
  assert.ok(
    bytes <= BigInt(Number.MAX_SAFE_INTEGER),
    "Evidence size exceeds exact integer range",
  );
  return { sha256: hash.digest("hex"), bytes: Number(bytes) };
}

/** Integrity check only: this does not authenticate or score historical evidence. */
export async function verifyPreservedEvidence(root, inventory) {
  root = await fs.realpath(root);
  assert.equal(inventory.schema, "aperture.preserved-evidence.v1");
  assert.match(inventory.baselineRevision, /^[a-f0-9]{40}$/);
  assert.ok(
    inventory.files &&
      typeof inventory.files === "object" &&
      !Array.isArray(inventory.files),
  );
  const entries = Object.entries(inventory.files);
  assert.ok(entries.length > 0, "Empty preserved evidence inventory");
  for (const [relative, expected] of entries) {
    preservedPath(relative);
    assert.match(expected, /^[a-f0-9]{64}$/);
  }
  // A small worker pool hashes large retained images without reading them all into memory.
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(8, entries.length) }, async () => {
      while (cursor < entries.length) {
        const [relative, expected] = entries[cursor++];
        assert.equal(
          (await inspectEvidenceFile(root, relative)).sha256,
          expected,
          `Modified preserved evidence: ${relative}`,
        );
      }
    }),
  );
  // Keep the actively executed recorder anchored to its original, independent freeze.
  if (Object.hasOwn(inventory.files, recorderFreeze)) {
    const frozen = JSON.parse(
      await fs.readFile(path.join(root, recorderFreeze), "utf8"),
    );
    assert.equal(frozen.schema, "aperture.crane-live-harness-freeze.v1");
    assert.equal(frozen.tests.passed, 24);
    assert.equal(frozen.tests.failed, 0);
    for (const [relative, record] of Object.entries(frozen.files)) {
      const target = path.posix.join(
        path.posix.dirname(recorderFreeze),
        relative,
      );
      preservedPath(target);
      assert.equal(
        inventory.files[target],
        record.sha256,
        `Frozen recorder pin mismatch: ${target}`,
      );
    }
  }
  return entries.map(([relative]) => relative).sort();
}

export async function loadRepositoryInventory() {
  const inventory = JSON.parse(await fs.readFile(inventoryPath, "utf8"));
  assert.ok(
    Object.hasOwn(inventory.files, recorderFreeze),
    "Missing active recorder freeze",
  );
  return inventory;
}

function recordKeys(record, expected) {
  assert.ok(record && typeof record === "object" && !Array.isArray(record));
  assert.deepEqual(
    Object.keys(record).sort(),
    expected.toSorted(),
    "Unexpected evidence metadata fields",
  );
}

function nonempty(value) {
  assert.ok(
    typeof value === "string" && value.trim(),
    "Expected nonempty evidence provenance",
  );
}

function timestamp(value) {
  assert.match(value, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/);
  assert.equal(
    new Date(value).toISOString().replace(/\.000Z$/, "Z"),
    value.replace(/\.000Z$/, "Z"),
    "Invalid evidence timestamp",
  );
}

export function experimentPath(value) {
  evidencePath(value);
  assert.ok(
    value.startsWith("benchmarks/"),
    `Experiment evidence must be retained under benchmarks/: ${value}`,
  );
  assert.ok(
    !value.split("/").includes(".aperture-env"),
    "Private author environments are not experiment artifacts",
  );
}

export function validateFreezeMetadata(freeze) {
  recordKeys(freeze, [
    "schema",
    "purpose",
    "capturedAt",
    "review",
    "provenance",
    "files",
  ]);
  assert.equal(freeze.schema, "aperture.experiment-evidence-freeze.v1");
  nonempty(freeze.purpose);
  timestamp(freeze.capturedAt);
  recordKeys(freeze.review, ["reviewedBy", "reviewedAt"]);
  nonempty(freeze.review.reviewedBy);
  timestamp(freeze.review.reviewedAt);
  assert.ok(
    Date.parse(freeze.review.reviewedAt) <= Date.parse(freeze.capturedAt),
    "Review must precede freezing",
  );
  recordKeys(freeze.provenance, ["kind", "note", "inputs"]);
  assert.equal(freeze.provenance.kind, "working-tree-snapshot");
  nonempty(freeze.provenance.note);
  assert.ok(
    freeze.provenance.inputs &&
      typeof freeze.provenance.inputs === "object" &&
      !Array.isArray(freeze.provenance.inputs),
  );
  assert.ok(
    Object.keys(freeze.provenance.inputs).length > 0,
    "Working-tree input copies are required",
  );
  assert.ok(
    freeze.files &&
      typeof freeze.files === "object" &&
      !Array.isArray(freeze.files),
  );
  assert.ok(Object.keys(freeze.files).length > 0, "Empty experiment freeze");
  for (const [relative, record] of Object.entries(freeze.files)) {
    experimentPath(relative);
    recordKeys(record, ["sha256", "bytes", "origin"]);
    assert.match(record.sha256, /^[a-f0-9]{64}$/);
    assert.ok(Number.isSafeInteger(record.bytes) && record.bytes >= 0);
    nonempty(record.origin);
  }
  for (const [sourceLabel, input] of Object.entries(freeze.provenance.inputs)) {
    evidencePath(sourceLabel);
    assert.ok(
      !sourceLabel.split("/").includes(".aperture-env"),
      "Use public source labels; private author environments are not inputs",
    );
    recordKeys(input, ["snapshotPath", "sha256", "bytes"]);
    experimentPath(input.snapshotPath);
    const copy = freeze.files[input.snapshotPath];
    assert.ok(copy, `Missing retained input copy: ${input.snapshotPath}`);
    assert.equal(
      input.sha256,
      copy.sha256,
      `Input hash does not match retained copy: ${sourceLabel}`,
    );
    assert.equal(
      input.bytes,
      copy.bytes,
      `Input byte count does not match retained copy: ${sourceLabel}`,
    );
  }
}

/** Fresh experiments use reviewed working-tree byte manifests, never fabricated commits. */
export async function verifyExperimentFreezes(root, registry) {
  root = await fs.realpath(root);
  recordKeys(registry, ["schema", "purpose", "inventories"]);
  assert.equal(registry.schema, "aperture.experiment-freeze-registry.v1");
  nonempty(registry.purpose);
  assert.ok(Array.isArray(registry.inventories));
  const paths = new Set();
  for (const registration of registry.inventories) {
    recordKeys(registration, ["path", "sha256"]);
    experimentPath(registration.path);
    assert.match(registration.sha256, /^[a-f0-9]{64}$/);
    assert.ok(
      !paths.has(registration.path),
      "Duplicate experiment inventory registration",
    );
    const bytes = await inspectEvidenceFile(root, registration.path);
    assert.equal(
      bytes.sha256,
      registration.sha256,
      `Modified experiment inventory: ${registration.path}`,
    );
    const freeze = JSON.parse(
      await fs.readFile(path.join(root, registration.path), "utf8"),
    );
    validateFreezeMetadata(freeze);
    paths.add(registration.path);
    for (const [relative, expected] of Object.entries(freeze.files)) {
      const actual = await inspectEvidenceFile(root, relative);
      assert.equal(
        actual.sha256,
        expected.sha256,
        `Modified experiment evidence: ${relative}`,
      );
      assert.equal(
        actual.bytes,
        expected.bytes,
        `Experiment byte count mismatch: ${relative}`,
      );
      paths.add(relative);
    }
  }
  return [...paths].sort();
}

export async function loadExperimentRegistry() {
  return JSON.parse(await fs.readFile(experimentRegistryPath, "utf8"));
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const paths = await verifyPreservedEvidence(
      repositoryRoot,
      await loadRepositoryInventory(),
    );
    const experiments = await verifyExperimentFreezes(
      repositoryRoot,
      await loadExperimentRegistry(),
    );
    console.log(
      `Preserved evidence: ${paths.length} baseline files and ${experiments.length} fresh experiment files byte-identical; active recorder freeze verified.`,
    );
  } catch (error) {
    console.error(`Preserved evidence check failed: ${error.message}`);
    process.exitCode = 1;
  }
}
