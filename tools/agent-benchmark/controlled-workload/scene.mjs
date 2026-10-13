// This module is shared unchanged by both engine adapters and the offline generator.
export const WORKLOAD_SCHEMA = "aperture.controlled-workload.v1";
export const VARIANTS = Object.freeze([
  "baseline",
  "no-shadows",
  "no-textures",
  "dense-geometry",
  "many-objects",
  "many-materials",
]);

const linear = (byte) => {
  const value = byte / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
};
const rgb = (hex) => [16, 8, 0].map((shift) => linear((hex >> shift) & 255));
const normalize = (v) => {
  const length = Math.hypot(...v);
  return v.map((value) => value / length);
};

export const RENDER_RECIPE = Object.freeze({
  viewport: { width: 1024, height: 768 },
  pixelRatio: 1,
  sampleCount: 4,
  tonemap: "aces",
  exposure: 1,
  clearColor: [...rgb(0xb9cee2), 1],
  environment: "constant-ambient-no-ibl",
  ambient: { color: [0.6902, 0.749, 0.7843], intensity: 0.55 },
  sun: {
    directionToLight: normalize([-11, 16, 12]),
    color: [1, 0.7454, 0.4342],
    intensity: 3,
  },
  shadow: {
    mapSize: 2048,
    center: [0, 2.5, 0],
    orthographicSize: 38,
    near: 0.5,
    far: 60,
    lightDistance: 30,
    bias: 0.0004,
    normalBias: 0.04,
    strength: 1,
    filterRadius: 1,
    shadowType: 1,
    cascadeCount: 1,
    reuse: "static-light-and-casters-reuse-after-first-frame",
  },
  effects: { ssao: false, bloom: false, clearcoat: false, normalMap: false },
  camera: {
    position: [14, 9, 19],
    target: [0, 2.5, 1],
    fovYDegrees: 37,
    near: 0.1,
    far: 200,
    frustumCulling: false,
  },
});

function geometry(id, positions, normals, uvs, indices) {
  return {
    id,
    positions: Array.from(Float32Array.from(positions)),
    normals: Array.from(Float32Array.from(normals)),
    uvs: Array.from(Float32Array.from(uvs)),
    indices,
  };
}

function box() {
  const p = [],
    n = [],
    uv = [],
    index = [];
  for (const [normal, u, v] of [
    [
      [1, 0, 0],
      [0, 0, -1],
      [0, 1, 0],
    ],
    [
      [-1, 0, 0],
      [0, 0, 1],
      [0, 1, 0],
    ],
    [
      [0, 1, 0],
      [1, 0, 0],
      [0, 0, -1],
    ],
    [
      [0, -1, 0],
      [1, 0, 0],
      [0, 0, 1],
    ],
    [
      [0, 0, 1],
      [1, 0, 0],
      [0, 1, 0],
    ],
    [
      [0, 0, -1],
      [-1, 0, 0],
      [0, 1, 0],
    ],
  ]) {
    const offset = p.length / 3;
    for (const [a, b] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ]) {
      p.push(...normal.map((c, axis) => (c + a * u[axis] + b * v[axis]) / 2));
      n.push(...normal);
      uv.push((a + 1) / 2, (b + 1) / 2);
    }
    index.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3);
  }
  return geometry("box", p, n, uv, index);
}

function sphere(longitudes, latitudes) {
  const p = [],
    n = [],
    uv = [],
    index = [];
  for (let row = 0; row <= latitudes; row++) {
    const phi = (row / latitudes) * Math.PI;
    for (let col = 0; col <= longitudes; col++) {
      const theta = (col / longitudes) * Math.PI * 2;
      const normal = [
        Math.sin(phi) * Math.cos(theta),
        Math.cos(phi),
        Math.sin(phi) * Math.sin(theta),
      ];
      p.push(...normal.map((value) => value / 2));
      n.push(...normal);
      uv.push(col / longitudes, row / latitudes);
      if (row < latitudes && col < longitudes) {
        const a = row * (longitudes + 1) + col,
          b = a + 1,
          c = a + longitudes + 1,
          d = c + 1;
        // Omit pole-degenerate triangles while retaining the normal/UV seam.
        if (row > 0) index.push(a, b, c);
        if (row < latitudes - 1) index.push(b, d, c);
      }
    }
  }
  return geometry("sphere", p, n, uv, index);
}

