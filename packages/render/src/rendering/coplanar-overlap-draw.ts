import { createSpatialTriangleMeshFromMeshAsset } from "../mesh/spatial-adapter.js";
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
  const mesh = input.resolveMesh(draw.mesh),
    material = input.resolveMaterial(draw.material);
  if (!mesh || mesh.kind !== "mesh") throw new Error("Missing mesh asset.");
  if (
    !material ||
    !("kind" in material) ||
    !["standard", "unlit", "matcap", "debug-normal"].includes(material.kind)
  )
    throw new Error(
      "Missing or custom material; final vertex positions are unknown.",
    );
  if (
    draw.boneMatrixOffset !== undefined ||
    draw.morphTargetCount !== undefined ||
    draw.instanceAttributePacketIndex !== undefined ||
    mesh.skinning ||
    mesh.morphTargetData ||
    (mesh.morphTargets?.length ?? 0) > 0 ||
    (material.kind === "standard" && material.extension?.deform)
  )
    throw new Error(
      "Skinning, morphing, instance attributes or shader deformation is unsupported.",
    );
  const offset = draw.worldTransformOffset,
    buffer = input.snapshot.transforms;
  if (
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    offset + 16 > buffer.length
  )
    throw new Error("Invalid resolved matrix offset.");
  const matrix = Array.from(buffer.subarray(offset, offset + 16));
  if (
    matrix.some((x) => !Number.isFinite(x)) ||
    matrix[3] !== 0 ||
    matrix[7] !== 0 ||
    matrix[11] !== 0 ||
    matrix[15] !== 1
  )
    throw new Error("Resolved matrix must be finite and affine.");
  const submesh = mesh.submeshes[draw.submesh];
  if (!submesh || submesh.topology !== "triangle-list")
    throw new Error("Selected submesh must use triangle-list topology.");
  const selected = {
    ...submesh,
    vertexStart: draw.vertexStart ?? submesh.vertexStart,
    vertexCount: draw.vertexCount ?? submesh.vertexCount,
    indexStart: draw.indexStart ?? submesh.indexStart,
    indexCount: draw.indexCount ?? submesh.indexCount,
  };
  const start = mesh.indexBuffer ? selected.indexStart : selected.vertexStart;
  const count = mesh.indexBuffer ? selected.indexCount : selected.vertexCount;
  if (
    !Number.isSafeInteger(start) ||
    start < 0 ||
    !Number.isSafeInteger(count) ||
    count < 0 ||
    count % 3 !== 0
  )
    throw new Error("Invalid triangle draw range.");
  if (count / 3 > budget.remaining) return "triangle-limit";
  // Charge attempted work even if validation fails near the end of a draw.
  budget.remaining -= count / 3;
  const stream = mesh.vertexStreams.find((s) =>
    s.attributes.some((a) => a.semantic === "POSITION"),
  );
  const attribute = stream?.attributes.find((a) => a.semantic === "POSITION");
  if (
    !stream ||
    !attribute ||
    attribute.format !== "float32x3" ||
    !ArrayBuffer.isView(stream.data) ||
    !Number.isSafeInteger(stream.vertexCount) ||
    stream.vertexCount < 0 ||
    !Number.isSafeInteger(stream.arrayStride) ||
    stream.arrayStride < 12 ||
    stream.arrayStride % 4 !== 0 ||
    !Number.isSafeInteger(attribute.offset) ||
    attribute.offset < 0 ||
    attribute.offset % 4 !== 0 ||
    attribute.offset + 12 > stream.arrayStride ||
    stream.data.byteOffset % 4 !== 0 ||
    (stream.vertexCount > 0 &&
      (stream.vertexCount - 1) * stream.arrayStride + attribute.offset + 12 >
        stream.data.byteLength)
  )
    throw new Error("Invalid or unsupported POSITION stream.");
  if (
    mesh.indexBuffer &&
    mesh.indexBuffer.indexCount !== undefined &&
    (!Number.isSafeInteger(mesh.indexBuffer.indexCount) ||
      mesh.indexBuffer.indexCount < 0 ||
      mesh.indexBuffer.indexCount > mesh.indexBuffer.data.length)
  )
    throw new Error("Invalid advertised index buffer count.");
  if (
    mesh.indexBuffer &&
    ((mesh.indexBuffer.format === "uint16" &&
      !(mesh.indexBuffer.data instanceof Uint16Array)) ||
      (mesh.indexBuffer.format === "uint32" &&
        !(mesh.indexBuffer.data instanceof Uint32Array)))
  )
    throw new Error("Index buffer format does not match its data.");
  const adapted = createSpatialTriangleMeshFromMeshAsset({
    ...mesh,
    submeshes: [selected],
  });
  if (!adapted.mesh)
    throw new Error(adapted.diagnostics.map((d) => d.message).join(" "));
  const spatial = adapted.mesh;
  const available = spatial.indices?.length ?? spatial.vertexCount;
  if (start + count > available)
    throw new Error("Draw range exceeds the mesh buffer.");
  let transformPrecision = 0;
  const read = (at: number): Point3 => {
    const index = spatial.indices?.[at] ?? at;
    if (
      !Number.isSafeInteger(index) ||
      index < 0 ||
      index >= spatial.vertexCount
    )
      throw new Error("Triangle index exceeds POSITION data.");
    const base =
      (spatial.positions.offset ?? 0) + index * spatial.positions.stride;
    const p = [
      spatial.positions.data[base],
      spatial.positions.data[base + 1],
      spatial.positions.data[base + 2],
    ];
    if (p.some((value) => typeof value !== "number" || !Number.isFinite(value)))
      throw new Error("Nonfinite triangle position.");
    // Include intermediate magnitudes: cancellation can hide rounding error
    // even when the resulting world coordinate itself is small.
    for (let row = 0; row < 3; row++)
      transformPrecision = Math.max(
        transformPrecision,
        (Math.abs(matrix[row]! * p[0]!) +
          Math.abs(matrix[4 + row]! * p[1]!) +
          Math.abs(matrix[8 + row]! * p[2]!) +
          Math.abs(matrix[12 + row]!)) *
          Number.EPSILON *
          16,
      );
    const world = [0, 1, 2].map(
      (row) =>
        matrix[row]! * p[0]! +
        matrix[4 + row]! * p[1]! +
        matrix[8 + row]! * p[2]! +
        matrix[12 + row]!,
    );
    if (world.some((value) => !Number.isFinite(value)))
      throw new Error("Nonfinite transformed position.");
    return [world[0]!, world[1]!, world[2]!];
  };
  const triangles: InspectionTriangle[] = [];
  let degenerateCount = 0;
  for (let at = start; at < start + count; at += 3) {
    transformPrecision = 0;
    const triangle = inspectionTriangle(
      [read(at), read(at + 1), read(at + 2)],
      at,
      transformPrecision,
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
  const state = material.renderState;
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
