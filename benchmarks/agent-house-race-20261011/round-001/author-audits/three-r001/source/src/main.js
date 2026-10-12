import * as THREE from 'three/webgpu';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(37, 1024 / 768, 0.1, 200);
camera.position.set(14, 9, 19);
camera.lookAt(0, 2.5, 1);
const renderer = new THREE.WebGPURenderer({ antialias: true, samples: 4, alpha: false, forceWebGL: false });
renderer.setPixelRatio(1);
renderer.setSize(1024, 768);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
document.body.style.background = '#abc8dc';
renderer.domElement.style.display = 'block';
renderer.domElement.style.width = '1024px';
renderer.domElement.style.height = '768px';
renderer.domElement.setAttribute('aria-label', 'Mediterranean house exterior rendered in native WebGPU');

let seed = 914073;
function rnd() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }
const lerp = THREE.MathUtils.lerp;
const mats = {};
const textures = [];
function noiseTex(base, amplitude, size = 256, repeat = 1, fleck = 0) {
  const data = new Uint8Array(size * size * 4);
  const col = new THREE.Color(base);
  const r = col.r ** (1 / 2.2) * 255, g = col.g ** (1 / 2.2) * 255, b = col.b ** (1 / 2.2) * 255;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const p = (y * size + x) * 4;
    const coarse = Math.sin(x * .071 + Math.sin(y * .053) * 2) * Math.sin(y * .049 + Math.cos(x * .087));
    let n = (rnd() - .5) * amplitude + coarse * amplitude * .25;
    if (fleck && rnd() < fleck) n -= amplitude * 1.6;
    data[p] = Math.max(0, Math.min(255, r + n));
    data[p + 1] = Math.max(0, Math.min(255, g + n));
    data[p + 2] = Math.max(0, Math.min(255, b + n));
    data[p + 3] = 255;
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat); t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.needsUpdate = true; textures.push(t); return t;
}
function std(name, color, roughness = .8, extras = {}) {
  return mats[name] = new THREE.MeshStandardMaterial({ color, roughness, ...extras });
}
const stuccoTex = noiseTex('#e8ddc8', 22, 256, 4);
const grassTex = noiseTex('#64743b', 54, 512, 8, .025);
const asphaltTex = noiseTex('#51535a', 39, 512, 10, .07);
const stoneTex = noiseTex('#c7baa1', 24, 128, 1, .035);
const tileTex = noiseTex('#be6c38', 21, 128, 1);
std('stucco', '#fff9e9', .91, { map: stuccoTex, bumpMap: stuccoTex, bumpScale: .018 });
std('plinth', '#b5ad97', .96, { map: stoneTex, bumpMap: stoneTex, bumpScale: .025 });
std('grass', '#c0ba76', 1, { map: grassTex, bumpMap: grassTex, bumpScale: .04 });
std('asphalt', '#e4dcd5', .96, { map: asphaltTex, bumpMap: asphaltTex, bumpScale: .022 });
std('mortar', '#958b76', 1);
std('curb', '#d4c9b7', .92, { map: stoneTex, bumpMap: stoneTex, bumpScale: .015 });
std('line', '#efeee4', .92);
std('frame', '#303433', .47, { metalness: .33 });
std('wood', '#aa916c', .92, { map: noiseTex('#69503a', 28, 128, 2) });
std('door', '#3b4140', .57);
std('gutter', '#45483e', .5, { metalness: .48 });
std('roofBase', '#6c412e', .92);
std('glass', '#30475a', .14, { metalness: .38 });
std('curtain', '#b8ad95', 1, { side: THREE.DoubleSide });
std('interior', '#30352e', 1);
std('pot', '#d19a6c', .86, { map: noiseTex('#a7683d', 18, 128, 1) });
std('soil', '#463728', 1);
std('bark', '#b39b75', .97, { map: noiseTex('#67533c', 40, 128, 2), bumpScale: .03 });
std('leaf1', '#526738', .91); std('leaf2', '#71804b', .87); std('leaf3', '#858b52', .88);
std('cypress', '#394d2f', .95); std('lavender', '#796ca0', .86);
std('stem', '#686b36', .95);
std('blue', '#175489', .25, { metalness: .64 });
mats.blue = new THREE.MeshPhysicalMaterial({ color: '#17558c', roughness: .23, metalness: .64, clearcoat: 1, clearcoatRoughness: .14 });
std('rubber', '#181b1d', .9, { map: noiseTex('#252728', 19, 128, 2) });
std('chrome', '#b9bec0', .23, { metalness: .93 });
std('black', '#202426', .76);
std('headlamp', '#d8e3da', .19, { metalness: .34 });
std('tail', '#9b231c', .32, { metalness: .18, emissive: '#5a0a04', emissiveIntensity: .18 });
std('seat', '#464747', .93);
mats.carGlass = new THREE.MeshPhysicalMaterial({ color: '#365267', roughness: .1, metalness: .12, transparent: true, opacity: .73, clearcoat: .8, side: THREE.DoubleSide });
const stoneMats = Array.from({ length: 7 }, (_, i) => std('stone' + i, new THREE.Color('#d0c3a9').multiplyScalar(.85 + i * .035), .93, { map: stoneTex, bumpMap: stoneTex, bumpScale: .021 }));
const tileMats = Array.from({ length: 6 }, (_, i) => std('tile' + i, new THREE.Color('#db9b63').multiplyScalar(.76 + i * .065), .8, { map: tileTex, bumpMap: tileTex, bumpScale: .012 }));

// Analytic sky and reflection environment: no external images.
{
  const w = 512, h = 256, data = new Uint8Array(w * h * 4);
  const blue = new THREE.Color('#94b9df'), horizon = new THREE.Color('#e9ddc4'), ground = new THREE.Color('#787b5a');
  const sunDir = new THREE.Vector3(-.55, .63, .38).normalize();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const theta = y / (h - 1) * Math.PI, phi = x / w * Math.PI * 2;
    const dir = new THREE.Vector3(-Math.sin(theta) * Math.cos(phi), -Math.cos(theta), -Math.sin(theta) * Math.sin(phi));
    const c = dir.y > 0 ? horizon.clone().lerp(blue, Math.pow(dir.y, .48)) : horizon.clone().lerp(ground, Math.min(1, -dir.y * 5));
    const cloud = Math.max(0, Math.sin(phi * 13 + Math.sin(theta * 27)) * Math.sin(theta * 43 + Math.sin(phi * 8)) - .35) * Math.max(0, 1 - Math.abs(dir.y - .22) * 3);
    c.lerp(new THREE.Color('#fff4df'), cloud * .24);
    const solar = Math.pow(Math.max(0, dir.dot(sunDir)), 270);
    c.add(new THREE.Color(1, .81, .53).multiplyScalar(solar * .6));
    const p = (y * w + x) * 4; data[p] = Math.min(255, Math.round(c.r ** (1 / 2.2) * 255)); data[p + 1] = Math.min(255, Math.round(c.g ** (1 / 2.2) * 255)); data[p + 2] = Math.min(255, Math.round(c.b ** (1 / 2.2) * 255)); data[p + 3] = 255;
  }
  const env = new THREE.DataTexture(data, w, h, THREE.RGBAFormat); env.colorSpace = THREE.SRGBColorSpace;
  env.mapping = THREE.EquirectangularReflectionMapping; env.needsUpdate = true; textures.push(env);
  scene.environment = env; scene.background = env; scene.environmentIntensity = .53;
}
scene.fog = new THREE.Fog('#cfdbc9', 28, 95);
const ambient = new THREE.HemisphereLight('#d8e6f2', '#a09064', 1.18); scene.add(ambient);
const sun = new THREE.DirectionalLight('#fff0d2', 3.2); sun.position.set(-9, 14, 10); sun.target.position.set(0, 2, 0);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -17; sun.shadow.camera.right = 17; sun.shadow.camera.top = 17; sun.shadow.camera.bottom = -17;
sun.shadow.camera.near = 1; sun.shadow.camera.far = 42; sun.shadow.bias = -.00045; sun.shadow.normalBias = .025; sun.shadow.radius = 2;
scene.add(sun, sun.target);

