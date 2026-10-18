import type { ExtrudeMeshOptions } from "./extrude-types.js";
import type {
  TriangleListMeshOptions,
  TriangleListPosition as Point,
} from "./triangle-list-types.js";
import { readExtrudeRings } from "./extrude-validation.js";
import { triangulateExtrudeCaps } from "./extrude-triangulation.js";
import { profileFrame, readPoint, subtract, unit } from "./path-frame.js";

export interface ExtrudeBetweenMeshOptions extends Omit<
  ExtrudeMeshOptions,
  "depth"
> {
  readonly start: Point;
  readonly end: Point;
  /** Profile +Y follows this vector projected perpendicular to the path. Default world +Y, or +Z for vertical paths. */
  readonly up?: Point;
}

/** A closed straight extrusion with explicit endpoints, including concave profiles and holes. */
export function extrudeBetweenTriangleListOptions(
  options: ExtrudeBetweenMeshOptions,
): TriangleListMeshOptions {
  const start = readPoint(options.start, "start"),
    end = readPoint(options.end, "end");
  const delta = subtract(end, start),
    direction = unit(delta, "start/end");
  const [right, up] = profileFrame(direction, options.up);
  const { rings } = readExtrudeRings({
    ...options,
    depth: Math.hypot(...delta),
  });
  const points = rings.flat(),
    count = points.length;
  const positions: Point[] = [];
  for (const center of [start, end])
    for (const [x, y] of points)
      positions.push([
        center[0] + right[0] * x + up[0] * y,
        center[1] + right[1] * x + up[1] * y,
        center[2] + right[2] * x + up[2] * y,
      ]);
  const caps = triangulateExtrudeCaps(rings),
    indices: number[] = [];
  for (let i = 0; i < caps.length; i += 3) {
    const a = caps[i]!,
      b = caps[i + 1]!,
      c = caps[i + 2]!;
    indices.push(a, c, b, a + count, b + count, c + count);
  }
  let offset = 0;
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i++) {
      const a = offset + i,
        b = offset + ((i + 1) % ring.length);
      indices.push(a, b, b + count, a, b + count, a + count);
    }
    offset += ring.length;
  }
  return {
    ...(options.label === undefined ? {} : { label: options.label }),
    positions,
    indices,
  };
}
