import * as THREE from "three/webgpu";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

// Deterministic Mediterranean roadside house. Every ornament is retained scene geometry.
let seed = 329187;
function rand() {
  seed = (1664525 * seed + 1013904223) >>> 0;
  return seed / 4294967296;
}
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa5bfd7);
scene.fog = new THREE.Fog(0xa5bfd7, 32, 85);
const camera = new THREE.PerspectiveCamera(37, 1024 / 768, 0.1, 200);
camera.position.set(14, 9, 19);
camera.lookAt(0, 2.5, 1);
const renderer = new THREE.WebGPURenderer({
  antialias: true,
  samples: 4,
  forceWebGL: false,
});
renderer.setPixelRatio(1);
renderer.setSize(1024, 768);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
const sun = new THREE.DirectionalLight(0xffe4b7, 3.2);
sun.position.set(-10, 18, 11);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, {
  left: -18,
  right: 18,
  top: 18,
  bottom: -18,
  near: 1,
  far: 55,
});
sun.shadow.bias = -0.0003;
sun.shadow.normalBias = 0.035;
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xb8d2eb, 0x827555, 1.55));
const fill = new THREE.DirectionalLight(0xc2d8ec, 0.35);
fill.position.set(12, 8, -8);
scene.add(fill);
const mats = {};
const textures = [];
function noiseTexture(base, size = 128, amount = 22) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(size, size);
  const rgb = new THREE.Color(base);
  const vals = [rgb.r, rgb.g, rgb.b].map((v) => Math.pow(v, 1 / 2.2) * 255);
  for (let i = 0; i < size * size; i++) {
    const v = (rand() - 0.5) * amount;
    for (let k = 0; k < 3; k++)
      img.data[i * 4 + k] = Math.max(0, Math.min(255, vals[k] + v));
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  textures.push(t);
  return t;
}
function material(name, color, roughness = 1, extra = {}) {
  return (mats[name] = new THREE.MeshStandardMaterial({
    color,
    roughness,
    ...extra,
  }));
}
const stuccoTex = noiseTexture(0xd3c9b6, 256, 32);
stuccoTex.repeat.set(4, 4);
const stucco = material("stucco", 0xffffff, 0.96, {
  map: stuccoTex,
  bumpMap: stuccoTex,
  bumpScale: 0.055,
});
const foundation = material("foundation", 0xb3a288, 0.92);
const stoneTex = noiseTexture(0x9e998b, 128, 35);
stoneTex.repeat.set(2, 2);
const stone = material("stone", 0xe5d2ae, 0.94, {
  map: stoneTex,
  bumpMap: stoneTex,
  bumpScale: 0.045,
});
const mortar = material("mortar", 0x8b8575, 0.98);
const clayTex = noiseTexture(0xa8754b, 128, 38);
const clay = material("terracotta", 0xffe5c4, 0.92, {
  map: clayTex,
  bumpMap: clayTex,
  bumpScale: 0.04,
});
const wood = material("aged timber", 0x5e4732, 0.82),
  trim = material("window frames", 0x393d3c, 0.6),
  glass = material("window glass", 0x38474b, 0.15, {
    metalness: 0.5,
    transparent: true,
    opacity: 0.72,
  });
const curtain = material("linen curtains", 0xccc3ab, 1),
  gutter = material("gutters", 0x4f4e43, 0.62, { metalness: 0.45 });
const blue = new THREE.MeshPhysicalMaterial({
  color: 0x1261a3,
  metalness: 0.58,
  roughness: 0.25,
  clearcoat: 1,
  clearcoatRoughness: 0.2,
});
const rubber = material("rubber", 0x191b1e, 0.93),
  black = material("dark trim", 0x1f2226, 0.64),
  chrome = material("alloy", 0xabb8be, 0.27, { metalness: 0.9 });
const carGlass = new THREE.MeshPhysicalMaterial({
  color: 0x223743,
  metalness: 0.25,
  roughness: 0.1,
  transparent: true,
  opacity: 0.83,
  clearcoat: 1,
  side: THREE.DoubleSide,
});
const tan = material("seats", 0x776a55, 0.85),
  lamp = material("headlamp", 0xe5e6cf, 0.18, { metalness: 0.4 }),
  red = material("tail light", 0xa91212, 0.24, { metalness: 0.2 });
const grassTex = noiseTexture(0x78824b, 256, 45);
grassTex.repeat.set(28, 28);
const grass = material("grass", 0xe4dfbd, 1, {
  map: grassTex,
  bumpMap: grassTex,
  bumpScale: 0.08,
});
const asphaltTex = noiseTexture(0x474950, 256, 45);
asphaltTex.repeat.set(9, 9);
const asphalt = material("asphalt", 0x8b8b88, 1, {
  map: asphaltTex,
  bumpMap: asphaltTex,
  bumpScale: 0.03,
});
const curbMat = material("curbs", 0xbcb4a0, 0.97),
  stripe = material("road paint", 0xe8e4d2, 0.95);
const soil = material("soil", 0x5c5035, 1),
  bark = material("olive bark", 0x635344, 1),
  leaves = material("leaves", 0x9ca772, 0.92, { side: THREE.DoubleSide });
const flowerMat = material("flowers", 0xa69aba, 0.96),
  potMat = material("pots", 0xae6841, 0.92),
  mailMat = material("mailbox", 0x434747, 0.65, { metalness: 0.4 });
// A procedural sky is used only for ambient material reflections, not a baked scene.
const ec = document.createElement("canvas");
ec.width = 512;
ec.height = 256;
const ex = ec.getContext("2d");
const eg = ex.createLinearGradient(0, 0, 0, 256);
eg.addColorStop(0, "#719bbd");
eg.addColorStop(0.45, "#cee1ed");
eg.addColorStop(0.52, "#d4c7a3");
eg.addColorStop(0.7, "#6e784f");
eg.addColorStop(1, "#474c30");
ex.fillStyle = eg;
ex.fillRect(0, 0, 512, 256);
for (let i = 0; i < 35; i++) {
  ex.fillStyle = "rgba(255,248,226,0.14)";
  ex.beginPath();
  ex.ellipse(
    rand() * 512,
    35 + rand() * 55,
    10 + rand() * 60,
    3 + rand() * 12,
    0,
    0,
    Math.PI * 2,
  );
  ex.fill();
}
const env = new THREE.CanvasTexture(ec);
env.mapping = THREE.EquirectangularReflectionMapping;
env.colorSpace = THREE.SRGBColorSpace;
scene.environment = env;
textures.push(env);
const unitBox = new THREE.BoxGeometry(1, 1, 1),
  roundBox = new RoundedBoxGeometry(1, 1, 1, 2, 0.075);
const pools = new Map();
const tm = new THREE.Matrix4(),
  q = new THREE.Quaternion(),
  ev = new THREE.Euler(),
  ps = new THREE.Vector3(),
  sc = new THREE.Vector3();
function batch(name, geo, mat, cast = true) {
  const key = name;
  if (!pools.has(key)) pools.set(key, { name, geo, mat, cast, items: [] });
  return pools.get(key);
}
function inst(pool, p, scale = [1, 1, 1], rotation = [0, 0, 0], color = null) {
  ps.fromArray(p);
  sc.fromArray(scale);
  q.setFromEuler(ev.set(...rotation));
  tm.compose(ps, q, sc);
  pool.items.push({ matrix: tm.clone(), color });
}
const stoneGeo = new RoundedBoxGeometry(1, 1, 1, 3, 0.055);
const stoneP = stoneGeo.getAttribute("position");
for (let i = 0; i < stoneP.count; i++) {
  const x = stoneP.getX(i),
    y = stoneP.getY(i),
    z = stoneP.getZ(i);
  stoneP.setXYZ(
    i,
    x + 0.018 * Math.sin(y * 13 + z * 9),
    y + 0.019 * Math.sin(x * 11 + z * 6),
    z + 0.021 * Math.sin(x * 12 + y * 7),
  );
}
stoneGeo.computeVertexNormals();
const stonePool = batch("individual garden masonry", stoneGeo, stone),
  clayPool = batch("roof field tiles", tileGeometry(0.142, 0.57), clay),
  boxStucco = batch("stucco wall panels", unitBox, stucco);
