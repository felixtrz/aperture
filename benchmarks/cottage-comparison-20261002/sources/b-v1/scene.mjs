/**
 * Hand-authored editable geometry. No image assets, imported meshes, randomness,
 * animation, billboard scenery, postprocessed screenshots, or WebGL renderer.
 * Serve the exact unchanged vendor directory at /engine/shadow-lab/src/compare/.
 */
import * as THREE from '/engine/shadow-lab/src/compare/three.webgpu.js';

export const AUTHOR = Object.freeze({
  engine: 'three.js',
  actualRevision: '185dev',
  identity: '/root/author_three_cottage',
  correlation: '7a40a32fff00c08cc1f31560b4b338c16febd016a1ee39b841c16a80597baf54',
  sourceSubmission: 1,
});

export function parametersFor(edit = 'base') {
  if (!['base', 'roof', 'bench', 'trees'].includes(edit)) throw new Error(`Unknown edit: ${edit}`);
  const ridgeY = 3.55 * (edit === 'roof' ? 1.3 : 1);
  const eaveY = 1.94;
  const roofThickness = 0.12;
  const wallHalfWidth = 1.5;
  const roofHalfWidth = 1.68;
  const wallTopY = eaveY + (ridgeY - eaveY) * (1 - wallHalfWidth / roofHalfWidth) - roofThickness;
  return {
    edit,
    base: { width: 8, depth: 8, topY: 0, thickness: 0.80 },
    house: { centerX: -0.10, width: 3, depth: 2.45, frontZ: -0.25, backZ: -2.70, wallThickness: 0.18, wallTopY },
    roof: { halfWidth: roofHalfWidth, eaveY, ridgeY, thickness: roofThickness, frontZ: -0.06, backZ: -2.89, baselineRidgeY: 3.55, ridgeMultiplier: edit === 'roof' ? 1.3 : 1 },
    door: { leftX: -1.00, rightX: -0.23, bottomY: 0, topY: 1.31 },
    window: { leftX: 0.34, rightX: 1.08, bottomY: 0.78, topY: 1.44, inset: 0.125 },
    path: { centerX: -0.615, width: 0.88, depth: 0.53, thickness: 0.10, centerZ: [0.04, 0.82, 1.60, 2.38] },
    bench: { centerX: 2.30, centerZ: 2.10, width: 1.93 * (edit === 'bench' ? 1.25 : 1), baselineWidth: 1.93, depth: 0.69, seatY: 0.59, seatThickness: 0.15, legThickness: 0.15, legEndInset: 0.13, backTopY: 1.21 },
    trees: [
      { key: 'tree.left', x: -2.90 - (edit === 'trees' ? 0.6 : 0), z: -1.18, trunkRadius: 0.23, trunkHeight: 0.99, lowerBottom: 0.69, lowerHeight: 2.04, lowerRadius: 1.00, upperBottom: 2.14, upperHeight: 2.15, upperRadius: 0.80 },
      { key: 'tree.right', x: 2.90 + (edit === 'trees' ? 0.6 : 0), z: -0.83, trunkRadius: 0.23, trunkHeight: 0.87, lowerBottom: 0.61, lowerHeight: 1.78, lowerRadius: 0.96, upperBottom: 1.91, upperHeight: 1.80, upperRadius: 0.73 },
    ],
  };
}

export const CAMERA_PARAMETERS = Object.freeze({
  orthographicSpan: 11.50,
  target: [0, 0.60, 0.15],
  front: [10, 16.28, 20.15],
  rear: [-10, 16.28, -19.85],
  side: [22.36, 16.28, 0.15],
  near: 0.1,
  far: 100,
  viewport: [800, 800],
  pixelRatio: 1,
});

const PALETTE = Object.freeze({
  ground: '#aba79f', grass: '#82915f', plaster: '#eadfc3',
  roof: '#b8573a', wood: '#725036', trunk: '#654a31',
  foliage: '#405f35', foliageUpper: '#49683b',
  stone: '#e6dcc2', interior: '#483927', window: '#497d8c', windowReveal: '#64706a',
});

function material(color) {
  return new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0, flatShading: true });
}