let objectId = 0;
function mesh(g, m, p = [0, 0, 0], rot = [0, 0, 0], parent = scene, shadow = true) {
  const o = new THREE.Mesh(g, m); o.name = 'authored-' + (++objectId); o.position.fromArray(p); o.rotation.set(...rot); o.castShadow = shadow; o.receiveShadow = true; parent.add(o); return o;
}
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const roundedGeo = new RoundedBoxGeometry(1, 1, 1, 1, .065);
function box(w, h, d, m, p, rot = [0, 0, 0], parent = scene, round = false) {
  const o = mesh(round ? roundedGeo : boxGeo, m, p, rot, parent); o.scale.set(w, h, d); return o;
}
function rod(a, b, r0, r1, m, parent = scene, radial = 8) {
  const av = new THREE.Vector3(...a), bv = new THREE.Vector3(...b), v = bv.clone().sub(av);
  const o = mesh(new THREE.CylinderGeometry(r1, r0, v.length(), radial), m, av.clone().add(bv).multiplyScalar(.5).toArray(), [0, 0, 0], parent);
  o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize()); return o;
}
function instanced(g, m, transforms, parent = scene, shadow = true) {
  if (!transforms.length) return;
  const o = new THREE.InstancedMesh(g, m, transforms.length); o.name = 'authored-instanced-' + (++objectId);
  const dummy = new THREE.Object3D();
  transforms.forEach((v, i) => {
    dummy.position.fromArray(v.p); dummy.rotation.set(...(v.r || [0, 0, 0])); dummy.scale.fromArray(v.s || [1, 1, 1]);
    dummy.updateMatrix(); o.setMatrixAt(i, dummy.matrix);
  });
  o.instanceMatrix.needsUpdate = true; o.castShadow = shadow; o.receiveShadow = true; parent.add(o); return o;
}
function polygon(vertices, indices, m, parent = scene) {
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(vertices.flat(), 3));
  const uv = vertices.flatMap(v => [v[0] * .18 + v[2] * .13, v[1] * .18 + v[2] * .12]);
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(indices); g.computeVertexNormals(); return mesh(g, m, [0, 0, 0], [0, 0, 0], parent);
}
function quad(a, b, c, d, m, parent = scene) { return polygon([a, b, c, d], [0, 1, 2, 0, 2, 3], m, parent); }

