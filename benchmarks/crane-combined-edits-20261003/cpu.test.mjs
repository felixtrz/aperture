import test from "node:test";
import assert from "node:assert/strict";
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
  EDITS,
  COMPOSITIONS,
  PARAMETERS,
  parametersFor,
  SESSION_IDS,
  statesFor,
  BUDGETS,
} from "./contract.mjs";
import { inspectSemantics } from "./semantics.mjs";
import { nativeEvidenceBytes } from "./author-a/native-evidence.mjs";
import { validateTransition } from "./harness/checks.mjs";
const json = (value) => JSON.parse(JSON.stringify(value));
function nativeComparable(meshes) {
  return meshes.map((m) => ({
    name: m.name,
    positions: m.positions,
    indices: m.indices,
    matrix: m.worldMatrix ?? m.matrix,
    raw: m.streams
      ? m.streams.map((s) => ({
          rawBytes: s.rawBytes,
          dataType: s.dataType,
          arrayStride: s.arrayStride,
          attributes: s.attributes,
        }))
      : m.cpuStreams.map((s) => ({
          semantic: s.semantic,
          rawBytes: s.rawBytes,
          arrayType: s.arrayType,
          byteStride: s.byteStride,
        })),
    indexRaw: m.indexBuffer?.rawBytes ?? null,
  }));
}
const summary = {
  kind: "CPU only, no native browser/GPU execution",
  engines: {},
  equivalence: {},
};

test("bounded equal contract composes only prior approved single-edit values", () => {
  assert.equal(SESSION_IDS.length, 5);
  assert.equal(statesFor().length, 14);
  assert.equal(
    SESSION_IDS.reduce((n, s) => n + statesFor(s).length, 0),
    BUDGETS.perEngineStates,
  );
  for (const [key, edits] of Object.entries(COMPOSITIONS))
    assert.deepEqual(
      parametersFor(key),
      Object.assign({}, PARAMETERS.baseline, ...edits.map((e) => EDITS[e])),
    );
  for (const key of ["bad", "__proto__", "constructor", {}, null])
    assert.throws(() => parametersFor(key), /Unknown edit/);
  assert.throws(() => statesFor("fresh-shoulder"), /Unknown session/);
  const copy = parametersFor("all");
  copy.shoulder_deg = 0;
  assert.equal(parametersFor("all").shoulder_deg, 65);
  assert(Object.isFrozen(PARAMETERS.all));
});

test("both adapters preserve baseline and all seven singles exactly, including material/camera/settings", async () => {
  for (const engine of ["aperture", "threejs"]) {
    const original = (await sceneModule(engine, true)).module,
      derived = (await sceneModule(engine)).module;
    const build = engine === "aperture" ? "constructScene" : "buildScene";
    const entries = [];
    for (const edit of Object.keys(EDITS)) {
      assert.deepEqual(
        derived[build](edit),
        original[build](edit),
        `${engine}:${edit}:full source geometry/material/camera equivalence`,
      );
      entries.push({ edit, exactFullScene: true });
    }
    assert.deepEqual(derived.BASELINE, original.BASELINE);
    assert.deepEqual(derived.EDITS, original.EDITS);
    assert.deepEqual(derived.CAMERAS, original.CAMERAS);
    assert.deepEqual(derived.PALETTE, original.PALETTE);
    if (engine === "aperture")
      assert.deepEqual(derived.CONFIG, original.CONFIG);
    for (const [file, old] of engine === "aperture"
      ? [["worker.mjs", "author-a/post-author-byte-diagnostic/worker.mjs"]]
      : [
          ["lighting.mjs", "author-b/v1/lighting.mjs"],
          ["scene.mjs", "author-b/v1/scene.mjs"],
        ])
      assert.equal(
        await readFile(
          resolve(
            repo,
            "benchmarks/crane-combined-edits-20261003",
            engine === "aperture" ? "author-a" : "author-b",
            file,
          ),
          "utf8",
        ).then((text) =>
          file === "scene.mjs" ? text.replace("}, 180000)", "}, 60000)") : text,
        ),
        await readFile(
          resolve(repo, "benchmarks/crane-live-edits-20261003", old),
          "utf8",
        ),
      );
    summary.equivalence[engine] = entries;
  }
});

