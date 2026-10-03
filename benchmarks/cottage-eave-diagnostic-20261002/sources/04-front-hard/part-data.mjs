/** Hand-authored, deterministic cottage parts. World convention: Y up, front +Z. */
export const SOURCE_REVISION = '2c89bd7b1ea6583b990a9745ba9fa4cbf7f28c33';
export const PALETTE = Object.freeze({
  ground: [0.16, 0.20, 0.10, 1],
  backdrop: [0.35, 0.345, 0.33, 1],
  cream: [0.98, 0.90, 0.74, 1],
  roof: [0.43, 0.105, 0.060, 1],
  stone: [0.88, 0.81, 0.66, 1],
  pine: [0.050, 0.105, 0.035, 1],
  trunk: [0.115, 0.068, 0.033, 1],
  bench: [0.15, 0.086, 0.049, 1],
  interior: [0.055, 0.038, 0.023, 1],
  glass: [0.20, 0.39, 0.46, 1],
});
export const VIEWS = Object.freeze({
  front: { position: [7, 11.9, 14], target: [0, 0.30, 0], height: 11.5 },
  rear: { position: [-7, 11.9, -14], target: [0, 0.30, 0], height: 11.5 },
  side: { position: [15, 9.5, 0], target: [0, 0.30, 0], height: 11.5 },
});
export function normalizeOptions(options = {}) {
  const view = options.view ?? 'front';
  const edit = options.edit ?? 'base';
  if (!Object.hasOwn(VIEWS, view)) throw new Error(`Unknown view: ${view}`);
  if (!['base', 'roof', 'bench', 'trees'].includes(edit)) throw new Error(`Unknown edit: ${edit}`);
  return { view, edit };
}
function boundsOf(points) {
  return { min: [0, 1, 2].map(a => Math.min(...points.map(p => p[a]))),
    max: [0, 1, 2].map(a => Math.max(...points.map(p => p[a]))) };
}
function unionBounds(items) {
  return { min: [0, 1, 2].map(a => Math.min(...items.map(p => p.bounds.min[a]))),
    max: [0, 1, 2].map(a => Math.max(...items.map(p => p.bounds.max[a]))) };
}
/** Extrude a CCW XY outline into a closed, outward-wound flat-shaded solid. */
function extruded(outline, z0, z1) {
  const p = [];
  const v = (i, z) => [outline[i][0], outline[i][1], z];
  for (let i = 1; i < outline.length - 1; i++) {
    p.push(v(0, z1), v(i, z1), v(i + 1, z1));
    p.push(v(0, z0), v(i + 1, z0), v(i, z0));
  }
  for (let i = 0; i < outline.length; i++) {
    const j = (i + 1) % outline.length;
    p.push(v(i, z0), v(j, z0), v(j, z1), v(i, z0), v(j, z1), v(i, z1));
  }
  return p;
}
/** Closed faceted frustum. No smoothing normals; each face remains planar. */
function frustum(radius, topRadius, height, segments = 7) {
  const p = [];
  const phase = Math.PI / 14;
  const ring = (i, r, y) => [r * Math.cos(phase + i * Math.PI * 2 / segments), y,
    r * Math.sin(phase + i * Math.PI * 2 / segments)];
  for (let i = 0; i < segments; i++) {
    const b0 = ring(i, radius, -height / 2), b1 = ring(i + 1, radius, -height / 2);
    const t0 = ring(i, topRadius, height / 2), t1 = ring(i + 1, topRadius, height / 2);
    p.push(b0, t0, b1);
    if (topRadius > 0) p.push(b1, t0, t1);
    p.push([0, -height / 2, 0], b0, b1);
    if (topRadius > 0) p.push([0, height / 2, 0], t1, t0);
  }
  return p;
}
export function buildCottage(options = {}) {
  const { view, edit } = normalizeOptions(options);
  const p = {
    base: { size: [8, 1.05, 8], topY: 0 },
    house: { halfWidth: 1.45, frontZ: 0.70, rearZ: -2.10, wallHeight: 2.23, wallThickness: 0.16 },
    roof: { halfWidth: 1.64, eaveY: 2.20, baseRidgeY: 3.55, thickness: 0.12,
      frontZ: 0.90, rearZ: -2.30, riseMultiplier: edit === 'roof' ? 1.30 : 1 },
    bench: { center: [2.75, 0, 2.13], baseWidth: 2.20, widthMultiplier: edit === 'bench' ? 1.25 : 1,
      seatTopY: 0.63, seatDepth: 0.70, legInset: 0.12 },
    trees: { outwardOffset: edit === 'trees' ? 0.60 : 0,
      left: { center: [-3.18, 0, -1.22], height: 4.30 },
      right: { center: [3.13, 0, -1.15], height: 4.30 } },
    door: { min: [-0.93, 0.02, 0.54], max: [-0.19, 1.45, 0.70] },
    window: { min: [0.37, 0.87, 0.54], max: [1.08, 1.55, 0.70], paneZ: 0.535 },
    path: { centersZ: [0.97, 1.67, 2.37, 3.07], centerX: -0.56, width: 0.88, depth: 0.50 },
  };
  p.roof.ridgeY = p.roof.eaveY + (p.roof.baseRidgeY - p.roof.eaveY) * p.roof.riseMultiplier;
  p.bench.width = p.bench.baseWidth * p.bench.widthMultiplier;
  p.house.wallHeight = p.roof.ridgeY - p.roof.thickness - (p.roof.ridgeY - p.roof.eaveY) * p.house.halfWidth / p.roof.halfWidth;
  const parts = [];
  function box(name, group, size, center, color, extra = {}) {
    const bounds = { min: center.map((x, a) => x - size[a] / 2), max: center.map((x, a) => x + size[a] / 2) };
    parts.push({ name, group, geometry: { kind: 'box', size }, center, color, bounds, ...extra });
  }
  function tris(name, group, positions, center, color, extra = {}) {
    const bounds = boundsOf(positions.map(v => v.map((x, a) => x + center[a])));
    parts.push({ name, group, geometry: { kind: 'triangles', positions }, center, color, bounds, ...extra });
  }
  function profile(name, group, outline, holes, depth, center, color) {
    const positions = outline.flatMap(([x, y]) => [[x, y, 0], [x, y, depth]]);
    const bounds = boundsOf(positions.map(v => v.map((x, a) => x + center[a])));
    parts.push({ name, group, geometry: { kind: 'extrude', outline, holes, depth }, center, color, bounds });
  }
  // The photographic-style neutral backdrop is a real matte shadow receiver.
  box('backdrop.floor', 'backdrop', [100, 0.04, 100], [0, -1.09, 0], 'backdrop', { castShadow: false });
  box('base.square', 'base', p.base.size, [0, -0.525, 0], 'ground');
  // Four independent walls, a floor and a true doorway; no facade image or pasted opening.
  const h = p.house;
  // Side walls stop at the facade's inner surface, avoiding coplanar overlaps.
  box('house.wall.left', 'house', [0.16, h.wallHeight, 2.48], [-1.37, h.wallHeight / 2, -0.70], 'cream');
  box('house.wall.right', 'house', [0.16, h.wallHeight, 2.48], [1.37, h.wallHeight / 2, -0.70], 'cream');
  box('house.interior.floor', 'house', [2.56, 0.035, 2.47], [0, 0.0175, -0.70], 'interior');
  box('house.interior.rear-lining', 'house', [2.56, 2.14, 0.035], [0, 1.08, -1.924], 'interior');
  box('window.inset-pane', 'window', [0.71, 0.68, 0.035], [0.725, 1.21, p.window.paneZ], 'glass', { roughness: 0.48 });
  box('window.sill', 'window', [0.74, 0.035, 0.19], [0.725, 0.87, 0.625], 'stone');
  const r = p.roof;
  const gableEdgeY = r.ridgeY - r.thickness - (r.ridgeY - r.eaveY) * h.halfWidth / r.halfWidth;
  // One continuous native extrusion includes the gable, doorway notch and window hole.
  const frontOutline = [[-1.45, 0], [-0.93, 0], [-0.93, 1.45], [-0.19, 1.45], [-0.19, 0],
    [1.45, 0], [1.45, gableEdgeY], [0, r.ridgeY - r.thickness], [-1.45, gableEdgeY]];
  const windowHole = [[0.37, 0.87], [0.37, 1.55], [1.08, 1.55], [1.08, 0.87]];
  profile('house.facade.front', 'house', frontOutline, [windowHole], 0.16, [0, 0, 0.54], 'cream');
  profile('house.facade.rear', 'house', [[-1.45, 0], [1.45, 0], [1.45, gableEdgeY],
    [0, r.ridgeY - r.thickness], [-1.45, gableEdgeY]], [], 0.16, [0, 0, -2.10], 'cream');
  tris('roof.left-slope', 'roof', extruded([[-r.halfWidth, r.eaveY - r.thickness], [0, r.ridgeY - r.thickness],
    [0, r.ridgeY], [-r.halfWidth, r.eaveY]], r.rearZ, r.frontZ), [0, 0, 0], 'roof');
  tris('roof.right-slope', 'roof', extruded([[0, r.ridgeY - r.thickness], [r.halfWidth, r.eaveY - r.thickness],
    [r.halfWidth, r.eaveY], [0, r.ridgeY]], r.rearZ, r.frontZ), [0, 0, 0], 'roof');
  p.path.centersZ.forEach((z, i) => box(`path.slab.${i + 1}`, 'path', [0.88, i === 0 ? 0.12 : 0.085, 0.50],
    [-0.56, i === 0 ? 0.06 : 0.0425, z], 'stone'));
  for (const [side, x, z, factor] of [
    ['left', p.trees.left.center[0] - p.trees.outwardOffset, p.trees.left.center[2], 1],
    ['right', p.trees.right.center[0] + p.trees.outwardOffset, p.trees.right.center[2], 1],
  ]) {
    tris(`tree.${side}.trunk`, `tree.${side}`, frustum(0.23, 0.23, 0.98 * factor), [x, 0.49 * factor, z], 'trunk');
    tris(`tree.${side}.lower-crown`, `tree.${side}`, frustum(0.99 * factor, 0, 2.13 * factor),
      [x, (0.76 + 2.13 / 2) * factor, z], 'pine');
    tris(`tree.${side}.upper-crown`, `tree.${side}`, frustum(0.79 * factor, 0, 2.03 * factor),
      [x, (2.27 + 2.03 / 2) * factor, z], 'pine');
  }
  const b = p.bench, bx = b.center[0], bz = b.center[2], legX = b.width / 2 - b.legInset;
  // Separate seat slats, back slats, under-seat rails, four legs and back uprights.
  for (let i = 0; i < 3; i++) box(`bench.seat-slat.${i + 1}`, 'bench', [b.width, 0.14, 0.22],
    [bx, 0.56, bz - 0.24 + i * 0.24], 'bench');
  for (const [label, sign] of [['left', -1], ['right', 1]]) {
    const x = bx + sign * legX;
    box(`bench.leg.${label}.front`, 'bench', [0.15, 0.51, 0.15], [x, 0.255, bz + 0.24], 'bench');
    box(`bench.leg.${label}.rear`, 'bench', [0.15, 0.51, 0.15], [x, 0.255, bz - 0.24], 'bench');
    box(`bench.rail.${label}`, 'bench', [0.13, 0.12, 0.67], [x, 0.44, bz], 'bench');
    box(`bench.back-post.${label}`, 'bench', [0.13, 0.78, 0.13], [x, 0.84, bz - 0.26], 'bench');
  }
  for (let i = 0; i < 2; i++) box(`bench.back-slat.${i + 1}`, 'bench', [b.width + 0.04 * b.widthMultiplier, 0.205, 0.14],
    [bx, 0.915 + i * 0.23, bz - 0.25], 'bench');
  const assemblyOffset = [-0.38, 0, -0.95];
  for (const part of parts) {
    if (!['house', 'roof', 'window', 'path'].includes(part.group)) continue;
    part.center = part.center.map((x, a) => x + assemblyOffset[a]);
    part.bounds.min = part.bounds.min.map((x, a) => x + assemblyOffset[a]);
    part.bounds.max = part.bounds.max.map((x, a) => x + assemblyOffset[a]);
  }
  // Public dimensions/openings below are world-space, matching the final part bounds.
  p.house.centerX = assemblyOffset[0];
  p.house.frontZ += assemblyOffset[2];
  p.house.rearZ += assemblyOffset[2];
  p.roof.centerX = assemblyOffset[0];
  p.roof.frontZ += assemblyOffset[2];
  p.roof.rearZ += assemblyOffset[2];
  p.path.centerX += assemblyOffset[0];
  p.path.centersZ = p.path.centersZ.map(z => z + assemblyOffset[2]);
  for (const opening of [p.door, p.window]) {
    opening.min = opening.min.map((x, a) => x + assemblyOffset[a]);
    opening.max = opening.max.map((x, a) => x + assemblyOffset[a]);
  }
  p.window.paneZ += assemblyOffset[2];
  const groups = {};
  for (const group of [...new Set(parts.map(part => part.group))]) {
    const selected = parts.filter(part => part.group === group);
    groups[group] = { bounds: unionBounds(selected), parts: selected.map(part => part.name) };
  }
  const report = {
    schema: 'aperture-cottage-parts-v1', sourceSubmission: 'v2', engine: 'Aperture app/ECS facade', sourceRevision: SOURCE_REVISION,
    view, edit, worldConvention: 'Y up; front +Z', camera: VIEWS[view], parameters: p,
    groups, partCount: parts.length,
    parts: parts.map(({ geometry, ...part }) => ({ ...part, geometryKind: geometry.kind,
      ...(geometry.kind === 'box' ? { dimensions: geometry.size } : geometry.kind === 'triangles'
        ? { triangleCount: geometry.positions.length / 3 }
        : { outline: geometry.outline, holes: geometry.holes, depth: geometry.depth }) })),
    openings: { door: { ...p.door, type: 'physical wall opening into modeled interior' },
      window: { ...p.window, type: 'physical wall opening with recessed blue pane' } },
    assertions: { pathSlabs: 4, trees: 2, crownTiersPerTree: 2, benchLegs: 4, seatSlats: 3, backSlats: 2,
      roofRiseMultiplier: r.riseMultiplier, roofEaveY: r.eaveY,
      benchWidthMultiplier: b.widthMultiplier, benchLegCentersX: [bx - legX, bx + legX],
      treeCentersX: [p.trees.left.center[0] - p.trees.outwardOffset, p.trees.right.center[0] + p.trees.outwardOffset] },
  };
  return { parts, report };
}
export const cottageReport = options => buildCottage(options).report;
