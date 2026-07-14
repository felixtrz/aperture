import type {
  LatheMeshOptions,
  MeshAsset,
  ShapeOutlinePoint,
} from "./types.js";
import {
  boundsFromPositions,
  clampInteger,
  createPrimitiveMeshAsset,
  interleavePrimitiveVertexList,
  normalize,
  type PrimitivePosition,
  type PrimitiveVertex,
} from "./primitives-builders.js";

/**
 * Lathe (three.js `LatheGeometry`): revolve a 2D `profile` (points `[x, y]`,
 * `x` = radius from the Y axis, `y` = height) around the Y axis over `segments`
 * angular steps from `startAngle` to `endAngle`. Each profile vertex carries an
 * in-plane normal from the averaged profile tangent, rotated to every meridian;
 * `u` = angle fraction, `v` = profile index fraction.
 */
export function createLatheMeshAsset(options: LatheMeshOptions): MeshAsset {
  const profile = options.profile;

  if (profile.length < 2) {
    throw new RangeError(
      "createLatheMeshAsset requires at least two profile points.",
    );
  }

  const segments = clampInteger(options.segments ?? 12, 3, 512);
  const startAngle = Number.isFinite(options.startAngle)
    ? (options.startAngle ?? 0)
    : 0;
  const endAngle = Number.isFinite(options.endAngle)
    ? (options.endAngle ?? Math.PI * 2)
    : Math.PI * 2;
  const sweep = endAngle - startAngle;
  const meridianNormals = profileNormals(profile);
  const vertices: PrimitiveVertex[] = [];
  const positions: PrimitivePosition[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= segments; i += 1) {
    const phi = startAngle + (i / segments) * sweep;
    const sin = Math.sin(phi);
    const cos = Math.cos(phi);

    for (let j = 0; j < profile.length; j += 1) {
      const point = profile[j] as ShapeOutlinePoint;
      const meridian = meridianNormals[j] as PrimitivePosition;
      const position: PrimitivePosition = [
        point[0] * sin,
        point[1],
        point[0] * cos,
      ];

      vertices.push({
        position,
        // The meridian normal has zero Z, so rotating it around Y is a plain
        // (x*sin, y, x*cos) mapping that stays unit length.
        normal: [meridian[0] * sin, meridian[1], meridian[0] * cos],
        uv: [i / segments, j / (profile.length - 1)],
      });
      positions.push(position);
    }
  }

  const stride = profile.length;

  for (let i = 0; i < segments; i += 1) {
    for (let j = 0; j < profile.length - 1; j += 1) {
      const a = j + i * stride;
      const b = a + stride;
      const c = a + stride + 1;
      const d = a + 1;

      indices.push(a, b, d, c, d, b);
    }
  }

  const bounds = boundsFromPositions(positions);

  return createPrimitiveMeshAsset({
    label: options.label ?? "Lathe",
    vertices: interleavePrimitiveVertexList(vertices),
    vertexCount: vertices.length,
    indices: new Uint16Array(indices),
    localAabb: bounds.aabb,
    localSphere: bounds.sphere,
  });
}

// Per-profile-vertex normal in the meridian plane (X = radial, Y = height,
// Z = 0), perpendicular to the profile tangent `(dx, dy)` as `(dy, -dx)`,
// averaged (length-weighted) across the two adjacent segments at interior
// vertices — three.js LatheGeometry's initial-normal pass, always normalized.
function profileNormals(
  profile: readonly ShapeOutlinePoint[],
): PrimitivePosition[] {
  const last = profile.length - 1;
  const segments: PrimitivePosition[] = [];

  for (let j = 0; j < last; j += 1) {
    const current = profile[j] as ShapeOutlinePoint;
    const next = profile[j + 1] as ShapeOutlinePoint;

    segments.push([next[1] - current[1], current[0] - next[0], 0]);
  }

  const normals: PrimitivePosition[] = [];

  for (let j = 0; j <= last; j += 1) {
    const before = segments[j - 1];
    const after = segments[j];

    if (before === undefined) {
      normals.push(normalize(after ?? [0, 1, 0]));
    } else if (after === undefined) {
      normals.push(normalize(before));
    } else {
      normals.push(normalize([before[0] + after[0], before[1] + after[1], 0]));
    }
  }

  return normals;
}