test("Aperture real ECS/asset registry: all live and genuinely fresh CPU states, bytes, no-ops and reset identities", async () => {
  const { createApertureApp, disposeApertureApp } = await import(
    pathToFileURL(resolve(repo, "packages/app/dist/advanced.js")).href
  );
  const firstByEdit = new Map(),
    rows = [];
  for (const session of SESSION_IDS) {
    const { system, scene } = await apertureSystem(session);
    let app;
    try {
      app = await createApertureApp({
        config: scene.CONFIG,
        systems: [{ default: system.CraneCourtyard }],
      });
      assert.deepEqual(
        system.sceneOwner.scene.parameters,
        parametersFor(statesFor(session)[0].edit),
        "Fresh initialization uses desired composition before any step",
      );
      let identity = null,
        previous = null;
      for (const state of statesFor(session)) {
        app.context.commands.queue(system.LIVE_CHANNEL, {
          id: state.id,
          index: state.index,
          revision: state.index + 1,
        });
        app.step(1 / 60, (state.index + 1) / 60);
        const snapshot = app.extract(state.index + 1);
        const evidence = system.sceneOwner.evidenceAtNativePublication(
          snapshot.frame,
          snapshot,
        );
        assert.equal(evidence.revision, state.index + 1);
        assert.deepEqual(evidence.parameters, parametersFor(state.edit));
        assert(evidence.nativeChecks.ok);
        assert.equal(snapshot.meshDraws.length, evidence.identity.meshCount);
        identity ??= json(evidence.identity);
        assert.deepEqual(evidence.identity, identity);
        for (const mesh of evidence.nativeGeometry.meshes) {
          for (const stream of mesh.streams)
            assert.equal(nativeEvidenceBytes(stream).length, stream.byteLength);
          if (mesh.indexBuffer) nativeEvidenceBytes(mesh.indexBuffer);
        }
        const semantics = inspectSemantics(
          "aperture",
          evidence.sourceGeometry,
          evidence.nativeGeometry.meshes,
        );
        assert(
          semantics.ok,
          JSON.stringify(semantics.checks.filter((c) => !c.ok)),
        );
        const comparable = nativeComparable(evidence.nativeGeometry.meshes);
        if (firstByEdit.has(state.edit))
          assert.deepEqual(
            comparable,
            firstByEdit.get(state.edit),
            `${session}:${state.edit}:exact live/fresh/reset native bytes`,
          );
        else firstByEdit.set(state.edit, comparable);
        const adapted = {
          ...evidence,
          resources: { worker: evidence.resources },
        };
        validateTransition(adapted, state, previous, "aperture");
        previous = adapted;
        if (session !== "live")
          assert.equal(
            evidence.resources.meshAssetReplacements,
            0,
            "Fresh control has no warmed/replaced assets",
          );
        rows.push({
          session,
          id: state.id,
          edit: state.edit,
          nativeChecks: evidence.nativeChecks.checks.length,
          semanticChecks: semantics.checks.length,
          meshCount: evidence.identity.meshCount,
          noOp: state.noop,
          assetReplacements: evidence.resources.meshAssetReplacements,
        });
      }
      const revision = system.sceneOwner.revision;
      app.context.commands.queue(system.LIVE_CHANNEL, {
        id: "wrong-state",
        index: 0,
        revision: revision + 1,
      });
      assert.throws(() => system.sceneOwner.update(), /sequence mismatch/);
      assert.equal(system.sceneOwner.revision, revision);
    } finally {
      if (app) await disposeApertureApp(app);
    }
  }
  assert.equal(rows.length, 18);
  summary.engines.aperture = rows;
});

