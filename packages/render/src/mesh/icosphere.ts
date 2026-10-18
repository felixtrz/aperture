import type {
  TriangleListMeshOptions,
  TriangleListPosition,
} from "./triangle-list-types.js";

export interface IcosphereMeshOptions {
  readonly label?: string;
  /** Radius in local units. Defaults to 1. */
  readonly radius?: number;
  /** Recursive midpoint subdivisions, 0 through 4. Defaults to 1 (80 triangles). */
  readonly subdivisions?: number;
}

/** A closed, uniformly faceted sphere with shared edges and outward winding. */
export function icosphereTriangleListOptions(
  options: IcosphereMeshOptions = {},
): TriangleListMeshOptions {
  if (options === null || typeof options !== "object" || Array.isArray(options))
    throw new Error("mesh.icosphere() requires an options object.");
  const radius = options.radius === undefined ? 1 : options.radius;
  if (
    typeof radius !== "number" ||
    !Number.isFinite(Math.fround(radius)) ||
    Math.fround(radius) <= 0
  )
    throw new Error(
      "mesh.icosphere() radius must be a positive finite float32 value.",
    );
  const subdivisions =
    options.subdivisions === undefined ? 1 : options.subdivisions;
  if (!Number.isInteger(subdivisions) || subdivisions < 0 || subdivisions > 4)
    throw new Error(
      "mesh.icosphere() subdivisions must be an integer from 0 through 4.",
    );
  const t = (1 + Math.sqrt(5)) / 2;
  const normalize = (p: TriangleListPosition): TriangleListPosition => {
    const length = Math.hypot(...p);
    return [p[0] / length, p[1] / length, p[2] / length];
  };
  const vertices: TriangleListPosition[] = [
    [-1, t, 0],
    [1, t, 0],
    [-1, -t, 0],
    [1, -t, 0],
    [0, -1, t],
    [0, 1, t],
    [0, -1, -t],
    [0, 1, -t],
    [t, 0, -1],
    [t, 0, 1],
    [-t, 0, -1],
    [-t, 0, 1],
  ].map((p) => normalize(p as [number, number, number]));
  let faces: [number, number, number][] = [
    [0, 11, 5],
    [0, 5, 1],
    [0, 1, 7],
    [0, 7, 10],
    [0, 10, 11],
    [1, 5, 9],
    [5, 11, 4],
    [11, 10, 2],
    [10, 7, 6],
    [7, 1, 8],
    [3, 9, 4],
    [3, 4, 2],
    [3, 2, 6],
    [3, 6, 8],
    [3, 8, 9],
    [4, 9, 5],
    [2, 4, 11],
    [6, 2, 10],
    [8, 6, 7],
    [9, 8, 1],
  ];
  for (let level = 0; level < subdivisions; level++) {
    const midpoints = new Map<string, number>();
    const midpoint = (a: number, b: number): number => {
      const key = a < b ? `${a}/${b}` : `${b}/${a}`;
      const cached = midpoints.get(key);
      if (cached !== undefined) return cached;
      const start = vertices[a]!,
        end = vertices[b]!;
      const index = vertices.length;
      vertices.push(
        normalize([start[0] + end[0], start[1] + end[1], start[2] + end[2]]),
      );
      midpoints.set(key, index);
      return index;
    };
    const next: [number, number, number][] = [];
    for (const [a, b, c] of faces) {
      const ab = midpoint(a, b),
        bc = midpoint(b, c),
        ca = midpoint(c, a);
      next.push([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]);
    }
    faces = next;
  }
  return {
    ...(options.label === undefined ? {} : { label: options.label }),
    positions: vertices.map((p) => [
      p[0] * radius,
      p[1] * radius,
      p[2] * radius,
    ]),
    indices: faces.flat(),
  };
}
