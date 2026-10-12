import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import * as fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { format } from "prettier";
import {
  evidencePath,
  experimentPath,
  inspectEvidenceFile,
  repositoryRoot,
  validateFreezeMetadata,
} from "./check-preserved-evidence.mjs";

/** Create-only sealing of an explicitly reviewed list; never scans source environments. */
export async function sealReviewedExperiment(
  specification,
  { root = repositoryRoot, outputPath, now = () => new Date() } = {},
) {
  root = await fs.realpath(root);
  experimentPath(outputPath);
  assert.deepEqual(Object.keys(specification).sort(), [
    "files",
    "provenance",
    "purpose",
    "review",
    "schema",
  ]);
  assert.equal(specification.schema, "aperture.experiment-freeze-request.v1");
  assert.ok(
    specification.files &&
      typeof specification.files === "object" &&
      !Array.isArray(specification.files),
  );
  assert.deepEqual(Object.keys(specification.provenance).sort(), [
    "inputs",
    "kind",
    "note",
  ]);
  assert.equal(specification.provenance.kind, "working-tree-snapshot");
  const listed = Object.entries(specification.files);
  assert.ok(
    listed.length > 0,
    "Explicitly reviewed artifact paths are required",
  );
  for (const [relative, origin] of listed) {
    experimentPath(relative);
    assert.ok(
      typeof origin === "string" && origin.trim(),
      "Artifact origin is required",
    );
  }
  const inputCopies = Object.entries(specification.provenance.inputs);
  assert.ok(
    inputCopies.length > 0,
    "Explicit working-tree input copies are required",
  );
  for (const [sourceLabel, snapshotPath] of inputCopies) {
    evidencePath(sourceLabel);
    assert.ok(
      !sourceLabel.split("/").includes(".aperture-env"),
      "Use public source labels; private author environments are not inputs",
    );
    experimentPath(snapshotPath);
    assert.ok(
      Object.hasOwn(specification.files, snapshotPath),
      `Unlisted input copy: ${snapshotPath}`,
    );
  }
  const files = {};
  for (const [relative, origin] of listed.toSorted(([a], [b]) =>
    a.localeCompare(b),
  )) {
    files[relative] = {
      ...(await inspectEvidenceFile(root, relative)),
      origin,
    };
  }
  const inputs = {};
  for (const [sourceLabel, snapshotPath] of inputCopies.toSorted(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const { sha256, bytes } = files[snapshotPath];
    inputs[sourceLabel] = { snapshotPath, sha256, bytes };
  }
  const freeze = {
    schema: "aperture.experiment-evidence-freeze.v1",
    purpose: specification.purpose,
    capturedAt: now().toISOString(),
    review: specification.review,
    provenance: { ...specification.provenance, inputs },
    files,
  };
  validateFreezeMetadata(freeze);
  const payload = await format(JSON.stringify(freeze), { parser: "json" });
  const output = path.join(root, outputPath);
  const parent = path.dirname(output);
  await fs.mkdir(parent, { recursive: true });
  assert.equal(
    await fs.realpath(parent),
    parent,
    "Redirected freeze destination",
  );
  await fs.writeFile(output, payload, { flag: "wx" });
  return {
    path: outputPath,
    sha256: createHash("sha256").update(payload).digest("hex"),
  };
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const args = process.argv.slice(2);
    assert.equal(
      args.length,
      4,
      "Use --spec /absolute/reviewed-batch.json --output benchmarks/.../freeze.json",
    );
    const options = {};
    for (let i = 0; i < args.length; i += 2) {
      assert.ok(args[i] === "--spec" || args[i] === "--output");
      assert.ok(!Object.hasOwn(options, args[i]), "Duplicate freeze option");
      options[args[i]] = args[i + 1];
    }
    assert.ok(
      path.isAbsolute(options["--spec"]),
      "Freeze spec must be an explicit absolute file path",
    );
    const specification = JSON.parse(
      await fs.readFile(options["--spec"], "utf8"),
    );
    const registration = await sealReviewedExperiment(specification, {
      outputPath: options["--output"],
    });
    console.log(JSON.stringify(registration, null, 2));
    console.error(
      "Inspect the freeze, then add this exact record to scripts/experiment-freezes.json inventories. No formatter exemption was registered automatically.",
    );
  } catch (error) {
    console.error(`Experiment sealing failed: ${error.message}`);
    process.exitCode = 1;
  }
}