// Ground and a continuous curved roadway.
box(28, .12, 28, mats.grass, [0, -.075, 0]);
const roadCurve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(-14, .025, 10.4), new THREE.Vector3(-6, .025, 10.2), new THREE.Vector3(1.5, .025, 9.5),
  new THREE.Vector3(6.7, .025, 6.8), new THREE.Vector3(9.3, .025, 1.4), new THREE.Vector3(9.2, .025, -6), new THREE.Vector3(9, .025, -14)
]);
const roadLen = roadCurve.getLength();
function roadAt(t, offset = 0, y = .025) {
  const p = roadCurve.getPointAt(t), tangent = roadCurve.getTangentAt(t);
  return new THREE.Vector3(p.x + tangent.z * offset, y, p.z - tangent.x * offset);
}
function strip(a, b, y, material, segments = 220) {
  const vs = [], uv = [], idx = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments, p = roadAt(t, a, y), q = roadAt(t, b, y);
    vs.push(...p.toArray(), ...q.toArray()); uv.push(t * roadLen / 6, 0, t * roadLen / 6, (b - a) / 6);
    if (i < segments) { const j = i * 2; idx.push(j, j + 2, j + 1, j + 1, j + 2, j + 3); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(vs, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return mesh(g, material, [0, 0, 0], [0, 0, 0], scene, false);
}
strip(-2.45, 2.45, .028, mats.asphalt);
strip(2.45, 3.28, .13, mats.curb);
strip(-3.0, -2.45, .12, mats.curb);
const curbBlocks = [];
for (let s = 0; s < roadLen; s += .55) {
  const t = s / roadLen, tangent = roadCurve.getTangentAt(t), angle = Math.atan2(-tangent.z, tangent.x);
  for (const off of [2.45, -2.45]) curbBlocks.push({ p: roadAt(t, off, .085).toArray(), s: [.535, .18, .19], r: [0, angle, 0] });
}
instanced(roundedGeo, mats.curb, curbBlocks);
const sidewalkSeams = [];
for (let s = 0; s < roadLen; s += 1.05) {
  const t = s / roadLen, tangent = roadCurve.getTangentAt(t), angle = Math.atan2(-tangent.z, tangent.x);
  sidewalkSeams.push({ p: roadAt(t, 2.88, .133).toArray(), s: [.012, .005, .77], r: [0, angle, 0] });
}
instanced(boxGeo, mats.mortar, sidewalkSeams, scene, false);
for (let s = .7; s < roadLen; s += 2.65) {
  const t = s / roadLen, tangent = roadCurve.getTangentAt(t), angle = Math.atan2(-tangent.z, tangent.x);
  box(1.4, .008, .11, mats.line, roadAt(t, -.42, .036).toArray(), [0, angle, 0]);
}

// Thick stucco walls with true apertures.
const hx = -.95, hz = -1.2, width = 7.8, depth = 6.8, bottom = .18, eave = 5.93, ridge = 8.16;
const frontZ = hz + depth / 2, backZ = hz - depth / 2, leftX = hx - width / 2, rightX = hx + width / 2;
const frontHoles = [
  { x: -3.55, y: 1.55, w: 1.05, h: 1.5 }, { x: 1.45, y: 1.55, w: 1.02, h: 1.5 },
  { x: -3.02, y: 4.55, w: 1.35, h: 1.5 }, { x: 1.12, y: 4.55, w: 1.42, h: 1.5 },
  { x: -.77, y: 1.3, w: 1.0, h: 2.24 }
];
const rightHoles = [
  { x: .75, y: 1.56, w: .96, h: 1.45 }, { x: -2.5, y: 1.56, w: .88, h: 1.45 },
  { x: .75, y: 4.55, w: .85, h: 1.52 }, { x: -2.5, y: 4.55, w: .85, h: 1.52 }
];
function wallSegments(min, max, plane, holes, side) {
  const xs = [...new Set([min, max, ...holes.flatMap(v => [v.x - v.w / 2, v.x + v.w / 2])])].sort((a, b) => a - b);
  const ys = [...new Set([bottom, eave, ...holes.flatMap(v => [v.y - v.h / 2, v.y + v.h / 2])])].sort((a, b) => a - b);
  const geos = [];
  for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < ys.length - 1; j++) {
    const cx = (xs[i] + xs[i + 1]) / 2, cy = (ys[j] + ys[j + 1]) / 2;
    if (holes.some(v => Math.abs(cx - v.x) < v.w / 2 && Math.abs(cy - v.y) < v.h / 2)) continue;
    const g = new THREE.BoxGeometry(xs[i + 1] - xs[i], ys[j + 1] - ys[j], .26);
    if (side) g.rotateY(Math.PI / 2);
    g.translate(side ? plane : cx, cy, side ? cx : plane); geos.push(g);
  }
  mesh(mergeGeometries(geos), mats.stucco);
}
wallSegments(leftX, rightX, frontZ, frontHoles, false);
wallSegments(backZ, frontZ, rightX, rightHoles, true);
const backHoles = [{ x: -2.6, y: 4.5, w: 1.15, h: 1.5 }, { x: .85, y: 4.5, w: 1.15, h: 1.5 }, { x: -.5, y: 1.65, w: 1.3, h: 1.5 }];
wallSegments(leftX, rightX, backZ, backHoles, false);
const leftHoles = [{ x: .1, y: 4.55, w: 1.0, h: 1.5 }, { x: -2.75, y: 4.55, w: 1.0, h: 1.5 }, { x: -.3, y: 1.55, w: 1.0, h: 1.5 }];
wallSegments(backZ, frontZ, leftX, leftHoles, true);
box(width, .22, depth, mats.plinth, [hx, .08, hz]);
box(width - .4, .1, depth - .4, mats.interior, [hx, .2, hz]);
box(width - .4, .13, depth - .4, mats.interior, [hx, 3.12, hz]);
function gable(x) {
  const v = [[x - .13, eave, backZ], [x - .13, eave, frontZ], [x - .13, ridge - .09, hz],
    [x + .13, eave, backZ], [x + .13, eave, frontZ], [x + .13, ridge - .09, hz]];
  return polygon(v, [0, 1, 2, 3, 5, 4, 0, 4, 1, 0, 3, 4, 1, 5, 2, 1, 4, 5, 2, 3, 0, 2, 5, 3], mats.stucco);
}
gable(leftX); gable(rightX);
function windowUnit(x, y, w, h, z, rotation = 0) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotation; scene.add(g);
  box(w - .025, h - .025, .045, mats.interior, [0, 0, -.23], [0, 0, 0], g);
  const folds = 10;
  for (const s of [-1, 1]) for (let i = 0; i < folds; i++) {
    const xx = s * (w * .23 + i * w * .022);
    box(w * .032, h * .89, .025, mats.curtain, [xx, 0, -.16 - (i % 2) * .014], [0, 0, 0], g);
  }
  box(w - .12, h - .12, .028, mats.glass, [0, 0, -.105], [0, 0, 0], g);
  for (const s of [-1, 1]) {
    box(.072, h, .09, mats.frame, [s * (w / 2 - .04), 0, -.02], [0, 0, 0], g);
    box(w, .075, .09, mats.frame, [0, s * (h / 2 - .04), -.02], [0, 0, 0], g);
  }
  box(.055, h - .08, .07, mats.frame, [0, 0, .0], [0, 0, 0], g);
  box(w - .08, .044, .063, mats.frame, [0, -.075, .0], [0, 0, 0], g);
  box(w + .18, .09, .33, mats.curb, [0, -h / 2 - .045, .07], [0, 0, 0], g);
  box(.028, .075, .025, mats.chrome, [.06, -.12, .06], [0, 0, 0], g);
}
frontHoles.slice(0, 4).forEach(v => windowUnit(v.x, v.y, v.w, v.h, frontZ + .01));
rightHoles.forEach(v => windowUnit(rightX + .01, v.y, v.w, v.h, v.x, Math.PI / 2));
backHoles.forEach(v => windowUnit(v.x, v.y, v.w, v.h, backZ - .01, Math.PI));
leftHoles.forEach(v => windowUnit(leftX - .01, v.y, v.w, v.h, v.x, -Math.PI / 2));
box(.97, 2.19, .12, mats.door, [-.77, 1.28, frontZ - .08]);
for (const x of [-1.30, -.24]) box(.08, 2.32, .13, mats.frame, [x, 1.29, frontZ + .025]);
box(1.13, .08, .13, mats.frame, [-.77, 2.43, frontZ + .025]);
for (const yy of [.7, 1.69]) {
  box(.69, .74, .025, mats.frame, [-.77, yy, frontZ + .005]);
  box(.59, .64, .035, mats.door, [-.77, yy, frontZ + .025]);
}
rod([-1.11, 1.08, frontZ + .11], [-1.11, 1.28, frontZ + .11], .025, .025, mats.chrome);
box(.09, .04, .035, mats.chrome, [-1.11, .99, frontZ + .105]);

