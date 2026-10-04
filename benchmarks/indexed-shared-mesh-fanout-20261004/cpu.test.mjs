/** Real ECS/compiled algorithm CPU checks; synthetic native records are explicitly separate. */
import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { readFile } from "node:fs/promises";
import { apertureSystem, repo } from "./cpu-loader.mjs";
import { SESSION_IDS, statesFor, BUDGETS, PIPE_PARTS } from "./contract.mjs";
import {
  validateFanoutGeometry,
  validateFanoutTransition,
  validateMirrorAndSnapshot,
  validateSubmittedFanout,
  validateNativeResources,
} from "./fanout-checks.mjs";
import { jsonValue, nativeMeshEvidence } from "./author-a/native-evidence.mjs";
import { compactNativeScope, expandNativeScope } from "./native-observer.mjs";
import { decodeSubmittedDraw } from "./indirect-evidence.mjs";
import { SHADOW_CASTER_DEPTH_ONLY_WGSL } from "./shader-contract.mjs";
const load = (p) => import(pathToFileURL(resolve(repo, p)).href),
  clone = (v) => structuredClone(v);
const comparable = (e) =>
  e.nativeGeometry.meshes.map((m) => ({
    name: m.name,
    streams: m.streams,
    worldMatrix: m.worldMatrix,
    submeshes: m.submeshes,
    indexBuffer: m.indexBuffer,
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
test("identity indexing preserves exact corner streams, normals, UVs and bounds at every topology", async () => {
  const render = await load("packages/render/dist/index.js");
  const { system, scene } = await apertureSystem("live");
  for (const edit of ["baseline", "grow", "shrink"]) {
    for (const part of scene.constructScene(edit).parts) {
      const original = render.createTriangleListMeshAsset({
        label: system.meshKeyFor(part),
        positions: part.positions,
        indices: part.indices,
      });
      const indexed = system.createPartAsset(part);
      assert.deepEqual(indexed.vertexStreams, original.vertexStreams);
      assert.deepEqual(indexed.localAabb, original.localAabb);
      assert.deepEqual(indexed.localSphere, original.localSphere);
      assert.equal(
        indexed.indexBuffer?.format,
        part.instance === null ? undefined : "uint16",
      );
      if (part.instance !== null) {
        assert(indexed.indexBuffer.data instanceof Uint16Array);
        assert.deepEqual(
          [...indexed.indexBuffer.data],
          Array.from(
            { length: original.vertexStreams[0].vertexCount },
            (_, i) => i,
          ),
        );
      }
    }
  }
  summary.identityIndexing = {
    topologies: 3,
    pipeInstancesPerState: 9,
    originalCornerStreamsExact: true,
    localBoundsExact: true,
    deduplication: false,
    memoryClaim: false,
  };
});
test("actual installed packing and coalescing algorithms activate for all three shared groups", async () => {
  const render = await load("packages/render/dist/index.js"),
    packing = await load(
      "packages/webgpu/dist/render/frame/draw-order-transform-packing.js",
    ),
    lists = await load(
      "packages/webgpu/dist/render/passes/render-pass-draw-list.js",
    );
  for (const session of SESSION_IDS.filter((s) => s !== "live")) {
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
      indexBufferKey: p.packet.indexCount ? p.meshResourceKey + "/index" : null,
      indexCount: p.packet.indexCount || null,
      indexStart: p.packet.indexCount ? p.packet.indexStart : null,
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
    // Resource objects are CPU mocks; planning, conversion and execution are the
    // actual installed algorithms operating on the actual ECS packet ranges.
    const planner = await load(
        "packages/webgpu/dist/render/passes/render-pass-commands.js",
      ),
      indirect = await load(
        "packages/webgpu/dist/render/draw/indirect-draw-commands.js",
      ),
      executor = await load(
        "packages/webgpu/dist/render/passes/render-pass-command-executor.js",
      );
    const direct = planner.planRenderPassCommands({
      draws: pipe.map((d) => ({
        ...d,
        pipeline: {},
        bindGroups: [],
        vertexBuffers: d.vertexBufferKeys.map((resourceKey) => ({
          resourceKey,
          buffer: {},
          vertexCount: d.vertexCount,
        })),
        indexBuffer: {
          resourceKey: d.indexBufferKey,
          buffer: {},
          format: "uint16",
          indexCount: d.indexCount,
        },
      })),
    });
    assert(direct.valid);
    assert.equal(direct.indexedDrawCount, 3);
    const indexedDirect = direct.commands.filter(
      (c) => c.kind === "drawIndexed",
    );
    assert.deepEqual(
      indexedDirect.map((c) => c.firstInstance),
      [0, 3, 6],
    );
    assert(
      indexedDirect.every(
        (c) =>
          c.baseVertex === 0 && c.firstIndex === 0 && c.instanceCount === 3,
      ),
    );
    writes.length = 0;
    const converted = indirect.prepareIndirectDrawCommands({
      device,
      cache: indirect.createIndirectDrawCommandCache(),
      commands: direct.commands,
      supportsIndirectFirstInstance: true,
      label: "CPU actual indexed fanout route",
    });
    const convertedDraws = converted.commands.filter(
      (c) => c.kind === "drawIndexedIndirect",
    );
    assert.equal(convertedDraws.length, 3);
    assert.deepEqual(
      convertedDraws.map((c) => c.offset),
      [0, 20, 40],
    );
    assert.equal(writes.length, 1);
    assert.equal(writes[0].bytes.length, 60);
    const view = new DataView(writes[0].bytes.buffer),
      decoded = [];
    for (let i = 0; i < 3; i++) {
      const fields = [
        view.getUint32(i * 20, true),
        view.getUint32(i * 20 + 4, true),
        view.getUint32(i * 20 + 8, true),
        view.getInt32(i * 20 + 12, true),
        view.getUint32(i * 20 + 16, true),
      ];
      assert.deepEqual(fields, [pipe[i].indexCount, 3, 0, 0, i * 3]);
      decoded.push(fields);
    }
    const calls = [];
    const execution = executor.executeRenderPassCommands({
      commands: converted.commands,
      pass: {
        setPipeline() {},
        setBindGroup() {},
        setVertexBuffer() {},
        setIndexBuffer() {},
        drawIndexedIndirect: (buffer, offset) => calls.push({ buffer, offset }),
        draw() {
          throw Error("Unexpected nonindexed pipe execution");
        },
        drawIndirect() {
          throw Error("Unexpected nonindexed indirect pipe execution");
        },
        drawIndexed() {
          throw Error("Unexpected direct indexed pipe execution");
        },
      },
    });
    assert(execution.valid);
    assert.equal(calls.length, 3);
    assert(
      calls.every(
        (c, i) => c.buffer === writes[0].buffer && c.offset === i * 20,
      ),
    );
    summary.indexedCommandChain = {
      actualCompiledPlanner: true,
      actualCompiledConverter: true,
      actualCompiledExecutor: true,
      simulatedDeviceOnly: true,
      slotBytes: 20,
      decoded,
      methods: convertedDraws.map((c) => c.kind),
      nativeExecution: false,
    };
    (summary.indexedCommandChains ??= []).push({
      session,
      ...summary.indexedCommandChain,
    });
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
  const grouped = [
    ...Map.groupBy(e.nativeGeometry.meshes, (m) => m.meshId).values(),
  ].sort(
    (a, b) =>
      Number(a[0].instance === null) - Number(b[0].instance === null) ||
      a[0].partName.localeCompare(b[0].partName),
  );
  for (const members of grouped) {
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
    const firstInstance =
      e.shared && mesh.indexed
        ? ["inner", "outer", "rims"].indexOf(mesh.partName.split(".").at(-1)) *
          3
        : 0;
    const matrix = new Float32Array([
        ...new Array(firstInstance * 16).fill(0),
        ...members.flatMap((m) => m.worldMatrix),
      ]),
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
    let index = null;
    if (mesh.indexed) {
      index = {
        id: id++,
        label: `${mesh.assetLabel}/index`,
        format: "uint16",
        offset: 0,
        size: mesh.indexBuffer.byteLength,
        allocationBytes: mesh.indexBuffer.byteLength,
      };
      uploads.push({
        ...index,
        usage: 24,
        submissionSerial: 1,
        contentVersion: 1,
        writeCalls: 1,
        destroyed: false,
        fullUploadBytes: [...mesh.indexBuffer.rawBytes],
        writtenRanges: [[0, mesh.indexBuffer.byteLength]],
        uncertainRanges: [],
      });
    }
    const common = {
      method: mesh.indexed ? "drawIndexed" : "draw",
      ...(mesh.indexed ? { baseVertex: 0 } : {}),
      count: mesh.indexed ? mesh.indices.length : mesh.positions.length / 3,
      start: 0,
      instances: members.length,
      firstInstance,
      vertices,
      index,
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
    [
      "missing-index-buffer",
      (e) => (e.nativeGeometry.meshes[1].indexBuffer = null),
    ],
    [
      "stale-index-range",
      (e) => (e.nativeGeometry.meshes[1].submeshes[0].indexCount = 3),
    ],
    [
      "stale-raw-index",
      (e) => (e.nativeGeometry.meshes[1].indexBuffer.rawBytes[0] ^= 1),
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
  const good = syntheticIndirect(saved.get("live:2")),
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
    ["wrong-count", (s) => (s.draws.find((d) => d.indirect).count = 3)],
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
function syntheticIndirect(e) {
  e = synthetic(e);
  const scope = e.nativeGeometry.submittedDraws,
    selected = scope.draws.filter(
      (d) => d.pass.colors.length && d.instances === 3,
    ),
    bytes = new Uint8Array(selected.length * 20),
    view = new DataView(bytes.buffer),
    binding = {
      id: 10000,
      label: "synthetic indirect args",
      allocationBytes: bytes.length,
      offset: 0,
      size: bytes.length,
    };
  selected.forEach((d, i) => {
    [d.count, d.instances, d.start, d.baseVertex, d.firstInstance].forEach(
      (n, j) => {
        if (j === 3) view.setInt32(i * 20 + j * 4, n, true);
        else view.setUint32(i * 20 + j * 4, n, true);
      },
    );
    d.method = "drawIndexedIndirect";
    d.indirect = { buffer: binding, offset: i * 20 };
    for (const key of [
      "count",
      "instances",
      "start",
      "baseVertex",
      "firstInstance",
    ])
      delete d[key];
  });
  const upload = {
    ...binding,
    usage: 264,
    writeCalls: 1,
    contentVersion: 1,
    submissionSerial: 1,
    destroyed: false,
    indirectFirstInstanceSupported: true,
    fullUploadBytes: [...bytes],
    writtenRanges: [[0, bytes.length]],
    uncertainRanges: [],
  };
  for (const d of selected) d.uploads = [...d.uploads, upload];
  return e;
}
test("three indirect pipe draws retain exact current geometry, three instances and packed-transform gates", async (t) => {
  const good = syntheticIndirect(saved.get("live:2")),
    receipt = { nativeFrame: 3 },
    compact = (e) => {
      e = clone(e);
      e.nativeGeometry.submittedDraws = compactNativeScope(
        e.nativeGeometry.submittedDraws,
      );
      return e;
    },
    result = validateSubmittedFanout(compact(good), receipt);
  assert.equal(
    result.mainCoverage.filter((c) => c.methods[0] === "drawIndexedIndirect")
      .length,
    3,
  );
  const argumentUpload = (scope) =>
    scope.draws.find((d) => d.indirect).uploads.find((u) => u.id === 10000);
  for (const [name, mutate] of [
    [
      "wrong-indirect-active-count",
      (s) => (argumentUpload(s).fullUploadBytes[0] ^= 1),
    ],
    [
      "wrong-indirect-first-instance",
      (s) => (argumentUpload(s).fullUploadBytes[16] = 1),
    ],
    [
      "wrong-indirect-three-instance-count",
      (s) => (argumentUpload(s).fullUploadBytes[4] = 2),
    ],
    [
      "wrong-indirect-first-index",
      (s) => (argumentUpload(s).fullUploadBytes[8] = 1),
    ],
    [
      "negative-signed-base-vertex",
      (s) => {
        const b = argumentUpload(s).fullUploadBytes;
        b.splice(12, 4, 255, 255, 255, 255);
      },
    ],
    [
      "positive-base-vertex",
      (s) => (argumentUpload(s).fullUploadBytes[12] = 1),
    ],
    [
      "different-argument-buffer-same-label",
      (s) => {
        const d = s.draws.filter((draw) => draw.indirect)[1];
        d.indirect = clone(d.indirect);
        d.indirect.buffer.id = 10001;
        d.uploads = d.uploads.map((u) =>
          u.id === 10000 ? { ...u, id: 10001 } : u,
        );
      },
    ],
    [
      "first-instance-feature-missing",
      (s) => (argumentUpload(s).indirectFirstInstanceSupported = false),
    ],
    [
      "wrong-index-buffer-object",
      (s) => (s.draws.find((d) => d.indirect).index.id = 999),
    ],
    [
      "wrong-index-format",
      (s) => (s.draws.find((d) => d.indirect).index.format = "uint32"),
    ],
    [
      "wrong-index-binding-offset",
      (s) => (s.draws.find((d) => d.indirect).index.offset = 2),
    ],
    [
      "truncated-index-binding",
      (s) => (s.draws.find((d) => d.indirect).index.size = 2),
    ],
    [
      "stale-index-bytes",
      (s) => {
        const d = s.draws.find((d) => d.indirect);
        d.uploads.find((u) => u.id === d.index.id).fullUploadBytes[0] ^= 1;
      },
    ],
    [
      "wrong-index-submit-version",
      (s) => {
        const d = s.draws.find((d) => d.indirect);
        d.uploads.find((u) => u.id === d.index.id).submissionSerial = 99;
      },
    ],
    [
      "index-gpu-storage-usage",
      (s) => {
        const d = s.draws.find((d) => d.indirect);
        d.uploads.find((u) => u.id === d.index.id).usage |= 128;
      },
    ],
    [
      "index-query-resolve-usage",
      (s) => {
        const d = s.draws.find((d) => d.indirect);
        d.uploads.find((u) => u.id === d.index.id).usage |= 512;
      },
    ],
    [
      "index-unproven-mutation",
      (s) => {
        const d = s.draws.find((d) => d.indirect);
        d.uploads.find((u) => u.id === d.index.id).uncertainRanges = [[0, 2]];
      },
    ],
    [
      "stale-indirect-argument-submission",
      (s) => (argumentUpload(s).submissionSerial = 0),
    ],
    [
      "unsubmitted-indirect-draw",
      (s) => (s.draws.find((d) => d.indirect).commandBufferId = 999),
    ],
    [
      "wrong-indirect-object-same-label",
      (s) => (s.draws.find((d) => d.indirect).indirect.buffer.id = 999),
    ],
    [
      "indirect-stale-geometry-bytes",
      (s) =>
        (s.draws.find((d) => d.indirect).uploads[0].fullUploadBytes[0] ^= 1),
    ],
    [
      "indirect-wrong-packed-transform",
      (s) => {
        const d = s.draws.find((d) => d.indirect),
          id = d.groups[0].entries[0].buffer.id;
        d.uploads.find((u) => u.id === id).fullUploadBytes[0] ^= 1;
      },
    ],
  ])
    await t.test(name, () => {
      const e = clone(good);
      mutate(e.nativeGeometry.submittedDraws);
      assert.throws(() => validateSubmittedFanout(compact(e), receipt));
      summary.negativeControls.push(name);
    });
  summary.indirectSyntheticCaptureBytes = Buffer.byteLength(
    JSON.stringify(compact(good)),
  );
  assert(
    summary.indirectSyntheticCaptureBytes + 2 * 1024 * 1024 < 16 * 1024 * 1024,
  );
});
test("installed indirect conversion and native executor preserve 20-byte slots, 16/20-byte payloads and actual method", async () => {
  const indirect = await load(
      "packages/webgpu/dist/render/draw/indirect-draw-commands.js",
    ),
    executor = await load(
      "packages/webgpu/dist/render/passes/render-pass-command-executor.js",
    ),
    writes = [],
    calls = [],
    device = {
      createBuffer: (d) => ({ ...d }),
      queue: {
        writeBuffer: (buffer, offset, data, start, size) =>
          writes.push({
            buffer,
            offset,
            bytes: new Uint8Array(data, start, size).slice(),
          }),
      },
    },
    commands = [
      {
        kind: "draw",
        renderId: 1,
        vertexCount: 99,
        instanceCount: 3,
        firstVertex: 7,
        firstInstance: 0,
      },
      {
        kind: "drawIndexed",
        renderId: 2,
        indexCount: 42,
        instanceCount: 3,
        firstIndex: 5,
        baseVertex: -17,
        firstInstance: 3,
      },
      {
        kind: "draw",
        renderId: 3,
        vertexCount: 6,
        instanceCount: 1,
        firstVertex: 0,
        firstInstance: 0,
      },
    ],
    result = indirect.prepareIndirectDrawCommands({
      device,
      cache: indirect.createIndirectDrawCommandCache(),
      commands,
      label: "CPU evidence",
      supportsIndirectFirstInstance: true,
    });
  assert.equal(result.report.indirectDraws, 2);
  assert.equal(writes[0].buffer.usage, 264);
  assert.equal(writes[0].bytes.length, 40);
  assert.deepEqual(
    result.commands.map((c) => [c.kind, c.offset]),
    [
      ["drawIndirect", 0],
      ["drawIndexedIndirect", 20],
      ["draw", undefined],
    ],
  );
  const v = new DataView(writes[0].bytes.buffer);
  assert.equal(v.getUint32(4, true), 3);
  assert.equal(v.getInt32(32, true), -17);
  assert.equal(v.getUint32(36, true), 3);
  const report = executor.executeRenderPassCommands({
    commands: result.commands,
    pass: {
      drawIndirect: (...args) => calls.push(["drawIndirect", ...args]),
      drawIndexedIndirect: (...args) =>
        calls.push(["drawIndexedIndirect", ...args]),
      draw: (...args) => calls.push(["draw", ...args]),
    },
  });
  assert.equal(report.valid, true);
  assert.equal(calls[0][1], writes[0].buffer);
  assert.equal(calls[1][1], writes[0].buffer);
  assert.equal(calls[1][2], 20);
  summary.compiledIndirectRoute = {
    actualCompiledConversion: true,
    actualCompiledExecutor: true,
    argumentAllocationUsage: 264,
    slotBytes: 20,
    formats: [16, 20],
    nativeExecution: false,
  };
});
test("bounded serialized synthetic capture estimates retain sixteen MiB recorder gate", () => {
  const rows = [];
  for (const session of ["shared-grow", "unshared-grow"]) {
    const e = session.startsWith("shared-")
      ? syntheticIndirect(saved.get(session + ":0"))
      : synthetic(saved.get(session + ":0"));
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
test("nonindexed sentinel accepts an unused retained index binding", () => {
  const e = syntheticIndirect(saved.get("live:0")),
    scope = e.nativeGeometry.submittedDraws;
  const pipe = scope.draws.find((d) => d.indirect);
  for (const draw of scope.draws.filter((d) => d.method === "draw"))
    draw.index = clone(pipe.index);
  e.nativeGeometry.submittedDraws = compactNativeScope(scope);
  assert(validateSubmittedFanout(e, { nativeFrame: 1 }));
});
test("synthetic renderer diagnostics preserve prepared versions, cache, no-op and reset gates", async (t) => {
  const make = (index) => {
    const e = syntheticIndirect(saved.get(`live:${index}`)),
      state = statesFor()[index];
    const nr = {
      preparedMeshFacade: {
        totalEntries: 5,
        entries: [
          ...new Map(
            e.nativeGeometry.meshes.map((m) => [
              m.meshId,
              { assetKey: `mesh:${m.meshId}`, sourceVersion: m.assetVersion },
            ]),
          ).values(),
        ],
      },
      preparedMeshCache: { totalEntries: [5, 5, 8, 8, 11, 11, 11, 11][index] },
      meshBuffersCreated: 0,
      preparedMeshBuffersCreated: 0,
      autoShadowFrameCache: { status: state.noop ? "hit" : "miss" },
      autoShadowFramesCreated: state.noop ? 0 : 1,
      autoShadowFramesReused: state.noop ? 1 : 0,
    };
    e.resources.nativeRenderer = nr;
    if (state.noop)
      e.nativeGeometry.submittedDraws.draws =
        e.nativeGeometry.submittedDraws.draws.filter(
          (d) => d.pass.colors.length,
        );
    e.nativeGeometry.submittedDraws = compactNativeScope(
      e.nativeGeometry.submittedDraws,
    );
    return e;
  };
  for (const state of statesFor())
    assert(validateNativeResources(make(state.index), state));
  for (const [name, index, mutate] of [
    [
      "stale-prepared-source-version",
      2,
      (e) =>
        e.resources.nativeRenderer.preparedMeshFacade.entries[0]
          .sourceVersion--,
    ],
    [
      "missing-prepared-source",
      2,
      (e) => e.resources.nativeRenderer.preparedMeshFacade.entries.pop(),
    ],
    [
      "wrong-retained-cache-inventory",
      2,
      (e) => e.resources.nativeRenderer.preparedMeshCache.totalEntries++,
    ],
    [
      "noop-geometry-allocation",
      1,
      (e) => e.resources.nativeRenderer.preparedMeshBuffersCreated++,
    ],
    [
      "noop-shadow-cache-miss",
      1,
      (e) => (e.resources.nativeRenderer.autoShadowFrameCache.status = "miss"),
    ],
    [
      "reset-geometry-allocation",
      5,
      (e) => e.resources.nativeRenderer.preparedMeshBuffersCreated++,
    ],
  ])
    await t.test(name, () => {
      const e = make(index);
      mutate(e);
      assert.throws(() => validateNativeResources(e, statesFor()[index]));
    });
});
test.after(() =>
  console.log("INDEXED_FANOUT_CPU_SUMMARY " + JSON.stringify(summary)),
);
