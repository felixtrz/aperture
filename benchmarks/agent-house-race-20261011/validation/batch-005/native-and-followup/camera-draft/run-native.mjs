import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { runManualControl } from "/workspace/aperture/tools/agent-benchmark/manual-control-run.mjs";
import {
  sha256,
  writeImmutable,
} from "/workspace/aperture/tools/agent-benchmark/recorder.mjs";

const [inputs, output, expectedSha256] = process.argv.slice(2);
const bytes = await readFile(resolve(inputs, "provenance.json"));
assert.equal(
  sha256(bytes),
  expectedSha256,
  "Root-reviewed frozen provenance differs",
);
const provenance = JSON.parse(bytes);
assert.equal(
  provenance.diagnostic,
  "current-camera-projection; unscored; public worker/ECS semantic request",
);
assert.equal(provenance.typecheck.exitCode, 0);
assert.deepEqual(provenance.variants, ["transferable"]);
for (const pin of provenance.currentFiles) {
  const actual = await readFile(pin.path);
  assert.equal(
    actual.length,
    pin.bytes,
    `Current input size differs: ${pin.path}`,
  );
  assert.equal(
    sha256(actual),
    pin.sha256,
    `Current input SHA differs: ${pin.path}`,
  );
}
await runManualControl(inputs, output);
const status = JSON.parse(
  await readFile(resolve(output, "transferable/validation.json")),
);
assert.equal(status.ok, true);
assert.equal(status.schema, "aperture.native-camera-projection.v1");
assert.deepEqual(
  status.frames.map((frame) => frame.snapshotFrame),
  [0, 1, 2],
);
assert.equal(status.captures[0].path, "baseline.png");
assert.equal(status.captures[1].path, "updated.png");
assert.equal(status.captures[2].path, "unchanged.png");
for (const capture of status.captures) {
  const png = await readFile(resolve(output, "transferable", capture.path));
  assert.equal(png.length, capture.bytes);
  assert.equal(sha256(png), capture.sha256);
}
assert.notEqual(status.captures[0].sha256, status.captures[1].sha256);
assert.equal(status.captures[1].sha256, status.captures[2].sha256);
assert.notDeepEqual(
  status.frames[0].snapshot.matrix,
  status.frames[1].snapshot.matrix,
);
assert.deepEqual(
  status.frames[1].snapshot.matrix,
  status.frames[2].snapshot.matrix,
);
assert.deepEqual(status.frames[1].camera, status.frames[2].camera);
for (const frame of status.frames) {
  assert.equal(frame.snapshot.meshDraws, 3);
  assert.ok(frame.nativeDrawCalls > 0 && frame.nativeSubmissions > 0);
  const camera = frame.camera.camera,
    matrix = frame.snapshot.matrix;
  const focal = Math.tan(Math.PI / 2 - camera.fovYRadians / 2);
  assert.ok(Math.abs(matrix[0] - focal / camera.aspect) < 0.00001);
  assert.ok(Math.abs(matrix[5] - focal) < 0.00001);
  for (const [distance, expected] of [
    [camera.near, 0],
    [camera.far, 1],
  ]) {
    // Fixture camera has an identity rotation at [0,0,8]. Recompute clip
    // depths from the actual WORLD->clip matrix, not from a predicted frame.
    const z = 8 - distance;
    const ndc = (matrix[10] * z + matrix[14]) / (matrix[11] * z + matrix[15]);
    assert.ok(Number.isFinite(ndc) && Math.abs(ndc - expected) < 0.00002);
  }
}
await writeImmutable(
  resolve(output, "camera-host-review.json"),
  JSON.stringify({
    schema: "aperture.native-camera-projection.host-review.v1",
    status: "passed",
    provenanceSha256: expectedSha256,
    scope:
      "Unscored API diagnostic; three actual frames, full PNG ACK hashes and independently recomputed clip depths",
    snapshotFrames: [0, 1, 2],
    nativeFrames: status.frames.map((frame) => ({
      nativeDrawCalls: frame.nativeDrawCalls,
      nativeSubmissions: frame.nativeSubmissions,
    })),
    captures: status.captures,
    diagnosticCodes: [
      "aperture.camera.projection.invalidPayload",
      "aperture.camera.projection.precisionLoss",
    ],
  }) + "\n",
);
console.log(JSON.stringify({ status: "passed", output }));
