/** CPU fixture proof only. No browser, server or genuine GPU invocation. */
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import {
  sceneModule,
  apertureSystem,
  threeModules,
  repo,
} from "./cpu-loader.mjs";
import {
  TOPOLOGIES,
  BASELINE,
  parametersFor,
  topologyFor,
  SESSION_IDS,
  statesFor,
  BUDGETS,
} from "./contract.mjs";
import { inspectSemantics } from "./semantics.mjs";
import {
  validateTopology,
  validateSubmittedTopology,
  validateTopologyTransition,
  validateOpenBores,
  expectedPipeCounts,
} from "./topology.mjs";
import { nativeEvidenceBytes } from "./author-a/native-evidence.mjs";
import { validateTransition } from "./harness/checks.mjs";
const json = (x) => JSON.parse(JSON.stringify(x)),
  isPipe = (m) => m.name.startsWith("pipe.hollow-elbow");
const hash = (bytes) =>
  createHash("sha256").update(Uint8Array.from(bytes)).digest("hex");
function comparable(meshes) {
  return meshes.map((m) => ({
    name: m.name,
    positions: m.positions,
    indices: m.indices,
    matrix: m.worldMatrix ?? m.matrix,
    raw: (m.cpuStreams ?? m.streams).map((s) => ({
      rawBytes: s.rawBytes,
      dataType: s.dataType ?? s.arrayType,
      arrayStride: s.arrayStride ?? s.byteStride,
      attributes: s.attributes,
      semantic: s.semantic,
    })),
    indexRaw: m.indexBuffer?.rawBytes ?? null,
    submeshes: m.submeshes ?? null,
    groups: m.groups ?? null,
  }));
}
const summary = {
  kind: "CPU fixture checks only; native unrun",
  browsersLaunched: 0,
  serversStarted: 0,
  engines: {},
  negativeControls: [],
  baselineByteControl: {},
};
const saved = new Map();
function report(engine, session, state, evidence, result) {
  const pipes = evidence.nativeGeometry.meshes.filter(isPipe);
  saved.set(`${engine}:${session}:${state.index}`, json(evidence));
  return {
    session,
    id: state.id,
    edit: state.edit,
    noOp: state.noop,
    semanticTopology: result,
    resources:
      engine === "aperture"
        ? evidence.resources.worker
        : evidence.resources.nativeObjects,
    pipes: pipes.map((m) => ({
      name: m.name,
      vertices: m.positions.length / 3,
      indices: m.indices.length,
      assetVersion: m.assetVersion,
      geometryId: m.geometryId,
      attributeIds: m.attributeIds,
      streams: (m.streams ?? m.cpuStreams).map((s) => ({
        semantic: s.semantic ?? s.id,
        bytes: s.byteLength,
        sha256: hash(s.rawBytes),
      })),
      drawRange: m.drawRange,
      submeshes: m.submeshes,
      groups: m.groups,
    })),
  };
}
test("bounded topology axis and absolute baseline pose", () => {
  assert.equal(SESSION_IDS.length, 4);
  assert.equal(statesFor().length, 8);
  assert.equal(
    SESSION_IDS.reduce((n, s) => n + statesFor(s).length, 0),
    11,
  );
  assert.equal(BUDGETS.totalStates, 22);
  for (const edit of Object.keys(TOPOLOGIES))
    assert.deepEqual(parametersFor(edit), BASELINE);
  for (const value of ["all", "__proto__", "constructor", null, {}])
    assert.throws(() => topologyFor(value));
  assert.throws(() => statesFor("fresh-all"));
});
test("baseline constructors preserve original bytes/settings and all nonpipe geometry remains exact", async () => {
  for (const engine of ["aperture", "threejs"]) {
    const old = (await sceneModule(engine, true)).module,
      module = (await sceneModule(engine)).module,
      build = engine === "aperture" ? "constructScene" : "buildScene",
      baseline = module[build]("baseline");
    assert.deepEqual(baseline, old[build]("baseline"));
    for (const key of ["BASELINE", "EDITS", "CAMERAS", "PALETTE"])
      assert.deepEqual(module[key], old[key]);
    if (engine === "aperture") assert.deepEqual(module.CONFIG, old.CONFIG);
    for (const edit of ["grow", "shrink"]) {
      const next = module[build](edit);
      assert.deepEqual(
        (next.parts ?? next.meshes).filter((m) => !isPipe(m)),
        (baseline.parts ?? baseline.meshes).filter((m) => !isPipe(m)),
      );
      assert.deepEqual(next.parameters, baseline.parameters);
    }
    summary.baselineByteControl[engine] = {
      originalConstructorExact: true,
      nonpipeAllStatesExact: true,
    };
  }
});
test("Aperture real ECS stable handles with cardinality-changing asset publication and reset bytes", async () => {
  const { createApertureApp, disposeApertureApp } = await import(
      pathToFileURL(resolve(repo, "packages/app/dist/advanced.js")).href
    ),
    firstByEdit = new Map(),
    rows = [];
  for (const session of SESSION_IDS) {
    const { system, scene } = await apertureSystem(session);
    let app;
    try {
      app = await createApertureApp({
        config: scene.CONFIG,
        systems: [{ default: system.CraneCourtyard }],
      });
      assert.equal(system.sceneOwner.scene.edit, statesFor(session)[0].edit);
      let identities, previous;
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
          evidence = { ...raw, resources: { worker: raw.resources } };
        assert.equal(evidence.revision, state.index + 1);
        assert(evidence.nativeChecks.ok);
        identities ??= json(evidence.identity);
        assert.deepEqual(evidence.identity, identities);
        for (const mesh of evidence.nativeGeometry.meshes) {
          for (const stream of mesh.streams) nativeEvidenceBytes(stream);
          if (mesh.indexBuffer) nativeEvidenceBytes(mesh.indexBuffer);
        }
        const semantics = inspectSemantics(
          "aperture",
          evidence.sourceGeometry,
          evidence.nativeGeometry.meshes,
        );
        assert(semantics.ok);
        const topology = validateTopology(
          "aperture",
          evidence.sourceGeometry,
          evidence.nativeGeometry.meshes,
        );
        validateTransition(evidence, state, previous, "aperture");
        previous = evidence;
        const actual = comparable(evidence.nativeGeometry.meshes);
        if (firstByEdit.has(state.edit))
          assert.deepEqual(actual, firstByEdit.get(state.edit));
        else firstByEdit.set(state.edit, actual);
        if (session !== "live")
          assert.equal(evidence.resources.worker.meshAssetReplacements, 0);
        rows.push(report("aperture", session, state, evidence, topology));
      }
      const revision = system.sceneOwner.revision;
      app.context.commands.queue(system.LIVE_CHANNEL, {
        id: "wrong",
        index: 0,
        revision: revision + 1,
      });
      assert.throws(() => system.sceneOwner.update(), /sequence mismatch/);
      assert.equal(system.sceneOwner.revision, revision);
    } finally {
      if (app) await disposeApertureApp(app);
    }
  }
  assert.equal(rows.length, 11);
  assert.equal(rows[7].resources.meshAssetReplacements, 15);
  summary.engines.aperture = rows;
});
test("Three.js actual Mesh identity, geometry/attribute replacement, dispose events, no-op and reset bytes", async () => {
  const { scene: module, checks, store: factory, THREE } = await threeModules(),
    firstByEdit = new Map(),
    rows = [];
  for (const session of SESSION_IDS) {
    const scene = new THREE.Scene(),
      materials = new Map(
        Object.keys(module.PALETTE).map((name) => {
          const m = new THREE.MeshStandardMaterial();
          m.name = name;
          return [name, m];
        }),
      ),
      store = factory.createMeshStore(scene, materials);
    let identities, previous;
    const tracked = new Set();
    let actualDisposes = 0;
    try {
      for (const state of statesFor(session)) {
        const source = module.buildScene(state.edit);
        store.install(source, state.index + 1);
        for (const m of store.meshes)
          if (!tracked.has(m.geometry)) {
            tracked.add(m.geometry);
            m.geometry.addEventListener("dispose", () => actualDisposes++);
          }
        const native = store.cpuSnapshot(source);
        assert(checks.inspectScene(native).ok);
        identities ??= [...store.meshes];
        store.meshes.forEach((m, i) => assert.equal(m, identities[i]));
        assert.equal(actualDisposes, store.counters.geometryDisposeCalls);
        for (const mesh of native.meshes) {
          const src = source.meshes.find((m) => m.name === mesh.name);
          for (const [semantic, key] of [
            ["position", "positions"],
            ["normal", "normals"],
            ["index", "indices"],
          ])
            assert.deepEqual(
              mesh.cpuStreams.find((s) => s.semantic === semantic).rawBytes,
              Array.from(
                new Uint8Array(
                  src[key].buffer,
                  src[key].byteOffset,
                  src[key].byteLength,
                ),
              ),
            );
        }
        const evidence = {
          revision: state.index + 1,
          sourceGeometry: json(source),
          nativeGeometry: {
            meshes: native.meshes.map((m) => ({
              ...m,
              worldMatrix: m.matrix,
              streams: m.cpuStreams,
            })),
          },
          resources: { nativeObjects: { ...store.counters } },
        };
        assert(inspectSemantics("threejs", source, native.meshes).ok);
        const topology = validateTopology(
          "threejs",
          source,
          evidence.nativeGeometry.meshes,
        );
        validateTransition(evidence, state, previous, "threejs");
        previous = evidence;
        const actual = comparable(native.meshes);
        if (firstByEdit.has(state.edit))
          assert.deepEqual(actual, firstByEdit.get(state.edit));
        else firstByEdit.set(state.edit, actual);
        rows.push(report("threejs", session, state, evidence, topology));
      }
    } finally {
      for (const m of store.meshes) m.geometry.dispose();
      for (const m of materials.values()) m.dispose();
    }
  }
  assert.equal(rows.length, 11);
  assert.equal(rows[7].resources.geometryReplacements, 5);
  assert.equal(rows[7].resources.geometryDisposeCalls, 5);
  assert.equal(rows[7].resources.attributeReplacements, 15);
  summary.engines.threejs = rows;
});
test("baseline actual native CPU bytes equal retained successful combined native controls", async () => {
  for (const engine of ["aperture", "threejs"]) {
    const old = JSON.parse(
        await readFile(
          resolve(
            repo,
            `benchmarks/crane-combined-edits-20261003/renders/${engine}/fresh-baseline/attempt-001/states/s00-fresh-baseline.json`,
          ),
          "utf8",
        ),
      ),
      actual = saved.get(`${engine}:fresh-baseline:0`);
    assert(actual);
    const control =
      engine === "aperture"
        ? old.evidence.nativeGeometry.meshes
        : old.evidence.nativeCpuGeometry.meshes;
    assert.deepEqual(
      comparable(actual.nativeGeometry.meshes),
      comparable(control),
    );
    summary.baselineByteControl[engine].retainedNativeBytesExact = true;
  }
});
test("independent topology gates reject stale counts, truncated bytes, indices, draw ranges and failed resets", () => {
  for (const engine of ["aperture", "threejs"]) {
    const good = saved.get(`${engine}:live:2`),
      base = saved.get(`${engine}:live:0`);
    assert(good && base);
    const reject = (label, mutate) => {
      const e = structuredClone(good);
      mutate(e);
      assert.throws(
        () =>
          validateTopology(engine, e.sourceGeometry, e.nativeGeometry.meshes),
        undefined,
        `${engine}:${label}`,
      );
      summary.negativeControls.push(`${engine}:${label}`);
    };
    const pipe = (e) => e.nativeGeometry.meshes.find(isPipe);
    reject("stale-old-counts", (e) => {
      e.nativeGeometry.meshes = structuredClone(base.nativeGeometry.meshes);
    });
    reject("truncated-position-buffer", (e) => pipe(e).positions.pop());
    reject("truncated-raw-buffer", (e) => pipe(e).streams[0].rawBytes.pop());
    reject("wrong-ring-count", (e) => {
      const p = (e.sourceGeometry.parts ?? e.sourceGeometry.meshes).find(
        isPipe,
      );
      if (engine === "aperture") p.features.outerRings.pop();
      else delete p.markers["outer.24"];
    });
    reject("wrong-active-draw-range", (e) => {
      if (engine === "aperture") pipe(e).submeshes[0].vertexCount -= 3;
      else pipe(e).drawRange.count = 3;
    });
    reject("wrong-native-indices", (e) => {
      if (engine === "aperture")
        pipe(e).positions.splice(0, 3, ...pipe(e).positions.slice(3, 6));
      else pipe(e).indices[0] = pipe(e).indices[1];
    });
    reject("reset-did-not-reset", (e) => {
      e.sourceGeometry.edit = "baseline";
    });
    reject("changed-analytic-dimension", (e) => {
      for (const m of e.nativeGeometry.meshes.filter(isPipe))
        for (let i = 0; i < m.positions.length; i += 3) m.positions[i] += 0.01;
    });
    const bad = structuredClone(good);
    if (engine === "aperture") bad.resources.worker.meshAssetReplacements--;
    else bad.resources.nativeObjects.geometryDisposeCalls--;
    assert.throws(() =>
      validateTopologyTransition(
        bad,
        statesFor()[2],
        saved.get(`${engine}:live:1`),
        engine,
      ),
    );
    summary.negativeControls.push(`${engine}:unaccounted-replacement`);
  }
});
function simulatedDraws(engine, e) {
  const draws = [],
    inventory = [];
  let id = 1;
  for (const expected of expectedPipeCounts(engine, e.sourceGeometry.edit)) {
    const m = e.nativeGeometry.meshes.find((x) => x.name === expected.name);
    if (engine === "aperture")
      draws.push({
        method: "draw",
        count: expected.vertices,
        start: 0,
        instances: 1,
        vertices: m.streams.map((s) => ({
          id: id++,
          label: `${m.name}/vertex:${s.id}`,
          size: s.byteLength + 256,
          allocationBytes: s.byteLength + 256,
          offset: 0,
        })),
        index: null,
      });
    else {
      const pi = id++,
        ii = id++;
      inventory.push(
        { mesh: m.name, semantic: "position", nativeDrawBufferId: pi },
        { mesh: m.name, semantic: "index", nativeDrawBufferId: ii },
      );
      for (const g of m.groups)
        draws.push({
          method: "drawIndexed",
          count: g.count,
          start: g.start,
          instances: 1,
          baseVertex: 0,
          vertices: [
            {
              id: pi,
              size: expected.vertices * 12,
              allocationBytes: expected.vertices * 12,
              offset: 0,
            },
          ],
          index: {
            id: ii,
            format: "uint32",
            size: expected.indices * 4,
            allocationBytes: expected.indices * 4,
            offset: 0,
          },
        });
    }
  }
  e.nativeGeometry.gpuBuffers = draws.flatMap((d) =>
    d.vertices.map((v) => ({
      name: v.label?.split("/vertex:")[0],
      streamId: v.label?.split("/vertex:")[1],
      nativeDrawBufferId: v.id,
      ok: true,
      nativeByteLength: v.size - 256,
    })),
  );
  return { draws, inventory };
}
test("submitted-range gate accepts retained capacity and rejects old counts, missing ranges and stale frame correlation", () => {
  for (const engine of ["aperture", "threejs"]) {
    const original = saved.get(`${engine}:live:4`),
      e = structuredClone(original),
      mock = simulatedDraws(engine, e);
    e.nativeGeometry.submittedDraws = {
      frame: 5,
      submissions: 1,
      draws: mock.draws,
    };
    e.resources.inventory = mock.inventory;
    const receipt = { nativeFrame: 5 };
    assert(validateSubmittedTopology(engine, e, receipt));
    for (const [name, fn] of [
      ["old-count", (s) => (s.draws[0].count = 99999)],
      ["offset", (s) => (s.draws[0].start = 99999)],
      [
        "binding-offset",
        (s) => {
          s.draws[0].vertices[0].offset = 4;
          s.draws[0].vertices[0].allocationBytes += 4;
        },
      ],
      ["wrong-frame", (s) => s.frame--],
      ["not-submitted", (s) => (s.submissions = 0)],
      ["missing-draws", (s) => (s.draws = [])],
      ["indirect-unproven", (s) => (s.draws[0].method = "drawIndirect")],
    ]) {
      const bad = structuredClone(e);
      fn(bad.nativeGeometry.submittedDraws);
      assert.throws(() => validateSubmittedTopology(engine, bad, receipt));
      summary.negativeControls.push(`${engine}:submitted-${name}`);
    }
  }
});
test("Aperture actual submitted binding must match the exact uploaded object even when labels match", () => {
  const e = structuredClone(saved.get("aperture:live:4")),
    mock = simulatedDraws("aperture", e);
  e.nativeGeometry.submittedDraws = {
    frame: 5,
    submissions: 1,
    draws: mock.draws,
  };
  assert(validateSubmittedTopology("aperture", e, { nativeFrame: 5 }));
  e.nativeGeometry.gpuBuffers[0].nativeDrawBufferId += 1000;
  assert.throws(
    () => validateSubmittedTopology("aperture", e, { nativeFrame: 5 }),
    /exact verified upload object/,
  );
  summary.negativeControls.push("aperture:same-label-different-upload-object");
});
test("open-bore ray checks reject either capped opening independently", () => {
  assert(validateOpenBores([]));
  for (const cap of [
    [
      [0.85, 0.04, 1.52],
      [0.85, 0.44, 1.52],
      [0.85, 0.24, 1.92],
    ],
    [
      [1.45, 1.04, 1.52],
      [1.85, 1.04, 1.52],
      [1.65, 1.04, 1.92],
    ],
  ])
    assert.throws(() => validateOpenBores([cap]), /Closed hollow opening/);
});
test.after(() =>
  console.log("TOPOLOGY_CPU_SUMMARY " + JSON.stringify(summary)),
);