// Curved overlapping terracotta tiles, eaves, ridge and chimney.
function tileGeometry() {
  const p = [], idx = [], seg = 8;
  for (let end = 0; end < 2; end++) {
    const r = end ? .116 : .098, z = end ? .265 : -.265;
    for (let side = 0; side < 2; side++) for (let i = 0; i <= seg; i++) {
      const a = i / seg * Math.PI; p.push(Math.cos(a) * (r - side * .019), Math.sin(a) * (r - side * .019), z);
    }
  }
  const n = seg + 1;
  for (let side = 0; side < 2; side++) for (let i = 0; i < seg; i++) {
    const a = side * n + i, b = 2 * n + side * n + i;
    if (side === 0) idx.push(a, a + 1, b, a + 1, b + 1, b); else idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  for (let i = 0; i < seg; i++) {
    idx.push(i, i + 1, n + i, i + 1, n + i + 1, n + i);
    idx.push(2 * n + i, 3 * n + i, 2 * n + i + 1, 2 * n + i + 1, 3 * n + i, 3 * n + i + 1);
  }
  for (const i of [0, seg]) idx.push(i, n + i, 2 * n + i, 2 * n + i, n + i, 3 * n + i);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  const uv = []; for (let end = 0; end < 2; end++) for (let side = 0; side < 2; side++) for (let i = 0; i <= seg; i++) uv.push(i / seg, end);
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
const tileGeo = tileGeometry();
const tileGroups = tileMats.map(() => []);
function roofTiles(xMin, xMax, zStart, zEnd, yStart, yEnd) {
  const dz = zEnd - zStart, slope = (yEnd - yStart) / dz, angle = Math.atan(-slope);
  const run = Math.hypot(dz, yEnd - yStart), columns = Math.ceil((xMax - xMin) / .225), rows = Math.ceil(run / .43);
  box(xMax - xMin + .08, .10, run + .09, mats.roofBase, [(xMin + xMax) / 2, (yStart + yEnd) / 2 - .035, (zStart + zEnd) / 2], [angle, 0, 0]);
  for (let c = 0; c < columns; c++) for (let r = 0; r < rows; r++) {
    const f = (r + .5) / rows, x = xMin + (c + .5) / columns * (xMax - xMin);
    tileGroups[Math.floor(rnd() * tileMats.length)].push({ p: [x, lerp(yStart, yEnd, f) + .03, lerp(zStart, zEnd, f)], r: [angle, 0, 0], s: [1, 1, 1.05] });
  }
}
roofTiles(leftX - .47, rightX + .47, hz, frontZ + .48, ridge, eave - .08);
roofTiles(leftX - .47, rightX + .47, backZ - .48, hz, eave - .08, ridge);
const ridgeTiles = [];
for (let x = leftX - .43; x < rightX + .5; x += .37) ridgeTiles.push({ p: [x, ridge + .06, hz], r: [0, Math.PI / 2, 0], s: [1.45, 1.4, .82] });
instanced(tileGeo, tileMats[3], ridgeTiles);
const roofRun = (depth / 2 + .48), roofRise = ridge - (eave - .08), roofAngle = Math.atan(roofRise / roofRun), roofLength = Math.hypot(roofRun, roofRise);
for (const x of [leftX - .48, rightX + .48]) for (const s of [-1, 1]) {
  box(.11, .18, roofLength + .16, mats.wood, [x, (ridge + eave - .08) / 2 - .10, hz + s * roofRun / 2], [s * roofAngle, 0, 0]);
  box(.10, .09, roofLength + .16, tileMats[3], [x, (ridge + eave - .08) / 2 + .06, hz + s * roofRun / 2], [s * roofAngle, 0, 0]);
}
for (const z of [frontZ + .48, backZ - .48]) {
  box(width + 1.08, .13, .15, mats.wood, [hx, eave - .14, z]);
  rod([leftX - .5, eave - .22, z + (z > hz ? .03 : -.03)], [rightX + .5, eave - .22, z + (z > hz ? .03 : -.03)], .075, .075, mats.gutter, scene, 12);
}
for (const x of [leftX + .04, rightX - .04]) {
  rod([x, .17, frontZ + .21], [x, 5.35, frontZ + .21], .045, .045, mats.gutter);
  rod([x, 5.35, frontZ + .21], [x, 5.68, frontZ + .45], .045, .045, mats.gutter);
  for (const y of [.7, 2.7, 4.8]) box(.13, .035, .075, mats.gutter, [x, y, frontZ + .22]);
}
box(.8, .14, .86, mats.gutter, [1.92, 7.78, -1.72]);
box(.67, 1.18, .69, mats.stucco, [1.92, 8.27, -1.72]);
box(.79, .10, .81, mats.curb, [1.92, 8.86, -1.72]);
box(.65, .30, .67, mats.interior, [1.92, 9.03, -1.72]);
for (const xx of [-.26, .26]) for (const zz of [-.27, .27]) box(.11, .37, .11, mats.stucco, [1.92 + xx, 9.08, -1.72 + zz]);
box(.96, .09, .97, tileMats[2], [1.92, 9.31, -1.72]);
const cap = new THREE.ConeGeometry(.70, .19, 4); cap.rotateY(Math.PI / 4); mesh(cap, tileMats[3], [1.92, 9.43, -1.72]);

// Open porch, timber structure, tile canopy, step and lantern.
const porchLeft = -3.35, porchRight = 1.85;
roofTiles(porchLeft, porchRight, frontZ + .03, 4.35, 3.72, 3.22);
box(porchRight - porchLeft, .20, .19, mats.wood, [(porchLeft + porchRight) / 2, 3.15, 4.31]);
box(porchRight - porchLeft, .13, .15, mats.gutter, [(porchLeft + porchRight) / 2, 3.11, 4.39]);
for (const x of [-3.01, 1.49]) {
  box(.30, 2.77, .32, mats.stucco, [x, 1.61, 4.12]);
  box(.45, .13, .46, mats.curb, [x, .27, 4.12]);
  box(.47, .12, .48, mats.stucco, [x, 3.02, 4.12]);
  box(.36, .10, .37, mats.stucco, [x, 2.92, 4.12]);
}
for (let x = porchLeft + .12; x < porchRight; x += .42) rod([x, 3.53, frontZ + .04], [x, 3.05, 4.35], .035, .035, mats.wood);
box(5.03, .16, 2.10, mats.curb, [-.77, .23, 3.30]);
box(3.0, .13, .44, mats.curb, [-.77, .11, 4.49]);
box(2.6, .08, .34, mats.curb, [-.77, .04, 4.83]);
for (let x = -3.1; x < 1.6; x += .58) box(.012, .005, 2.0, mats.mortar, [x, .313, 3.28]);
box(.11, .21, .10, mats.gutter, [-1.9, 2.15, frontZ + .12]);
rod([-1.9, 2.20, frontZ + .15], [-1.9, 2.20, frontZ + .43], .025, .025, mats.gutter);
const lantern = new THREE.Group(); lantern.position.set(-1.9, 1.91, frontZ + .45); scene.add(lantern);
box(.19, .26, .17, mats.headlamp, [0, 0, 0], [0, 0, 0], lantern);
for (const xx of [-.095, .095]) for (const zz of [-.085, .085]) rod([xx, -.14, zz], [xx, .14, zz], .012, .012, mats.frame, lantern, 5);
mesh(new THREE.ConeGeometry(.175, .11, 4), mats.frame, [0, .19, 0], [0, Math.PI / 4, 0], lantern);
box(.23, .035, .21, mats.frame, [0, -.16, 0], [0, 0, 0], lantern);
tileGroups.forEach((v, i) => instanced(tileGeo, tileMats[i], v));

// Irregular shallow-bevel stone paving.
function flagstone(x, z, w, d, y = .037) {
  const sh = new THREE.Shape();
  const pts = [[-w / 2 + .05, -d / 2], [w / 2 - .09, -d / 2 - (rnd() - .5) * .04], [w / 2, -d / 2 + .09], [w / 2 - .015, d / 2 - .09], [w / 2 - .09, d / 2], [-w / 2 + .07, d / 2 + (rnd() - .5) * .04], [-w / 2, d / 2 - .07], [-w / 2 - .01, -d / 2 + .10]];
  sh.moveTo(...pts[0]); pts.slice(1).forEach(p => sh.lineTo(...p)); sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: .036, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: .012, bevelThickness: .009 });
  g.rotateX(-Math.PI / 2); mesh(g, stoneMats[Math.floor(rnd() * 7)], [x, y, z]);
}
box(1.66, .02, 2.0, mats.mortar, [-.77, .027, 5.60]);
for (let row = 0; row < 5; row++) for (let c = 0; c < 3; c++) flagstone(-1.32 + c * .55 + (row % 2) * .025, 4.89 + row * .39, .515, .36);
box(2.70, .022, 8.5, mats.mortar, [4.23, .021, -.02]);
for (let r = 0; r < 19; r++) for (let c = 0; c < 4; c++) flagstone(3.22 + c * .64 + (r % 2) * .02, -4.13 + r * .44, .61, .415, .024);