function cylinder(segments, cone = false) {
  const p = [],
    n = [],
    uv = [],
    index = [];
  for (let col = 0; col <= segments; col++) {
    const theta = (col / segments) * Math.PI * 2,
      c = Math.cos(theta),
      s = Math.sin(theta);
    const normal = normalize([c, cone ? 0.5 : 0, s]);
    p.push(c / 2, -0.5, s / 2, cone ? 0 : c / 2, 0.5, cone ? 0 : s / 2);
    n.push(...normal, ...normal);
    uv.push(col / segments, 0, col / segments, 1);
    if (col < segments) {
      const a = col * 2;
      index.push(a, a + 1, a + 2);
      if (!cone) index.push(a + 2, a + 1, a + 3);
    }
  }
  for (const y of cone ? [-0.5] : [-0.5, 0.5]) {
    const center = p.length / 3;
    p.push(0, y, 0);
    n.push(0, Math.sign(y), 0);
    uv.push(0.5, 0.5);
    for (let col = 0; col <= segments; col++) {
      const theta = (col / segments) * Math.PI * 2,
        c = Math.cos(theta),
        s = Math.sin(theta);
      p.push(c / 2, y, s / 2);
      n.push(0, Math.sign(y), 0);
      uv.push((c + 1) / 2, (s + 1) / 2);
      if (col < segments)
        index.push(
          center,
          center + col + (y > 0 ? 2 : 1),
          center + col + (y > 0 ? 1 : 2),
        );
    }
  }
  return geometry(cone ? "cone" : "cylinder", p, n, uv, index);
}

function roof() {
  const points = [
    [-0.5, 0, -0.5],
    [0.5, 0, -0.5],
    [0, 0.5, -0.5],
    [-0.5, 0, 0.5],
    [0.5, 0, 0.5],
    [0, 0.5, 0.5],
  ];
  const p = [],
    n = [],
    uv = [],
    index = [];
  for (const face of [
    [0, 2, 1],
    [3, 4, 5],
    [0, 3, 5, 2],
    [1, 2, 5, 4],
    [0, 1, 4, 3],
  ]) {
    const vertices = face.map((i) => points[i]);
    const [a, b, c] = vertices;
    const u = b.map((v, i) => v - a[i]),
      v = c.map((w, i) => w - a[i]);
    const normal = normalize([
      u[1] * v[2] - u[2] * v[1],
      u[2] * v[0] - u[0] * v[2],
      u[0] * v[1] - u[1] * v[0],
    ]);
    const offset = p.length / 3;
    for (const point of vertices) {
      p.push(...point);
      n.push(...normal);
      uv.push(point[0] + 0.5, point[2] + 0.5);
    }
    for (let i = 1; i + 1 < vertices.length; i++)
      index.push(offset, offset + i, offset + i + 1);
  }
  return geometry("roof", p, n, uv, index);
}

function terrain(cells) {
  const p = [],
    n = [],
    uv = [],
    index = [];
  const height = (x, z) => 0.08 * Math.sin(x * 0.4) * Math.cos(z * 0.35);
  for (let row = 0; row <= cells; row++)
    for (let col = 0; col <= cells; col++) {
      const x = -17 + (col * 34) / cells,
        z = -17 + (row * 34) / cells;
      p.push(x, height(x, z) - 0.15, z);
      n.push(
        ...normalize([
          -0.032 * Math.cos(x * 0.4) * Math.cos(z * 0.35),
          1,
          0.028 * Math.sin(x * 0.4) * Math.sin(z * 0.35),
        ]),
      );
      uv.push((col / cells) * 12, (row / cells) * 12);
      if (row < cells && col < cells) {
        const a = row * (cells + 1) + col,
          b = a + 1,
          c = a + cells + 1;
        index.push(a, c, b, b, c, c + 1);
      }
    }
  return geometry("terrain", p, n, uv, index);
}

function checker() {
  const width = 64,
    height = 64,
    bytes = [];
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const value =
        ((Math.floor(x / 8) + Math.floor(y / 8)) % 2 ? 228 : 248) -
        ((x * 13 + y * 17) % 7);
      bytes.push(value, value, value, 255);
    }
  return {
    id: "surface",
    width,
    height,
    bytes,
    colorSpace: "srgb",
    mipmaps: false,
    wrap: "repeat",
    filter: "linear",
  };
}