function mesh(
  name,
  geo,
  mat,
  pos = [0, 0, 0],
  rot = [0, 0, 0],
  scale = [1, 1, 1],
  parent = scene,
) {
  const o = new THREE.Mesh(geo, mat);
  o.name = name;
  o.position.fromArray(pos);
  o.rotation.set(...rot);
  o.scale.fromArray(scale);
  o.castShadow = true;
  o.receiveShadow = true;
  parent.add(o);
  return o;
}
function box(
  name,
  size,
  pos,
  mat,
  rot = [0, 0, 0],
  parent = scene,
  rounded = false,
) {
  return mesh(name, rounded ? roundBox : unitBox, mat, pos, rot, size, parent);
}
function cyl(name, a, b, r, mat, parent = scene, r2 = r, segments = 8) {
  const aa = new THREE.Vector3(...a),
    bb = new THREE.Vector3(...b),
    delta = bb.clone().sub(aa);
  const o = mesh(
    name,
    new THREE.CylinderGeometry(r2, r, delta.length(), segments),
    mat,
    aa.clone().add(bb).multiplyScalar(0.5).toArray(),
    [0, 0, 0],
    [1, 1, 1],
    parent,
  );
  o.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    delta.normalize(),
  );
  return o;
}
function poly(name, pts, indices, mat, parent = scene) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pts.flat(), 3));
  g.setIndex(indices);
  g.setAttribute(
    "uv",
    new THREE.Float32BufferAttribute(
      pts.flatMap((v) => [v[0] + v[2], v[1]]),
      2,
    ),
  );
  g.computeVertexNormals();
  return mesh(name, g, mat, [0, 0, 0], [0, 0, 0], [1, 1, 1], parent);
}
function tileGeometry(r, len) {
  const p = [],
    uv = [],
    idx = [],
    n = 10;
  for (let j = 0; j < 2; j++)
    for (let k = 0; k <= n; k++) {
      const t = (k / n) * Math.PI,
        rr = r * (j ? 1 : 0.9);
      p.push(rr * Math.cos(t), rr * Math.sin(t), j ? len / 2 : -len / 2);
      uv.push(k / n, j);
    }
  for (let k = 0; k < n; k++) {
    let a = k,
      b = k + 1,
      c = n + 1 + k,
      d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  const off = p.length / 3;
  for (let k = 0; k <= n; k++) {
    let t = (k / n) * Math.PI;
    for (let rr of [r, r - 0.025]) {
      p.push(rr * Math.cos(t), rr * Math.sin(t), len / 2);
      uv.push(k / n, rr === r ? 1 : 0.96);
    }
  }
  for (let k = 0; k < n; k++) {
    const a = off + 2 * k;
    idx.push(a, a + 2, a + 1, a + 2, a + 3, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
// Lawn and true curved road ribbon, with segmented curbs and center markings.
box("land", [100, 0.16, 100], [0, -0.12, 0], grass);
const road = new THREE.CatmullRomCurve3([
  new THREE.Vector3(-17, 0.015, 9.4),
  new THREE.Vector3(-8, 0.015, 9.5),
  new THREE.Vector3(0, 0.015, 9.5),
  new THREE.Vector3(6, 0.015, 8.75),
  new THREE.Vector3(10.5, 0.015, 4.9),
  new THREE.Vector3(11.7, 0.015, -1),
  new THREE.Vector3(11.5, 0.015, -15),
]);
function ribbon(curve, width, height = 0) {
  const p = [],
    uv = [],
    idx = [];
  const steps = 160;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps,
      c = curve.getPointAt(t),
      v = curve.getTangentAt(t),
      right = new THREE.Vector3(-v.z, 0, v.x).normalize();
    for (const side of [-1, 1]) {
      p.push(
        c.x + right.x * width * 0.5 * side,
        c.y + height,
        c.z + right.z * width * 0.5 * side,
      );
      uv.push(side * 0.5 + 0.5, t * 5);
    }
    if (i < steps) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
mesh("asphalt sweeping bend", ribbon(road, 4.6), asphalt);
const curbPool = batch("segmented pale curb", roundBox, curbMat);
const sidewalkPool = batch("pavement slabs", roundBox, curbMat);
for (let i = 0; i < 77; i++) {
  let t = (i + 0.5) / 77,
    c = road.getPointAt(t),
    v = road.getTangentAt(t),
    r = new THREE.Vector3(-v.z, 0, v.x).normalize(),
    a = Math.atan2(v.x, v.z);
  inst(
    curbPool,
    [c.x - r.x * 2.44, 0.11, c.z - r.z * 2.44],
    [0.29, 0.25, 0.61],
    [0, a, 0],
  );
  inst(
    sidewalkPool,
    [c.x - r.x * 2.94, 0.055, c.z - r.z * 2.94],
    [0.78, 0.15, 0.61],
    [0, a, 0],
    new THREE.Color(0xbcb4a3).multiplyScalar(0.9 + rand() * 0.18),
  );
  if (i % 3 === 0 && i > 1 && i < 75)
    box(
      "broken white road marking",
      [0.13, 0.011, 0.92],
      [c.x, 0.027, c.z],
      stripe,
      [0, a, 0],
    );
}
// Wall openings are real holes, assembled from a deterministic rectangular partition.
const hx = -1.3,
  hz = -1,
  front = 2.2,
  back = -4.2,
  right = 3,
  left = -5.6,
  wallH = 6.42;
function wall(name, min, max, axis, fixed, holes) {
  const cuts = [
      min,
      max,
      ...holes.flatMap((h) => [h.u - h.w / 2, h.u + h.w / 2]),
    ].sort((a, b) => a - b),
    ys = [
      0.28,
      wallH,
      ...holes.flatMap((h) => [h.y - h.h / 2, h.y + h.h / 2]),
    ].sort((a, b) => a - b);
  for (let i = 0; i < cuts.length - 1; i++)
    for (let j = 0; j < ys.length - 1; j++) {
      const u = (cuts[i] + cuts[i + 1]) / 2,
        y = (ys[j] + ys[j + 1]) / 2;
      if (
        holes.some(
          (h) =>
            Math.abs(u - h.u) < h.w / 2 - 0.0001 &&
            Math.abs(y - h.y) < h.h / 2 - 0.0001,
        )
      )
        continue;
      const w = cuts[i + 1] - cuts[i],
        h = ys[j + 1] - ys[j];
      if (w < 0.001 || h < 0.001) continue;
      inst(
        boxStucco,
        axis === "x" ? [u, y, fixed] : [fixed, y, u],
        axis === "x" ? [w, h, 0.24] : [0.24, h, w],
      );
    }
  box(
    name + " foundation",
    axis === "x" ? [max - min, 0.32, 0.3] : [0.3, 0.32, max - min],
    axis === "x"
      ? [(min + max) / 2, 0.18, fixed]
      : [fixed, 0.18, (min + max) / 2],
    foundation,
  );
}
const frontHoles = [
  { u: -3.65, y: 4.75, w: 1.5, h: 1.75 },
  { u: 0.75, y: 4.75, w: 1.65, h: 1.75 },
  { u: -4.22, y: 1.7, w: 1.25, h: 1.68 },
  { u: 1.1, y: 1.7, w: 1.17, h: 1.68 },
  { u: -1.25, y: 1.43, w: 1.16, h: 2.3 },
];
const sideHoles = [
  { u: -2.75, y: 4.75, w: 0.93, h: 1.62 },
  { u: 0.55, y: 4.75, w: 0.93, h: 1.62 },
  { u: -2.75, y: 1.65, w: 1.05, h: 1.65 },
  { u: 0.55, y: 1.65, w: 1.05, h: 1.65 },
];
wall("front", left, right, "x", front, frontHoles);
wall("right", back, front, "z", right, sideHoles);
wall("left", back, front, "z", left, sideHoles);
wall("rear", left, right, "x", back, [
  { u: -3.6, y: 4.7, w: 1.3, h: 1.6 },
  { u: 0.7, y: 4.7, w: 1.3, h: 1.6 },
  { u: -3.6, y: 1.7, w: 1.3, h: 1.6 },
  { u: 0.7, y: 1.7, w: 1.3, h: 1.6 },
]);
function houseWindow(name, u, y, w, h, axis, fixed, sign = 1) {
  const group = new THREE.Group();
  group.name = name;
  group.position.set(axis === "x" ? u : fixed, y, axis === "x" ? fixed : u);
  if (axis === "z") group.rotation.y = (sign * Math.PI) / 2;
  else if (sign < 0) group.rotation.y = Math.PI;
  scene.add(group);
  box(
    "reveal shadow",
    [w - 0.025, h - 0.02, 0.025],
    [0, 0, -0.12],
    black,
    [0, 0, 0],
    group,
  );
  box(
    "reflective inset pane",
    [w - 0.14, h - 0.13, 0.015],
    [0, 0, -0.02],
    glass,
    [0, 0, 0],
    group,
  );
  for (let s of [-1, 1]) {
    box(
      "window jamb",
      [0.066, h, 0.12],
      [s * (w / 2 - 0.034), 0, 0],
      trim,
      [0, 0, 0],
      group,
    );
    box(
      "linen curtain",
      [w * 0.17, h - 0.18, 0.018],
      [s * w * 0.32, 0, -0.05],
      curtain,
      [0, 0, 0],
      group,
    );
  }
  for (let s of [-1, 1])
    box(
      "window rail",
      [w, 0.065, 0.12],
      [0, s * (h / 2 - 0.03), 0],
      trim,
      [0, 0, 0],
      group,
    );
  box(
    "center mullion",
    [0.057, h - 0.11, 0.13],
    [0, 0, 0.007],
    trim,
    [0, 0, 0],
    group,
  );
  box(
    "cross transom",
    [w - 0.1, 0.038, 0.1],
    [0, -0.08, 0.008],
    trim,
    [0, 0, 0],
    group,
  );
  box(
    "stone sill",
    [w + 0.22, 0.12, 0.41],
    [0, -h / 2 - 0.075, 0.04],
    stone,
    [0, 0, 0],
    group,
  );
  box(
    "interior plant pot",
    [0.15, 0.13, 0.12],
    [w * 0.25, -h * 0.4, -0.045],
    potMat,
    [0, 0, 0],
    group,
    true,
  );
  mesh(
    "plant at window",
    new THREE.SphereGeometry(0.13, 7, 5),
    leaves,
    [w * 0.25, -h * 0.3, -0.038],
    [0, 0, 0],
    [0.8, 1.3, 0.55],
    group,
  );
}
frontHoles
  .slice(0, 4)
  .forEach((h, i) =>
    houseWindow("front window " + i, h.u, h.y, h.w, h.h, "x", front + 0.015),
  );
sideHoles.forEach((h, i) => {
  houseWindow("right window " + i, h.u, h.y, h.w, h.h, "z", right + 0.015);
  houseWindow("left window " + i, h.u, h.y, h.w, h.h, "z", left - 0.015, -1);
});
[
  { u: -3.6, y: 4.7 },
  { u: 0.7, y: 4.7 },
  { u: -3.6, y: 1.7 },
  { u: 0.7, y: 1.7 },
].forEach((h, i) =>
  houseWindow("rear window " + i, h.u, h.y, 1.3, 1.6, "x", back - 0.015, -1),
);
// Solid triangular gables, roof decks, clay barrel tiles, fascia and drainage.
poly(
  "right stucco gable",
  [
    [right, 6.42, back],
    [right, 6.42, front],
    [right, 8.35, hz],
  ],
  [0, 2, 1],
  stucco,
);
poly(
  "left stucco gable",
  [
    [left, 6.42, front],
    [left, 6.42, back],
    [left, 8.35, hz],
  ],
  [0, 2, 1],
  stucco,
);
const roofAngle = Math.atan2(1.94, 3.63);
for (const s of [-1, 1]) {
  const angle = s * roofAngle;
  box("main roof deck", [9.4, 0.12, 4.13], [hx, 7.42, hz + s * 1.83], wood, [
    angle,
    0,
    0,
  ]);
  for (let row = 0; row < 8; row++)
    for (let col = 0; col < 35; col++) {
      const d = 0.24 + row * 0.49;
      inst(
        clayPool,
        [
          hx - 4.62 + col * 0.271 + (row % 2) * 0.015,
          8.38 - d * Math.sin(roofAngle),
          hz + s * d * Math.cos(roofAngle),
        ],
        [1, 1, 1],
        [angle, 0, 0],
        new THREE.Color(0xffffff).multiplyScalar(0.76 + rand() * 0.37),
      );
    }
  box("dark eaves fascia", [9.45, 0.19, 0.14], [hx, 6.48, hz + s * 3.73], wood);
  cyl(
    "eaves gutter",
    [hx - 4.72, 6.4, hz + s * 3.75],
    [hx + 4.72, 6.4, hz + s * 3.75],
    0.068,
    gutter,
    scene,
    0.068,
    10,
  );
}
const ridgePool = batch("ridge cap tiles", tileGeometry(0.18, 0.52), clay);
for (let i = 0; i < 19; i++)
  inst(
    ridgePool,
    [hx - 4.55 + i * 0.49, 8.41, hz],
    [1, 1, 1],
    [0, Math.PI / 2, 0],
    new THREE.Color(0xffffff).multiplyScalar(0.9 + rand() * 0.2),
  );
for (const x of [left - 0.3, right + 0.3])
  for (const s of [-1, 1])
    cyl(
      "gable wooden verge",
      [x, 8.34, hz],
      [x, 6.38, hz + s * 3.74],
      0.073,
      wood,
      scene,
      0.073,
      8,
    );
for (const x of [left + 0.01, right - 0.01]) {
  cyl("front downpipe", [x, 6.37, 2.6], [x, 6.15, 2.37], 0.047, gutter);
  cyl(
    "front downpipe vertical",
    [x, 6.15, 2.37],
    [x, 0.4, 2.37],
    0.047,
    gutter,
  );
}
// Chimney with open smoke vents and a small terracotta hood.
box("chimney stack", [0.7, 1.2, 0.82], [1.3, 8.388, -1.6], stucco);
box("chimney collar", [0.86, 0.11, 0.98], [1.3, 8.892, -1.6], stone);
box("chimney dark interior", [0.6, 0.28, 0.64], [1.3, 9.072, -1.6], black);
for (let x of [1.0, 1.6])
  for (let z of [-1.91, -1.29])
    box("chimney cap upright", [0.095, 0.3, 0.095], [x, 9.084, z], stucco);
for (let s of [-1, 1])
  box(
    "chimney clay cap",
    [1.06, 0.11, 0.62],
    [1.3, 9.24, -1.6 + s * 0.25],
    clay,
    [s * 0.2, 0, 0],
  );
// Covered porch and recessed front door.
box("porch stone platform", [5.85, 0.28, 1.75], [-1.3, 0.16, 3.01], stone);
box("porch first step", [2.7, 0.14, 0.54], [-1.25, 0.065, 4.0], stone);
box("porch second step", [2.42, 0.15, 0.37], [-1.25, 0.19, 3.75], stone);
for (const x of [-3.93, 1.33]) {
  box("square porch post", [0.31, 2.94, 0.34], [x, 1.74, 3.75], stucco);
  box("post foot", [0.46, 0.17, 0.46], [x, 0.4, 3.75], stone);
  box("post capital", [0.47, 0.17, 0.46], [x, 3.2, 3.75], stucco);
}
box("porch front beam", [6.1, 0.25, 0.27], [-1.3, 3.32, 3.77], wood);
box("porch beam facing", [6.05, 0.17, 0.08], [-1.3, 3.33, 3.93], stucco);
const pa = Math.atan2(0.59, 2.08);
box("porch roof substrate", [6.25, 0.12, 2.2], [-1.3, 3.66, 3.13], wood, [
  pa,
  0,
  0,
]);
for (let row = 0; row < 5; row++)
  for (let col = 0; col < 23; col++) {
    let d = 0.12 + row * 0.44;
    inst(
      clayPool,
      [-4.35 + col * 0.273, 4.0 - d * Math.sin(pa), 2.12 + d * Math.cos(pa)],
      [1, 1, 1],
      [pa, 0, 0],
      new THREE.Color(0xffffff).multiplyScalar(0.8 + rand() * 0.3),
    );
  }
cyl(
  "porch gutter",
  [-4.46, 3.39, 4.16],
  [1.86, 3.39, 4.16],
  0.065,
  gutter,
  scene,
  0.065,
  10,
);
box("door recessed surround", [1.22, 2.38, 0.1], [-1.25, 1.45, 2.18], stone);
box("front door", [1.05, 2.21, 0.08], [-1.25, 1.42, 2.23], trim);
for (let y of [0.7, 1.62])
  for (let x of [-1.51, -0.99]) {
    box("door panel molding", [0.42, 0.77, 0.02], [x, y, 2.279], gutter);
    box("door panel inset", [0.34, 0.68, 0.024], [x, y, 2.292], trim);
  }
box("door handle", [0.025, 0.17, 0.028], [-1.67, 1.25, 2.315], chrome);
box("door threshold", [1.28, 0.075, 0.33], [-1.25, 0.305, 2.25], stone);
// Lantern beside the entry.
cyl("lantern bracket", [-2.35, 2.46, 2.29], [-2.35, 2.46, 2.52], 0.025, black);
box("lantern glass", [0.16, 0.27, 0.15], [-2.35, 2.26, 2.5], lamp);
for (let x of [-0.085, 0.085])
  for (let z of [-0.085, 0.085])
    cyl(
      "lantern iron corner",
      [-2.35 + x, 2.1, 2.5 + z],
      [-2.35 + x, 2.43, 2.5 + z],
      0.014,
      black,
    );
mesh(
  "lantern roof",
  new THREE.ConeGeometry(0.18, 0.14, 4),
  black,
  [-2.35, 2.48, 2.5],
  [0, Math.PI / 4, 0],
);
box("lantern floor", [0.21, 0.035, 0.21], [-2.35, 2.095, 2.5], black);
// Irregular stepping stones, garden boundary blocks and gate pillars.
const pavingPools = [];
for (let kind = 0; kind < 7; kind++) {
  const shp = new THREE.Shape();
  const pts = [];
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2,
      r = 0.49 + rand() * 0.09;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  shp.moveTo(...pts[0]);
  for (let k = 1; k < 7; k++) shp.lineTo(...pts[k]);
  shp.closePath();
  const pg = new THREE.ExtrudeGeometry(shp, {
    depth: 1,
    steps: 1,
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: 0.025,
    bevelThickness: 0.03,
  });
  pg.rotateX(-Math.PI / 2);
  pavingPools.push(batch("irregular flagstones " + kind, pg, stone));
}
function pavingStone(x, z, sx, sz, y = 0.035) {
  inst(
    pavingPools[Math.floor(rand() * 7)],
    [x + (rand() - 0.5) * 0.07, y - 0.025, z + (rand() - 0.5) * 0.06],
    [sx, 0.08, sz],
    [0, (rand() - 0.5) * 0.24, 0],
    new THREE.Color(0xffffff).multiplyScalar(0.87 + rand() * 0.27),
  );
}
for (let row = 0; row < 8; row++)
  for (let col = 0; col < 3; col++)
    pavingStone(
      -2.02 + col * 0.69 + (row % 2) * 0.12,
      4.2 + row * 0.35,
      0.64 + rand() * 0.12,
      0.31 + rand() * 0.1,
    );
for (let row = 0; row < 15; row++)
  for (let col = 0; col < 4; col++)
    pavingStone(
      4.1 + col * 0.51,
      -3.4 + row * 0.6,
      0.47 + rand() * 0.11,
      0.55 + rand() * 0.11,
    );
function stoneWall(a, b, rows = 3) {
  const av = new THREE.Vector3(...a),
    bv = new THREE.Vector3(...b),
    d = bv.clone().sub(av),
    len = d.length(),
    n = Math.ceil(len / 0.67),
    angle = Math.atan2(d.x, d.z);
  box(
    "stone wall mortar",
    [0.43, rows * 0.25, len],
    [
      ...av
        .clone()
        .add(bv)
        .multiplyScalar(0.5)
        .toArray()
        .map((v, i) => (i === 1 ? rows * 0.125 : v)),
    ],
    mortar,
    [0, angle, 0],
  );
  for (let row = 0; row < rows; row++)
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n,
        p = av.clone().lerp(bv, t);
      inst(
        stonePool,
        [
          p.x + (rand() - 0.5) * 0.035,
          row * 0.25 + 0.14,
          p.z + (rand() - 0.5) * 0.035,
        ],
        [0.49, 0.232, len / n - 0.023],
        [0, angle, 0],
        new THREE.Color(0xffffff).multiplyScalar(0.85 + rand() * 0.3),
      );
    }
}
stoneWall([-12, 0, 6.65], [-2.55, 0, 6.65]);
stoneWall([-0.18, 0, 6.65], [5.1, 0, 6.42]);
stoneWall([5.1, 0, 6.42], [7.15, 0, 5.2]);
stoneWall([7.15, 0, 5.2], [8.6, 0, 2.5]);
stoneWall([8.6, 0, 2.5], [8.8, 0, -3.5]);
for (const p of [
  [-2.6, 6.65],
  [-0.1, 6.65],
  [5.2, 6.4],
]) {
  for (let y = 0; y < 5; y++)
    inst(
      stonePool,
      [p[0], 0.15 + y * 0.25, p[1]],
      [0.62, 0.24, 0.64],
      [0, 0, 0],
      new THREE.Color(0xffffff).multiplyScalar(0.9 + rand() * 0.15),
    );
  box(
    "gate pillar cap",
    [0.79, 0.12, 0.8],
    [p[0], 1.44, p[1]],
    stone,
    [0, 0, 0],
    scene,
    true,
  );
}
// Mailbox: arched enclosure, front slot, post and small flag.
cyl(
  "mail post",
  [-2.0, 0.04, 6.4],
  [-2, 1.31, 6.4],
  0.053,
  mailMat,
  scene,
  0.053,
  8,
);
box(
  "mailbox base",
  [0.45, 0.3, 0.52],
  [-2, 1.36, 6.4],
  mailMat,
  [0, 0, 0],
  scene,
  true,
);
mesh(
  "mailbox rounded roof",
  new THREE.CylinderGeometry(0.23, 0.23, 0.52, 16, 1, false, 0, Math.PI),
  mailMat,
  [-2, 1.5, 6.4],
  [Math.PI / 2, 0, 0],
);
box("mail slot", [0.27, 0.035, 0.017], [-2, 1.42, 6.673], black);
box("mail slot flap", [0.3, 0.02, 0.02], [-2, 1.45, 6.687], chrome);
box("mail flag", [0.04, 0.15, 0.12], [-1.745, 1.44, 6.4], red);
// Wooden side gate at the rear of the drive.
for (let i = 0; i < 12; i++)
  box(
    "wooden gate plank",
    [0.18, 1.5, 0.08],
    [4.9 + i * 0.195, 0.79, -2.9],
    wood,
    [0, 0, 0],
    scene,
    true,
  );
for (let x of [4.76, 7.2])
  box("gate post", [0.17, 1.65, 0.17], [x, 0.825, -2.9], wood);
// Varied three-dimensional shrubs, olive trees and narrow cypresses.
const leafGeo = new THREE.BufferGeometry();
leafGeo.setAttribute(
  "position",
  new THREE.Float32BufferAttribute(
    [-0.45, 0, 0, 0, 0.045, -1, 0.45, 0, 0, 0, -0.02, 1, 0, 0.07, 0],
    3,
  ),
);
leafGeo.setIndex([0, 1, 4, 1, 2, 4, 2, 3, 4, 3, 0, 4]);
leafGeo.computeVertexNormals();
const leafPool = batch("individual olive and shrub leaves", leafGeo, leaves),
  clumpPool = batch(
    "dense foliage clumps",
    new THREE.IcosahedronGeometry(1, 1),
    leaves,
  );
const branchPool = batch(
  "woody branch cylinders",
  new THREE.CylinderGeometry(1, 1, 1, 7),
  bark,
);
function branch(a, b, r1, r2 = r1) {
  let av = new THREE.Vector3(...a),
    bv = new THREE.Vector3(...b),
    d = bv.clone().sub(av);
  const o = new THREE.Object3D();
  o.position.copy(av).add(bv).multiplyScalar(0.5);
  o.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    d.clone().normalize(),
  );
  o.scale.set(r1, d.length(), r2);
  o.updateMatrix();
  branchPool.items.push({ matrix: o.matrix.clone() });
}
function leafCluster(c, r, count = 50, color = 0x7b8445) {
  inst(
    clumpPool,
    c,
    [r * 0.55, r * 0.43, r * 0.54],
    [rand(), rand() * 3, rand()],
    new THREE.Color(color).multiplyScalar(0.65 + rand() * 0.35),
  );
  for (let i = 0; i < count; i++) {
    let a = rand() * Math.PI * 2,
      h = (rand() - 0.5) * 2,
      rr = Math.sqrt(1 - h * h) * (rand() * 0.25 + 0.75);
    inst(
      leafPool,
      [
        c[0] + Math.cos(a) * rr * r,
        c[1] + h * r * 0.65,
        c[2] + Math.sin(a) * rr * r,
      ],
      [0.08 + rand() * 0.04, 0.4, 0.13 + rand() * 0.045],
      [rand() * 3, rand() * 6, rand() * 3],
      new THREE.Color(color).multiplyScalar(0.8 + rand() * 0.4),
    );
  }
}
function olive(x, z, size = 1) {
  const trunkTop = [x + 0.2 * size, 1.7 * size, z + 0.07];
  branch([x, 0, z], trunkTop, 0.17 * size, 0.14 * size);
  branch(
    [x + 0.08, 0, z - 0.08],
    [x + 0.29, 1.45 * size, z - 0.06],
    0.12 * size,
  );
  for (let j = 0; j < 10; j++) {
    let a = (j / 10) * Math.PI * 2 + rand() * 0.3,
      b = [
        x + Math.cos(a) * (0.7 + rand() * 0.55) * size,
        (2.2 + rand() * 0.5) * size,
        z + Math.sin(a) * (0.7 + rand() * 0.55) * size,
      ];
    branch(trunkTop, b, 0.08 * size, 0.055 * size);
    for (let k = 0; k < 3; k++) {
      let c = [
        b[0] + (rand() - 0.5) * 1.1 * size,
        b[1] + rand() * 0.75 * size,
        b[2] + (rand() - 0.5) * 1.1 * size,
      ];
      branch(b, c, 0.028 * size);
      leafCluster(c, 0.53 * size, 95, 0x879255);
    }
  }
}
olive(-8.3, 3.8, 1.05);
olive(7.3, -4.2, 1.04);
olive(-8.5, -4.4, 0.92);
function cypress(x, z, h) {
  branch([x, 0, z], [x, h * 0.88, z], 0.1);
  for (let i = 0; i < 17; i++) {
    let y = 0.5 + (i * h) / 20,
      r = (1 - y / h) * 0.6 + 0.1;
    inst(
      clumpPool,
      [x + (rand() - 0.5) * 0.18, y, z + (rand() - 0.5) * 0.18],
      [r, 0.52, r],
      [0, rand() * 4, 0],
      new THREE.Color(0x344d25).multiplyScalar(0.8 + rand() * 0.3),
    );
  }
}
cypress(-9, -5.2, 6.6);
cypress(-11, -1.8, 5.5);
cypress(8.2, -7.3, 5.2);
function shrub(x, z, r = 0.45) {
  box(
    "planting soil",
    [r * 1.9, 0.05, r * 1.8],
    [x, 0.001, z],
    soil,
    [0, rand(), 0],
    scene,
    true,
  );
  for (let j = 0; j < 5; j++) {
    const c = [
      x + (rand() - 0.5) * r,
      0.26 + rand() * 0.3,
      z + (rand() - 0.5) * r,
    ];
    leafCluster(c, r * 0.65, 15, 0x647133);
  }
}
for (let i = 0; i < 21; i++)
  shrub(-11.5 + i * 0.44, 6.12, 0.35 + rand() * 0.11);
for (let i = 0; i < 11; i++) shrub(0.5 + i * 0.4, 5.97, 0.34);
for (let i = 0; i < 15; i++)
  shrub(7.7 + Math.sin(i * 0.16) * 0.45, -2.7 + i * 0.44, 0.4);
for (let i = 0; i < 9; i++) shrub(-5.0 + i * 0.85, 2.7, 0.32);
const flowerPool = batch(
  "lavender flower heads",
  new THREE.IcosahedronGeometry(1, 0),
  flowerMat,
);
for (const [x, z] of [
  [-4.6, 3.9],
  [1.4, 4.45],
  [3.7, 0.5],
  [3.7, -1.2],
  [-6.4, 5.2],
  [6.4, 4.7],
]) {
  shrub(x, z, 0.43);
  for (let k = 0; k < 40; k++) {
    const xx = x + (rand() - 0.5) * 0.75,
      zz = z + (rand() - 0.5) * 0.75,
      y = 0.5 + rand() * 0.25;
    branch([xx, 0.18, zz], [xx, y, zz], 0.008);
    inst(
      flowerPool,
      [xx, y, zz],
      [0.025, 0.095, 0.026],
      [0, rand() * 6, (rand() - 0.5) * 0.3],
      new THREE.Color(0xb7a4cf).multiplyScalar(0.75 + rand() * 0.35),
    );
  }
}
function pot(x, z, r = 0.25) {
  mesh(
    "terracotta plant pot",
    new THREE.CylinderGeometry(r, r * 0.68, 0.36, 14),
    potMat,
    [x, 0.49, z],
  );
  mesh(
    "pot rim",
    new THREE.TorusGeometry(r, 0.034, 5, 16),
    potMat,
    [x, 0.66, z],
    [Math.PI / 2, 0, 0],
  );
  mesh(
    "soil inside pot",
    new THREE.CylinderGeometry(r * 0.88, r * 0.88, 0.025, 14),
    soil,
    [x, 0.66, z],
  );
  branch([x, 0.65, z], [x, 1.28, z], 0.024);
  for (let j = 0; j < 7; j++) {
    let a = (j / 7) * 6.28,
      c = [x + Math.cos(a) * 0.25, 1.0 + rand() * 0.35, z + Math.sin(a) * 0.25];
    branch([x, 0.78, z], c, 0.01);
    leafCluster(c, 0.15, 12, 0x5a6c31);
  }
}
pot(-2.7, 3.22, 0.26);
pot(0.27, 3.3, 0.22);
pot(2.8, 3.13, 0.3);
const tuftGeo = new THREE.BufferGeometry();
tuftGeo.setAttribute(
  "position",
  new THREE.Float32BufferAttribute(
    [-0.04, 0, 0, 0, 0.065, 0, 0.04, 0, 0, 0, 0, -0.04, 0, 0.05, 0, 0, 0, 0.04],
    3,
  ),
);
tuftGeo.setIndex([0, 2, 1, 3, 5, 4]);
tuftGeo.computeVertexNormals();
const tuftPool = batch(
  "grass blades",
  tuftGeo,
  new THREE.MeshStandardMaterial({
    color: 0xe3dc9b,
    roughness: 1,
    side: THREE.DoubleSide,
  }),
  false,
);
for (let i = 0; i < 1400; i++) {
  const x = -11.5 + rand() * 17.3,
    z = 2.6 + rand() * 3.7;
  if (x > -2.3 && x < -0.25 && z > 3.9) continue;
  inst(
    tuftPool,
    [x, 0.03, z],
    [0.8 + rand(), 0.65 + rand() * 0.8, 0.8 + rand()],
    [0, rand() * 6.28, 0],
    new THREE.Color(0xb3af61).multiplyScalar(0.6 + rand() * 0.5),
  );
}
// Authored hatchback, with contoured coachwork, wheel openings, interior and glazing.
const car = new THREE.Group();
car.name = "blue five door hatchback";
car.position.set(5.6, 0.035, 7.15);
car.rotation.y = -0.7;
car.scale.setScalar(0.98);
scene.add(car);
function cb(name, size, p, mat = blue, rot = [0, 0, 0], rounded = false) {
  return box(name, size, p, mat, rot, car, rounded);
}
function cm(name, geo, mat, p = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]) {
  return mesh(name, geo, mat, p, rot, scale, car);
}
const rings = [
  [-2.13, 0.69, 1.02],
  [-1.94, 0.82, 1.09],
  [-1.5, 0.84, 1.11],
  [-0.75, 0.84, 1.05],
  [0, 0.84, 1.05],
  [0.7, 0.83, 1.0],
  [1.3, 0.82, 0.94],
  [1.92, 0.78, 0.86],
  [2.18, 0.68, 0.75],
];
const bp = [],
  bi = [];
for (const [z, w, h] of rings) {
  for (const [x, y] of [
    [-0.6 * w, 0.35],
    [-w, 0.45],
    [-w, 0.7 * h],
    [-w * 0.94, h - 0.07],
    [-w * 0.68, h],
    [0, h + 0.045],
    [w * 0.68, h],
    [w * 0.94, h - 0.07],
    [w, 0.7 * h],
    [w, 0.45],
    [w * 0.6, 0.35],
    [0, 0.33],
  ])
    bp.push([x, y, z]);
}
for (let r = 0; r < rings.length - 1; r++)
  for (let j = 0; j < 12; j++) {
    const a = r * 12 + j,
      b = r * 12 + ((j + 1) % 12),
      c = a + 12,
      d = b + 12;
    bi.push(a, c, b, b, c, d);
  }
for (let j = 1; j < 11; j++) {
  bi.push(0, j, j + 1);
  let a = (rings.length - 1) * 12;
  bi.push(a, a + j + 1, a + j);
}
poly("sculpted main coachwork", bp, bi, blue, car);
function sidePanel(sign) {
  const sh = new THREE.Shape();
  sh.moveTo(2.18, 0.41);
  sh.lineTo(1.78, 0.41);
  sh.absarc(1.29, 0.41, 0.49, 0, Math.PI, false);
  sh.lineTo(-0.81, 0.41);
  sh.absarc(-1.3, 0.41, 0.49, 0, Math.PI, false);
  sh.lineTo(-2.13, 0.41);
  sh.lineTo(-2.12, 0.95);
  sh.lineTo(-1.91, 1.08);
  sh.lineTo(-0.8, 1.07);
  sh.lineTo(0.68, 1.02);
  sh.lineTo(1.92, 0.9);
  sh.lineTo(2.18, 0.74);
  sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, {
    depth: 0.095,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.023,
    bevelThickness: 0.018,
    curveSegments: 14,
  });
  cm(
    "side body with wheel cutouts",
    g,
    blue,
    [sign * 0.885, 0, 0],
    [0, -Math.PI / 2, 0],
    [1, 1, sign],
  );
}
sidePanel(1);
sidePanel(-1);
cb(
  "black sill trim",
  [1.77, 0.085, 2.0],
  [0, 0.38, -0.03],
  black,
  [0, 0, 0],
  true,
);
cb(
  "front bumper contour",
  [1.58, 0.28, 0.32],
  [0, 0.53, 2.03],
  blue,
  [0, 0, 0],
  true,
);
cb(
  "front lower grille",
  [1.14, 0.18, 0.019],
  [0, 0.48, 2.205],
  black,
  [0, 0, 0],
  true,
);
cb("front upper grille", [0.95, 0.115, 0.02], [0, 0.765, 2.175], black);
for (let y of [0.44, 0.49, 0.54, 0.747, 0.79])
  cb(
    "grille metal slats",
    [y < 0.6 ? 1.02 : 0.87, 0.015, 0.024],
    [0, y, 2.224],
    chrome,
  );
cm(
  "front badge rim",
  new THREE.TorusGeometry(0.077, 0.015, 6, 16),
  chrome,
  [0, 0.78, 2.226],
);
cm(
  "front badge dark center",
  new THREE.CircleGeometry(0.065, 16),
  black,
  [0, 0.78, 2.229],
);
cb("registration plate", [0.51, 0.11, 0.026], [0, 0.58, 2.24], curtain);
cb("plate characters", [0.34, 0.025, 0.027], [0, 0.58, 2.259], black);
cb("rear bumper", [1.63, 0.2, 0.26], [0, 0.48, -2.04], blue, [0, 0, 0], true);
cb("rear bumper dark insert", [1.45, 0.09, 0.03], [0, 0.38, -2.18], black);
cb("rear registration plate", [0.54, 0.12, 0.022], [0, 0.76, -2.194], curtain);
cb("rear plate characters", [0.36, 0.027, 0.026], [0, 0.76, -2.208], black);
// Sloping glass cabin and roof, deliberately open behind the glass for interior detail.
const roofPts = [
  [-0.66, 1.7, 0.43],
  [0.66, 1.7, 0.43],
  [-0.66, 1.76, -0.93],
  [0.66, 1.76, -0.93],
  [-0.68, 1.65, -1.3],
  [0.68, 1.65, -1.3],
  [-0.61, 1.76, 0.25],
  [0.61, 1.76, 0.25],
];
poly(
  "curved car roof",
  roofPts,
  [0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4, 0, 2, 6, 1, 7, 3],
  blue,
  car,
);
cb(
  "roof center",
  [1.31, 0.074, 1.34],
  [0, 1.74, -0.28],
  blue,
  [0.025, 0, 0],
  true,
);
poly(
  "front windscreen",
  [
    [-0.76, 1.04, 1.12],
    [0.76, 1.04, 1.12],
    [0.635, 1.68, 0.42],
    [-0.635, 1.68, 0.42],
  ],
  [0, 1, 2, 0, 2, 3],
  carGlass,
  car,
);
poly(
  "rear hatch glass",
  [
    [-0.78, 1.12, -1.95],
    [-0.64, 1.63, -1.31],
    [0.64, 1.63, -1.31],
    [0.78, 1.12, -1.95],
  ],
  [0, 1, 2, 0, 2, 3],
  carGlass,
  car,
);
for (let s of [-1, 1]) {
  const pts = [
    [s * 0.8, 1.065, 1.02],
    [s * 0.66, 1.66, 0.38],
    [s * 0.665, 1.69, -0.35],
    [s * 0.825, 1.085, -0.36],
    [s * 0.665, 1.69, -0.45],
    [s * 0.68, 1.62, -1.23],
    [s * 0.8, 1.12, -1.72],
    [s * 0.825, 1.085, -0.44],
  ];
  poly(
    "side door glass",
    pts,
    s > 0
      ? [0, 2, 1, 0, 3, 2, 4, 6, 5, 4, 7, 6]
      : [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7],
    carGlass,
    car,
  );
  cyl(
    "front windscreen pillar",
    [s * 0.79, 1.025, 1.15],
    [s * 0.66, 1.73, 0.4],
    0.047,
    blue,
    car,
    0.038,
    8,
  );
  cyl(
    "rear hatch pillar",
    [s * 0.8, 1.1, -1.94],
    [s * 0.68, 1.68, -1.28],
    0.065,
    blue,
    car,
    0.055,
    8,
  );
  cyl(
    "window waist trim",
    [s * 0.842, 1.062, 1.04],
    [s * 0.842, 1.1, -1.73],
    0.022,
    black,
    car,
    0.022,
    7,
  );
  poly(
    "black B pillar",
    [
      [s * 0.828, 1.08, -0.42],
      [s * 0.828, 1.08, -0.33],
      [s * 0.666, 1.71, -0.33],
      [s * 0.666, 1.71, -0.43],
    ],
    s > 0 ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3],
    black,
    car,
  );
  for (const z of [0.54, -0.97]) {
    cb(
      "door handle",
      [0.065, 0.055, 0.26],
      [s * 0.946, 1.018, z],
      black,
      [0, 0, 0],
      true,
    );
    cb(
      "body colored handle",
      [0.055, 0.03, 0.21],
      [s * 0.975, 1.025, z],
      blue,
      [0, 0, 0],
      true,
    );
  }
  cyl(
    "mirror mount",
    [s * 0.83, 1.18, 0.83],
    [s * 1.0, 1.17, 0.79],
    0.045,
    black,
    car,
  );
  cb(
    "wing mirror housing",
    [0.29, 0.13, 0.19],
    [s * 1.05, 1.19, 0.76],
    blue,
    [0, 0.13 * s, 0],
    true,
  );
  cb("mirror inset", [0.18, 0.075, 0.01], [s * 1.06, 1.2, 0.652], glass);
  for (const zz of [-1.3, 1.29]) {
    const arc = [];
    for (let i = 0; i <= 20; i++) {
      let t = (i / 20) * Math.PI;
      arc.push(
        new THREE.Vector3(
          s * 0.989,
          0.41 + 0.496 * Math.sin(t),
          zz + 0.496 * Math.cos(t),
        ),
      );
    }
    cm(
      "wheel arch black liner",
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(arc),
        20,
        0.026,
        5,
        false,
      ),
      black,
    );
  }
  // Door joints are narrow actual dark geometry.
  for (const z of [-0.4, -1.77, 1.12]) {
    cyl(
      "door shut line",
      [s * 0.946, 0.53, z],
      [s * 0.942, 0.93, z],
      0.006,
      black,
      car,
      0.006,
      5,
    );
  }
}
for (const z of [0.25, -0.86])
  for (const x of [-0.4, 0.4]) {
    cb("seat cushion", [0.53, 0.13, 0.5], [x, 0.74, z], tan, [0, 0, 0], true);
    cb(
      "seat back",
      [0.49, 0.54, 0.14],
      [x, 1.05, z - 0.16],
      tan,
      [-0.15, 0, 0],
      true,
    );
    cb(
      "seat headrest",
      [0.28, 0.2, 0.11],
      [x, 1.4, z - 0.19],
      tan,
      [0, 0, 0],
      true,
    );
  }
