import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { pathToFileURL, fileURLToPath } from "node:url";
const repo = process.cwd();
const { buildCottage } = await import(
  pathToFileURL(
    path.join(
      repo,
      "benchmarks/cottage-comparison-20261002/sources/a-v2/part-data.mjs",
    ),
  )
);
const { createBoxMeshAsset } = await import(
  pathToFileURL(
    path.join(repo, "packages/render/dist/mesh/primitives-box-plane.js"),
  )
);
const { createTriangleListMeshAsset } = await import(
  pathToFileURL(
    path.join(repo, "packages/render/dist/mesh/primitives-triangle-list.js"),
  )
);
const { createExtrudeMeshAsset } = await import(
  pathToFileURL(
    path.join(repo, "packages/render/dist/mesh/primitives-extrude.js"),
  )
);
const context = vm.createContext({
  console,
  URL,
  URLSearchParams,
  performance,
  setTimeout,
  clearTimeout,
  TextEncoder,
  TextDecoder,
});
const modules = new Map();
async function load(file) {
  file = path.resolve(file);
  if (!file.startsWith(repo + path.sep))
    throw Error("Import outside pinned repo");
  if (modules.has(file)) return modules.get(file);
  const module = new vm.SourceTextModule(await fs.readFile(file, "utf8"), {
    context,
    identifier: pathToFileURL(file).href,
    initializeImportMeta(meta) {
      meta.url = pathToFileURL(file).href;
    },
  });
  modules.set(file, module);
  await module.link((specifier, referencing) => {
    const target = specifier.startsWith("/engine/")
      ? path.join(repo, specifier.slice(8))
      : path.resolve(
          path.dirname(fileURLToPath(referencing.identifier)),
          specifier,
        );
    return load(target);
  });
  return module;
}
const B = await load(
  path.join(
    repo,
    "benchmarks/cottage-comparison-20261002/sources/b-v2/scene.mjs",
  ),
);
await B.evaluate();
const T = modules.get(
  path.join(repo, "shadow-lab/src/compare/three.webgpu.js"),
).namespace;
const all = [];
function box(points) {
  return {
    min: [0, 1, 2].map((a) => Math.min(...points.map((p) => p[a]))),
    max: [0, 1, 2].map((a) => Math.max(...points.map((p) => p[a]))),
  };
}
function aState(edit, view = "front") {
  return buildCottage({ edit, view })
    .parts.map((p) => {
      const g = p.geometry;
      const asset =
        g.kind === "box"
          ? createBoxMeshAsset({
              width: g.size[0],
              height: g.size[1],
              depth: g.size[2],
            })
          : g.kind === "triangles"
            ? createTriangleListMeshAsset({ positions: g.positions })
            : createExtrudeMeshAsset({
                outline: g.outline,
                holes: g.holes,
                depth: g.depth,
              });
      const stream = asset.vertexStreams[0],
        stride = stream.arrayStride / 4,
        points = [];
      for (let i = 0; i < stream.vertexCount; i++)
        points.push(
          [0, 1, 2].map((a) => stream.data[i * stride + a] + p.center[a]),
        );
      return { name: p.name, points, bounds: box(points) };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
function bState(edit, view = "front") {
  const { scene } = B.namespace.createCottage(edit, view);
  scene.updateMatrixWorld(true);
  const parts = [];
  scene.traverse((mesh) => {
    if (!mesh.isMesh) return;
    const positions = mesh.geometry.getAttribute("position"),
      v = new T.Vector3(),
      points = [];
    for (let i = 0; i < positions.count; i++) {
      v.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
      points.push([v.x, v.y, v.z]);
    }
    parts.push({ name: mesh.name, points, bounds: box(points) });
  });
  return parts.sort((a, b) => a.name.localeCompare(b.name));
}
const eps = 1e-5;
function close(a, b) {
  return Math.abs(a - b) <= eps;
}
function check(engine, name, passed, details = {}) {
  all.push({ engine, name, passed, ...details });
}
for (const [engine, make] of [
  ["Aperture", aState],
  ["three.js", bState],
]) {
  const states = Object.fromEntries(
    ["base", "roof", "bench", "trees"].map((edit) => [edit, make(edit)]),
  );
  const base = states.base,
    map = (state) => new Map(state.map((p) => [p.name, p]));
  for (const [edit, parts] of Object.entries(states)) {
    check(
      engine,
      "finite native mesh vertices " + edit,
      parts.every(
        (p) => p.points.length > 0 && p.points.flat().every(Number.isFinite),
      ),
      {
        parts: parts.length,
        vertices: parts.reduce((n, p) => n + p.points.length, 0),
      },
    );
    check(
      engine,
      "stable part identity " + edit,
      JSON.stringify(parts.map((p) => p.name)) ===
        JSON.stringify(base.map((p) => p.name)),
    );
  }
  for (const view of ["rear", "side"]) {
    const other = make("base", view);
    check(
      engine,
      "alternate view preserves actual geometry " + view,
      other.length === base.length &&
        other.every(
          (p, i) =>
            p.name === base[i].name &&
            p.points.length === base[i].points.length &&
            p.points.every((v, j) =>
              v.every((x, a) => close(x, base[i].points[j][a])),
            ),
        ),
    );
  }
  const roof = (state) =>
    state.filter((p) => p.name.startsWith("roof.")).flatMap((p) => p.points);
  const r0 = roof(base),
    r1 = roof(states.roof),
    bounds0 = box(r0),
    bounds1 = box(r1);
  const eave = (points) => {
    const b = box(points);
    return Math.max(
      ...points
        .filter((p) => close(p[0], b.min[0]) || close(p[0], b.max[0]))
        .map((p) => p[1]),
    );
  };
  const e0 = eave(r0),
    e1 = eave(r1);
  const ratio = (bounds1.max[1] - e1) / (bounds0.max[1] - e0);
  check(engine, "roof actual vertex rise x1.30", close(ratio, 1.3), {
    actual: ratio,
  });
  check(
    engine,
    "roof actual eaves fixed",
    close(e0, e1) &&
      close(bounds0.min[0], bounds1.min[0]) &&
      close(bounds0.max[0], bounds1.max[0]),
    { baseEave: e0, editedEave: e1 },
  );
  const bm = map(states.bench),
    tm = map(states.trees);
  const seats = base.filter((p) => /^bench\.(seat|back).*slat/.test(p.name));
  for (const p of seats) {
    const q = bm.get(p.name),
      ratio =
        (q.bounds.max[0] - q.bounds.min[0]) /
        (p.bounds.max[0] - p.bounds.min[0]);
    check(engine, "actual slat width x1.25 " + p.name, close(ratio, 1.25), {
      actual: ratio,
    });
  }
  const s0 = seats.find((p) => p.name.includes("seat")),
    s1 = bm.get(s0.name);
  for (const p of base.filter((p) => p.name.startsWith("bench.leg."))) {
    const q = bm.get(p.name),
      cx0 = (p.bounds.min[0] + p.bounds.max[0]) / 2,
      cx1 = (q.bounds.min[0] + q.bounds.max[0]) / 2;
    const inset0 = Math.min(
        Math.abs(cx0 - s0.bounds.min[0]),
        Math.abs(s0.bounds.max[0] - cx0),
      ),
      inset1 = Math.min(
        Math.abs(cx1 - s1.bounds.min[0]),
        Math.abs(s1.bounds.max[0] - cx1),
      );
    check(
      engine,
      "bench leg attachment inset preserved " + p.name,
      close(inset0, inset1),
      { baseInset: inset0, editedInset: inset1 },
    );
  }
  for (const p of base.filter((p) => p.name.startsWith("tree."))) {
    const q = tm.get(p.name),
      shift = p.name.startsWith("tree.left.") ? -0.6 : 0.6;
    check(
      engine,
      "actual tree bounds translate outward " + p.name,
      p.bounds.min.every((x, a) =>
        close(q.bounds.min[a] - x, a === 0 ? shift : 0),
      ) &&
        p.bounds.max.every((x, a) =>
          close(q.bounds.max[a] - x, a === 0 ? shift : 0),
        ),
    );
  }
  for (const [edit, prefix] of [
    ["bench", "bench."],
    ["trees", "tree."],
  ]) {
    const edited = map(states[edit]);
    check(
      engine,
      "unrelated geometry unchanged for " + edit,
      base
        .filter((p) => !p.name.startsWith(prefix))
        .every((p) => {
          const q = edited.get(p.name);
          return (
            p.points.length === q.points.length &&
            p.points.every((v, i) =>
              v.every((x, a) => close(x, q.points[i][a])),
            )
          );
        }),
    );
  }
}
console.log(
  JSON.stringify({
    schema: 1,
    kind: "independent CPU geometry checks of real frozen author outputs",
    method:
      "Aperture native primitive vertex streams and three.js native BufferGeometry vertices after matrixWorld; no self-reported bounds used",
    tolerance: eps,
    total: all.length,
    passed: all.filter((x) => x.passed).length,
    failed: all.filter((x) => !x.passed),
    checks: all,
  }),
);
if (all.some((x) => !x.passed)) process.exitCode = 1;
