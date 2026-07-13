import type { Mat4, Vec3Like, Vec4Like } from "@aperture-engine/simulation";

/**
 * Immediate-mode debug-draw tessellation math (E3). Every debug primitive
 * reduces to a set of world-space line segments so the whole debug overlay
 * rides the shared E1 fat-line pipeline (no second rasterizer). These functions
 * are pure and allocation-explicit so the tessellation is unit-testable in
 * isolation (an AABB = 12 edges, a sphere = 3 great-circle rings, axes = 3
 * colored segments, a grid = N+M segments, a frustum = 12 edges of the inverse
 * view-projection cube, bones = a segment per joint link).
 */

export type DebugColor = readonly [number, number, number, number];
export type DebugPoint = readonly [number, number, number];

/** A single world-space debug line segment with an RGBA color. */
export interface DebugSegment {
  readonly from: DebugPoint;
  readonly to: DebugPoint;
  readonly color: DebugColor;
}

/** Default X/Y/Z axis colors (red / green / blue), matching three.js AxesHelper. */
export const DEBUG_AXIS_COLORS: readonly [DebugColor, DebugColor, DebugColor] =
  [
    [1, 0.25, 0.25, 1],
    [0.3, 1, 0.35, 1],
    [0.35, 0.55, 1, 1],
  ];

const DEFAULT_COLOR: DebugColor = [1, 1, 1, 1];

function point(x: number, y: number, z: number): DebugPoint {
  return [x, y, z];
}

function readVec3(value: Vec3Like): [number, number, number] {
  return [value[0] ?? 0, value[1] ?? 0, value[2] ?? 0];
}

function readColor(value: Vec4Like | undefined): DebugColor {
  if (value === undefined) {
    return DEFAULT_COLOR;
  }

  return [value[0] ?? 1, value[1] ?? 1, value[2] ?? 1, value[3] ?? 1];
}

/**
 * Tessellate an axis-aligned bounding box (min/max world corners) into its 12
 * edges — the `Box3Helper` analog. Corner order is deterministic: the four
 * bottom edges (y = min), the four top edges (y = max), then the four vertical
 * pillars connecting them.
 */
export function tessellateAabb(
  min: Vec3Like,
  max: Vec3Like,
  color?: Vec4Like,
): DebugSegment[] {
  const [minX, minY, minZ] = readVec3(min);
  const [maxX, maxY, maxZ] = readVec3(max);
  const rgba = readColor(color);
  // Eight corners: c[bit] where bit0 = x (min/max), bit1 = y, bit2 = z.
  const corners: DebugPoint[] = [
    point(minX, minY, minZ), // 0
    point(maxX, minY, minZ), // 1
    point(minX, maxY, minZ), // 2
    point(maxX, maxY, minZ), // 3
    point(minX, minY, maxZ), // 4
    point(maxX, minY, maxZ), // 5
    point(minX, maxY, maxZ), // 6
    point(maxX, maxY, maxZ), // 7
  ];
  const edges: readonly [number, number][] = [
    // bottom face (y = min)
    [0, 1],
    [1, 5],
    [5, 4],
    [4, 0],
    // top face (y = max)
    [2, 3],
    [3, 7],
    [7, 6],
    [6, 2],
    // vertical pillars
    [0, 2],
    [1, 3],
    [5, 7],
    [4, 6],
  ];

  return edges.map(([a, b]) => ({
    from: corners[a] as DebugPoint,
    to: corners[b] as DebugPoint,
    color: rgba,
  }));
}

/**
 * Tessellate a center + half-extents box into its 12 edges (a `Box3Helper`
 * built from a center and size instead of min/max corners).
 */
export function tessellateBox(
  center: Vec3Like,
  halfExtents: Vec3Like,
  color?: Vec4Like,
): DebugSegment[] {
  const [cx, cy, cz] = readVec3(center);
  const [hx, hy, hz] = readVec3(halfExtents);

  return tessellateAabb(
    [cx - hx, cy - hy, cz - hz],
    [cx + hx, cy + hy, cz + hz],
    color,
  );
}

