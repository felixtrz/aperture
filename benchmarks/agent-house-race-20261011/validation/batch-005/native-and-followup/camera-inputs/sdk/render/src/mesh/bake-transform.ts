import type { Aabb, BoundingSphere } from "@aperture-engine/simulation";
import {
  bakeNormal,
  bakePosition,
  finiteBakeFloat,
  multiplyBakeVector,
  normalizedBakeVector,
  orthogonalBakeTangent,
  readBakeTransform,
  type BakeAffineTransform,
  type BakeVector3,
} from "./bake-transform-math.js";
import {
  bakeFailure,
  MeshBakeFailure,
  type BakeMeshAssetTransformOptions,
  type BakeMeshAssetTransformResult,
} from "./bake-transform-types.js";
import {
  validateBakeSource,
  type BakeAttributeBinding,
  type BakeSourceLayout,
} from "./bake-transform-validation.js";
import type { MeshAsset, MeshVertexStreamDescriptor } from "./types.js";

/**
 * Bake a nonsingular affine transform into an owned static triangle-list asset.
 * Indexed sources remain indexed and can feed mergeMeshAssetsForBatch. Normals
 * use the inverse transpose; tangents are orthogonalized, with mirrored winding
 * and handedness corrected. Unsupported or invalid input produces diagnostics
 * and no partial mesh. See MESH_BAKE_TRANSFORM_LIMITS for fixed work/copy caps.
 */
export function bakeMeshAssetTransform(
  options: BakeMeshAssetTransformOptions,
): BakeMeshAssetTransformResult {
  try {
    if (
      options == null ||
      typeof options !== "object" ||
      Array.isArray(options)
    ) {
      bakeFailure({
        code: "meshBake.invalidSourceMesh",
        path: "options",
        message: "Provide mesh and transform options.",
      });
    }
    if (options.label !== undefined && typeof options.label !== "string") {
      bakeFailure({
        code: "meshBake.invalidSourceMesh",
        path: "label",
        message: "Provide a string label.",
      });
    }
    const transform = readBakeTransform(options.transform);
    const layout = validateBakeSource(options.mesh, transform.orientation < 0);
    const streams = options.mesh.vertexStreams.map(cloneStream);
    const views = streams.map(
      (stream) =>
        new DataView(
          stream.data.buffer,
          stream.data.byteOffset,
          stream.data.byteLength,
        ),
    );
    transformVertices(transform, layout, streams, views);
    const sourceIndex = options.mesh.indexBuffer;
    const indexBuffer =
      sourceIndex === undefined
        ? undefined
        : {
            format: sourceIndex.format,
            data:
              sourceIndex.data instanceof Uint32Array
                ? new Uint32Array(sourceIndex.data)
                : new Uint16Array(sourceIndex.data),
            ...(sourceIndex.indexCount === undefined
              ? {}
              : { indexCount: sourceIndex.indexCount }),
          };
    if (transform.orientation < 0) {
      for (const range of layout.triangleRanges) {
        for (let corner = range.start; corner < range.end; corner += 3) {
          if (indexBuffer !== undefined) {
            const second = indexBuffer.data[corner + 1]!;
            indexBuffer.data[corner + 1] = indexBuffer.data[corner + 2]!;
            indexBuffer.data[corner + 2] = second;
          }
        }
      }
      if (indexBuffer === undefined) reverseVertexWinding(layout, streams);
    }
    validateTriangles(layout, streams, views, indexBuffer?.data);
    const bounds = bakedBounds(layout, streams, views);
    const mesh: MeshAsset = {
      kind: "mesh",
      label: options.label ?? options.mesh.label,
      vertexStreams: streams,
      ...(indexBuffer === undefined ? {} : { indexBuffer }),
      submeshes: options.mesh.submeshes.map((submesh) => ({ ...submesh })),
      materialSlots: options.mesh.materialSlots.map((slot) => ({ ...slot })),
      localAabb: bounds.aabb,
      localSphere: bounds.sphere,
    };
    return { valid: true, mesh, diagnostics: [] };
  } catch (error) {
    if (!(error instanceof MeshBakeFailure)) throw error;
    return { valid: false, mesh: null, diagnostics: [error.diagnostic] };
  }
}

function cloneStream(
  stream: MeshVertexStreamDescriptor,
): MeshVertexStreamDescriptor {
  const buffer = new Uint8Array(
    stream.data.buffer,
    stream.data.byteOffset,
    stream.data.byteLength,
  ).slice().buffer;
  const data =
    stream.data instanceof Float32Array
      ? new Float32Array(buffer)
      : stream.data instanceof Uint16Array
        ? new Uint16Array(buffer)
        : new Uint8Array(buffer);
  return {
    id: stream.id,
    arrayStride: stream.arrayStride,
    vertexCount: stream.vertexCount,
    attributes: stream.attributes.map((attribute) => ({ ...attribute })),
    data,
  };
}