cb("dashboard", [1.39, 0.16, 0.39], [0, 1.0, 0.86], black, [0, 0, 0], true);
cm(
  "steering wheel",
  new THREE.TorusGeometry(0.18, 0.024, 7, 18),
  black,
  [-0.39, 1.17, 0.63],
  [0.72, 0, 0],
);
cb("interior floor", [1.45, 0.06, 2.6], [0, 0.63, -0.2], black);
for (let s of [-1, 1]) {
  poly(
    "headlight lens",
    [
      [s * 0.39, 0.8, 2.13],
      [s * 0.7, 0.81, 2.03],
      [s * 0.77, 0.93, 1.97],
      [s * 0.42, 0.93, 2.12],
    ],
    s > 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2],
    lamp,
    car,
  );
  for (let x of [0.48, 0.64])
    cm(
      "headlamp projector",
      new THREE.SphereGeometry(0.073, 10, 7),
      chrome,
      [s * x, 0.866, 2.126],
      [0, 0, 0],
      [1, 0.72, 0.24],
    );
  cb(
    "front fog lamp recess",
    [0.22, 0.11, 0.023],
    [s * 0.62, 0.48, 2.175],
    black,
    [0, s * 0.3, 0],
    true,
  );
  cm(
    "front fog light",
    new THREE.SphereGeometry(0.048, 8, 6),
    lamp,
    [s * 0.63, 0.49, 2.191],
    [0, 0, 0],
    [1, 1, 0.3],
  );
  cb(
    "rear red light cluster",
    [0.17, 0.25, 0.14],
    [s * 0.73, 0.94, -2.065],
    red,
    [0, -s * 0.22, 0],
    true,
  );
  cb(
    "rear white light strip",
    [0.135, 0.045, 0.025],
    [s * 0.73, 0.935, -2.144],
    lamp,
  );
  cb(
    "side indicator",
    [0.018, 0.045, 0.12],
    [s * 0.973, 0.8, 1.03],
    lamp,
    [0, 0, 0],
    true,
  );
}
for (const side of [-1, 1]) {
  const creasePts = [
    new THREE.Vector3(side * 0.48, 0.918, 1.92),
    new THREE.Vector3(side * 0.54, 0.982, 1.48),
    new THREE.Vector3(side * 0.59, 1.025, 1.13),
  ];
  cm(
    "raised hood crease",
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(creasePts),
      10,
      0.012,
      5,
      false,
    ),
    blue,
  );
  cyl(
    "rounded roof edge",
    [side * 0.67, 1.744, 0.38],
    [side * 0.68, 1.755, -1.1],
    0.025,
    blue,
    car,
    0.025,
    8,
  );
}
// Four complete tires, alloy rims, brakes, radial spokes, hubs and lug bolts.
for (const s of [-1, 1])
  for (const z of [-1.3, 1.29]) {
    cm(
      "rubber tire",
      new THREE.TorusGeometry(0.345, 0.106, 10, 28),
      rubber,
      [s * 0.89, 0.445, z],
      [0, Math.PI / 2, 0],
    );
    cm(
      "wheel tire wall",
      new THREE.CylinderGeometry(0.385, 0.385, 0.165, 28),
      rubber,
      [s * 0.89, 0.445, z],
      [0, 0, Math.PI / 2],
    );
    cm(
      "alloy rim hoop",
      new THREE.TorusGeometry(0.285, 0.019, 6, 24),
      chrome,
      [s * 1.002, 0.445, z],
      [0, Math.PI / 2, 0],
    );
    cm(
      "wheel brake disk",
      new THREE.CylinderGeometry(0.24, 0.24, 0.02, 20),
      black,
      [s * 0.977, 0.445, z],
      [0, 0, Math.PI / 2],
    );
    for (let k = 0; k < 10; k++) {
      let a = (k / 10) * Math.PI * 2 + 0.08;
      let aa = [
          s * 1.008,
          0.445 + Math.cos(a) * 0.055,
          z + Math.sin(a) * 0.055,
        ],
        bb = [
          s * 1.008,
          0.445 + Math.cos(a + 0.13) * 0.275,
          z + Math.sin(a + 0.13) * 0.275,
        ];
      cyl("split alloy wheel spoke", aa, bb, 0.019, chrome, car, 0.012, 5);
    }
    cm(
      "wheel center cap",
      new THREE.CylinderGeometry(0.066, 0.066, 0.032, 14),
      chrome,
      [s * 1.02, 0.445, z],
      [0, 0, Math.PI / 2],
    );
    for (let k = 0; k < 5; k++) {
      let a = (k / 5) * 6.28;
      cm("wheel lug bolt", new THREE.SphereGeometry(0.014, 5, 4), black, [
        s * 1.04,
        0.445 + Math.cos(a) * 0.046,
        z + Math.sin(a) * 0.046,
      ]);
    }
  }
