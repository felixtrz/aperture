import type {
  TriangleListMeshOptions,
  TriangleListPosition,
} from "./triangle-list-types.js";

export interface BeveledBoxMeshOptions {
  readonly label?: string;
  readonly size?: readonly [number, number, number];
  /** Width of each flat chamfer, in local units. Defaults to 8% of the smallest side. */
  readonly bevel?: number;
}

/** Closed faceted box with shared corners, 6 main faces, 12 edge strips and 8 corner faces. */
export function beveledBoxTriangleListOptions(
  options: BeveledBoxMeshOptions = {},
): TriangleListMeshOptions {
  const size = options.size ?? [1, 1, 1];
  if (
    !Array.isArray(size) ||
    size.length !== 3 ||
    size.some(
      (v) =>
        typeof v !== "number" || !Number.isFinite(Math.fround(v)) || v <= 0,
    )
  )
    throw new Error(
      "mesh.beveledBox() size must be three positive finite float32 dimensions.",
    );
  const half = size.map((v) => v / 2);
  const bevel = options.bevel ?? Math.min(...size) * 0.08;
  const maximumBevel = Math.min(...half);
  if (
    typeof bevel !== "number" ||
    !Number.isFinite(Math.fround(bevel)) ||
    bevel <= 0 ||
    bevel >= maximumBevel
  )
    throw new Error(
      "mesh.beveledBox() bevel must be positive and less than half the smallest dimension. " +
        `Received bevel ${typeof bevel === "number" ? String(bevel) : `<${typeof bevel}>`} ` +
        `for size [${size.join(", ")}]; require 0 < bevel < ${maximumBevel}.`,
    );
  const inset = half.map((v) => v - bevel);
  const positions: TriangleListPosition[] = [],
    indices: number[] = [];
  const corners = new Map<string, number>();
  const vertex = (p: number[]): number => {
    const key = p.join(",");
    const old = corners.get(key);
    if (old !== undefined) return old;
    const index = positions.length;
    positions.push([p[0]!, p[1]!, p[2]!]);
    corners.set(key, index);
    return index;
  };
  const face = (points: number[][]): void => {
    const a = points[0]!,
      b = points[1]!,
      c = points[2]!;
    const u = b.map((v, i) => v - a[i]!),
      v = c.map((value, i) => value - a[i]!);
    const normal = [
      u[1]! * v[2]! - u[2]! * v[1]!,
      u[2]! * v[0]! - u[0]! * v[2]!,
      u[0]! * v[1]! - u[1]! * v[0]!,
    ];
    if (normal.reduce((sum, n, i) => sum + n * a[i]!, 0) < 0) points.reverse();
    const ids = points.map(vertex);
    for (let i = 1; i < ids.length - 1; i++)
      indices.push(ids[0]!, ids[i]!, ids[i + 1]!);
  };
  const signs = [-1, 1];
  for (let axis = 0; axis < 3; axis++) {
    const u = (axis + 1) % 3,
      v = (axis + 2) % 3;
    for (const sign of signs)
      face(
        [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ].map(([su, sv]) => {
          const p = [0, 0, 0];
          p[axis] = sign * half[axis]!;
          p[u] = su! * inset[u]!;
          p[v] = sv! * inset[v]!;
          return p;
        }),
      );
    // Each strip runs along this axis and connects the other two main faces.
    for (const su of signs)
      for (const sv of signs)
        face(
          [
            [-1, 0],
            [1, 0],
            [1, 1],
            [-1, 1],
          ].map(([end, side]) => {
            const p = [0, 0, 0];
            p[axis] = end! * inset[axis]!;
            p[u] = su * (side === 0 ? half[u]! : inset[u]!);
            p[v] = sv * (side === 0 ? inset[v]! : half[v]!);
            return p;
          }),
        );
  }
  for (const x of signs)
    for (const y of signs)
      for (const z of signs) {
        const s = [x, y, z];
        face(
          [0, 1, 2].map((axis) =>
            s.map((sign, i) => sign * (i === axis ? half[i]! : inset[i]!)),
          ),
        );
      }
  return {
    ...(options.label === undefined ? {} : { label: options.label }),
    positions,
    indices,
  };
}
