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
export function validateSubmittedTopology(engine, evidence, receipt) {
  const scope = evidence.nativeGeometry.submittedDraws,
    frame = engine === "aperture" ? receipt.nativeFrame : evidence.revision;
  requireValue(
    scope?.frame === frame && scope.submissions > 0 && scope.draws?.length > 0,
    "Missing correlated actual native draw scope",
  );
  for (const expected of expectedPipeCounts(
    engine,
    evidence.sourceGeometry.edit,
  )) {
    const mesh = evidence.nativeGeometry.meshes.find(
      (m) => m.name === expected.name,
    );
    let draws;
    if (engine === "aperture") {
      const labels = mesh.streams.map((s) => `${mesh.name}/vertex:${s.id}`);
      draws = scope.draws.filter((d) =>
        d.vertices.some((v) => labels.includes(v.label)),
      );
      requireValue(
        draws.length > 0 &&
          draws.every(
            (d) =>
              d.method === "draw" &&
              d.count === expected.vertices &&
              d.start === 0 &&
              d.instances === 1,
          ),
        "Wrong submitted Aperture pipe draw count/range",
      );
      for (const d of draws)
        for (const stream of mesh.streams) {
          const b = d.vertices.find(
            (v) => v.label === `${mesh.name}/vertex:${stream.id}`,
          );
          requireValue(
            b &&
              b.size >= stream.byteLength &&
              b.offset === 0 &&
              b.offset + b.size <= b.allocationBytes,
            "Aperture submitted binding range too small",
          );
          const upload = evidence.nativeGeometry.gpuBuffers?.find(
            (record) =>
              record.name === mesh.name &&
              record.streamId === stream.id &&
              record.nativeDrawBufferId === b.id,
          );
          requireValue(
            upload?.ok === true &&
              upload.nativeByteLength === stream.byteLength,
            "Submitted Aperture buffer differs from exact verified upload object",
          );
        }
    } else {
      const index = evidence.resources.inventory.find(
          (v) => v.mesh === mesh.name && v.semantic === "index",
        ),
        position = evidence.resources.inventory.find(
          (v) => v.mesh === mesh.name && v.semantic === "position",
        );
      requireValue(
        index?.nativeDrawBufferId && position?.nativeDrawBufferId,
        "Missing observed native buffer correlation",
      );
      draws = scope.draws.filter(
        (d) => d.index?.id === index.nativeDrawBufferId,
      );
      requireValue(
        draws.length > 0 &&
          draws.every(
            (d) =>
              d.method === "drawIndexed" &&
              d.instances === 1 &&
              d.baseVertex === 0 &&
              d.start >= 0 &&
              d.count > 0 &&
              d.start + d.count <= expected.indices &&
              d.vertices.some((v) => v.id === position.nativeDrawBufferId),
          ),
        "Wrong submitted Three.js pipe draw count/range",
      );
      for (const g of mesh.groups)
        requireValue(
          draws.some((d) => d.start === g.start && d.count === g.count),
          "Missing active native material-group draw",
        );
      for (const d of draws) {
        requireValue(
          d.start % 3 === 0 &&
            d.count % 3 === 0 &&
            d.index.format === "uint32" &&
            d.index.offset === 0 &&
            d.index.size >= expected.indices * 4 &&
            d.index.offset + d.index.size <= d.index.allocationBytes,
          "Wrong submitted index binding range",
        );
        const p = d.vertices.find((v) => v.id === position.nativeDrawBufferId);
        requireValue(
          p.offset === 0 &&
            p.size >= expected.vertices * 12 &&
            p.offset + p.size <= p.allocationBytes,
          "Wrong submitted vertex binding range",
        );
      }
    }
  }
  return true;
}
export function validateTopologyTransition(evidence, state, previous, engine) {
  if (!previous) return true;
  const current = evidence.nativeGeometry.meshes,
    old = previous.nativeGeometry.meshes;
  const stable = (m) => ({
    name: m.name,
    positions: m.positions,
    indices: m.indices,
    worldMatrix: m.worldMatrix,
    streams: m.streams ?? m.cpuStreams,
    submeshes: m.submeshes ?? null,
    groups: m.groups ?? null,
    drawRange: m.drawRange ?? null,
  });
  for (const m of current.filter((m) => !isPipe(m))) {
    const p = old.find((p) => p.name === m.name);
    requireValue(
      JSON.stringify(stable(m)) === JSON.stringify(stable(p)),
      "Nonpipe native geometry changed",
    );
  }
  const before =
      engine === "aperture"
        ? previous.resources.worker
        : previous.resources.nativeObjects,
    after =
      engine === "aperture"
        ? evidence.resources.worker
        : evidence.resources.nativeObjects,
    delta = state.noop ? 0 : 1;
  const deltas =
    engine === "aperture"
      ? {
          meshAssetReplacements: 3 * delta,
          publishedVertexArrayReplacements: 3 * delta,
          publishedIndexArrayReplacements: 0,
          entityCreateCalls: 0,
          entityDestroyCalls: 0,
        }
      : {
          geometryReplacements: delta,
          geometryDisposeCalls: delta,
          attributeReplacements: 3 * delta,
          geometriesCreated: delta,
          attributesCreated: 3 * delta,
          inPlaceAttributeWrites: 0,
          matrixUpdates: 0,
          meshesCreated: 0,
        };
  for (const [key, n] of Object.entries(deltas))
    requireValue(
      Number.isSafeInteger(before[key]) && after[key] - before[key] === n,
      `Wrong observed replacement delta: ${key}`,
    );
  for (const mesh of current) {
    const prior = old.find((m) => m.name === mesh.name),
      changed = isPipe(mesh) && !state.noop;
    if (engine === "aperture")
      requireValue(
        mesh.assetVersion - prior.assetVersion === (changed ? 1 : 0),
        "Wrong pipe/nonpipe asset version",
      );
    else {
      requireValue(
        (mesh.geometryId !== prior.geometryId) === changed,
        "Wrong real geometry replacement identity",
      );
      for (const key of ["position", "normal", "index"])
        requireValue(
          (mesh.attributeIds[key] !== prior.attributeIds[key]) === changed,
          "Wrong real attribute replacement identity",
        );
    }
  }
  return true;
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