// Low curved masonry garden boundary and gate piers.
strip(3.43, 3.85, .07, mats.mortar);
const stoneBlocks = stoneMats.map(() => []), wallCaps = [];
for (let s = 0; s < roadLen; s += .48) {
  const t = s / roadLen, p = roadAt(t, 3.64), tangent = roadCurve.getTangentAt(t), angle = Math.atan2(-tangent.z, tangent.x);
  if (p.x > -1.64 && p.x < .05 && p.z > 4.8) continue;
  for (let row = 0; row < 3; row++) {
    const tt = Math.min(1, Math.max(0, (s + (row % 2) * .24) / roadLen)), pp = roadAt(tt, 3.64, .16 + row * .205);
    if (pp.x > -1.64 && pp.x < .05 && pp.z > 4.8) continue;
    stoneBlocks[Math.floor(rnd() * 7)].push({ p: pp.toArray(), s: [.46 + rnd() * .015, .188 + rnd() * .015, .38 + rnd() * .03], r: [0, angle + (rnd() - .5) * .025, 0] });
  }
  wallCaps.push({ p: roadAt(t, 3.64, .72).toArray(), s: [.49, .10, .48], r: [0, angle, 0] });
}
stoneBlocks.forEach((a, i) => instanced(roundedGeo, stoneMats[i], a));
instanced(roundedGeo, mats.curb, wallCaps);
const gateZ = 6.54;
for (const x of [-1.72, .18]) {
  box(.43, 1.09, .48, mats.mortar, [x, .57, gateZ]);
  for (let row = 0; row < 5; row++) for (const side of [-1, 1]) {
    box(.43, .195, .215, stoneMats[(row + (side > 0 ? 2 : 0)) % 7], [x, .14 + row * .204, gateZ + side * .122], [0, 0, 0], scene, true);
  }
  box(.60, .115, .63, mats.curb, [x, 1.12, gateZ], [0, 0, 0], scene, true);
}
for (const x of [5.55, 6.55]) {
  box(.40, .88, .42, mats.curb, [x, .47, 4.72], [0, 0, 0], scene, true);
  box(.51, .09, .51, mats.curb, [x, .95, 4.72], [0, 0, 0], scene, true);
}
// Wooden garden gate and fence behind the side path.
for (let i = 0; i < 18; i++) box(.18, 1.35, .07, mats.wood, [4.25 + i * .20, .80, -3.99], [0, 0, 0], scene, true);
for (const y of [.42, 1.18]) box(3.70, .10, .10, mats.wood, [5.9, y, -4.08]);
for (const x of [4.12, 7.9]) box(.15, 1.5, .16, mats.wood, [x, .81, -4.0]);

// Rounded mailbox, door seam, slot and brass label.
box(.065, .90, .07, mats.frame, [-2.15, .58, 6.27]);
const mailboxShape = new THREE.Shape();
mailboxShape.moveTo(-.23, -.14); mailboxShape.lineTo(.23, -.14); mailboxShape.lineTo(.23, .10);
mailboxShape.absarc(0, .10, .23, 0, Math.PI, false); mailboxShape.lineTo(-.23, -.14);
const mailGeo = new THREE.ExtrudeGeometry(mailboxShape, { depth: .42, bevelEnabled: true, bevelSize: .008, bevelThickness: .008, bevelSegments: 1, steps: 1 });
mesh(mailGeo, mats.frame, [-2.15, 1.1, 6.10]);
const mailDoor = new THREE.ShapeGeometry(mailboxShape);
mesh(mailDoor, mats.gutter, [-2.15, 1.1, 6.531]);
box(.15, .025, .013, mats.black, [-2.15, 1.16, 6.549]);
box(.07, .035, .014, mats.chrome, [-2.15, 1.06, 6.55]);

