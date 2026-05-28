import type { Aabb, BoundingSphere } from "@aperture-engine/simulation";

import type {
  GltfDecodedAccessor,
  GltfDecodedPrimitiveAccessors,
} from "./gltf-accessor-decoding.js";
import type { MeshIndexBufferDescriptor } from "../mesh/index.js";
import type { GltfMeshAssetConstructionDiagnostic } from "./gltf-mesh-asset-construction-types.js";
import { createGltfMeshAssetDiagnostic } from "./gltf-mesh-asset-construction-diagnostics.js";

export function createGltfMeshIndexBuffer(
  primitive: GltfDecodedPrimitiveAccessors,
  diagnostics: GltfMeshAssetConstructionDiagnostic[],
): MeshIndexBufferDescriptor | null {
  if (primitive.indices === null) {
    return null;
  }

  const source = primitive.indices.array;
  if (!(source instanceof Uint16Array) && !(source instanceof Uint32Array)) {
    diagnostics.push(
      createGltfMeshAssetDiagnostic(
        primitive,
        "gltfMeshAsset.unsupportedSemantic",
        {
          semantic: "INDICES",
          message: `Primitive '${primitive.meshHandleKey}' has unsupported index array type.`,
        },
      ),
    );
    return null;
  }

  for (const indexValue of source) {
    if (indexValue >= primitive.vertexCount) {
      diagnostics.push(
        createGltfMeshAssetDiagnostic(
          primitive,
          "gltfMeshAsset.invalidIndexValue",
          {
            semantic: "INDICES",
            indexValue,
            vertexCount: primitive.vertexCount,
            message: `Primitive '${primitive.meshHandleKey}' index ${indexValue} is outside vertex count ${primitive.vertexCount}.`,
          },
        ),
      );
      return null;
    }
  }

  return {
    format: source instanceof Uint16Array ? "uint16" : "uint32",
    data: source,
  };
}

export function computeGltfMeshBounds(
  position: GltfDecodedAccessor,
  primitive: GltfDecodedPrimitiveAccessors,
  diagnostics: GltfMeshAssetConstructionDiagnostic[],
): { readonly aabb: Aabb; readonly sphere: BoundingSphere } | null {
  if (position.array.length < 3 || position.itemSize !== 3) {
    diagnostics.push(
      createGltfMeshAssetDiagnostic(primitive, "gltfMeshAsset.missingBounds", {
        semantic: "POSITION",
        message: `Primitive '${primitive.meshHandleKey}' cannot compute bounds without float32x3 POSITION data.`,
      }),
    );
    return null;
  }

  const min: [number, number, number] = [
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
  ];
  const max: [number, number, number] = [
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ];

  for (let i = 0; i < position.array.length; i += 3) {
    for (const axis of [0, 1, 2] as const) {
      const value = position.array[i + axis] ?? 0;
      min[axis] = Math.min(min[axis], value);
      max[axis] = Math.max(max[axis], value);
    }
  }

  if (!min.every(Number.isFinite) || !max.every(Number.isFinite)) {
    diagnostics.push(
      createGltfMeshAssetDiagnostic(primitive, "gltfMeshAsset.invalidBounds", {
        semantic: "POSITION",
        message: `Primitive '${primitive.meshHandleKey}' produced non-finite bounds.`,
      }),
    );
    return null;
  }

  const center: [number, number, number] = [
    (min[0] + max[0]) / 2,
    (min[1] + max[1]) / 2,
    (min[2] + max[2]) / 2,
  ];
  let radius = 0;
  for (let i = 0; i < position.array.length; i += 3) {
    const dx = (position.array[i] ?? 0) - center[0];
    const dy = (position.array[i + 1] ?? 0) - center[1];
    const dz = (position.array[i + 2] ?? 0) - center[2];
    radius = Math.max(radius, Math.hypot(dx, dy, dz));
  }

  return {
    aabb: { min, max },
    sphere: { center, radius },
  };
}
