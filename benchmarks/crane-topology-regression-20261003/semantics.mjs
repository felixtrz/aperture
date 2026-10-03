/** Independent physical checks on actual native positions; no raster proxies. */
import { topologyFor } from './contract.mjs';
const add = (a, b) => a.map((v, i) => v + b[i]);
const mean = (values) =>
  values.reduce((a, b) => add(a, b), [0, 0, 0]).map((v) => v / values.length);
const transform = (v, m) => [
  m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12],
  m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13],
  m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14],
];
export function expectedKinematics(p) {
  const angle = (p.shoulder_deg * Math.PI) / 180,
    elbow = ((p.shoulder_deg + p.elbow_deg) * Math.PI) / 180;
  const P = [-2.15, 1.25 + p.top_tier_height - 0.18, 0.15];
  const E = add(P, [2.6 * Math.cos(angle), 2.6 * Math.sin(angle), 0]);
  const T = add(E, [1.7 * Math.cos(elbow), 1.7 * Math.sin(elbow), 0]);
  const H = add(T, [0, -p.hoist_length, 0]);
  const yaw = (p.assembly_yaw_deg * Math.PI) / 180,
    c = Math.cos(yaw),
    s = Math.sin(yaw);
  const assemble = (q) => [
    -2.15 + c * (q[0] + 2.15) + s * (q[2] - 0.15) + p.assembly_dx,
    q[1],
    0.15 - s * (q[0] + 2.15) + c * (q[2] - 0.15) + p.assembly_dz,
  ];
  return Object.fromEntries(
    Object.entries({
      P,
      E,
      T,
      H,
      load: add(H, [0, -0.83, 0]),
      platform: [-2.15, 0.32 + p.top_tier_height / 2, 0.15],
    }).map(([k, v]) => [k, assemble(v)]),
  );
}
export function inspectSemantics(engine, source, nativeMeshes) {
  const meshes = new Map(nativeMeshes.map((m) => [m.name, m])),
    checks = [];
  const parts = new Map(
    (source.parts ?? source.meshes).map((p) => [p.name, p]),
  );
  function vertex(name, index) {
    const mesh = meshes.get(name),
      part = parts.get(name);
    if (!mesh || !part) throw Error(`Missing semantic mesh: ${name}`);
    // A triangle-list expands authored indices. Recover the native occurrence,
    // never the source position; B keeps its authored marker-to-native indices.
    const nativeIndex =
      engine === "aperture" && !part.extrusion
        ? part.indices.indexOf(index)
        : index;
    if (nativeIndex < 0)
      throw Error(`Unrepresented marker vertex: ${name}:${index}`);
    return transform(
      mesh.positions.slice(nativeIndex * 3, nativeIndex * 3 + 3),
      mesh.worldMatrix ?? mesh.matrix,
    );
  }
  function marker(name, aKey, bKey) {
    const part = parts.get(name),
      ids = engine === "aperture" ? part.features[aKey] : part.markers[bKey];
    if (!ids?.length) throw Error(`Missing semantic marker: ${name}`);
    return mean(ids.map((index) => vertex(name, index)));
  }
  function center(name) {
    const mesh = meshes.get(name),
      v = [];
    for (let i = 0; i < mesh.positions.length / 3; i++)
      v.push(
        transform(
          mesh.positions.slice(i * 3, i * 3 + 3),
          mesh.worldMatrix ?? mesh.matrix,
        ),
      );
    return [0, 1, 2].map(
      (axis) =>
        (Math.min(...v.map((x) => x[axis])) +
          Math.max(...v.map((x) => x[axis]))) /
        2,
    );
  }
  const actual = {
    P: marker("crane.boom.lower", "startRing", "start"),
    E: marker("crane.boom.lower", "endRing", "end"),
    T: marker("crane.boom.upper", "endRing", "end"),
    H: marker("crane.hoist.cable", "endRing", "end"),
    load: center("crane.load.body"),
    platform: center("platform.upper"),
  };
  const near = (name, a, b) => {
    const error = Math.max(...a.map((v, i) => Math.abs(v - b[i])));
    checks.push({ name, ok: error <= 2e-5, error, actual: a, expected: b });
  };
  const expected = expectedKinematics(source.parameters);
  for (const key of Object.keys(expected))
    near(key, actual[key], expected[key]);
  near(
    "elbow continuity",
    marker("crane.boom.upper", "startRing", "start"),
    actual.E,
  );
  near(
    "hoist tip continuity",
    marker("crane.hoist.cable", "startRing", "start"),
    actual.T,
  );
  const pipeName =
      engine === "aperture" ? "pipe.hollow-elbow.outer" : "pipe.hollow-elbow",
    pipe = parts.get(pipeName),
    R = source.parameters.pipe_bend_radius;
  const { curveSegments } = topologyFor(source.edit);
  for (let ring = 0; ring <= curveSegments; ring++) {
    const ids =
      engine === "aperture"
        ? pipe.features.outerRings[ring]
        : pipe.markers[`outer.${ring}`];
    near(
      `pipe center ${ring}`,
      mean(ids.map((index) => vertex(pipeName, index))),
      [
        0.85 + R * Math.sin((ring * Math.PI) / (2 * curveSegments)),
        0.24 + R * (1 - Math.cos((ring * Math.PI) / (2 * curveSegments))),
        1.72,
      ],
    );
  }
  const r = source.parameters.opening_width / 2;
  const archPoint = (name, which) =>
    engine === "aperture"
      ? mean(
          (which === "left" ? [0, 4] : [1, 5]).map((index) =>
            vertex(name, index),
          ),
        )
      : marker(name, null, which === "left" ? "inner0" : "inner1");
  near("arch left", archPoint("wall.arch.00", "left"), [1.2 - r, 1.1, -2.05]);
  near("arch right", archPoint("wall.arch.11", "right"), [1.2 + r, 1.1, -2.05]);
  return { ok: checks.every((c) => c.ok), tolerance: 2e-5, checks, actual };
}