// Woody olive trees with explicitly modelled branch structure and leaf canopies.
const leafGeo = new THREE.IcosahedronGeometry(1, 0);
const leaves = [[], [], []], cypressLeaves = [], stems = [], blossoms = [];
function leafCluster(cx, cy, cz, rx, ry, rz, count, kind = 'olive') {
  for (let i = 0; i < count; i++) {
    let u = rnd() * 2 - 1, phi = rnd() * Math.PI * 2, radius = Math.cbrt(rnd());
    const rr = Math.sqrt(1 - u * u) * radius;
    const p = [cx + Math.cos(phi) * rr * rx, cy + u * radius * ry, cz + Math.sin(phi) * rr * rz];
    const v = { p, s: kind === 'cypress' ? [.09 + rnd() * .04, .13 + rnd() * .08, .065] : [.11 + rnd() * .035, .025, .055 + rnd() * .02], r: [rnd() * 3, rnd() * 6.28, rnd() * 3] };
    if (kind === 'cypress') cypressLeaves.push(v); else leaves[Math.floor(rnd() * 3)].push(v);
  }
}
function oliveTree(x, z, size = 1) {
  const tr = new THREE.Group(); tr.position.set(x, .04, z); tr.scale.setScalar(size); scene.add(tr);
  rod([0, 0, 0], [.11, 1.05, -.03], .18, .12, mats.bark, tr, 9);
  const tips = [[-.87, 2.27, .18], [.68, 2.55, .03], [.22, 2.91, -.50], [-.30, 2.79, -.78], [.02, 2.50, .79]];
  tips.forEach((tip, i) => {
    const mid = [tip[0] * .35 + .1, 1.48, tip[2] * .32]; rod([.1, .85, -.02], mid, .11, .075, mats.bark, tr);
    rod(mid, tip, .075, .032, mats.bark, tr);
    for (let b = 0; b < 4; b++) {
      const end = [tip[0] + (rnd() - .5) * 1.25, tip[1] + .20 + rnd() * .50, tip[2] + (rnd() - .5) * 1.2];
      rod([lerp(mid[0], tip[0], .68), lerp(mid[1], tip[1], .68), lerp(mid[2], tip[2], .68)], end, .024, .009, mats.bark, tr, 5);
    }
    leafCluster(x + tip[0] * size, .04 + (tip[1] + .15) * size, z + tip[2] * size, 1.0 * size, .65 * size, .87 * size, 850);
  });
  // Slightly raised roots at the base.
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; rod([0, .11, 0], [Math.cos(a) * .45, .015, Math.sin(a) * .45], .09, .025, mats.bark, tr); }
}
oliveTree(-6.60, 2.54, 1.02);
oliveTree(6.0, -2.70, .91);
oliveTree(-7.7, -7.15, .80);
function cypress(x, z, h) {
  rod([x, 0, z], [x, h * .75, z], .11, .038, mats.bark);
  for (let i = 0; i < 7; i++) {
    const f = i / 7, radius = .55 * Math.sin(Math.PI * (.16 + f * .78));
    leafCluster(x, .4 + h * f, z, radius, h / 6, radius, 450, 'cypress');
  }
}
cypress(-8.35, -3.85, 5.15); cypress(-6.5, -7.7, 4.8); cypress(6.5, -7.5, 4.5);
function shrub(x, z, radius, y = 0, count = 360) {
  leafCluster(x, y + radius * .63, z, radius, radius * .72, radius * .88, count);
  for (let j = 0; j < 4; j++) rod([x, y + .06, z], [x + (rnd() - .5) * radius, y + radius * .72, z + (rnd() - .5) * radius], .012, .004, mats.stem, scene, 5);
}
for (const p of [[-5.7, 4.6, .7], [-7.2, 4.5, .65], [-4.7, 4.9, .52], [1.15, 5.25, .52], [2.1, 4.8, .55], [3.18, 1.35, .53], [3.18, -.6, .58], [3.3, -2.1, .61], [6.1, 3.75, .52], [6.9, 2.5, .61], [-8.4, 1.1, .76], [-5.6, -2.2, .71], [5.6, -6.0, .68], [-2.8, -6.6, .74], [1.6, -6.2, .72]]) shrub(...p);
for (let s = 1; s < roadLen - 3; s += 1.06) {
  const p = roadAt(s / roadLen, 4.14);
  if (p.x > -2.6 && p.x < 1.2 && p.z > 5) continue;
  shrub(p.x, p.z, .35 + rnd() * .12, 0, 130);
}
function potPlant(x, z, scale = 1) {
  mesh(new THREE.CylinderGeometry(.27 * scale, .20 * scale, .40 * scale, 14), mats.pot, [x, .22 * scale + .27, z]);
  mesh(new THREE.TorusGeometry(.262 * scale, .03 * scale, 6, 20), mats.pot, [x, .435 * scale + .27, z], [Math.PI / 2, 0, 0]);
  mesh(new THREE.CylinderGeometry(.236 * scale, .236 * scale, .025, 14), mats.soil, [x, .417 * scale + .27, z]);
  rod([x, .63, z], [x, 1.28 * scale, z], .026, .014, mats.bark);
  leafCluster(x, 1.1 * scale + .27, z, .43 * scale, .42 * scale, .39 * scale, 330);
}
potPlant(-2.40, 2.98, .85); potPlant(.17, 3.0, .73); potPlant(2.40, 3.70, 1.03);
function lavender(x, z, radius) {
  for (let i = 0; i < 60; i++) {
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * radius, yy = .20 + rnd() * .28;
    const xx = x + Math.cos(a) * r, zz = z + Math.sin(a) * r;
    stems.push({ p: [xx, yy / 2, zz], s: [.012, yy, .012], r: [(rnd() - .5) * .22, 0, (rnd() - .5) * .22] });
    blossoms.push({ p: [xx, yy + .07, zz], s: [.033, .095, .033], r: [0, rnd() * 3, .1] });
  }
  leafCluster(x, .13, z, radius, .15, radius, 170);
}
lavender(-3.9, 4.65, .43); lavender(1.35, 4.69, .39); lavender(3.75, 2.1, .47); lavender(-7.4, 4.1, .43); lavender(3.95, -.85, .44);
leaves.forEach((v, i) => instanced(leafGeo, mats['leaf' + (i + 1)], v));
instanced(leafGeo, mats.cypress, cypressLeaves);
instanced(boxGeo, mats.stem, stems);
instanced(new THREE.IcosahedronGeometry(1, 1), mats.lavender, blossoms);
const grassBlades = [];
const bladeGeo = new THREE.BufferGeometry();
bladeGeo.setAttribute('position', new THREE.Float32BufferAttribute([-.016, 0, 0, .016, 0, 0, .014, .20, .018, 0, .27, .025], 3)); bladeGeo.setIndex([0, 1, 2, 0, 2, 3]); bladeGeo.computeVertexNormals();
const bladeMat = std('blade', '#7c8447', 1, { side: THREE.DoubleSide });
for (let i = 0; i < 1900; i++) {
  const x = -10 + rnd() * 17, z = -8 + rnd() * 14;
  if (x > leftX - .2 && x < rightX + 2 && z > backZ - .1 && z < 4.7) continue;
  if (x > -1.7 && x < .2 && z > 4.5) continue;
  grassBlades.push({ p: [x, .01, z], r: [0, rnd() * 6.28, 0], s: [.7 + rnd(), .25 + rnd() * .55, .7 + rnd()] });
}
instanced(bladeGeo, bladeMat, grassBlades, scene, false);

