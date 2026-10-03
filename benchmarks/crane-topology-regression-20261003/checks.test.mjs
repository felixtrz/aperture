import test from "node:test";
import assert from "node:assert/strict";
import {
  inspectFrameCorrespondence,
  inspectConsumedSnapshot,
} from "./author-a/frame-proof.mjs";
import { nativeArrayEvidence } from "./author-a/native-evidence.mjs";
import { compareNativeUploadBytes } from "./author-a/gpu-observer.mjs";
import {
  validateTransition,
  validateRawEvidence,
  validateTransport,
} from "./harness/checks.mjs";
import { statesFor } from "./contract.mjs";
const state = statesFor()[0],
  clone = structuredClone;
function fixture() {
  return {
    frame: {
      frame: 8,
      ok: true,
      counts: { drawCalls: 1 },
      renderTargets: [
        {
          source: "swapchain",
          ok: true,
          drawCalls: 1,
          width: 1024,
          height: 1024,
        },
      ],
    },
    snapshot: { frame: 8 },
  };
}
const publication = () =>
  new Map([
    [
      8,
      {
        stateId: state.id,
        revision: 1,
        snapshotFrame: 8,
        snapshotFrameField: 8,
      },
    ],
  ]);
test("frame gates reject every absent/wrong publication or completion boundary", () => {
  assert(inspectFrameCorrespondence(state, publication(), fixture()).ok);
  assert(!inspectFrameCorrespondence(state, new Map(), fixture()).ok);
  assert(!inspectFrameCorrespondence(state, publication(), null).ok);
  for (const change of [
    (p) => p.get(8).revision++,
    (p) => (p.get(8).stateId = "wrong"),
    (p) => p.get(8).snapshotFrame++,
    (p) => p.get(8).snapshotFrameField++,
  ]) {
    const p = publication();
    change(p);
    assert(!inspectFrameCorrespondence(state, p, fixture()).ok);
  }
  for (const change of [
    (c) => c.snapshot.frame++,
    (c) => c.frame.frame++,
    (c) => (c.frame.ok = false),
    (c) => (c.frame.counts.drawCalls = 0),
    (c) => (c.frame.renderTargets = []),
  ]) {
    const c = fixture();
    change(c);
    assert(!inspectFrameCorrespondence(state, publication(), c).ok);
  }
});
test("consumed native identity/matrix gates reject missing entity, handle and transforms", () => {
  const matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    meshes = [{ name: "m", entityId: "2:1", meshId: 3, worldMatrix: matrix }];
  const snapshot = {
    meshDraws: [
      {
        entity: { index: 2, generation: 1 },
        mesh: { id: 3 },
        worldTransformOffset: 0,
      },
    ],
    transforms: matrix,
  };
  assert(inspectConsumedSnapshot(meshes, snapshot).every((c) => c.ok));
  for (const change of [
    (s) => (s.meshDraws = []),
    (s) => s.meshDraws[0].mesh.id++,
    (s) => (s.transforms[12] = 1),
  ]) {
    const s = clone(snapshot);
    change(s);
    assert(inspectConsumedSnapshot(meshes, s).some((c) => !c.ok));
  }
});
test("raw signed zero survives JSON; numerically identical corrupt bytes fail", () => {
  const values = new Float32Array([-0, 0, 1]);
  const native = JSON.parse(JSON.stringify(nativeArrayEvidence(values)));
  const bytes = new Uint8Array(values.buffer).slice();
  assert(compareNativeUploadBytes(bytes, native).ok);
  bytes[3] ^= 128;
  assert(!compareNativeUploadBytes(bytes, native).ok);
  delete native.rawBytes;
  assert(!compareNativeUploadBytes(bytes, native).ok);
});
test("three.js native readback bytes require source raw stream equality", () => {
  const evidence = {
    sourceGeometry: {
      meshes: [
        {
          name: "m",
          rawStreams: [
            { semantic: "positions", rawBytes: [0, 0, 0, 128] },
            { semantic: "indices", rawBytes: [0, 0, 0, 0] },
          ],
        },
      ],
    },
    nativeGeometry: {
      meshes: [
        {
          name: "m",
          streams: [
            { semantic: "position", rawBytes: [0, 0, 0, 128], byteLength: 4 },
            { semantic: "index", rawBytes: [0, 0, 0, 0], byteLength: 4 },
          ],
        },
      ],
    },
  };
  validateRawEvidence(evidence, "threejs");
  const bad = clone(evidence);
  bad.nativeGeometry.meshes[0].streams[0].rawBytes[3] = 0;
  assert.throws(() => validateRawEvidence(bad, "threejs"), /bytes differ/);
  delete bad.sourceGeometry.meshes[0].rawStreams;
  assert.throws(() => validateRawEvidence(bad, "threejs"), /Missing raw/);
});
test("no-op rejects geometry drift, publication and nonmonotonic revisions", () => {
  const resources = {
    worker: {
      meshAssetReplacements: 0,
      publishedVertexArrayReplacements: 0,
      publishedIndexArrayReplacements: 0,
      entityCreateCalls: 65,
      entityDestroyCalls: 0,
      changedMeshes: [],
    },
  };
  const prior = {
    revision: 1,
    resources,
    nativeGeometry: {
      meshes: [
        {
          name: "m",
          positions: [0, 0, 0],
          indices: [],
          worldMatrix: [],
          streams: [],
        },
      ],
    },
  };
  const next = clone(prior);
  next.revision = 2;
  validateTransition(next, statesFor()[1], prior, "aperture");
  for (const change of [
    (x) => x.revision++,
    (x) => (x.nativeGeometry.meshes[0].positions[0] = 1),
    (x) => x.resources.worker.meshAssetReplacements++,
    (x) => x.resources.worker.changedMeshes.push({ name: "m" }),
  ]) {
    const bad = clone(next);
    change(bad);
    assert.throws(() =>
      validateTransition(bad, statesFor()[1], prior, "aperture"),
    );
  }
  assert.throws(
    () => validateTransition(next, statesFor()[2], prior, "aperture"),
    /changed no native geometry/,
  );
});

test("missing or fallback shared transport fails closed", () => {
  const valid = {
    active: "shared-array-buffer",
    fallback: null,
    sharedArrayBuffer: { supported: true },
  };
  validateTransport(valid);
  for (const bad of [
    null,
    {},
    { ...valid, active: "transfer" },
    { ...valid, fallback: "transfer" },
    { ...valid, sharedArrayBuffer: { supported: false } },
  ])
    assert.throws(() => validateTransport(bad), /Fallback/);
});
