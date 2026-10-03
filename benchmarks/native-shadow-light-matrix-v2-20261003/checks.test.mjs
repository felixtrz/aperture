import test from "node:test";
import assert from "node:assert/strict";
import { validateRecord, PIPELINES } from "./checks.mjs";
import { selection } from "./run.mjs";
import {
  nativeArrayEvidence,
  nativeEvidenceBytes,
  nativeMeshEvidence,
} from "../crane-live-edits-20261003/author-a/post-author-byte-diagnostic/native-evidence.mjs";
import { compareNativeUploadBytes } from "../crane-live-edits-20261003/author-a/post-author-byte-diagnostic/gpu-observer.mjs";
import { casterAsset, MODES, STATES } from "./fixture.mjs";

const clone = (value) => JSON.parse(JSON.stringify(value));
function record(mode = "directional", index = 0) {
  const state = STATES[index],
    frame = index + 1;
  return {
    mode,
    state,
    frame,
    assetVersion: state.version,
    identity: {
      entityActive: true,
      entityCount: 5,
      meshId: "fixture",
      entityId: "1:0",
    },
    snapshot: {
      frame,
      meshDraws: [],
      shadowCasterDraws: [],
      lights: [],
      shadowRequests: [],
      bounds: [],
      transforms: [],
      views: [],
      viewMatrices: [],
    },
    report: {
      ok: true,
      frame,
      counts: { drawCalls: 2 },
      shadow: {
        ready: true,
        requestCoverage: { requestedCount: 1, servedCount: 1, omittedCount: 0 },
        casterCounts: { submittedDrawCalls: state.reuse ? 0 : 1 },
      },
      resourceReuse: {
        autoShadowFramesReused: state.reuse ? 1 : 0,
        autoShadowFramesCreated: state.reuse ? 0 : 1,
        autoShadowFrameCache: {
          pipelineKind: PIPELINES[mode],
          firstChangedInputSection: "caster-mesh-assets",
        },
      },
    },
    proof: {
      native: true,
      webglAttempts: 0,
      submissions: frame,
      draws: 3,
      errors: [],
      deviceLost: [],
      devices: [{}],
      canvasWebGPU: 1,
      adapters: [{ architecture: "swiftshader" }],
    },
    gpu: { checks: [{ ok: true }, { ok: true }] },
  };
}
test("all four modes validate each bounded live state; these are synthetic validator fixtures", () => {
  for (const mode of MODES) {
    let previous = null;
    for (const [index, state] of STATES.entries()) {
      const value = record(mode, index);
      assert.equal(validateRecord(value, state, previous), true);
      previous = value;
    }
  }
});
test("native proof, revisions, pipeline, shadow cache and frozen inputs fail closed", () => {
  const changes = [
    (r) => (r.report.ok = false),
    (r) => r.report.frame++,
    (r) => r.snapshot.frame++,
    (r) => r.assetVersion++,
    (r) => (r.identity.meshId = "other"),
    (r) => r.identity.entityCount++,
    (r) => (r.proof.native = false),
    (r) => r.proof.webglAttempts++,
    (r) => r.proof.errors.push("bad"),
    (r) => r.proof.deviceLost.push("bad"),
    (r) => (r.proof.submissions = 1),
    (r) => r.proof.devices.push({}),
    (r) => (r.gpu.checks[0].ok = false),
    (r) => (r.report.shadow.ready = false),
    (r) => r.report.shadow.requestCoverage.omittedCount++,
    (r) => (r.report.shadow.casterCounts.submittedDrawCalls = 0),
    (r) => (r.report.resourceReuse.autoShadowFramesReused = 1),
    (r) => (r.report.resourceReuse.autoShadowFrameCache.pipelineKind = "spot"),
    (r) =>
      (r.report.resourceReuse.autoShadowFrameCache.firstChangedInputSection =
        "bounds"),
    (r) => r.snapshot.bounds.push("moved"),
  ];
  for (const mutate of changes) {
    const value = record("directional", 2);
    mutate(value);
    assert.throws(() =>
      validateRecord(value, STATES[2], record("directional", 1)),
    );
  }
});
test("fresh controls cannot inherit live revisions or cache reuse", () => {
  for (const mode of MODES)
    for (const shape of ["baseline", "vertices", "indices"]) {
      const [state] = selection(mode, `fresh-${shape}`, "attempt-001");
      const value = record(mode);
      value.state = state;
      assert.equal(validateRecord(value, state), true);
      value.report.resourceReuse.autoShadowFramesReused = 1;
      assert.throws(() => validateRecord(value, state));
    }
  for (const bad of [
    ["mixed", "live", "attempt-001"],
    ["point", "unknown", "attempt-001"],
    ["point", "live", "../attempt-001"],
  ])
    assert.throws(() => selection(...bad));
});
test("native caster bytes preserve signed zeros and index types through JSON", () => {
  for (const shape of ["baseline", "vertices", "indices"]) {
    const asset = casterAsset(shape),
      evidence = clone(nativeMeshEvidence("matrix-caster", asset, []));
    for (const [view, captured] of [
      [asset.vertexStreams[0].data, evidence.streams[0]],
      [asset.indexBuffer.data, evidence.indexBuffer],
    ]) {
      const bytes = new Uint8Array(
        view.buffer,
        view.byteOffset,
        view.byteLength,
      );
      assert.deepEqual(nativeEvidenceBytes(captured), bytes);
      assert.equal(compareNativeUploadBytes(bytes, captured).ok, true);
      const corrupt = bytes.slice();
      corrupt[0] ^= 1;
      assert.equal(compareNativeUploadBytes(corrupt, captured).ok, false);
    }
  }
  const backing = new Float32Array([99, -0, 0, 4, 99]),
    view = backing.subarray(1, 4),
    evidence = clone(nativeArrayEvidence(view));
  assert.equal(evidence.dataByteOffset, 4);
  assert.equal(
    compareNativeUploadBytes(
      new Uint8Array(view.buffer, view.byteOffset, view.byteLength),
      evidence,
    ).ok,
    true,
  );
  assert.equal(
    compareNativeUploadBytes(
      new Uint8Array(new Float32Array(evidence.data).buffer),
      evidence,
    ).ok,
    false,
  );
});

