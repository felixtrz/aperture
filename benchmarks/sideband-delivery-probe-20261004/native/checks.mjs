import assert from "node:assert/strict";
import { expandNativeScope } from "../../indexed-shared-mesh-fanout-20261004/native-observer.mjs";
import { verifyNativeProof } from "../../indexed-shared-mesh-fanout-20261004/harness/base-checks.mjs";
import { SCHEMA, statesFor } from "./contract.mjs";
export function validateState(record, session, id) {
  const expected = statesFor(session).find((state) => state.id === id);
  assert(expected, "Unknown capture state");
  assert.equal(record.schema, SCHEMA);
  assert.equal(record.session, session);
  assert.equal(record.id, id);
  assert.deepEqual(record.expected, expected);
  for (const frame of [
    record.frame,
    record.snapshot.frame,
    record.report.frame,
    record.native.frame,
  ])
    assert.equal(frame, expected.frame, "Consumed frame");
  assert.equal(record.report.ok, true);
  assert.equal(record.mirrorVersion, expected.mirrorVersion);
  assert.equal(record.snapshotNotifications, 1);
  assert.equal(record.snapshot.meshDraws.length, 1);
  assert.deepEqual(
    record.snapshot.meshDraws[0].mesh,
    record.sourceAtRender.mesh,
  );
  assert.deepEqual(
    record.mirroredAsset,
    record.sourceAtRender.expected[expected.geometry],
    "Actual mirror/source byte identity",
  );
  assert.equal(record.capture.gpuFenceCompleted, true);
  assert.equal(record.capture.presentationFrames, 2);
  assert.equal(record.capture.width, 1024);
  assert.equal(record.capture.height, 1024);
  verifyNativeProof(record.proof);
  assert.equal(record.proof.canvasWebGPU, 1);
  const snapshots = record.messages.filter(
    (message) => message.type === "aperture.simulation.snapshot",
  );
  const sidebands = record.messages.filter(
    (message) => message.type === "aperture.simulation.sourceAssets",
  );
  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0].frame, session === "cold-changed" ? 2 : 1);
  const needsSideband =
    (session === "before-poll" && id === "changed") || id === "converged";
  assert.equal(sidebands.length, needsSideband ? 1 : 0);
  if (needsSideband) {
    assert.equal(sidebands[0].frame, 2);
    assert.equal(sidebands[0].versions.length, 1);
    assert.equal(sidebands[0].versions[0].version, 2);
  }
  const scope = expandNativeScope(record.native);
  assert.equal(scope.draws.length, 1);
  assert(scope.submissions > 0);
  const draw = scope.draws[0];
  assert.equal(draw.method, "drawIndexed");
  assert.equal(draw.count, 36);
  assert.equal(draw.instances, 1);
  assert.equal(draw.start, 0);
  assert.equal(draw.baseVertex, 0);
  assert.equal(draw.firstInstance, 0);
  assert.equal(draw.submittedFrame, expected.frame);
  assert(
    scope.commands.some(
      (command) =>
        command.id === draw.commandBufferId &&
        command.encoderId === draw.commandEncoderId &&
        command.submissionSerial === draw.submissionSerial,
    ),
    "Actual submission join",
  );
  assert(
    draw.pass.colors.length === 1 &&
      draw.pass.depth &&
      draw.pipeline.targets.length === 1 &&
      /worldTransforms/.test(draw.pipeline.vertex.code),
    "Actual color pipeline",
  );
  const upload = (binding, size) => {
    const matches = draw.uploads.filter(
      (value) =>
        value.id === binding.id &&
        value.submissionSerial === draw.submissionSerial,
    );
    assert.equal(matches.length, 1, "Unambiguous upload object");
    const value = matches[0];
    assert(
      !value.destroyed && value.contentVersion > 0 && value.writeCalls > 0,
    );
    assert(
      value.writtenRanges.some(
        ([a, b]) => a <= binding.offset && b >= binding.offset + size,
      ),
      "Initialized bound bytes",
    );
    assert(
      !value.uncertainRanges.some(
        ([a, b]) => a < binding.offset + size && b > binding.offset,
      ),
      "Uncertain upload bytes",
    );
    assert.equal(value.fullUploadBytes.length, value.allocationBytes);
    return value.fullUploadBytes.slice(binding.offset, binding.offset + size);
  };
  const vertex = draw.vertices.filter((binding) => binding.slot === 0);
  assert.equal(vertex.length, 1);
  const expectedVertex = record.mirroredAsset.vertices[0].bytes;
  assert.deepEqual(
    upload(vertex[0], expectedVertex.length),
    expectedVertex,
    "Submitted vertex bytes",
  );
  assert.equal(draw.index.format, record.mirroredAsset.index.format);
  assert.deepEqual(
    upload(draw.index, record.mirroredAsset.index.bytes.length),
    record.mirroredAsset.index.bytes,
    "Submitted index bytes",
  );
  if (id === "converged") {
    assert.equal(record.stationary.sabFrame, 2);
    assert.equal(record.stationary.mirrorVersion, 2);
    assert.deepEqual(record.stationary.renderedFrames, [1, 2]);
    assert.equal(record.stationary.rerendered, false);
    assert.equal(
      record.stationary.submissionsBefore,
      record.stationary.submissionsAfter,
    );
  }
  return {
    frame: record.frame,
    mirrorVersion: record.mirrorVersion,
    draw: { method: draw.method, count: draw.count, instances: draw.instances },
    vertexBytes: expectedVertex.length,
    indexBytes: record.mirroredAsset.index.bytes.length,
  };
}
