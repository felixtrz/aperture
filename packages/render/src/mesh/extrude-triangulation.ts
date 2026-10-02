import earcut, { deviation } from "./vendor/earcut.js";
import type { ExtrudePoint } from "./extrude-types.js";
import { ExtrudeMeshError } from "./extrude-validation.js";

/** Earcut may simplify collinear hole bridges; split their T-junctions again. */
export function triangulateExtrudeCaps(
  rings: readonly (readonly ExtrudePoint[])[],
): number[] {
  const points = rings.flat();
  const data = points.flatMap(([x, y]) => [x, y]);
  const holes: number[] = [];
  let offset = rings[0]!.length;
  for (const ring of rings.slice(1)) {
    holes.push(offset);
    offset += ring.length;
  }
  const raw = earcut(data, holes, 2);
  const pending: number[][] = [];
  for (let i = 0; i < raw.length; i += 3) pending.push(raw.slice(i, i + 3));
  const caps: number[] = [];
  const expectedTriangles = points.length + 2 * holes.length - 2;
  while (pending.length) {
    const triangle = pending.pop()!;
    let split = false;
    for (let edge = 0; edge < 3; edge++) {
      const a = triangle[edge]!,
        b = triangle[(edge + 1) % 3]!,
        c = triangle[(edge + 2) % 3]!;
      const p = points[a]!,
        q = points[b]!;
      const dx = q[0] - p[0],
        dy = q[1] - p[1];
      const cuts = points
        .map((point, index) => {
          if (index === a || index === b || index === c)
            return { index, t: -1 };
          const x = point[0] - p[0],
            y = point[1] - p[1];
          const t = Math.abs(dx) >= Math.abs(dy) ? x / dx : y / dy;
          return { index, t: x * dy - y * dx === 0 ? t : -1 };
        })
        .filter((cut) => cut.t > 0 && cut.t < 1)
        .sort((a, b) => a.t - b.t);
      if (!cuts.length) continue;
      const chain = [a, ...cuts.map((cut) => cut.index), b];
      for (let i = 0; i < chain.length - 1; i++)
        pending.push([chain[i]!, chain[i + 1]!, c]);
      split = true;
      break;
    }
    if (!split) caps.push(...triangle);
    if (caps.length / 3 + pending.length > expectedTriangles) fail();
  }
  if (
    caps.length !== expectedTriangles * 3 ||
    deviation(data, holes, 2, caps) > 1e-10
  )
    fail();
  // Every authored ring edge must appear exactly once, and every internal
  // cap edge twice with opposite directions. Never publish incomplete caps.
  const edges = new Map<string, { count: number; direction: number }>();
  function key(a: number, b: number): string {
    return a < b ? `${a}:${b}` : `${b}:${a}`;
  }
  for (let i = 0; i < caps.length; i += 3) {
    for (let e = 0; e < 3; e++) {
      const a = caps[i + e]!,
        b = caps[i + ((e + 1) % 3)]!;
      const entry = edges.get(key(a, b)) ?? { count: 0, direction: 0 };
      entry.count++;
      entry.direction += a < b ? 1 : -1;
      edges.set(key(a, b), entry);
    }
  }
  offset = 0;
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i++) {
      const a = offset + i,
        b = offset + ((i + 1) % ring.length);
      const entry = edges.get(key(a, b));
      if (entry?.count !== 1 || entry.direction !== (a < b ? 1 : -1)) fail();
      edges.delete(key(a, b));
    }
    offset += ring.length;
  }
  for (const entry of edges.values())
    if (entry.count !== 2 || entry.direction !== 0) fail();
  return caps;
}
function fail(): never {
  throw new ExtrudeMeshError(
    "outline",
    "could not be triangulated completely; simplify numerically ambiguous boundaries.",
  );
}
