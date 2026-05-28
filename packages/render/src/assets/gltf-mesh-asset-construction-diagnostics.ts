import type { GltfDecodedPrimitiveAccessors } from "./gltf-accessor-decoding.js";
import type { GltfMeshAssetConstructionDiagnostic } from "./gltf-mesh-asset-construction-types.js";

export function createGltfMeshAssetDiagnostic(
  primitive: GltfDecodedPrimitiveAccessors,
  code: string,
  input: Omit<
    GltfMeshAssetConstructionDiagnostic,
    "code" | "severity" | "meshHandleKey" | "meshIndex" | "primitiveIndex"
  >,
): GltfMeshAssetConstructionDiagnostic {
  return {
    code,
    severity: "error",
    meshHandleKey: primitive.meshHandleKey,
    meshIndex: primitive.meshIndex,
    primitiveIndex: primitive.primitiveIndex,
    ...input,
  };
}

export function gltfMeshAssetIdFromRegisteredHandleKey(
  handleKey: string,
): string {
  const prefix = "mesh:";
  return handleKey.startsWith(prefix)
    ? handleKey.slice(prefix.length)
    : handleKey;
}

export function gltfMeshPrimitiveRequestKey(
  meshIndex: number,
  primitiveIndex: number,
): string {
  return `${meshIndex}:${primitiveIndex}`;
}