/** Frozen workload categories are chosen without engine timings or image outcomes. */
export function createWorkload(variant = "baseline") {
  if (!VARIANTS.includes(variant))
    throw new Error(`Unknown controlled variant: ${variant}`);
  const dense = variant === "dense-geometry",
    many = variant === "many-objects";
  const colors = [
    0xb9b09d, 0xba7654, 0x678d5c, 0x596f85, 0x80664e, 0x52614d, 0xd7c8a8,
    0x654f46,
  ];
  const materials = colors.map((hex, i) => ({
    id: `material-${i}`,
    color: [...rgb(hex), 1],
    roughness: i === 3 ? 0.4 : 0.82,
    metallic: 0,
    texture: variant === "no-textures" ? null : "surface",
  }));
  if (variant === "many-materials")
    for (let i = 8; i < 48; i++)
      materials.push({
        ...materials[i % 8],
        id: `material-${i}`,
        color: [
          ...materials[i % 8].color
            .slice(0, 3)
            .map((v) => v * (0.9 + (i % 5) * 0.02)),
          1,
        ],
      });
  const instances = [];
  const add = (
    geometryId,
    mat,
    translation,
    scale = [1, 1, 1],
    yaw = 0,
    castShadow = true,
  ) => {
    const id = `object-${instances.length}`;
    instances.push({
      id,
      geometry: geometryId,
      material: materials[mat % materials.length].id,
      translation: translation.map(Math.fround),
      scale: scale.map(Math.fround),
      rotation: [
        0,
        Math.fround(Math.sin(yaw / 2)),
        0,
        Math.fround(Math.cos(yaw / 2)),
      ],
      castShadow,
      receiveShadow: true,
    });
  };
  add("terrain", 5, [0, 0, 0], [1, 1, 1], 0, false);
  add("box", 0, [0, -0.05, 1], [14, 0.08, 16], 0, false);
  // Small architecture, street furniture, foliage and reusable props cover
  // broad opaque game costs rather than one deliberately favorable primitive.
  for (const [x, z, yaw] of [
    [-5, -5, 0],
    [4, -5, 0],
    [-5, 5, Math.PI],
    [4, 5, Math.PI],
  ]) {
    add("box", 0, [x, 1.4, z], [3, 2.8, 2.6], yaw);
    add("roof", 1, [x, 2.8, z], [3.5, 1.5, 3.1], yaw);
    add("box", 4, [x, 0.7, z + (yaw ? -1.31 : 1.31)], [0.65, 1.4, 0.05]);
    for (const dx of [-0.9, 0.9])
      add(
        "box",
        3,
        [x + dx, 1.6, z + (yaw ? -1.32 : 1.32)],
        [0.55, 0.65, 0.06],
      );
    for (const dx of [-1.3, 1.3])
      add("cylinder", 6, [x + dx, 1, z + (yaw ? -2 : 2)], [0.16, 2, 0.16]);
  }
  add("cylinder", 6, [0, 0.25, 0], [3.2, 0.5, 3.2]);
  add("sphere", 3, [0, 1.2, 0], [1.1, 1.4, 1.1]);
  for (let i = 0; i < 12; i++) {
    const theta = (i * Math.PI * 2) / 12;
    add(
      "box",
      4,
      [Math.cos(theta) * 3, 0.4, Math.sin(theta) * 3],
      [0.75, 0.8, 0.7],
      theta,
    );
  }
  const count = many ? 320 : 80;
  for (let i = 0; i < count; i++) {
    // Irrational angular steps provide deterministic distribution without RNG.
    const theta = i * 2.399963229728653,
      radius = 7.8 + ((i % 17) / 17) * 5.2;
    const x = Math.cos(theta) * radius,
      z = Math.sin(theta) * radius;
    const mat = variant === "many-materials" ? i % materials.length : 2;
    const height = 1.5 + (i % 7) * 0.2;
    add("cylinder", 4, [x, height * 0.35, z], [0.16, height * 0.7, 0.16]);
    add(
      i % 2 ? "sphere" : "cone",
      mat,
      [x, height, z],
      [0.9 + (i % 3) * 0.2, height, 0.9 + (i % 3) * 0.2],
      i * 0.37,
    );
    if (i % 4 === 0)
      add("sphere", 7, [x + 0.9, 0.15, z + 0.6], [0.6, 0.35, 0.5], i);
  }
  return {
    schema: WORKLOAD_SCHEMA,
    variant,
    settings: {
      ...RENDER_RECIPE,
      shadow: { ...RENDER_RECIPE.shadow, enabled: variant !== "no-shadows" },
    },
    geometries: [
      box(),
      sphere(dense ? 40 : 16, dense ? 24 : 10),
      cylinder(dense ? 40 : 16),
      cylinder(dense ? 40 : 16, true),
      roof(),
      terrain(dense ? 64 : 20),
    ],
    materials,
    textures: variant === "no-textures" ? [] : [checker()],
    instances,
  };
}

export function typedGeometry(source) {
  return {
    ...source,
    positions: Float32Array.from(source.positions),
    normals: Float32Array.from(source.normals),
    uvs: Float32Array.from(source.uvs),
    indices: source.indices.some((index) => index > 0xffff)
      ? Uint32Array.from(source.indices)
      : Uint16Array.from(source.indices),
  };
}

export function groupedInstances(workload) {
  const groups = new Map();
  for (const instance of workload.instances) {
    const key = [
      instance.geometry,
      instance.material,
      instance.castShadow,
      instance.receiveShadow,
    ].join("/");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(instance);
  }
  return [...groups.entries()].map(([id, instances]) => ({ id, instances }));
}