function transformVertices(
  transform: BakeAffineTransform,
  layout: BakeSourceLayout,
  streams: readonly MeshVertexStreamDescriptor[],
  views: readonly DataView[],
): void {
  for (let vertex = 0; vertex < layout.vertexCount; vertex += 1) {
    const path = `mesh.vertex[${vertex}]`;
    writeVector(
      layout.position,
      vertex,
      bakePosition(
        transform,
        readVector(layout.position, vertex, streams, views),
        `${path}.POSITION`,
      ),
      streams,
      views,
    );
    if (layout.normal !== undefined) {
      const normal = bakeNormal(
        transform,
        readVector(layout.normal, vertex, streams, views),
        `${path}.NORMAL`,
      );
      writeVector(layout.normal, vertex, normal, streams, views);
      if (layout.tangent !== undefined) {
        const binding = layout.tangent;
        const offset =
          vertex * streams[binding.stream]!.arrayStride + binding.offset;
        const w = views[binding.stream]!.getFloat32(offset + 12, true);
        if (w !== 1 && w !== -1) {
          bakeFailure({
            code: "meshBake.invalidSourceMesh",
            path: `${path}.TANGENT.w`,
            message: "Tangent handedness must be +1 or -1.",
          });
        }
        const tangent = normalizedBakeVector(
          multiplyBakeVector(
            transform.linear,
            readVector(binding, vertex, streams, views),
          ),
          `${path}.TANGENT`,
        );
        const orthogonal = orthogonalBakeTangent(
          tangent,
          normal,
          `${path}.TANGENT`,
        );
        writeVector(binding, vertex, orthogonal, streams, views);
        views[binding.stream]!.setFloat32(
          offset + 12,
          w * transform.orientation,
          true,
        );
      }
    }
  }
}

function readVector(
  binding: BakeAttributeBinding,
  vertex: number,
  streams: readonly MeshVertexStreamDescriptor[],
  views: readonly DataView[],
): BakeVector3 {
  const offset = vertex * streams[binding.stream]!.arrayStride + binding.offset;
  const view = views[binding.stream]!;
  return [
    view.getFloat32(offset, true),
    view.getFloat32(offset + 4, true),
    view.getFloat32(offset + 8, true),
  ];
}

function writeVector(
  binding: BakeAttributeBinding,
  vertex: number,
  value: BakeVector3,
  streams: readonly MeshVertexStreamDescriptor[],
  views: readonly DataView[],
): void {
  const offset = vertex * streams[binding.stream]!.arrayStride + binding.offset;
  const view = views[binding.stream]!;
  view.setFloat32(offset, value[0], true);
  view.setFloat32(offset + 4, value[1], true);
  view.setFloat32(offset + 8, value[2], true);
}

function reverseVertexWinding(
  layout: BakeSourceLayout,
  streams: readonly MeshVertexStreamDescriptor[],
): void {
  for (const stream of streams) {
    const bytes = new Uint8Array(
      stream.data.buffer,
      stream.data.byteOffset,
      stream.data.byteLength,
    );
    const temporary = new Uint8Array(stream.arrayStride);
    for (const range of layout.triangleRanges) {
      for (let corner = range.start; corner < range.end; corner += 3) {
        const startA = (corner + 1) * stream.arrayStride,
          startB = (corner + 2) * stream.arrayStride;
        temporary.set(bytes.subarray(startA, startA + stream.arrayStride));
        bytes.copyWithin(startA, startB, startB + stream.arrayStride);
        bytes.set(temporary, startB);
      }
    }
  }
}

function validateTriangles(
  layout: BakeSourceLayout,
  streams: readonly MeshVertexStreamDescriptor[],
  views: readonly DataView[],
  indices: Uint16Array | Uint32Array | undefined,
): void {
  for (const range of layout.triangleRanges) {
    for (let corner = range.start; corner < range.end; corner += 3) {
      const a = readVector(
        layout.position,
        indices?.[corner] ?? corner,
        streams,
        views,
      );
      const b = readVector(
        layout.position,
        indices?.[corner + 1] ?? corner + 1,
        streams,
        views,
      );
      const c = readVector(
        layout.position,
        indices?.[corner + 2] ?? corner + 2,
        streams,
        views,
      );
      const ab: BakeVector3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const ac: BakeVector3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const area = Math.hypot(
        ab[1] * ac[2] - ab[2] * ac[1],
        ab[2] * ac[0] - ab[0] * ac[2],
        ab[0] * ac[1] - ab[1] * ac[0],
      );
      if (area === 0) {
        bakeFailure({
          code: "meshBake.degenerateTriangle",
          path: `mesh.${indices === undefined ? "vertices" : "indices"}[${corner}..${corner + 2}]`,
          message:
            "This active triangle has zero area after float32 transform storage; reduce translation/scale or separate its vertices.",
        });
      }
    }
  }
}

function bakedBounds(
  layout: BakeSourceLayout,
  streams: readonly MeshVertexStreamDescriptor[],
  views: readonly DataView[],
): { aabb: Aabb; sphere: BoundingSphere } {
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let vertex = 0; vertex < layout.vertexCount; vertex += 1) {
    const p = readVector(layout.position, vertex, streams, views);
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis]!, p[axis]!);
      max[axis] = Math.max(max[axis]!, p[axis]!);
    }
  }
  const center: [number, number, number] = [
    (min[0] + max[0]) / 2,
    (min[1] + max[1]) / 2,
    (min[2] + max[2]) / 2,
  ];
  let radius = 0;
  for (let vertex = 0; vertex < layout.vertexCount; vertex += 1) {
    const p = readVector(layout.position, vertex, streams, views);
    radius = Math.max(
      radius,
      Math.hypot(p[0] - center[0], p[1] - center[1], p[2] - center[2]),
    );
  }
  finiteBakeFloat(radius, "mesh.localSphere.radius");
  return { aabb: { min, max }, sphere: { center, radius } };
}
