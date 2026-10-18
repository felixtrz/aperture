import type {
  TriangleListMeshOptions,
  TriangleListPosition as Point,
} from "./triangle-list-types.js";
import {
  cross,
  dot,
  profileFrame,
  readPoint,
  subtract,
  unit,
} from "./path-frame.js";

export interface TubeMeshOptions {
  readonly label?: string;
  /** Open polyline, 2–512 points. No repeated adjacent points or reversing corners. */
  readonly path: readonly Point[];
  /** Positive radius, or one positive radius per path point. Defaults to 0.05. */
  readonly radius?: number | readonly number[];
  /** 3–64 sides. Defaults to 8. */
  readonly radialSegments?: number;
  /** Close both endpoints. Defaults to true. */
  readonly capped?: boolean;
}

/** One connected flat-shaded surface; shared bend rings avoid gaps between independently rotated cylinders. */
export function tubeTriangleListOptions(
  options: TubeMeshOptions,
): TriangleListMeshOptions {
  if (
    !Array.isArray(options.path) ||
    options.path.length < 2 ||
    options.path.length > 512
  )
    throw new Error("mesh.tube() path must contain 2 through 512 points.");
  const path = options.path.map((p, i) => readPoint(p, `path[${i}]`));
  if (Math.hypot(...subtract(path[0]!, path.at(-1)!)) < 1e-12)
    throw new Error(
      "mesh.tube() path must be open; its endpoints must differ.",
    );
  const segments = options.radialSegments ?? 8;
  if (!Number.isInteger(segments) || segments < 3 || segments > 64)
    throw new Error(
      "mesh.tube() radialSegments must be an integer from 3 through 64.",
    );
  const radius = options.radius ?? 0.05;
  const radii = typeof radius === "number" ? path.map(() => radius) : radius;
  if (
    !Array.isArray(radii) ||
    radii.length !== path.length ||
    radii.some(
      (r) =>
        typeof r !== "number" ||
        !Number.isFinite(Math.fround(r)) ||
        Math.fround(r) <= 0,
    )
  )
    throw new Error(
      "mesh.tube() radius must be positive and finite, or one such radius per path point.",
    );
  const directions = path
    .slice(1)
    .map((p, i) => unit(subtract(p, path[i]!), `path[${i}..${i + 1}]`));
  const tangents = path.map((_, i): Point => {
    if (i === 0) return directions[0]!;
    if (i === path.length - 1) return directions.at(-1)!;
    const a = directions[i - 1]!,
      b = directions[i]!;
    if (dot(a, b) < -0.999)
      throw new Error(
        `path[${i}] reverses direction; split the tube or use a wider bend.`,
      );
    return unit([a[0] + b[0], a[1] + b[1], a[2] + b[2]], `path[${i}] tangent`);
  });
  let [right] = profileFrame(tangents[0]!);
  const positions: Point[] = [],
    indices: number[] = [];
  for (let i = 0; i < path.length; i++) {
    const tangent = tangents[i]!,
      center = path[i]!,
      r = radii[i]!;
    if (i > 0) {
      // Minimal rotation of the previous frame (parallel transport); no world-axis seam at a bend.
      const previous = tangents[i - 1]!,
        axis = cross(previous, tangent),
        c = dot(previous, tangent);
      const first = cross(axis, right),
        second = cross(axis, first);
      right = unit(
        [
          right[0] + first[0] + second[0] / (1 + c),
          right[1] + first[1] + second[1] / (1 + c),
          right[2] + first[2] + second[2] / (1 + c),
        ],
        `path[${i}] frame`,
      );
    }
    const up = cross(tangent, right);
    for (let j = 0; j < segments; j++) {
      const angle = (j * Math.PI * 2) / segments,
        x = Math.cos(angle) * r,
        y = Math.sin(angle) * r;
      positions.push([
        center[0] + right[0] * x + up[0] * y,
        center[1] + right[1] * x + up[1] * y,
        center[2] + right[2] * x + up[2] * y,
      ]);
    }
    if (i > 0)
      for (let j = 0; j < segments; j++) {
        const a = (i - 1) * segments + j,
          b = i * segments + j,
          c = i * segments + ((j + 1) % segments),
          d = (i - 1) * segments + ((j + 1) % segments);
        indices.push(a, c, b, a, d, c);
      }
  }
  if (options.capped ?? true) {
    const start = positions.length,
      end = start + 1;
    positions.push(path[0]!, path.at(-1)!);
    const last = (path.length - 1) * segments;
    for (let j = 0; j < segments; j++) {
      const k = (j + 1) % segments;
      indices.push(start, k, j, end, last + j, last + k);
    }
  }
  return {
    ...(options.label === undefined ? {} : { label: options.label }),
    positions,
    indices,
  };
}