// Authentic failed native attempt: no-op extraction reordered object properties.
import { readFileSync } from "node:fs";
import { sameStructure } from "./checks.mjs";
const captured = id => JSON.parse(readFileSync(new URL(`../native-shadow-light-matrix-20261003/renders/directional/live/attempt-001/${id}.json`, import.meta.url)));
test("authentic native no-op accepts property order but every field remains checked", () => {
  const baseline = captured("baseline"), noop = captured("noop");
  assert.notEqual(JSON.stringify(baseline.snapshot.meshDraws), JSON.stringify(noop.snapshot.meshDraws));
  assert.doesNotThrow(() => validateRecord(noop, noop.state, baseline));
  for (const key of ["meshDraws", "shadowCasterDraws", "lights", "shadowRequests", "bounds", "transforms", "views", "viewMatrices"]) {
    const changed = clone(noop);
    changed.snapshot[key] = [...changed.snapshot[key], "unexpected"];
    assert.throws(() => validateRecord(changed, changed.state, baseline), /Frozen snapshot input changed/);
  }
  const changed = clone(noop); changed.snapshot.meshDraws[0].indexCount++;
  assert.throws(() => validateRecord(changed, changed.state, baseline), /meshDraws/);
});
test("structural comparison preserves types, keys, values and array order", () => {
  assert.ok(sameStructure({a:{x:1,y:2},b:[1,2]}, {b:[1,2],a:{y:2,x:1}}));
  for (const [a,b] of [[{a:1},{a:2}],[{a:1},{b:1}],[[1,2],[2,1]],[[1],{0:1}],[[1],[1,2]],[{a:null},{a:0}],[{a:1},{a:"1"}],[{a:1},{a:1,b:2}]]) assert.equal(sameStructure(a,b),false);
});