// A fully volumetric compact hatchback: swept body, glazed cabin, interior, four wheels.
const car = new THREE.Group(); car.position.set(4.55, .04, 8.0); car.rotation.y = -.66; scene.add(car);
const stations = [
  [-2.02, .63, .87], [-1.84, .79, 1.04], [-1.40, .825, 1.13], [-.65, .835, 1.16], [.45, .835, 1.12], [1.30, .81, 1.06], [1.82, .76, .92], [2.02, .65, .78]
];
function stationAt(z) {
  let a = stations[0], b = stations[1];
  for (let i = 0; i < stations.length - 1; i++) if (z >= stations[i][0] && z <= stations[i + 1][0]) { a = stations[i]; b = stations[i + 1]; break; }
  const f = (z - a[0]) / (b[0] - a[0]); return [lerp(a[1], b[1], f), lerp(a[2], b[2], f)];
}
{
  const vs = [], idx = [], n = 64, points = 12;
  for (let i = 0; i <= n; i++) {
    const z = lerp(-2.02, 2.02, i / n), [w, top] = stationAt(z);
    let low = .37;
    for (const wc of [-1.22, 1.20]) { const d = z - wc; if (Math.abs(d) < .475) low = Math.max(low, .455 + Math.sqrt(.475 * .475 - d * d)); }
    const ring = [[-w * .64, .36], [-w * .97, low], [-w, Math.max(low + .035, top - .20)], [-w * .94, top - .015], [-w * .64, top + .025], [-w * .24, top + .039], [w * .24, top + .039], [w * .64, top + .025], [w * .94, top - .015], [w, Math.max(low + .035, top - .20)], [w * .97, low], [w * .64, .36]];
    ring.forEach(p => vs.push(p[0], p[1], z));
    if (i < n) for (let j = 0; j < points; j++) { const a = i * points + j, b = i * points + (j + 1) % points, c = a + points, d = b + points; idx.push(a, c, b, b, c, d); }
  }
  for (const end of [0, n]) for (let j = 1; j < points - 1; j++) { const offset = end * points; end ? idx.push(offset, offset + j + 1, offset + j) : idx.push(offset, offset + j, offset + j + 1); }
  polygon(Array.from({ length: vs.length / 3 }, (_, i) => vs.slice(i * 3, i * 3 + 3)), idx, mats.blue, car);
}
box(1.36, .11, 3.8, mats.black, [0, .39, 0], [0, 0, 0], car, true);
// Roof crown, a gently curved surface rather than a cuboid cabin.
{
  const pos = [], ind = [], nx = 12, nz = 10;
  for (let iz = 0; iz <= nz; iz++) for (let ix = 0; ix <= nx; ix++) {
    const x = lerp(-.65, .65, ix / nx), z = lerp(-.94, .39, iz / nz);
    pos.push([x, 1.635 + .08 * (1 - (x / .70) ** 2) + .015 * Math.sin(iz / nz * Math.PI), z]);
    if (ix < nx && iz < nz) { const a = iz * (nx + 1) + ix; ind.push(a, a + nx + 1, a + 1, a + 1, a + nx + 1, a + nx + 2); }
  }
  polygon(pos, ind, mats.blue, car);
}
function trimLine(points, radius, material) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  return mesh(new THREE.TubeGeometry(curve, points.length * 5, radius, 5, false), material, [0, 0, 0], [0, 0, 0], car);
}
const windshield = [[-.654, 1.635, .395], [.654, 1.635, .395], [.746, 1.107, 1.115], [-.746, 1.107, 1.115]];
quad(...windshield, mats.carGlass, car);
trimLine([...windshield, windshield[0]], .025, mats.black);
const rearGlass = [[.65, 1.64, -.945], [-.65, 1.64, -.945], [-.77, 1.115, -1.56], [.77, 1.115, -1.56]];
quad(...rearGlass, mats.carGlass, car);
trimLine([...rearGlass, rearGlass[0]], .026, mats.black);
for (const side of [-1, 1]) {
  const sx = side;
  const frontPane = [[sx * .672, 1.626, .34], [sx * .673, 1.63, -.19], [sx * .802, 1.125, -.22], [sx * .770, 1.115, .98]];
  const rearPane = [[sx * .666, 1.63, -.28], [sx * .641, 1.616, -.88], [sx * .756, 1.14, -1.45], [sx * .802, 1.125, -.28]];
  if (side > 0) { quad(...frontPane, mats.carGlass, car); quad(...rearPane, mats.carGlass, car); }
  else { quad(frontPane[3], frontPane[2], frontPane[1], frontPane[0], mats.carGlass, car); quad(rearPane[3], rearPane[2], rearPane[1], rearPane[0], mats.carGlass, car); }
  trimLine([...frontPane, frontPane[0]], .020, mats.black);
  trimLine([...rearPane, rearPane[0]], .020, mats.black);
  rod([sx * .796, 1.118, -.25], [sx * .66, 1.65, -.23], .035, .035, mats.black, car, 6);
  trimLine([[sx * .76, 1.115, 1.02], [sx * .67, 1.65, .38], [sx * .65, 1.68, -.9], [sx * .77, 1.10, -1.54]], .039, mats.blue);
  trimLine([[sx * .830, .60, .9], [sx * .849, .59, -.16], [sx * .825, 1.10, -.21]], .008, mats.black);
  trimLine([[sx * .829, 1.12, -1.33], [sx * .845, .88, -1.0], [sx * .842, .60, -.87], [sx * .849, .59, -.20]], .006, mats.black);
  box(.022, .045, .18, mats.black, [sx * .850, 1.03, -.05], [0, 0, 0], car, true);
  box(.023, .04, .17, mats.black, [sx * .843, 1.04, -.96], [0, 0, 0], car, true);
  rod([sx * .79, 1.16, .77], [sx * .99, 1.17, .75], .033, .032, mats.black, car);
  box(.24, .14, .28, mats.blue, [sx * 1.02, 1.19, .77], [0, side * .12, 0], car, true);
  box(.018, .095, .21, mats.glass, [sx * 1.147, 1.19, .756], [0, side * .12, 0], car, true);
  trimLine([[sx * .84, .48, -1.72], [sx * .862, .47, 0], [sx * .84, .48, 1.72]], .021, mats.blue);
}
// Interior seats, dashboard, wheel and windscreen wipers.
box(1.34, .13, .35, mats.black, [0, 1.13, .85], [0, 0, 0], car, true);
for (const x of [-.38, .38]) for (const z of [-.62, .21]) {
  box(.46, .16, .45, mats.seat, [x, .88, z], [0, 0, 0], car, true);
  box(.46, .49, .13, mats.seat, [x, 1.13, z - .20], [-.14, 0, 0], car, true);
  box(.25, .20, .11, mats.seat, [x, 1.43, z - .23], [0, 0, 0], car, true);
}
mesh(new THREE.TorusGeometry(.17, .025, 8, 20), mats.black, [-.38, 1.24, .63], [-.65, 0, 0], car);
for (const x of [-.32, .30]) trimLine([[x - .20, 1.136, 1.07], [x + .16, 1.24, .94]], .014, mats.black);
// Front face: grille, chrome bars, lamps and small round badge.
box(1.21, .21, .065, mats.black, [0, .71, 2.028], [0, 0, 0], car, true);
for (const y of [.64, .71, .78]) box(1.15, .018, .014, mats.chrome, [0, y, 2.067], [0, 0, 0], car);
box(1.09, .19, .047, mats.black, [0, .47, 1.975], [0, 0, 0], car, true);
for (const y of [.43, .48, .53]) box(1.03, .013, .018, mats.gutter, [0, y, 2.003], [0, 0, 0], car);
box(.48, .115, .03, mats.frame, [0, .57, 2.077], [0, 0, 0], car, true);
mesh(new THREE.TorusGeometry(.092, .016, 6, 20), mats.chrome, [0, .76, 2.085], [0, 0, 0], car);
box(.028, .10, .013, mats.chrome, [0, .76, 2.097], [0, 0, .1], car);
for (const s of [-1, 1]) {
  const lamp = [[s * .40, .83, 2.044], [s * .67, .85, 1.94], [s * .73, .70, 1.963], [s * .44, .70, 2.05]];
  polygon(lamp, s > 0 ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3], mats.headlamp, car);
  trimLine([...lamp, lamp[0]], .012, mats.chrome);
  for (let i = 0; i < 2; i++) mesh(new THREE.CylinderGeometry(.051, .051, .01, 12), mats.chrome, [s * (.50 + i * .11), .773, 2.059 - i * .035], [Math.PI / 2, 0, 0], car);
  box(.23, .14, .056, mats.black, [s * .63, .48, 1.988], [0, 0, 0], car, true);
  box(.13, .055, .015, mats.headlamp, [s * .63, .48, 2.022], [0, 0, 0], car, true);
  box(.20, .19, .075, mats.tail, [s * .65, .91, -1.962], [0, 0, 0], car, true);
}
box(1.27, .09, .058, mats.black, [0, .44, -1.993], [0, 0, 0], car, true);
box(.48, .12, .025, mats.frame, [0, .75, -2.03], [0, 0, 0], car, true);
box(.53, .025, .10, mats.blue, [0, 1.20, -1.55], [0, 0, 0], car, true);
trimLine([[-.58, 1.04, 1.79], [-.62, 1.108, 1.10], [-.60, 1.122, .99]], .006, mats.frame);
trimLine([[.58, 1.04, 1.79], [.62, 1.108, 1.10], [.60, 1.122, .99]], .006, mats.frame);
rod([0, 1.69, -.78], [0, 2.02, -.97], .011, .005, mats.black, car, 5);
for (const side of [-1, 1]) for (const z of [-1.22, 1.20]) {
  const wg = new THREE.Group(); wg.position.set(side * .865, .455, z); car.add(wg);
  mesh(new THREE.CylinderGeometry(.405, .405, .215, 28), mats.rubber, [0, 0, 0], [0, 0, Math.PI / 2], wg);
  for (const ox of [-.09, .09]) mesh(new THREE.TorusGeometry(.341, .067, 8, 28), mats.rubber, [ox, 0, 0], [0, Math.PI / 2, 0], wg);
  const outer = side * .121;
  mesh(new THREE.CylinderGeometry(.292, .292, .018, 28), mats.black, [outer, 0, 0], [0, 0, Math.PI / 2], wg);
  mesh(new THREE.CylinderGeometry(.228, .228, .014, 20), mats.gutter, [outer + side * .009, 0, 0], [0, 0, Math.PI / 2], wg);
  mesh(new THREE.TorusGeometry(.275, .020, 6, 28), mats.chrome, [outer + side * .023, 0, 0], [0, Math.PI / 2, 0], wg);
  for (let j = 0; j < 7; j++) {
    const a = j / 7 * Math.PI * 2;
    for (const delta of [-.035, .035]) {
      const aa = a + delta, start = [outer + side * .025, Math.sin(aa) * .068, Math.cos(aa) * .068], end = [outer + side * .025, Math.sin(aa + .10) * .262, Math.cos(aa + .10) * .262];
      rod(start, end, .016, .022, mats.chrome, wg, 5);
    }
  }
  mesh(new THREE.CylinderGeometry(.075, .075, .025, 16), mats.chrome, [outer + side * .043, 0, 0], [0, 0, Math.PI / 2], wg);
  for (let j = 0; j < 5; j++) mesh(new THREE.SphereGeometry(.015, 5, 3), mats.gutter, [outer + side * .059, Math.sin(j * 1.256) * .046, Math.cos(j * 1.256) * .046], [0, 0, 0], wg);
  const arc = [];
  for (let i = 0; i <= 18; i++) { const a = i / 18 * Math.PI; arc.push([side * .85, .455 + Math.sin(a) * .49, z + Math.cos(a) * .49]); }
  trimLine(arc, .021, mats.black);
}

