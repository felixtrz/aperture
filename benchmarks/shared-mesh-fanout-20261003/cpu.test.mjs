/** Real ECS/compiled algorithm CPU checks; synthetic native records are explicitly separate. */
import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { apertureSystem, repo } from "./cpu-loader.mjs";
import { SESSION_IDS, statesFor, BUDGETS, PIPE_PARTS } from "./contract.mjs";
import {
  validateFanoutGeometry,
  validateFanoutTransition,
  validateMirrorAndSnapshot,
  validateSubmittedFanout,
} from "./fanout-checks.mjs";
import { jsonValue, nativeMeshEvidence } from "./author-a/native-evidence.mjs";
import { compactNativeScope } from "./native-observer.mjs";
import { SHADOW_CASTER_DEPTH_ONLY_WGSL } from "./shader-contract.mjs";
const load = (p) => import(pathToFileURL(resolve(repo, p)).href),
  clone = (v) => structuredClone(v);
const comparable = (e) =>
  e.nativeGeometry.meshes.map((m) => ({
    name: m.name,
    streams: m.streams,
    worldMatrix: m.worldMatrix,
    submeshes: m.submeshes,
  }));
export const saved = new Map();
const summary = {
  kind: "CPU-only exploratory fixture validation; not native GPU proof",
  sessions: [],
  negativeControls: [],
  browsersLaunched: 0,
  serversStarted: 0,
};
test("exact seven-session fourteen-state bounded contract", () => {
  assert.equal(SESSION_IDS.length, 7);
  assert.equal(
    SESSION_IDS.reduce((n, s) => n + statesFor(s).length, 0),
    14,
  );
  assert.equal(BUDGETS.totalStates, 14);
  assert.throws(() => statesFor("fresh-all"));
});
test("all real ECS instances share explicit handles; once-per-handle cardinality changes and byte-exact resets", async () => {
  const { createApertureApp, disposeApertureApp } = await load(
    "packages/app/dist/advanced.js",
  );
  const first = new Map();
  const mirror = await load("packages/app/dist/asset-mirror.js"),
    simulation = await load("packages/simulation/dist/index.js");
  for (const session of SESSION_IDS) {
    const { system, scene } = await apertureSystem(session);
    let app;
    try {
      app = await createApertureApp({
        config: scene.CONFIG,
        systems: [{ default: system.CraneCourtyard }],
      });
      let previous;
      const mirroredRegistry = new simulation.AssetRegistry(),
        serializationState = mirror.createSourceAssetSerializationState();
      for (const state of statesFor(session)) {
        app.context.commands.queue(system.LIVE_CHANNEL, {
          id: state.id,
          index: state.index,
          revision: state.index + 1,
        });
        app.step(1 / 60, (state.index + 1) / 60);
        const snapshot = app.extract(state.index + 1),
          raw = system.sceneOwner.evidenceAtNativePublication(
            snapshot.frame,
            snapshot,
          ),
          e = jsonValue({ ...raw, resources: { worker: raw.resources } });
        assert(e.nativeChecks.ok);
        validateFanoutGeometry(e, state);
        validateFanoutTransition(e, state, previous);
        previous = e;
        e.nativeGeometry.actualSubmittedSnapshot = jsonValue(snapshot);
        const serialized = mirror.serializeSourceAssetRegistry(
          system.sceneOwner.assetsRegistry,
          { state: serializationState },
        );
        const transferred = structuredClone(serialized);
        const mirrorReport = mirror.mirrorSourceAssetRegistryFromMessage(
          mirroredRegistry,
          { sourceAssets: transferred },
        );
        mirror.commitSerializedSourceAssets(serializationState, serialized);
        if (state.noop) assert.equal(mirrorReport.mirrored, 0);
        e.nativeGeometry.mirroredAssets = [
          ...new Set(e.nativeGeometry.meshes.map((m) => m.meshId)),
        ].map((meshId) => {
          const entry = mirroredRegistry.get(
            simulation.createMeshHandle(meshId),
          );
          return nativeMeshEvidence(meshId, entry.asset, [], {
            meshId,
            assetVersion: entry.version,
            assetLabel: entry.asset.label,
          });
        });
        validateMirrorAndSnapshot(e, { nativeFrame: snapshot.frame });
        if (first.has(state.edit))
          assert.deepEqual(comparable(e), first.get(state.edit));
        else first.set(state.edit, comparable(e));
        saved.set(`${session}:${state.index}`, e);
        summary.sessions.push({
          session,
          state: state.id,
          shared: e.shared,
          entityCount: e.identity.entityCount,
          uniqueMeshHandles: e.resources.worker.currentMeshAssets,
          publications: e.resources.worker.meshAssetReplacements,
          actualMirrorEntriesUpdated: mirrorReport.mirrored,
          versions: e.nativeGeometry.meshes
            .filter((m) => m.instance !== null)
            .map((m) => m.assetVersion),
        });
      }
    } finally {
      if (app) await disposeApertureApp(app);
    }
  }
  assert.equal(saved.size, 14);
  assert.equal(saved.get("live:7").resources.worker.meshAssetReplacements, 15);
});
test("actual installed packing and coalescing algorithms activate for all three shared groups", async () => {
  const render = await load("packages/render/dist/index.js"),
    packing = await load(
      "packages/webgpu/dist/render/frame/draw-order-transform-packing.js",
    ),
    lists = await load(
      "packages/webgpu/dist/render/passes/render-pass-draw-list.js",
    );
  for (const session of ["shared-baseline", "unshared-baseline"]) {
    const e = saved.get(session + ":0"),
      snapshot = e.nativeGeometry.actualSubmittedSnapshot,
      transforms = render.packSnapshotTransforms(snapshot);
    const ready = snapshot.meshDraws.map((packet) => ({
      renderId: packet.renderId,
      packet,
      batchKey: packet.batchKey,
      meshResourceKey: "prepared-mesh:mesh:" + packet.mesh.id,
      materialResourceKey: "material:" + packet.material.id,
    }));
    const packages = render.planRenderWorldDrawPackages(
        { ready, blocked: [] },
        transforms,
      ),
      pipelineKeys = [...new Set(ready.map((p) => p.batchKey.pipelineKey))],
      pipelines = pipelineKeys.map((key) => ({
        ok: true,
        key,
        pipeline: {
          getBindGroupLayout(group) {
            return { group };
          },
        },
      })),
      writes = [];
    const device = {
      createBuffer(d) {
        return { size: d.size, label: d.label, destroy() {} };
      },
      queue: {
        writeBuffer(buffer, offset, data, start = 0, size) {
          const bytes = ArrayBuffer.isView(data)
            ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
            : new Uint8Array(data);
          writes.push({
            buffer,
            bytes: bytes.slice(start, start + (size ?? bytes.length)),
          });
        },
      },
      createBindGroup(d) {
        return { descriptor: d };
      },
    };
    const baseGroups = [0, 1, 3].map((group) => ({
      group,
      resourceKey: "group" + group,
      entryResourceKeys: [],
    }));
    for (const material of new Set(ready.map((r) => r.materialResourceKey)))
      baseGroups.push({
        group: 2,
        resourceKey: material,
        entryResourceKeys: [material],
      });
    const scratch = packing.createDrawOrderTransformPackingScratch(),
      packed = packing.prepareDrawOrderTransformPacking({
        device,
        packages,
        transforms,
        pipelines,
        bindGroups: baseGroups,
        cache: packing.createDrawOrderTransformBufferCache(),
        scratch,
      });
    if (!e.shared) {
      assert.equal(packed, null);
      continue;
    }
    assert(packed);
    assert.equal(scratch.selected.length, 9);
    const descriptors = packages.packages.map((p) => ({
      renderId: p.renderId,
      pipelineKey: p.batchKey.pipelineKey,
      requiredBindGroupGroups: [0, 1, 2, 3],
      meshResourceKey: p.meshResourceKey,
      materialResourceKey: p.materialResourceKey,
      vertexBufferKeys: [p.meshResourceKey + "/vertex"],
      vertexCount: p.packet.vertexCount,
      vertexStart: 0,
      indexBufferKey: null,
      indexCount: null,
      indexStart: null,
      transformPackedOffset: p.transformPackedOffset,
      worldTransformResourceKey: packed.worldTransformResourceKeyByRenderId.get(
        p.renderId,
      ),
    }));
    const plan = lists.writeRenderPassDrawList(
      { drawCommands: descriptors, pipelines, bindGroups: packed.bindGroups },
      lists.createRenderPassDrawListScratch(),
    );
    assert(plan.valid);
    const pipe = plan.draws.filter((d) =>
      d.meshResourceKey.includes("pipe.hollow-elbow"),
    );
    assert.equal(pipe.length, 3);
    assert(pipe.every((d) => d.instanceCount === 3));
    for (const offset of scratch.offsets) {
      const source = snapshot.meshDraws.find(
        (p) => p.renderId === offset.renderId,
      );
      assert.deepEqual(
        [...scratch.data.slice(offset.packedOffset, offset.packedOffset + 16)],
        snapshot.transforms.slice(
          source.worldTransformOffset,
          source.worldTransformOffset + 16,
        ),
      );
    }
    summary.eligibility = {
      actualCompiledPacking: true,
      actualCompiledDrawList: true,
      coalescedRuns: pipe.map((d) => ({
        mesh: d.meshResourceKey,
        instances: d.instanceCount,
        packedOffset: d.transformPackedOffset,
      })),
      unsharedPacked: false,
      nativeActivation: "unrun",
    };
  }
});
function synthetic(e) {
  e = clone(e);
  const frame = e.nativeGeometry.actualSubmittedSnapshot.frame,
    commands = [{ id: 1, encoderId: 2, submissionSerial: 1 }],
    draws = [],
    shadow = [];
  let id = 10;
  for (const members of Map.groupBy(
    e.nativeGeometry.meshes,
    (m) => m.meshId,
  ).values()) {
    const mesh = members[0],
      vertices = [],
      uploads = [];
    for (const s of mesh.streams) {
      const b = {
        id: id++,
        label: `${mesh.assetLabel}/vertex:${s.id}`,
        allocationBytes: s.byteLength + 256,
        offset: 0,
        size: s.byteLength + 256,
        slot: 0,
      };
      vertices.push(b);
      uploads.push({
        ...b,
        writeCalls: 1,
        destroyed: false,
        fullUploadBytes: [...s.rawBytes, ...new Array(256).fill(0)],
        writtenRanges: [[0, s.byteLength]],
      });
    }
    const matrix = new Float32Array(members.flatMap((m) => m.worldMatrix)),
      raw = Array.from(new Uint8Array(matrix.buffer)),
      b = {
        id: id++,
        label: "matrix",
        allocationBytes: raw.length,
        offset: 0,
        size: raw.length,
      };
    uploads.push({
      ...b,
      writeCalls: 1,
      destroyed: false,
      fullUploadBytes: raw,
      writtenRanges: [[0, raw.length]],
    });
    const common = {
      method: "draw",
      count: mesh.positions.length / 3,
      start: 0,
      instances: members.length,
      firstInstance: 0,
      vertices,
      index: null,
      uploads,
      commandBufferId: 1,
      commandEncoderId: 2,
      submissionSerial: 1,
      submittedFrame: frame,
      sampledTextureVersions: [{ textureId: 900, contentRevision: 1 }],
    };
    draws.push({
      ...common,
      groups: [
        { index: 1, dynamicOffsets: [], entries: [{ binding: 0, buffer: b }] },
        {
          index: 3,
          dynamicOffsets: [],
          entries: [{ binding: 3, texture: { textureId: 900 } }],
        },
      ],
      pipeline: {
        id: 101,
        targets: [{ format: "rgba16float" }],
        vertex: {
          code: "@group(1) @binding(0) var<storage, read> worldTransforms: array<mat4x4<f32>>;",
        },
      },
      pass: { colors: [{}], depth: { view: { textureId: 901 } } },
    });
    shadow.push({
      ...common,
      groups: [
        { index: 0, dynamicOffsets: [], entries: [{ binding: 1, buffer: b }] },
      ],
      pipeline: {
        id: 102,
        targets: [],
        vertex: { code: SHADOW_CASTER_DEPTH_ONLY_WGSL },
      },
      pass: { colors: [], depth: { view: { textureId: 900 } } },
    });
  }
  e.nativeGeometry.submittedDraws = {
    frame,
    submissions: 1,
    commands,
    draws: [...draws, ...shadow],
    textureInvalidations: [],
    shadowHistory: [
      {
        textureId: 900,
        contentRevision: 1,
        frame,
        submissionSerial: 1,
        commands,
        draws: shadow,
      },
    ],
  };
  e.nativeSubmission = {
    nativeFrameReport: {
      shadow: {
        ready: true,
        shadowKind: "directional",
        requestCount: 1,
        requestCoverage: { omittedCount: 0 },
      },
    },
  };
  return e;
}
test("fail-closed controls cover missing/stale second and third instances and per-entity publications", () => {
  const good = saved.get("live:2");
  for (const [name, fn] of [
    ["missing-second", (e) => e.nativeGeometry.meshes.splice(1, 1)],
    ["missing-third", (e) => e.nativeGeometry.meshes.splice(2, 1)],
    ["stale-second", (e) => e.nativeGeometry.meshes[1].assetVersion--],
    ["stale-third", (e) => e.nativeGeometry.meshes[2].assetVersion--],
    [
      "duplicate-publication",
      (e) =>
        e.resources.worker.publications.push(
          clone(e.resources.worker.publications[0]),
        ),
    ],
    [
      "wrong-transform",
      (e) => (e.nativeGeometry.meshes[2].worldMatrix[12] = 0),
    ],
    [
      "stale-range",
      (e) => (e.nativeGeometry.meshes[1].submeshes[0].vertexCount = 3),
    ],
  ]) {
    const e = clone(good);
    fn(e);
    assert.throws(
      () => validateFanoutGeometry(e, statesFor()[2]),
      undefined,
      name,
    );
    summary.negativeControls.push(name);
  }
  for (const [name, fn] of [
    [
      "missing-snapshot-second",
      (e) => e.nativeGeometry.actualSubmittedSnapshot.meshDraws.splice(1, 1),
    ],
    [
      "stale-snapshot-third",
      (e) =>
        (e.nativeGeometry.actualSubmittedSnapshot.meshDraws[2].vertexCount = 3),
    ],
    [
      "stale-mirror-version",
      (e) => e.nativeGeometry.mirroredAssets[0].assetVersion--,
    ],
    [
      "stale-mirror-bytes",
      (e) => (e.nativeGeometry.mirroredAssets[0].streams[0].rawBytes[0] ^= 1),
    ],
  ]) {
    const e = clone(good);
    fn(e);
    assert.throws(
      () => validateMirrorAndSnapshot(e, { nativeFrame: 3 }),
      undefined,
      name,
    );
    summary.negativeControls.push(name);
  }
});
test("synthetic native joins reject wrong ranges, packed offsets, exact buffer objects and orphan commands", () => {
  const good = synthetic(saved.get("live:2")),
    receipt = { nativeFrame: 3 };
  const compact = (e) => {
    e = clone(e);
    e.nativeGeometry.submittedDraws = compactNativeScope(
      e.nativeGeometry.submittedDraws,
    );
    return e;
  };
  assert(validateSubmittedFanout(compact(good), receipt));
  const mutations = [
    [
      "old-shadow-after-clear-only",
      (s) =>
        s.textureInvalidations.push({
          textureId: 900,
          contentRevision: 2,
          reason: "clear-only depth pass",
        }),
    ],
    [
      "wrong-sampled-shadow-content",
      (s) => (s.draws[0].sampledTextureVersions[0].contentRevision = 0),
    ],
    ["not-submitted", (s) => (s.submissions = 0)],
    ["orphan-command", (s) => (s.commands[0].id = 99)],
    ["wrong-count", (s) => (s.draws[0].count = 3)],
    ["wrong-start", (s) => (s.draws[0].start = 3)],
    ["wrong-first-instance", (s) => (s.draws[0].firstInstance = 1)],
    ["missing-second-instance", (s) => (s.draws[0].instances = 2)],
    ["missing-third-instance", (s) => (s.draws[0].instances = 1)],
    ["wrong-exact-vertex-buffer", (s) => (s.draws[0].vertices[0].id = 999)],
    [
      "wrong-exact-transform-buffer",
      (s) => (s.draws[0].groups[0].entries[0].buffer.id = 999),
    ],
    ["wrong-bound-range", (s) => (s.draws[0].vertices[0].size = 4)],
    ["wrong-bound-offset", (s) => (s.draws[0].vertices[0].offset = 4)],
    [
      "unwritten-active-bytes",
      (s) => (s.draws[0].uploads[0].writtenRanges = []),
    ],
    ["stale-upload", (s) => (s.draws[0].uploads[0].fullUploadBytes[0] ^= 1)],
    [
      "guessed-pass-label",
      (s) => (s.draws[0].pass = { label: "main", colors: [], depth: null }),
    ],
    ["wrong-shadow-texture", (s) => (s.shadowHistory[0].textureId = 999)],
  ];
  for (const [name, fn] of mutations) {
    const e = clone(good);
    fn(e.nativeGeometry.submittedDraws);
    assert.throws(
      () => validateSubmittedFanout(compact(e), receipt),
      undefined,
      name,
    );
    summary.negativeControls.push(name);
  }
  summary.syntheticCaptureBytes = Buffer.byteLength(
    JSON.stringify(compact(good)),
  );
  assert(summary.syntheticCaptureBytes < 16 * 1024 * 1024);
  const cached = clone(good);
  cached.nativeGeometry.submittedDraws.draws =
    cached.nativeGeometry.submittedDraws.draws.filter(
      (d) => d.pass.colors.length,
    );
  assert.equal(
    validateSubmittedFanout(compact(cached), receipt).shadow.reused,
    true,
  );
});
test("source-pinned shadow classifier equals installed built-in shader", async () => {
  const shader = await load(
    "packages/webgpu/dist/shadows/shadow-caster-pipeline-resource.js",
  );
  assert.equal(
    shader.SHADOW_CASTER_DEPTH_ONLY_WGSL,
    SHADOW_CASTER_DEPTH_ONLY_WGSL,
  );
});
test("bounded serialized synthetic capture estimates retain sixteen MiB recorder gate", () => {
  const rows = [];
  for (const session of ["shared-grow", "unshared-grow"]) {
    const e = synthetic(saved.get(session + ":0"));
    e.nativeGeometry.submittedDraws = compactNativeScope(
      e.nativeGeometry.submittedDraws,
    );
    const bytes = Buffer.byteLength(JSON.stringify(e));
    const metadataReserve = 2 * 1024 * 1024;
    assert(bytes + metadataReserve < 16 * 1024 * 1024);
    rows.push({
      session,
      syntheticEvidenceBytes: bytes,
      metadataReserveBytes: metadataReserve,
      maximumRecordBytes: 16 * 1024 * 1024,
    });
  }
  summary.sizeEstimates = {
    rows,
    limitation:
      "CPU synthetic geometry/byte inventories plus conservative metadata reserve; actual native record remains independently bounded and must fail rather than exceed the unchanged gate.",
  };
});
test.after(() => console.log("FANOUT_CPU_SUMMARY " + JSON.stringify(summary)));
