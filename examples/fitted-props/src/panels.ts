import type { PolygonMeshDescriptorOptions } from "@aperture-engine/app/systems";

export type Point = readonly [number, number, number];
export type Face = PolygonMeshDescriptorOptions["faces"][number];

function normal(outline: readonly Point[]): Point {
  const result = [0, 0, 0];
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i]!,
      b = outline[(i + 1) % outline.length]!;
    result[0]! += (a[1] - b[1]) * (a[2] + b[2]);
    result[1]! += (a[2] - b[2]) * (a[0] + b[0]);
    result[2]! += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return result as unknown as Point;
}

/** Orient an authored boundary toward its intended visible side. */
export function facing(outline: readonly Point[], toward: Point): Point[] {
  const n = normal(outline);
  return n.reduce((sum, value, axis) => sum + value * toward[axis]!, 0) < 0
    ? [...outline].reverse()
    : [...outline];
}

function planar(quad: readonly Point[]): boolean {
  const n = normal(quad),
    origin = quad[0]!;
  const length = Math.hypot(...n);
  const extent = Math.max(
    ...quad.map((p) => Math.hypot(...p.map((v, i) => v - origin[i]!))),
  );
  return (
    length > 0 &&
    quad.every(
      (p) =>
        Math.abs(
          n.reduce((sum, value, i) => sum + value * (p[i]! - origin[i]!), 0),
        ) <=
        1e-7 * length * extent,
    )
  );
}

function convex(quad: readonly Point[]): boolean {
  const n = normal(quad);
  return quad.every((a, i) => {
    const b = quad[(i + 1) % quad.length]!,
      c = quad[(i + 2) % quad.length]!;
    const u = b.map((v, axis) => v - a[axis]!),
      v = c.map((value, axis) => value - b[axis]!);
    const turn = [
      u[1]! * v[2]! - u[2]! * v[1]!,
      u[2]! * v[0]! - u[0]! * v[2]!,
      u[0]! * v[1]! - u[1]! * v[0]!,
    ];
    return (
      turn.reduce((sum, value, axis) => sum + value * n[axis]!, 0) >
      1e-10 * Math.hypot(...u) * Math.hypot(...v) * Math.hypot(...n)
    );
  });
}

/**
 * Connect corresponding profile corners. An open chain makes a rim/reveal;
 * closed profiles make a shell strip. Caps are an explicit authoring choice.
 * Bent quads become two planar triangles, never a silently flattened surface.
 */
export function bridgeProfiles(
  a: readonly Point[],
  b: readonly Point[],
  closed = false,
  label = "profile bridge",
): Face[] {
  if (a.length !== b.length || a.length < (closed ? 3 : 2))
    throw new Error(
      `${label}: profiles need matching corner counts (at least two, or three when closed)`,
    );
  const faces: Face[] = [];
  for (let i = 0; i < a.length - (closed ? 0 : 1); i++) {
    const j = (i + 1) % a.length;
    const outline = [a[i]!, a[j]!, b[j]!, b[i]!];
    if (planar(outline)) faces.push({ outline });
    else
      faces.push(
        { outline: [outline[0]!, outline[1]!, outline[2]!] },
        { outline: [outline[0]!, outline[2]!, outline[3]!] },
      );
  }
  return faces;
}

/**
 * Partition a convex planar quad into painted surround and glass. UV bounds are
 * fractions of the authored quad, not independent world-space measurements.
 * The returned pane IS the hole boundary; do not offset it or add a backing box.
 */
export function windowPanel(
  outline: readonly Point[],
  bounds: readonly [u0: number, v0: number, u1: number, v1: number] = [
    0.12, 0.12, 0.88, 0.88,
  ],
  label = "window panel",
): { surround: Face; pane: Face } {
  if (outline.length !== 4 || !planar(outline) || !convex(outline))
    throw new Error(
      `${label}: a window needs a strictly convex planar quad; put a section boundary at the bend`,
    );
  const [u0, v0, u1, v1] = bounds;
  if (!(0 < u0 && u0 < u1 && u1 < 1 && 0 < v0 && v0 < v1 && v1 < 1))
    throw new Error(
      `${label}: window bounds must be ordered strictly inside the panel`,
    );
  const at = (u: number, v: number): Point =>
    [0, 1, 2].map(
      (axis) =>
        (1 - v) * ((1 - u) * outline[0]![axis]! + u * outline[1]![axis]!) +
        v * ((1 - u) * outline[3]![axis]! + u * outline[2]![axis]!),
    ) as unknown as Point;
  const opening = [at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1)];
  return {
    surround: { outline, holes: [opening] },
    pane: { outline: opening },
  };
}