for (let s of [-1, 1])
  cyl(
    "windscreen wiper",
    [s * 0.25, 1.065, 1.103],
    [s * 0.25 + 0.22, 1.21, 0.967],
    0.013,
    black,
    car,
    0.013,
    5,
  );
cyl(
  "roof antenna",
  [0, 1.81, -0.98],
  [0, 2.03, -1.13],
  0.014,
  black,
  car,
  0.008,
  6,
);
cb(
  "rear roof spoiler",
  [1.38, 0.055, 0.16],
  [0, 1.71, -1.31],
  blue,
  [0, 0, 0],
  true,
);
cb(
  "rear hatch lower lip",
  [1.46, 0.075, 0.15],
  [0, 1.1, -1.98],
  blue,
  [0, 0, 0],
  true,
);
// A procedural daylight sky and a geometrical coastal ridge beyond the garden.
const skyCanvas = document.createElement("canvas");
skyCanvas.width = 1024;
skyCanvas.height = 512;
const skyCtx = skyCanvas.getContext("2d");
const skyGrad = skyCtx.createLinearGradient(0, 0, 0, 512);
skyGrad.addColorStop(0, "#749cc5");
skyGrad.addColorStop(0.42, "#99b9da");
skyGrad.addColorStop(0.58, "#c3d9e9");
skyGrad.addColorStop(1, "#c1d3dd");
skyCtx.fillStyle = skyGrad;
skyCtx.fillRect(0, 0, 1024, 512);
for (let i = 0; i < 38; i++) {
  const x = rand() * 1024,
    y = 170 + rand() * 65;
  for (let j = 0; j < 9; j++) {
    skyCtx.fillStyle = "rgba(255,247,225,0.10)";
    skyCtx.beginPath();
    skyCtx.ellipse(
      x + (rand() - 0.5) * 75,
      y + (rand() - 0.5) * 10,
      16 + rand() * 35,
      3 + rand() * 9,
      0,
      0,
      Math.PI * 2,
    );
    skyCtx.fill();
  }
}
const skyTexture = new THREE.CanvasTexture(skyCanvas);
skyTexture.mapping = THREE.EquirectangularReflectionMapping;
skyTexture.colorSpace = THREE.SRGBColorSpace;
textures.push(skyTexture);
scene.background = skyTexture;
const hillMat = material("distant sunlit hills", 0x7c8a78, 1);
const hillPts = [],
  hillIds = [];