/** Closed, explicitly surfaced convex polyhedron, with outward triangle winding. */
function polyhedron(vertices, faces) {
  const center = vertices.reduce((a, v) => a.map((n, i) => n + v[i] / vertices.length), [0, 0, 0]);
  const values = [];
  for (const face of faces) {
    const ids = [...face];
    const a = new THREE.Vector3(...vertices[ids[0]]);
    const b = new THREE.Vector3(...vertices[ids[1]]);
    const c = new THREE.Vector3(...vertices[ids[2]]);
    const normal = b.clone().sub(a).cross(c.clone().sub(a));
    const outward = a.clone().sub(new THREE.Vector3(...center));
    if (normal.dot(outward) < 0) ids.reverse();
    for (let i = 1; i < ids.length - 1; i++) {
      for (const id of [ids[0], ids[i], ids[i + 1]]) values.push(...vertices[id]);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(values, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function trianglePrism(x0, x1, bottom, peak, front, back) {
  const xm = (x0 + x1) / 2;
  return polyhedron([
    [x0, bottom, front], [x1, bottom, front], [xm, peak, front],
    [x0, bottom, back], [x1, bottom, back], [xm, peak, back],
  ], [[0, 1, 2], [5, 4, 3], [0, 3, 4, 1], [1, 4, 5, 2], [2, 5, 3, 0]]);
}

function roofSlab(xRidge, xEave, ridgeY, eaveY, front, back, thickness) {
  const vertices = [
    [xRidge, ridgeY - thickness, front], [xEave, eaveY - thickness, front],
    [xEave, eaveY - thickness, back], [xRidge, ridgeY - thickness, back],
    [xRidge, ridgeY, front], [xEave, eaveY, front],
    [xEave, eaveY, back], [xRidge, ridgeY, back],
  ];
  return polyhedron(vertices, [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]]);
}

const rounded = (n) => Math.round(n * 1e6) / 1e6;
function objectBounds(object) {
  object.updateWorldMatrix(true, true);
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  const p = new THREE.Vector3();
  object.traverse((child) => {
    if (!child.isMesh) return;
    const attribute = child.geometry.getAttribute('position');
    for (let i = 0; i < attribute.count; i++) {
      p.fromBufferAttribute(attribute, i).applyMatrix4(child.matrixWorld);
      for (let axis = 0; axis < 3; axis++) {
        min[axis] = Math.min(min[axis], p.getComponent(axis));
        max[axis] = Math.max(max[axis], p.getComponent(axis));
      }
    }
  });
  return { min: min.map(rounded), max: max.map(rounded), size: max.map((n, i) => rounded(n - min[i])) };
}

export function createCottage(edit = 'base', view = 'front') {
  if (!['front', 'rear', 'side'].includes(view)) throw new Error(`Unknown view: ${view}`);
  const parameters = parametersFor(edit);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#c9c6bf');
  const root = new THREE.Group();
  root.name = 'cottage.editable';
  scene.add(root);
  const mats = Object.fromEntries(Object.entries(PALETTE).map(([name, color]) => [name, material(color)]));
  const parts = [];
  const groups = new Map();
  function group(name, parent = root) {
    const node = new THREE.Group(); node.name = name; parent.add(node); groups.set(name, node); return node;
  }
  function add(name, geometry, mat, position = [0, 0, 0], parent = root, authored = {}) {
    const mesh = new THREE.Mesh(geometry, mats[mat]);
    mesh.name = name; mesh.position.set(...position); mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.userData.authored = { ...authored, material: mat, color: PALETTE[mat] };
    parent.add(mesh); parts.push(mesh); return mesh;
  }
  function box(name, dimensions, position, mat, parent = root) {
    return add(name, new THREE.BoxGeometry(...dimensions), mat, position, parent, { kind: 'box', dimensions });
  }
  const base = parameters.base;
  box('base.grass', [base.width, base.thickness, base.depth], [0, -base.thickness / 2, 0], 'grass');

  const h = parameters.house;
  const house = group('house');
  house.position.x = h.centerX;
  const left = -h.width / 2, right = h.width / 2;
  const t = h.wallThickness, frontWallZ = h.frontZ - t / 2;
  const wallBox = (name, x0, x1, y0, y1) => box(name, [x1 - x0, y1 - y0, t], [(x0 + x1) / 2, (y0 + y1) / 2, frontWallZ], 'plaster', house);
  const d = parameters.door, w = parameters.window;
  // The facade is a real collection of wall piers/lintels: both openings are holes.
  wallBox('house.front.left-pier', left, d.leftX, 0, h.wallTopY);
  wallBox('house.front.door-lintel', d.leftX, d.rightX, d.topY, h.wallTopY);
  wallBox('house.front.middle-pier', d.rightX, w.leftX, 0, h.wallTopY);
  wallBox('house.front.window-sill-wall', w.leftX, w.rightX, 0, w.bottomY);
  wallBox('house.front.window-lintel', w.leftX, w.rightX, w.topY, h.wallTopY);
  wallBox('house.front.right-pier', w.rightX, right, 0, h.wallTopY);
  box('house.wall.left', [t, h.wallTopY, h.depth], [left + t / 2, h.wallTopY / 2, (h.frontZ + h.backZ) / 2], 'plaster', house);
  box('house.wall.right', [t, h.wallTopY, h.depth], [right - t / 2, h.wallTopY / 2, (h.frontZ + h.backZ) / 2], 'plaster', house);
  box('house.wall.rear', [h.width - 2 * t, h.wallTopY, t], [0, h.wallTopY / 2, h.backZ + t / 2], 'plaster', house);
  add('house.gable.front', trianglePrism(left, right, h.wallTopY, parameters.roof.ridgeY - parameters.roof.thickness, h.frontZ, h.frontZ - t), 'plaster', [0, 0, 0], house, { kind: 'triangle-prism', editableRidge: true });
  add('house.gable.rear', trianglePrism(left, right, h.wallTopY, parameters.roof.ridgeY - parameters.roof.thickness, h.backZ + t, h.backZ), 'plaster', [0, 0, 0], house, { kind: 'triangle-prism', editableRidge: true });
  // An actual room behind the open doorway, not a door-shaped decal or panel.
  box('house.interior.floor', [h.width - 2 * t, 0.06, h.depth - 2 * t], [0, 0.03, (h.frontZ + h.backZ) / 2], 'interior', house);
  box('house.interior.back-lining', [h.width - 2 * t, h.wallTopY, 0.015], [0, h.wallTopY / 2, h.backZ + t + 0.01], 'interior', house);
  box('house.interior.left-lining', [0.015, h.wallTopY, h.depth - 2 * t], [left + t + 0.01, h.wallTopY / 2, (h.frontZ + h.backZ) / 2], 'interior', house);
  box('house.interior.right-lining', [0.015, h.wallTopY, h.depth - 2 * t], [right - t - 0.01, h.wallTopY / 2, (h.frontZ + h.backZ) / 2], 'interior', house);
  const windowWidth = w.rightX - w.leftX, windowHeight = w.topY - w.bottomY;
  box('house.window.inset-pane', [windowWidth, windowHeight, 0.024], [(w.leftX + w.rightX) / 2, (w.bottomY + w.topY) / 2, h.frontZ - w.inset], 'window', house);
  box('house.window.lower-reveal', [windowWidth, 0.025, 0.13], [(w.leftX + w.rightX) / 2, w.bottomY + 0.0125, h.frontZ - 0.065], 'stone', house);
  box('house.window.left-reveal', [0.022, windowHeight, 0.13], [w.leftX + 0.011, (w.bottomY + w.topY) / 2, h.frontZ - 0.065], 'windowReveal', house);
  const roof = group('roof'); roof.position.x = h.centerX;
  const r = parameters.roof;
  for (const [name, sign] of [['left', -1], ['right', 1]]) {
    add(`roof.${name}.solid-slope`, roofSlab(0, sign * r.halfWidth, r.ridgeY, r.eaveY, r.frontZ, r.backZ, r.thickness), 'roof', [0, 0, 0], roof, { kind: 'pitched-solid', ridgeY: r.ridgeY, eaveY: r.eaveY, thickness: r.thickness });
  }

  const path = group('path');
  parameters.path.centerZ.forEach((z, i) => {
    box(`path.slab.${i + 1}`, [parameters.path.width, parameters.path.thickness, parameters.path.depth], [parameters.path.centerX + h.centerX, parameters.path.thickness / 2, z], 'stone', path);
  });

  for (const tree of parameters.trees) {
    const treeGroup = group(tree.key); treeGroup.position.set(tree.x, 0, tree.z);
    const trunk = add(`${tree.key}.trunk`, new THREE.CylinderGeometry(tree.trunkRadius, tree.trunkRadius, tree.trunkHeight, 6, 1), 'trunk', [0, tree.trunkHeight / 2, 0], treeGroup, { kind: 'cylinder', radius: tree.trunkRadius, height: tree.trunkHeight, radialSegments: 6 });
    trunk.rotation.y = Math.PI / 6;
    for (const [tier, bottom, height, radius, mat] of [
      ['lower', tree.lowerBottom, tree.lowerHeight, tree.lowerRadius, 'foliage'],
      ['upper', tree.upperBottom, tree.upperHeight, tree.upperRadius, 'foliageUpper'],
    ]) {
      const foliage = add(`${tree.key}.${tier}`, new THREE.CylinderGeometry(0, radius, height, 8, 1, false), mat, [0, bottom + height / 2, 0], treeGroup, { kind: 'cone', radius, height, bottom, radialSegments: 8 });
      foliage.rotation.y = Math.PI / 8;
    }
  }

  const b = parameters.bench, bench = group('bench'); bench.position.set(b.centerX, 0, b.centerZ);
  const legX = b.width / 2 - b.legEndInset;
  const legZ = b.depth / 2 - b.legThickness / 2;
  for (const [side, x] of [['left', -legX], ['right', legX]]) {
    box(`bench.leg.${side}.front`, [b.legThickness, b.seatY, b.legThickness], [x, b.seatY / 2, legZ], 'wood', bench);
    box(`bench.leg.${side}.rear-and-back-support`, [b.legThickness, b.backTopY, b.legThickness], [x, b.backTopY / 2, -legZ], 'wood', bench);
    box(`bench.rail.${side}`, [b.legThickness, 0.11, b.depth], [x, b.seatY - 0.055, 0], 'wood', bench);
  }
  const seatGap = 0.018, slatDepth = (b.depth - 2 * seatGap) / 3;
  for (let i = 0; i < 3; i++) {
    box(`bench.seat.slat.${i + 1}`, [b.width, b.seatThickness, slatDepth], [0, b.seatY + b.seatThickness / 2, -b.depth / 2 + slatDepth / 2 + i * (slatDepth + seatGap)], 'wood', bench);
  }
  box('bench.back.slat.lower', [b.width, 0.19, 0.12], [0, 0.905, -legZ - 0.025], 'wood', bench);
  box('bench.back.slat.upper', [b.width, 0.19, 0.12], [0, 1.105, -legZ - 0.045], 'wood', bench);
  box('bench.underseat.crossbar', [2 * legX, 0.11, 0.11], [0, 0.46, -legZ], 'wood', bench);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), mats.ground);
  ground.name = 'lighting.neutral-ground'; ground.rotation.x = -Math.PI / 2; ground.position.y = -base.thickness - 0.012; ground.receiveShadow = true; scene.add(ground);
  const hemisphere = new THREE.HemisphereLight('#e9eef0', '#857661', 1.65);
  hemisphere.name = 'lighting.daylight-fill'; scene.add(hemisphere);
  const sun = new THREE.DirectionalLight('#fff4df', 3.15);
  sun.name = 'lighting.soft-sun'; sun.position.set(-3.8, 8.2, 5.7); sun.target.position.set(0, 0.4, -0.4);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -7; sun.shadow.camera.right = 7; sun.shadow.camera.top = 7; sun.shadow.camera.bottom = -7;
  sun.shadow.camera.near = 0.5; sun.shadow.camera.far = 28; sun.shadow.normalBias = 0.018; sun.shadow.bias = -0.00025; sun.shadow.radius = 2;
  scene.add(sun, sun.target);

  const cp = CAMERA_PARAMETERS, half = cp.orthographicSpan / 2;
  const camera = new THREE.OrthographicCamera(-half, half, half, -half, cp.near, cp.far);
  camera.name = `camera.${view}`; camera.position.set(...cp[view]); camera.lookAt(...cp.target); camera.updateMatrixWorld(true);
  scene.updateMatrixWorld(true);
  const manifest = {
    schema: 'editable-cottage-parts/v1', author: AUTHOR, revision: THREE.REVISION, edit, view,
    parameters, palette: PALETTE, camera: { ...cp, eye: cp[view] },
    sceneBounds: objectBounds(root),
    groups: Object.fromEntries([...groups].map(([name, object]) => [name, { bounds: objectBounds(object), position: object.position.toArray() }])),
    parts: parts.map((mesh) => ({
      name: mesh.name, ...mesh.userData.authored, bounds: objectBounds(mesh),
      localPosition: mesh.position.toArray().map(rounded), localRotation: [mesh.rotation.x, mesh.rotation.y, mesh.rotation.z].map(rounded),
      vertexCount: mesh.geometry.getAttribute('position').count,
      triangleCount: (mesh.geometry.index?.count ?? mesh.geometry.getAttribute('position').count) / 3,
    })),
    checks: {
      pathSlabs: 4, tieredTrees: 2, roofEaveY: r.eaveY, roofRidgeY: r.ridgeY,
      benchSeatWidth: b.width, benchLegAttachmentX: [-legX, legX], benchLegEndInset: b.legEndInset,
      doorwayIsOpen: true, windowInset: w.inset,
      treeCenters: parameters.trees.map((tree) => [tree.x, 0, tree.z]),
      noAssetsLoaded: true,
    },
  };
  return { scene, camera, root, parameters, manifest };
}

export async function startCottage() {
  const query = new URLSearchParams(location.search);
  const edit = query.get('edit') ?? 'base';
  const view = query.get('view') ?? 'front';
  globalThis.__COTTAGE_READY__ = { ok: false, stage: 'initializing', edit, view };
  if (THREE.REVISION !== AUTHOR.actualRevision) throw new Error(`Unexpected three.js bytes: REVISION ${THREE.REVISION}`);
  if (!navigator.gpu) throw new Error('Native WebGPU is required; WebGL fallback is forbidden.');
  const { scene, camera, root, manifest } = createCottage(edit, view);
  const canvas = document.getElementById('cottage');
  const renderer = new THREE.WebGPURenderer({ canvas, antialias: true, samples: 4, alpha: false, forceWebGL: false });
  // This pinned vendor constructor unconditionally installs a WebGL fallback.
  // Clear its documented internal callback on this instance before init, without
  // modifying any vendor bytes or invoking a WebGL context even on failure.
  renderer._getFallback = null;
  renderer.setPixelRatio(1); renderer.setSize(800, 800, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  await renderer.init();
  if (renderer.backend.isWebGPUBackend !== true) throw new Error('Renderer selected a forbidden non-WebGPU backend.');
  await renderer.compileAsync(scene, camera);
  await renderer.renderAsync(scene, camera);
  await renderer.backend.device.queue.onSubmittedWorkDone();
  // The presentation frame is still static; no animation loop is installed.
  await new Promise((resolve) => requestAnimationFrame(resolve));
  globalThis.__COTTAGE_PARTS__ = manifest;
  globalThis.__COTTAGE_SCENE__ = { scene, root, camera, renderer, createCottage, parametersFor };
  globalThis.__COTTAGE_READY__ = {
    ok: true, engine: 'three.js', revision: THREE.REVISION, backend: 'WebGPU', fallbackDisabled: renderer._getFallback === null,
    view, edit, width: 800, height: 800, pixelRatio: 1,
    meshCount: manifest.parts.length, triangleCount: manifest.parts.reduce((sum, part) => sum + part.triangleCount, 0),
    bounds: manifest.sceneBounds, parts: manifest, renderedFrames: 1,
  };
  return globalThis.__COTTAGE_READY__;
}

if (typeof document !== 'undefined' && document.getElementById('cottage')) {
  startCottage().catch((error) => {
    globalThis.__COTTAGE_READY__ = { ok: false, stage: 'failed', error: error?.stack ?? String(error) };
    const failure = document.getElementById('failure');
    if (failure) { failure.style.display = 'block'; failure.textContent = String(error); }
    console.error(error);
  });
}