/**
 * Tessellate a sphere (the `SphereHelper` analog) as three great-circle rings —
 * one in each of the XY, XZ, and YZ planes. Each ring is a closed loop of
 * `segments` line segments, so the total is `3 * segments`.
 */
export function tessellateSphere(
  center: Vec3Like,
  radius: number,
  color?: Vec4Like,
  segments = 24,
): DebugSegment[] {
  const [cx, cy, cz] = readVec3(center);
  const rgba = readColor(color);
  const count = Math.max(3, Math.floor(segments));
  const out: DebugSegment[] = [];
  // planeAxes[i] = (a, b) index pair the ring sweeps; the third axis is fixed.
  const rings: readonly [number, number][] = [
    [0, 1], // XY plane
    [0, 2], // XZ plane
    [1, 2], // YZ plane
  ];
  const centerArr: readonly [number, number, number] = [cx, cy, cz];

  for (const [axisA, axisB] of rings) {
    let previous: DebugPoint | null = null;
    let first: DebugPoint | null = null;

    for (let index = 0; index <= count; index += 1) {
      const theta = (index / count) * Math.PI * 2;
      const coords: [number, number, number] = [cx, cy, cz];
      coords[axisA] = (centerArr[axisA] ?? 0) + radius * Math.cos(theta);
      coords[axisB] = (centerArr[axisB] ?? 0) + radius * Math.sin(theta);
      const current = point(coords[0], coords[1], coords[2]);

      if (previous !== null) {
        out.push({ from: previous, to: current, color: rgba });
      } else {
        first = current;
      }

      previous = current;
    }

    // Close the loop exactly (guards float drift on the wrap segment).
    if (first !== null && previous !== null) {
      // The `<= count` loop already emitted the closing segment; nothing to do.
    }
  }

  return out;
}

/**
 * Tessellate a coordinate frame (the `AxesHelper` analog): three colored
 * segments from `origin` along the world +X (red), +Y (green), and +Z (blue)
 * axes, each `size` long.
 */
export function tessellateAxes(
  origin: Vec3Like,
  size = 1,
  colors: readonly [DebugColor, DebugColor, DebugColor] = DEBUG_AXIS_COLORS,
): DebugSegment[] {
  const [ox, oy, oz] = readVec3(origin);
  const from = point(ox, oy, oz);

  return [
    { from, to: point(ox + size, oy, oz), color: colors[0] },
    { from, to: point(ox, oy + size, oz), color: colors[1] },
    { from, to: point(ox, oy, oz + size), color: colors[2] },
  ];
}

export interface DebugGridOptions {
  readonly center?: Vec3Like;
  /** Full grid extent (edge-to-edge) on both axes. */
  readonly size?: number;
  /** Number of cells per side; grid lines per direction = divisions + 1. */
  readonly divisions?: number;
  readonly color?: Vec4Like;
}

/**
 * Tessellate a `GridHelper`-style grid on the XZ plane. A grid with `divisions`
 * cells emits `divisions + 1` lines parallel to X and `divisions + 1` lines
 * parallel to Z — `2 * (divisions + 1)` segments total.
 */
export function tessellateGrid(options: DebugGridOptions = {}): DebugSegment[] {
  const [cx, cy, cz] = readVec3(options.center ?? [0, 0, 0]);
  const size = Math.max(0, options.size ?? 10);
  const divisions = Math.max(1, Math.floor(options.divisions ?? 10));
  const rgba = readColor(options.color);
  const half = size / 2;
  const step = size / divisions;
  const out: DebugSegment[] = [];

  for (let index = 0; index <= divisions; index += 1) {
    const offset = -half + index * step;
    // Line parallel to Z (constant X).
    out.push({
      from: point(cx + offset, cy, cz - half),
      to: point(cx + offset, cy, cz + half),
      color: rgba,
    });
    // Line parallel to X (constant Z).
    out.push({
      from: point(cx - half, cy, cz + offset),
      to: point(cx + half, cy, cz + offset),
      color: rgba,
    });
  }

  return out;
}