const nx = 64,
  nz = 15;
for (let j = 0; j <= nz; j++)
  for (let i = 0; i <= nx; i++) {
    const x = -55 + (i * 110) / nx,
      z = -23 - j * 2.4;
    const y = Math.max(
      0.04,
      Math.sin((j / nz) * Math.PI) *
        Math.pow(
          0.5 + 0.5 * Math.sin(i * 0.26 + Math.sin(i * 0.09) * 3),
          0.65,
        ) *
        7 +
        Math.sin(i * 0.8 + j * 0.8) * 0.6,
    );
    hillPts.push([x, y, z]);
  }
for (let j = 0; j < nz; j++)
  for (let i = 0; i < nx; i++) {
    let a = j * (nx + 1) + i,
      b = a + 1,
      c = a + nx + 1,
      d = c + 1;
    hillIds.push(a, b, c, b, d, c);
  }
poly("distant rolling ridge", hillPts, hillIds, hillMat);
const barkTexture = noiseTexture(0x5f503e, 128, 50);
barkTexture.repeat.set(3, 8);
bark.color.set(0xf2dfc6);
bark.map = barkTexture;
bark.bumpMap = barkTexture;
bark.bumpScale = 0.09;
// Recessed mortar beds join the irregular stones into continuous usable paths.
box(
  "front flagstone mortar bed",
  [2.12, 0.04, 2.88],
  [-1.27, -0.005, 5.43],
  mortar,
);
box(
  "drive flagstone mortar bed",
  [2.18, 0.04, 9.0],
  [4.88, -0.005, 0.8],
  mortar,
);
// Instantiate every pooled item. Instance transforms and colors are the actual rendered data.
for (const pool of pools.values()) {
  const o = new THREE.InstancedMesh(pool.geo, pool.mat, pool.items.length);
  o.name = pool.name;
  o.castShadow = pool.cast;
  o.receiveShadow = true;
  pool.items.forEach((item, i) => {
    o.setMatrixAt(i, item.matrix);
    if (item.color) o.setColorAt(i, item.color);
  });
  o.instanceMatrix.needsUpdate = true;
  if (o.instanceColor) o.instanceColor.needsUpdate = true;
  scene.add(o);
}
scene.updateMatrixWorld(true);
const ready = (async () => {
  await renderer.init();
  if (renderer.backend.isWebGPUBackend !== true)
    throw new Error("A native WebGPU backend is required");
})();
globalThis.__AGENT_BENCHMARK__ = {
  engine: "three",
  canvas: renderer.domElement,
  ready,
  async setCamera(c) {
    await ready;
    camera.position.fromArray(c.position);
    camera.fov = c.fovYDegrees;
    camera.near = c.near;
    camera.far = c.far;
    camera.lookAt(new THREE.Vector3(...c.target));
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
  },
  async renderFrame() {
    await ready;
    renderer.render(scene, camera);
  },
  async inspectGeometry() {
    await ready;
    scene.updateMatrixWorld(true);
    const meshes = [];
    scene.traverse((o) => {
      if (!o.isMesh || !o.visible) return;
      const g = o.geometry,
        p = g.getAttribute("position");
      if (!p) return;
      const pos = new Float32Array(p.count * 3);
      for (let i = 0; i < p.count; i++) {
        pos[3 * i] = p.getX(i);
        pos[3 * i + 1] = p.getY(i);
        pos[3 * i + 2] = p.getZ(i);
      }
      const row = {
        id: "mesh-" + meshes.length + ":" + o.name,
        positions: pos,
        worldMatrix: o.matrixWorld.elements.slice(),
      };
      if (g.index) row.indices = new g.index.array.constructor(g.index.array);
      const n = g.getAttribute("normal");
      if (n) {
        row.normals = new Float32Array(n.count * 3);
        for (let i = 0; i < n.count; i++) {
          row.normals[3 * i] = n.getX(i);
          row.normals[3 * i + 1] = n.getY(i);
          row.normals[3 * i + 2] = n.getZ(i);
        }
      }
      if (o.isInstancedMesh) {
        row.instances = [];
        const m = new THREE.Matrix4();
        for (let i = 0; i < o.count; i++) {
          o.getMatrixAt(i, m);
          row.instances.push(
            new THREE.Matrix4()
              .multiplyMatrices(o.matrixWorld, m)
              .elements.slice(),
          );
        }
      }
      meshes.push(row);
    });
    return { meshes };
  },
  async dispose() {
    await ready;
    const gs = new Set(),
      ms = new Set();
    scene.traverse((o) => {
      if (o.geometry) gs.add(o.geometry);
      if (o.material)
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          ms.add(m);
    });
    gs.forEach((g) => g.dispose());
    ms.forEach((m) => m.dispose());
    textures.forEach((t) => t.dispose());
    renderer.dispose();
  },
};