// Bake static opaque pieces into material batches. Transparent glazing stays individually sortable.
scene.updateMatrixWorld(true);
const staticBatches = new Map();
scene.traverse(o => {
  if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material) || o.material.transparent) return;
  const key = o.material.uuid + ':' + Number(o.castShadow) + ':' + Number(o.receiveShadow);
  if (!staticBatches.has(key)) staticBatches.set(key, { material: o.material, cast: o.castShadow, receive: o.receiveShadow, pieces: [], originals: [] });
  const group = staticBatches.get(key);
  let geometry = o.geometry.clone();
  if (geometry.index) { const unindexed = geometry.toNonIndexed(); geometry.dispose(); geometry = unindexed; }
  geometry.applyMatrix4(o.matrixWorld);
  if (!geometry.getAttribute('uv')) geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geometry.getAttribute('position').count * 2), 2));
  group.pieces.push(geometry); group.originals.push(o);
});
for (const batch of staticBatches.values()) {
  const geometry = mergeGeometries(batch.pieces);
  if (!geometry) throw new Error('Static material geometry could not be merged.');
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  const o = mesh(geometry, batch.material, [0, 0, 0], [0, 0, 0], scene, batch.cast); o.receiveShadow = batch.receive;
  o.name = 'authored-material-batch-' + objectId;
  batch.originals.forEach(original => original.removeFromParent());
  batch.pieces.forEach(piece => piece.dispose());
}

// Register the real geometry and native renderer; rendering remains harness-controlled.
scene.updateMatrixWorld(true);
const ready = (async () => {
  if (!navigator.gpu) throw new Error('Native WebGPU is required; no fallback renderer is permitted.');
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error('No native WebGPU adapter is available.');
  await renderer.init();
  if (!renderer.backend.isWebGPUBackend) throw new Error('Unexpected non-WebGPU backend; rendering is refused.');
})();
globalThis.__AGENT_BENCHMARK__ = {
  engine: 'three', canvas: renderer.domElement, ready,
  async setCamera(v) {
    camera.position.fromArray(v.position); camera.up.set(0, 1, 0); camera.lookAt(...v.target);
    camera.fov = v.fovYDegrees; camera.near = v.near; camera.far = v.far; camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
  },
  async renderFrame() {
    await ready; scene.updateMatrixWorld(true); renderer.render(scene, camera);
  },
  async inspectGeometry() {
    scene.updateMatrixWorld(true);
    const meshes = [];
    const instanceLocal = new THREE.Matrix4(), instanceWorld = new THREE.Matrix4();
    scene.traverse(o => {
      if (!o.isMesh || !o.visible) return;
      let a = o.parent; while (a) { if (!a.visible) return; a = a.parent; }
      const g = o.geometry, position = g.getAttribute('position'), normal = g.getAttribute('normal');
      if (!position) return;
      const entry = { id: o.name || o.uuid, positions: position.array, worldMatrix: new Float32Array(o.matrixWorld.elements) };
      if (g.index) entry.indices = g.index.array; if (normal) entry.normals = normal.array;
      if (o.isInstancedMesh) {
        entry.instances = [];
        for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, instanceLocal); instanceWorld.multiplyMatrices(o.matrixWorld, instanceLocal); entry.instances.push(new Float32Array(instanceWorld.elements)); }
      }
      meshes.push(entry);
    });
    return { meshes };
  },
  async dispose() {
    renderer.dispose();
    const gs = new Set(), ms = new Set();
    scene.traverse(o => { if (o.geometry) gs.add(o.geometry); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => ms.add(m)); });
    gs.forEach(g => g.dispose()); ms.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
  }
};