/**
 * Tessellate a camera frustum (the `CameraHelper` analog) into its 12 edges.
 * The eight NDC-cube corners (x,y ∈ {-1,1}, z ∈ {0,1} — WebGPU clip space) are
 * transformed by the supplied inverse view-projection matrix and perspective
 * divided back into world space. Edge order: the near-plane loop (z=0), the
 * far-plane loop (z=1), then the four connecting edges.
 */
export function tessellateFrustum(
  inverseViewProjection: Mat4,
  color?: Vec4Like,
): DebugSegment[] {
  const rgba = readColor(color);
  // Near face (z=0): bl, br, tr, tl. Far face (z=1): bl, br, tr, tl.
  const ndc: readonly [number, number, number][] = [
    [-1, -1, 0],
    [1, -1, 0],
    [1, 1, 0],
    [-1, 1, 0],
    [-1, -1, 1],
    [1, -1, 1],
    [1, 1, 1],
    [-1, 1, 1],
  ];
  const corners = ndc.map(([x, y, z]) =>
    unprojectNdc(inverseViewProjection, x, y, z),
  );
  const edges: readonly [number, number][] = [
    // near loop
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
    // far loop
    [4, 5],
    [5, 6],
    [6, 7],
    [7, 4],
    // connectors
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7],
  ];

  return edges.map(([a, b]) => ({
    from: corners[a] as DebugPoint,
    to: corners[b] as DebugPoint,
    color: rgba,
  }));
}

export interface DebugBoneLink {
  readonly from: Vec3Like;
  readonly to: Vec3Like;
}

/**
 * Tessellate a set of skeleton bone links (the `SkeletonHelper` analog): one
 * segment per parent→child joint pair in world space.
 */
export function tessellateBones(
  links: readonly DebugBoneLink[],
  color?: Vec4Like,
): DebugSegment[] {
  const rgba = readColor(color);

  return links.map((link) => {
    const [fx, fy, fz] = readVec3(link.from);
    const [tx, ty, tz] = readVec3(link.to);

    return { from: point(fx, fy, fz), to: point(tx, ty, tz), color: rgba };
  });
}

export interface DebugLightGizmoOptions {
  readonly position: Vec3Like;
  /** For directional/spot lights, a world-space aim direction. */
  readonly direction?: Vec3Like;
  readonly size?: number;
  readonly color?: Vec4Like;
}

/**
 * Tessellate a light gizmo (a lightweight `DirectionalLightHelper`/
 * `PointLightHelper` analog): a coordinate frame at the light position, plus a
 * ray along the aim direction when one is supplied.
 */
export function tessellateLightGizmo(
  options: DebugLightGizmoOptions,
): DebugSegment[] {
  const size = options.size ?? 0.5;
  const [px, py, pz] = readVec3(options.position);
  const out: DebugSegment[] = tessellateAxes([px, py, pz], size);

  if (options.direction !== undefined) {
    const [dx, dy, dz] = readVec3(options.direction);
    const length = Math.hypot(dx, dy, dz);

    if (length > 1e-6) {
      const rayLength = size * 2;
      out.push({
        from: point(px, py, pz),
        to: point(
          px + (dx / length) * rayLength,
          py + (dy / length) * rayLength,
          pz + (dz / length) * rayLength,
        ),
        color: readColor(options.color),
      });
    }
  }

  return out;
}

function unprojectNdc(
  matrix: Mat4,
  x: number,
  y: number,
  z: number,
): DebugPoint {
  const m = matrix as ArrayLike<number>;
  const cx = (m[0] ?? 0) * x + (m[4] ?? 0) * y + (m[8] ?? 0) * z + (m[12] ?? 0);
  const cy = (m[1] ?? 0) * x + (m[5] ?? 0) * y + (m[9] ?? 0) * z + (m[13] ?? 0);
  const cz =
    (m[2] ?? 0) * x + (m[6] ?? 0) * y + (m[10] ?? 0) * z + (m[14] ?? 0);
  const cw =
    (m[3] ?? 0) * x + (m[7] ?? 0) * y + (m[11] ?? 0) * z + (m[15] ?? 0);
  const inv = Math.abs(cw) < 1e-9 ? 1 : 1 / cw;

  return point(cx * inv, cy * inv, cz * inv);
}
