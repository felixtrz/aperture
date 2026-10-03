/** Independent analytic/cardinality/manifold/open-bore/draw-range checks. */
import { topologyFor } from "./contract.mjs";
import { nativeEvidenceBytes } from "./author-a/native-evidence.mjs";
const requireValue = (c, m) => {
  if (!c) throw Error(m);
};
const isPipe = (m) => m.name.startsWith("pipe.hollow-elbow");
const sub = (a, b) => a.map((v, i) => v - b[i]),
  dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0),
  cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ],
  length = (a) => Math.hypot(...a);
function hit(origin, dir, a, b, c, limit) {
  const e1 = sub(b, a),
    e2 = sub(c, a),
    h = cross(dir, e2),
    det = dot(e1, h);
  if (Math.abs(det) < 1e-10) return false;
  const s = sub(origin, a),
    u = dot(s, h) / det,
    q = cross(s, e1),
    v = dot(dir, q) / det,
    t = dot(e2, q) / det;
  return (
    u >= -1e-8 &&
    v >= -1e-8 &&
    u + v <= 1 + 1e-8 &&
    t > 1e-7 &&
    t < limit - 1e-7
  );
}
export function expectedPipeCounts(engine, edit) {
  const { curveSegments: c, radialSegments: s } = topologyFor(edit);
  return engine === "aperture"
    ? [
        { name: "pipe.hollow-elbow.outer", vertices: 6 * c * s, indices: 0 },
        { name: "pipe.hollow-elbow.inner", vertices: 6 * c * s, indices: 0 },
        { name: "pipe.hollow-elbow.rims", vertices: 12 * s, indices: 0 },
      ]
    : [
        {
          name: "pipe.hollow-elbow",
          vertices: 8 * s * (c + 1),
          indices: 12 * s * (c + 1),
        },
      ];
}
export function validateTopology(engine, source, meshes) {
  const { curveSegments: c, radialSegments: s } = topologyFor(source.edit),
    parts = source.parts ?? source.meshes,
    pipes = meshes.filter(isPipe),
    expected = expectedPipeCounts(engine, source.edit),
    triangles = [],
    vertices = new Map(),
    edges = new Map();
  requireValue(pipes.length === expected.length, "Wrong pipe mesh inventory");
  for (const want of expected) {
    const mesh = pipes.find((m) => m.name === want.name),
      part = parts.find((m) => m.name === want.name);
    requireValue(mesh && part, "Missing topology mesh");
    requireValue(
      mesh.positions.length === want.vertices * 3 &&
        mesh.positions.every(Number.isFinite),
      "Stale/truncated native topology vertex count",
    );
    requireValue(
      mesh.indices.length === want.indices,
      "Stale/truncated native topology index count",
    );
    if (engine === "aperture") {
      requireValue(
        part.features.outerRings.length === c + 1 &&
          part.features.innerRings.length === c + 1 &&
          [...part.features.outerRings, ...part.features.innerRings].every(
            (r) => r.length === s,
          ),
        "Stale source ring counts",
      );
      requireValue(
        mesh.indexed === false && mesh.indexBuffer === null,
        "Expected original nonindexed Aperture pipe",
      );
      requireValue(
        mesh.submeshes.length === 1 &&
          mesh.submeshes[0].topology === "triangle-list" &&
          mesh.submeshes[0].vertexStart === 0 &&
          mesh.submeshes[0].vertexCount === want.vertices &&
          mesh.submeshes[0].indexStart === 0 &&
          mesh.submeshes[0].indexCount === 0,
        "Wrong active Aperture draw range",
      );
      for (const stream of mesh.streams) {
        const bytes = nativeEvidenceBytes(stream);
        requireValue(
          stream.vertexCount === want.vertices &&
            bytes.length === want.vertices * stream.arrayStride,
          "Truncated/stale native pipe buffer",
        );
      }
    } else {
      const ringKeys = Object.keys(part.markers).filter((k) =>
        /^(outer|inner)\./.test(k),
      );
      requireValue(
        ringKeys.length === 2 * (c + 1) &&
          ringKeys.every((k) => part.markers[k].length === s),
        "Stale source ring counts",
      );
      requireValue(
        mesh.drawRange?.start === 0 &&
          (mesh.drawRange.count === null ||
            mesh.drawRange.count === want.indices),
        "Wrong active Three.js draw range",
      );
      requireValue(
        mesh.indices.every(
          (i) => Number.isSafeInteger(i) && i >= 0 && i < want.vertices,
        ),
        "Wrong native topology indices",
      );
      let end = 0;
      for (const group of mesh.groups) {
        requireValue(
          group.start === end &&
            Number.isSafeInteger(group.count) &&
            group.count > 0 &&
            group.count % 3 === 0 &&
            [0, 1].includes(group.materialIndex),
          "Wrong active native group range",
        );
        end += group.count;
      }
      requireValue(
        end === want.indices,
        "Truncated/oversized native group coverage",
      );
      const streams = mesh.streams ?? mesh.cpuStreams;
      for (const semantic of ["position", "index"]) {
        const stream = streams.find((x) => x.semantic === semantic),
          n = semantic === "position" ? want.vertices * 3 : want.indices;
        requireValue(
          stream?.arrayType ===
            (semantic === "position" ? "Float32Array" : "Uint32Array") &&
            stream.byteLength === n * 4 &&
            stream.rawBytes?.length === n * 4,
          "Truncated/stale native pipe buffer",
        );
      }
    }
    const indices =
      engine === "aperture"
        ? Array.from({ length: want.vertices }, (_, i) => i)
        : mesh.indices;
    for (let i = 0; i < indices.length; i += 3) {
      const tri = indices
        .slice(i, i + 3)
        .map((j) => mesh.positions.slice(j * 3, j * 3 + 3));
      requireValue(
        length(cross(sub(tri[1], tri[0]), sub(tri[2], tri[0]))) > 1e-9,
        "Degenerate/wrong topology triangle",
      );
      triangles.push(tri);
    }
  }
  // Coordinate welding is validation only. Never modifies submitted arrays.
  const key = (v) => v.map((n) => Math.round(n * 1e5)).join(",");
  for (const tri of triangles) {
    const ids = tri.map((v) => {
      const k = key(v);
      vertices.set(k, v);
      return k;
    });
    for (let i = 0; i < 3; i++) {
      const a = ids[i],
        b = ids[(i + 1) % 3],
        k = [a, b].sort().join("|"),
        e = edges.get(k) ?? { uses: 0, balance: 0 };
      e.uses++;
      e.balance += a < b ? 1 : -1;
      edges.set(k, e);
    }
  }
  requireValue(
    vertices.size === 2 * (c + 1) * s,
    "Wrong independent welded ring cardinality",
  );
  requireValue(
    [...edges.values()].every((e) => e.uses === 2 && e.balance === 0),
    "Nonmanifold or miswound hollow pipe",
  );
  requireValue(
    vertices.size - edges.size + triangles.length === 0,
    "Wrong hollow-pipe Euler characteristic",
  );
  const expectedPoints = [];
  for (const r of [0.24, 0.175])
    for (let i = 0; i <= c; i++)
      for (let j = 0; j < s; j++) {
        const a = (i * Math.PI) / (2 * c),
          b = (j * 2 * Math.PI) / s;
        expectedPoints.push([
          0.85 + 0.8 * Math.sin(a) - r * Math.cos(b) * Math.sin(a),
          0.24 + 0.8 * (1 - Math.cos(a)) + r * Math.cos(b) * Math.cos(a),
          1.72 + r * Math.sin(b),
        ]);
      }
  for (const p of vertices.values())
    requireValue(
      expectedPoints.some((q) => length(sub(p, q)) <= 2e-5),
      "Native pipe changes analytic dimensions or ring sampling",
    );
  for (const q of expectedPoints)
    requireValue(
      [...vertices.values()].some((p) => length(sub(p, q)) <= 2e-5),
      "Missing analytic pipe sample",
    );
  validateOpenBores(triangles);
  return {
    ok: true,
    edit: source.edit,
    curveSegments: c,
    radialSegments: s,
    rings: c + 1,
    weldedVertices: vertices.size,
    triangles: triangles.length,
    edges: edges.size,
    openBoreRays: 6,
    counts: expected,
  };
}
export function validateOpenBores(triangles) {
  for (const z of [-0.1, 0, 0.1])
    for (const [o, d] of [
      [
        [0.77, 0.24, 1.72 + z],
        [1, 0, 0],
      ],
      [
        [1.65, 1.0, 1.72 + z],
        [0, 1, 0],
      ],
    ])
      requireValue(
        !triangles.some((t) => hit(o, d, ...t, 0.12)),
        "Closed hollow opening",
      );
  return true;
}