test("Three.js real Mesh/BufferGeometry: all live/fresh CPU states, raw bytes, no-ops, inherited checks and stable references", async () => {
  const { scene: module, checks, store: factory, THREE } = await threeModules(),
    firstByEdit = new Map(),
    rows = [];
  for (const session of SESSION_IDS) {
    const scene = new THREE.Scene();
    const materials = new Map(
      Object.keys(module.PALETTE).map((name) => {
        const m = new THREE.MeshStandardMaterial();
        m.name = name;
        return [name, m];
      }),
    );
    const store = factory.createMeshStore(scene, materials);
    let identities = null,
      previous = null;
    try {
      for (const state of statesFor(session)) {
        const source = module.buildScene(state.edit);
        store.install(source, state.index + 1);
        const actual = store.cpuSnapshot(source);
        const inherited = checks.inspectScene(actual);
        assert(
          inherited.ok,
          JSON.stringify(inherited.checks.filter((c) => !c.ok)),
        );
        assert.deepEqual(source.parameters, parametersFor(state.edit));
        identities ??= store.meshes.map((mesh) => [
          mesh,
          mesh.geometry,
          mesh.geometry.getAttribute("position"),
          mesh.geometry.getAttribute("normal"),
          mesh.geometry.index,
        ]);
        store.meshes.forEach((mesh, i) =>
          [
            mesh,
            mesh.geometry,
            mesh.geometry.getAttribute("position"),
            mesh.geometry.getAttribute("normal"),
            mesh.geometry.index,
          ].forEach((value, j) => assert.equal(value, identities[i][j])),
        );
        for (const mesh of actual.meshes) {
          const src = source.meshes.find((s) => s.name === mesh.name);
          for (const [semantic, key] of [
            ["position", "positions"],
            ["normal", "normals"],
            ["index", "indices"],
          ]) {
            assert.deepEqual(mesh[key], Array.from(src[key]));
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
        }
        const semantics = inspectSemantics("threejs", source, actual.meshes);
        assert(
          semantics.ok,
          JSON.stringify(semantics.checks.filter((c) => !c.ok)),
        );
        const comparable = nativeComparable(actual.meshes);
        if (firstByEdit.has(state.edit))
          assert.deepEqual(comparable, firstByEdit.get(state.edit));
        else firstByEdit.set(state.edit, comparable);
        const evidence = {
          revision: state.index + 1,
          nativeGeometry: {
            meshes: actual.meshes.map((m) => ({
              ...m,
              worldMatrix: m.matrix,
              streams: m.cpuStreams,
            })),
          },
          resources: { nativeObjects: { ...store.counters } },
        };
        validateTransition(evidence, state, previous, "threejs");
        previous = evidence;
        rows.push({
          session,
          id: state.id,
          edit: state.edit,
          nativeChecks: inherited.checks.length,
          semanticChecks: semantics.checks.length,
          meshCount: actual.meshes.length,
          noOp: state.noop,
          inPlaceWrites: store.counters.inPlaceAttributeWrites,
          matrixUpdates: store.counters.matrixUpdates,
        });
      }
      assert.equal(store.counters.geometryReplacements, 0);
      assert.equal(store.counters.attributeReplacements, 0);
    } finally {
      for (const mesh of store.meshes) mesh.geometry.dispose();
      for (const m of materials.values()) m.dispose();
    }
  }
  assert.equal(rows.length, 18);
  summary.engines.threejs = rows;
});

test("composed semantic negative controls reject stale baseline and incomplete compositions", async () => {
  for (const engine of ["aperture", "threejs"]) {
    const module = (await sceneModule(engine)).module,
      build = engine === "aperture" ? "constructScene" : "buildScene";
    // Source geometry is used here only to build CPU-negative controls, never native evidence.
    for (const stale of ["baseline", "articulation", "shape-assembly"]) {
      const good = module[build]("all"),
        wrong = module[build](stale);
      const meshes =
        engine === "aperture"
          ? wrong.parts.map((p) => ({
              name: p.name,
              positions: p.extrusion
                ? p.positions.flat()
                : p.indices.flatMap((i) => p.positions[i]),
              worldMatrix: p.worldMatrix,
            }))
          : wrong.meshes.map((m) => ({
              ...m,
              positions: Array.from(m.positions),
            }));
      const result = inspectSemantics(engine, good, meshes);
      assert(!result.ok, `${engine}:${stale}`);
    }
  }
});

test("both actual native CPU constructions agree on world-space parameter meaning for all compositions", async () => {
  const a = (await sceneModule("aperture")).module,
    b = (await sceneModule("threejs")).module;
  for (const edit of Object.keys(COMPOSITIONS)) {
    const aa = a.constructScene(edit),
      bb = b.buildScene(edit);
    const am = aa.parts.map((p) => ({
      name: p.name,
      positions: p.extrusion
        ? p.positions.flat()
        : p.indices.flatMap((i) => p.positions[i]),
      worldMatrix: p.worldMatrix,
    }));
    const bm = bb.meshes.map((m) => ({
      ...m,
      positions: Array.from(m.positions),
    }));
    const ar = inspectSemantics("aperture", aa, am),
      br = inspectSemantics("threejs", bb, bm);
    assert(ar.ok && br.ok);
    for (const key of Object.keys(ar.actual))
      assert(
        Math.max(
          ...ar.actual[key].map((v, i) => Math.abs(v - br.actual[key][i])),
        ) <= 2e-5,
        `${edit}:${key}`,
      );
  }
});

test.after(() =>
  console.log("COMBINED_CPU_SUMMARY " + JSON.stringify(summary)),
);
