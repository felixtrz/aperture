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

/**
 * Recess one opening into a planar surface. The outer outline's winding defines
 * outward; depth moves the inset inward along its normal. Use the returned
 * surround, reveals and inset together, without a backing face at the mouth.
 *
 * This also makes a flat ground surface, shoreline and lower water surface.
 * Polygon validation checks simple, coplanar, strictly contained boundaries at
 * extraction. It must see the surround as ONE face with a hole: joining two
 * unrelated loops by index can fold even when their corner counts match.
 */
export function insetSurface(
  outline: readonly Point[],
  opening: readonly Point[],
  depth: number,
  label = "inset surface",
): { surround: Face; reveals: Face[]; inset: Face } {
  if (!Number.isFinite(depth) || depth <= 0)
    throw new RangeError(`${label}: depth must be finite and positive`);
  for (const [name, points] of [
    ["outline", outline],
    ["opening", opening],
  ] as const)
    if (points.length < 3 || points.some((point) => !finitePoint(point)))
      throw new RangeError(
        `${label}: ${name} needs at least three finite float32 points`,
      );
  if (!planar(outline))
    throw new RangeError(`${label}: outline must be planar with nonzero area`);
  const n = normal(outline);
  const length = Math.hypot(...n);
  const unit = n.map((v) => v / length) as unknown as Point;
  const origin = outline[0]!;
  const extent = Math.max(
    ...outline.map((p) => Math.hypot(...p.map((v, i) => v - origin[i]!))),
  );
  if (
    opening.some(
      (p) =>
        Math.abs(
          unit.reduce((sum, v, i) => sum + v * (p[i]! - origin[i]!), 0),
        ) >
        1e-7 * extent,
    )
  )
    throw new RangeError(`${label}: opening must lie in the outline's plane`);
  const mouth = facing(opening, unit);
  const recessed = mouth.map(
    (p): Point => [
      p[0] - unit[0] * depth,
      p[1] - unit[1] * depth,
      p[2] - unit[2] * depth,
    ],
  );
  if (recessed.some((p) => !finitePoint(p)))
    throw new RangeError(
      `${label}: recessed points exceed finite float32 range`,
    );
  return {
    surround: { outline, holes: [mouth] },
    reveals: bridgeProfiles(mouth, recessed, true, `${label} reveals`),
    inset: { outline: recessed },
  };
}

/**
 * Explicit triangles from a caller-owned center to an ordered profile.
 * Open chains omit the last-to-first edge; closed loops include it. The center
 * may lie on an open chain's closing edge, as at the base of a bent roof cap.
 * A consistent fan may be reversed as a whole; mixed signs are never repaired
 * one triangle at a time. An overlapping projected sweep is rejected; choose
 * another center or explicit faces when the boundary is not star-shaped there.
 */
export function triangleFan(
  profile: readonly Point[],
  center: Point,
  toward: Point,
  closed = false,
  label = "triangle fan",
): Face[] {
  const directionLength = Math.hypot(...toward);
  if (
    profile.length < (closed ? 3 : 2) ||
    !finitePoint(center) ||
    !finitePoint(toward) ||
    directionLength === 0 ||
    profile.some((p) => !finitePoint(p))
  )
    throw new RangeError(
      `${label}: finite profile/center and a nonzero outward direction required`,
    );
  const n = toward.map((value) => value / directionLength);
  // Direct plane coordinates avoid subtracting large along-axis products.
  const axis = n.reduce(
    (best, value, i) => (Math.abs(value) < Math.abs(n[best]!) ? i : best),
    0,
  );
  const unit = [0, 0, 0];
  unit[axis] = 1;
  const tangent = [
    n[1]! * unit[2]! - n[2]! * unit[1]!,
    n[2]! * unit[0]! - n[0]! * unit[2]!,
    n[0]! * unit[1]! - n[1]! * unit[0]!,
  ];
  const tangentLength = Math.hypot(...tangent);
  const right = tangent.map((value) => value / tangentLength);
  const up = [
    n[1]! * right[2]! - n[2]! * right[1]!,
    n[2]! * right[0]! - n[0]! * right[2]!,
    n[0]! * right[1]! - n[1]! * right[0]!,
  ];
  const projected = (p: readonly number[]) => [
    p.reduce((sum, value, i) => sum + value * right[i]!, 0),
    p.reduce((sum, value, i) => sum + value * up[i]!, 0),
  ];
  const faces: Face[] = [];
  let winding = 0;
  let sweep = 0;
  for (let i = 0; i < profile.length - (closed ? 0 : 1); i++) {
    const a = profile[i]!,
      b = profile[(i + 1) % profile.length]!;
    const u = a.map((v, axis) => v - center[axis]!),
      v = b.map((value, axis) => value - center[axis]!);
    const cross = [
      u[1]! * v[2]! - u[2]! * v[1]!,
      u[2]! * v[0]! - u[0]! * v[2]!,
      u[0]! * v[1]! - u[1]! * v[0]!,
    ];
    const area = Math.hypot(...cross);
    const dot = cross.reduce(
      (sum, value, axis) => sum + value * toward[axis]!,
      0,
    );
    if (
      area <= 1e-10 * Math.hypot(...u) * Math.hypot(...v) ||
      Math.abs(dot) <= 1e-10 * area * directionLength
    )
      throw new RangeError(
        `${label}: triangle ${i} is degenerate or edge-on to the outward direction`,
      );
    const sign = Math.sign(dot);
    if (winding !== 0 && sign !== winding)
      throw new RangeError(
        `${label}: triangle ${i} reverses the fan; check profile order and center`,
      );
    const pu = projected(u),
      pv = projected(v);
    sweep += Math.abs(
      Math.atan2(
        pu[0]! * pv[1]! - pu[1]! * pv[0]!,
        pu[0]! * pv[0]! + pu[1]! * pv[1]!,
      ),
    );
    winding = sign;
    faces.push({ outline: sign > 0 ? [center, a, b] : [center, b, a] });
  }
  if (
    closed ? Math.abs(sweep - 2 * Math.PI) > 1e-8 : sweep >= 2 * Math.PI - 1e-8
  )
    throw new RangeError(
      `${label}: projected fan must sweep once without overlap; change its center or split the cap`,
    );
  return faces;
}

function finitePoint(point: unknown): point is Point {
  return (
    Array.isArray(point) &&
    point.length === 3 &&
    point.every(
      (value) =>
        typeof value === "number" && Number.isFinite(Math.fround(value)),
    )
  );
}
