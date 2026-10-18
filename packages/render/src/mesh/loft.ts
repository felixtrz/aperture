import type {
  TriangleListMeshOptions,
  TriangleListPosition,
} from "./triangle-list-types.js";

export interface LoftMeshOptions {
  readonly label?: string;
  /** Corresponding 3D corners in successive sections; never repeat the closing corner. */
  readonly sections: readonly (readonly TriangleListPosition[])[];
  /** Close each section around its perimeter. Defaults to true. End caps are separate polygons. */
  readonly closed?: boolean;
  /** Reverse every generated triangle when the authored section order faces inward. */
  readonly flipWinding?: boolean;
}

/** Connect corresponding sections with consistently split quads and flat normals. */
export function loftTriangleListOptions(
  options: LoftMeshOptions,
): TriangleListMeshOptions {
  const sections = options.sections;
  if (!Array.isArray(sections) || sections.length < 2 || sections.length > 256)
    throw new Error(
      "mesh.loft() sections must contain 2 through 256 corresponding sections.",
    );
  const count = sections[0]?.length ?? 0;
  const closed = options.closed ?? true;
  if (count < (closed ? 3 : 2) || count > 256)
    throw new Error(
      `mesh.loft() sections[0] must contain ${closed ? 3 : 2} through 256 corners.`,
    );
  const positions: TriangleListPosition[] = [];
  for (const [s, section] of sections.entries()) {
    if (!Array.isArray(section) || section.length !== count)
      throw new Error(
        `mesh.loft() sections[${s}] must contain exactly ${count} corresponding corners.`,
      );
    for (const [p, point] of section.entries()) {
      if (
        !Array.isArray(point) ||
        point.length !== 3 ||
        point.some(
          (v) => typeof v !== "number" || !Number.isFinite(Math.fround(v)),
        )
      )
        throw new Error(
          `mesh.loft() sections[${s}][${p}] must be a finite float32 [x, y, z] tuple.`,
        );
      positions.push([point[0], point[1], point[2]]);
    }
  }
  const indices: number[] = [];
  for (let s = 0; s < sections.length - 1; s++) {
    for (let i = 0; i < (closed ? count : count - 1); i++) {
      const j = (i + 1) % count;
      const a = s * count + i,
        b = (s + 1) * count + i;
      const c = (s + 1) * count + j,
        d = s * count + j;
      indices.push(
        ...(options.flipWinding ? [a, c, b, a, d, c] : [a, b, c, a, c, d]),
      );
    }
  }
  // Asset construction validates triangle area and generates flat normals/bounds.
  // Caps intentionally use mesh.polygons so concave boundaries are triangulated correctly.
  return {
    ...(options.label === undefined ? {} : { label: options.label }),
    positions,
    indices,
  };
}
