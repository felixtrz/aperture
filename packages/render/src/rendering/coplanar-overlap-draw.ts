import { readStaticInspectionDraw } from "./static-inspection-draw.js";
import type { MeshDrawPacket } from "./snapshot-packet-types.js";
import type {
  CoplanarOverlapDraw,
  CoplanarOverlapInput,
} from "./coplanar-overlap-types.js";
import {
  inspectionTriangle,
  type InspectionTriangle,
  type Point3,
} from "./coplanar-overlap-geometry.js";

export interface InspectionDraw {
  readonly identity: CoplanarOverlapDraw;
  readonly triangles: readonly InspectionTriangle[];
  readonly min: Point3;
  readonly max: Point3;
  readonly extent: number;
  readonly precision: number;
  readonly triangleCount: number;
  readonly degenerateCount: number;
}

/** Adapt only the selected draw range; never inspect inactive source triangles. */
export function readInspectionDraw(
  input: CoplanarOverlapInput,
  draw: MeshDrawPacket,
  budget: { remaining: number },
): InspectionDraw | "triangle-limit" {
  const references = { remaining: budget.remaining, divisor: 3 as const };
  let prepared;
  try {
    prepared = readStaticInspectionDraw(input, draw, references);
  } finally {
    budget.remaining = references.remaining;
  }
  if (prepared === "reference-limit") return "triangle-limit";
  const { start, count } = prepared;
  const triangles: InspectionTriangle[] = [];
  let degenerateCount = 0;
  for (let at = start; at < start + count; at += 3) {
    const vertices = [
      prepared.read(at),
      prepared.read(at + 1),
      prepared.read(at + 2),
    ];
    const triangle = inspectionTriangle(
      vertices.map((v) => v.world) as unknown as readonly [
        Point3,
        Point3,
        Point3,
      ],
      at,
      Math.max(...vertices.map((v) => v.precision)),
    );
    if (triangle) triangles.push(triangle);
    else degenerateCount++;
  }
  const min = [Infinity, Infinity, Infinity],
    max = [-Infinity, -Infinity, -Infinity];
  let extent = 0,
    precision = 0;
  for (const triangle of triangles) {
    extent = Math.max(extent, triangle.extent);
    precision = Math.max(precision, triangle.precision);
    for (let axis = 0; axis < 3; axis++) {
      min[axis] = Math.min(min[axis]!, triangle.min[axis]!);
      max[axis] = Math.max(max[axis]!, triangle.max[axis]!);
    }
  }
  const state = prepared.material.renderState;
  if (!state || !state.depth || !state.blend)
    throw new Error("Missing material render state.");
  return {
    identity: {
      entity: { ...draw.entity },
      renderId: draw.renderId,
      meshId: draw.mesh.id,
      materialId: draw.material.id,
      submesh: draw.submesh,
      renderState: {
        ...state,
        depth: { ...state.depth },
        blend: { ...state.blend },
      },
    },
    triangles,
    min: min as unknown as Point3,
    max: max as unknown as Point3,
    extent,
    precision,
    triangleCount: count / 3,
    degenerateCount,
  };
}
