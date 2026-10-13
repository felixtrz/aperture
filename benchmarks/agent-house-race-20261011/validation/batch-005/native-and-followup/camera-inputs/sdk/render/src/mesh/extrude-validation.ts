import type { ExtrudeMeshOptions, ExtrudePoint } from "./extrude-types.js";

/** Invalid extrusion input with a stable field or boundary path. */
export class ExtrudeMeshError extends RangeError {
  constructor(
    readonly path: string,
    reason: string,
  ) {
    super(`${path} ${reason}`);
    this.name = "ExtrudeMeshError";
  }
}

// Validation is deliberately bounded and conservative. Inputs are rounded before
// all topology tests so the uploaded float32 solid has the validated topology.
const MAX_VERTICES = 2048;
export function readExtrudeRings(options: ExtrudeMeshOptions): {
  label: string;
  rings: ExtrudePoint[][];
  depth: number;
} {
  if (options === null || typeof options !== "object" || Array.isArray(options))
    throw new ExtrudeMeshError("options", "must be an object.");
  if (options.label !== undefined && typeof options.label !== "string")
    throw new ExtrudeMeshError("label", "must be a string.");
  const depth =
    typeof options.depth === "number" ? Math.fround(options.depth) : NaN;
  if (!Number.isFinite(depth) || depth <= 0)
    throw new ExtrudeMeshError(
      "depth",
      "must remain positive and finite after float32 conversion.",
    );
  if (options.holes !== undefined && !Array.isArray(options.holes))
    throw new ExtrudeMeshError("holes", "must be an array of rings.");
  if ((options.holes?.length ?? 0) > Math.floor(MAX_VERTICES / 3) - 1)
    throw new ExtrudeMeshError(
      "holes",
      `exceeds the ${MAX_VERTICES} total boundary vertex limit.`,
    );
  const sources: unknown[] = [options.outline, ...(options.holes ?? [])];
  let count = 0;
  const rings = sources.map((source, ringIndex) => {
    const path = ringPath(ringIndex);
    if (!Array.isArray(source) || source.length < 3)
      throw new ExtrudeMeshError(
        path,
        "must contain at least three [x, y] vertices.",
      );
    count += source.length;
    if (count > MAX_VERTICES)
      throw new ExtrudeMeshError(
        path,
        `exceeds the ${MAX_VERTICES} total boundary vertex limit.`,
      );
    const ring: ExtrudePoint[] = Array.from(
      source,
      (point: unknown, i: number) => {
        if (
          !Array.isArray(point) ||
          point.length !== 2 ||
          point.some(
            (v) => typeof v !== "number" || !Number.isFinite(Math.fround(v)),
          )
        )
          throw new ExtrudeMeshError(
            `${path}[${i}]`,
            "must be two finite float32 coordinates.",
          );
        return [Math.fround(point[0]), Math.fround(point[1])];
      },
    );
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i]!;
      const b = ring[(i + 1) % ring.length]!;
      if (a[0] === b[0] && a[1] === b[1])
        throw new ExtrudeMeshError(
          `${path}[${i}]`,
          "forms a collapsed edge; omit repeated closing vertices.",
        );
      if (orientation(a, b, ring[(i + 2) % ring.length]!) === 0)
        throw new ExtrudeMeshError(
          `${path}[${(i + 1) % ring.length}]`,
          "is collinear or numerically ambiguous; remove redundant vertices or separate the corners.",
        );
      for (let j = i + 2; j < ring.length; j++) {
        if (i === 0 && j === ring.length - 1) continue;
        if (intersects(a, b, ring[j]!, ring[(j + 1) % ring.length]!))
          throw new ExtrudeMeshError(
            path,
            "must be simple: edges cannot cross or touch.",
          );
      }
    }
    const area = signedArea(ring);
    if (area === 0 || !Number.isFinite(area))
      throw new ExtrudeMeshError(path, "must enclose a nonzero finite area.");
    // Material stays to the left of every edge: CCW outline and CW holes.
    if (area > 0 !== (ringIndex === 0)) ring.reverse();
    // Canonical starting vertex makes winding reversal produce identical buffers.
    let first = 0;
    for (let i = 1; i < ring.length; i++) {
      if (
        ring[i]![0] < ring[first]![0] ||
        (ring[i]![0] === ring[first]![0] && ring[i]![1] < ring[first]![1])
      )
        first = i;
    }
    return [...ring.slice(first), ...ring.slice(0, first)];
  });
  for (let i = 1; i < rings.length; i++) {
    const ring = rings[i]!;
    for (let j = 0; j < i; j++) {
      const other = rings[j]!;
      for (let a = 0; a < ring.length; a++) {
        for (let b = 0; b < other.length; b++) {
          if (
            intersects(
              ring[a]!,
              ring[(a + 1) % ring.length]!,
              other[b]!,
              other[(b + 1) % other.length]!,
            )
          )
            throw new ExtrudeMeshError(
              ringPath(i),
              "must not intersect or touch another boundary.",
            );
        }
      }
      if (
        j === 0
          ? !inside(ring[0]!, other)
          : inside(ring[0]!, other) || inside(other[0]!, ring)
      )
        throw new ExtrudeMeshError(
          ringPath(i),
          "must lie strictly inside outline, outside every other hole; nested holes are unsupported.",
        );
    }
  }
  return { label: options.label ?? "Extrude", rings, depth };
}
function ringPath(index: number): string {
  return index === 0 ? "outline" : `holes[${index - 1}]`;
}
export function signedArea(ring: readonly ExtrudePoint[]): number {
  const origin = ring[0]!;
  let area = 0;
  for (let i = 1; i < ring.length - 1; i++) {
    const a = ring[i]!;
    const b = ring[i + 1]!;
    area +=
      (a[0] - origin[0]) * (b[1] - origin[1]) -
      (a[1] - origin[1]) * (b[0] - origin[0]);
  }
  return area / 2;
}
function orientation(
  a: ExtrudePoint,
  b: ExtrudePoint,
  c: ExtrudePoint,
): number {
  const left = (b[0] - a[0]) * (c[1] - a[1]);
  const right = (b[1] - a[1]) * (c[0] - a[0]);
  const difference = left - right;
  return Math.abs(difference) <=
    (Math.abs(left) + Math.abs(right)) * Number.EPSILON * 16
    ? 0
    : Math.sign(difference);
}
function onSegment(a: ExtrudePoint, b: ExtrudePoint, p: ExtrudePoint): boolean {
  return (
    p[0] >= Math.min(a[0], b[0]) &&
    p[0] <= Math.max(a[0], b[0]) &&
    p[1] >= Math.min(a[1], b[1]) &&
    p[1] <= Math.max(a[1], b[1])
  );
}
function intersects(
  a: ExtrudePoint,
  b: ExtrudePoint,
  c: ExtrudePoint,
  d: ExtrudePoint,
): boolean {
  const ac = orientation(a, b, c),
    ad = orientation(a, b, d);
  const ca = orientation(c, d, a),
    cb = orientation(c, d, b);
  return (
    (ac * ad < 0 && ca * cb < 0) ||
    (ac === 0 && onSegment(a, b, c)) ||
    (ad === 0 && onSegment(a, b, d)) ||
    (ca === 0 && onSegment(c, d, a)) ||
    (cb === 0 && onSegment(c, d, b))
  );
}
function inside(p: ExtrudePoint, ring: readonly ExtrudePoint[]): boolean {
  let result = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!,
      b = ring[j]!;
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      result = !result;
  }
  return result;
}
