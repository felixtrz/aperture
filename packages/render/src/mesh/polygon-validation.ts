import type { PolygonMeshFace, PolygonMeshPoint } from "./polygon-types.js";
import type { ExtrudePoint } from "./extrude-types.js";
import { ExtrudeMeshError, readExtrudeRings } from "./extrude-validation.js";
import { triangulateExtrudeCaps } from "./extrude-triangulation.js";

/** Invalid polygon surface input, with an authored face/boundary field path. */
export class PolygonMeshError extends RangeError {
  constructor(
    readonly path: string,
    reason: string,
  ) {
    super(`${path} ${reason}`);
    this.name = "PolygonMeshError";
  }
}

export interface PreparedPolygonFace {
  readonly positions: readonly PolygonMeshPoint[];
  readonly projected: readonly ExtrudePoint[];
  readonly normal: PolygonMeshPoint;
  readonly indices: readonly number[];
}

/** Drop the dominant axis so every projected coordinate is an exact source value. */
export function preparePolygonFace(
  face: PolygonMeshFace,
  path: string,
): PreparedPolygonFace {
  if (face === null || typeof face !== "object" || Array.isArray(face))
    throw new PolygonMeshError(path, "must be a face object.");
  if (face.holes !== undefined && !Array.isArray(face.holes))
    throw new PolygonMeshError(`${path}.holes`, "must be an array of rings.");
  if ((face.holes?.length ?? 0) > 681)
    throw new PolygonMeshError(
      path,
      "exceeds 2048 boundary vertices per face.",
    );
  let count = 0;
  const rings = [face.outline, ...(face.holes ?? [])].map((ring, r) => {
    const field = `${path}.${r === 0 ? "outline" : `holes[${r - 1}]`}`;
    if (!Array.isArray(ring) || ring.length < 3)
      throw new PolygonMeshError(
        field,
        "must contain at least three [x, y, z] corners.",
      );
    count += ring.length;
    if (count > 2048)
      throw new PolygonMeshError(
        field,
        "exceeds 2048 boundary vertices per face.",
      );
    return Array.from(ring, (p: unknown, i): PolygonMeshPoint => {
      if (
        !Array.isArray(p) ||
        p.length !== 3 ||
        p.some((v) => typeof v !== "number" || !Number.isFinite(Math.fround(v)))
      )
        throw new PolygonMeshError(
          `${field}[${i}]`,
          "must be three finite float32 coordinates.",
        );
      return [Math.fround(p[0]), Math.fround(p[1]), Math.fround(p[2])];
    });
  });
  const outline = rings[0]!;
  const origin = outline[0]!;
  const area = [0, 0, 0];
  // Relative coordinates avoid cancellation from large translations.
  for (let i = 1; i < outline.length - 1; i++) {
    const a = subtract(outline[i]!, origin),
      b = subtract(outline[i + 1]!, origin);
    area[0]! += a[1] * b[2] - a[2] * b[1];
    area[1]! += a[2] * b[0] - a[0] * b[2];
    area[2]! += a[0] * b[1] - a[1] * b[0];
  }
  const length = Math.hypot(...area);
  if (length === 0 || !Number.isFinite(length))
    throw new PolygonMeshError(
      `${path}.outline`,
      "must enclose a nonzero finite planar area.",
    );
  const normal: PolygonMeshPoint = [
    area[0]! / length,
    area[1]! / length,
    area[2]! / length,
  ];
  const points = rings.flat();
  const extent = Math.max(
    ...points.map((p) => Math.hypot(...subtract(p, origin))),
  );
  for (let r = 0; r < rings.length; r++)
    for (let i = 0; i < rings[r]!.length; i++) {
      const p = subtract(rings[r]![i]!, origin);
      if (
        Math.abs(p[0] * normal[0] + p[1] * normal[1] + p[2] * normal[2]) >
        extent * 1e-5
      )
        throw new PolygonMeshError(
          `${path}.${r === 0 ? "outline" : `holes[${r - 1}]`}[${i}]`,
          "is not coplanar with this face; split a bent surface into planar faces.",
        );
    }
  let axis = 0;
  for (let i = 1; i < 3; i++)
    if (Math.abs(normal[i]!) > Math.abs(normal[axis]!)) axis = i;
  const u = (axis + 1) % 3,
    v = (axis + 2) % 3;
  const project = (p: PolygonMeshPoint): ExtrudePoint => [p[u]!, p[v]!];
  const byProjection = new Map(points.map((p) => [key(project(p)), p]));
  try {
    // Reuse the bounded simple-ring/hole validation and complete triangulation
    // used by extrusion. No extrusion geometry is created here.
    const planar = readExtrudeRings({
      outline: outline.map(project),
      holes: rings.slice(1).map((r) => r.map(project)),
      depth: 1,
    });
    const projected = planar.rings.flat();
    const indices = triangulateExtrudeCaps(planar.rings);
    if (normal[axis]! < 0)
      for (let i = 0; i < indices.length; i += 3)
        [indices[i + 1], indices[i + 2]] = [indices[i + 2]!, indices[i + 1]!];
    return {
      positions: projected.map((p) => byProjection.get(key(p))!),
      projected,
      normal,
      indices,
    };
  } catch (error) {
    if (!(error instanceof ExtrudeMeshError)) throw error;
    throw new PolygonMeshError(
      `${path}.${error.path}`,
      error.message.slice(error.path.length + 1),
    );
  }
}

function subtract(a: PolygonMeshPoint, b: PolygonMeshPoint): PolygonMeshPoint {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function key(p: ExtrudePoint): string {
  return `${p[0]}:${p[1]}`;
}
