import type { GltfMeshPrimitiveAttributeReference } from "./gltf-mesh-primitive-types.js";
import {
  mapGltfMeshPrimitiveTargetAttributeReference,
  type GltfMeshPrimitiveAccessorReferenceInput,
} from "./gltf-mesh-primitive-accessor-reference.js";
import { isRecord } from "./gltf-mesh-primitive-utils.js";

export interface GltfMeshPrimitiveMorphTargetAttributeReferences {
  readonly morphPosition0: GltfMeshPrimitiveAttributeReference | null;
  readonly morphNormal0: GltfMeshPrimitiveAttributeReference | null;
  readonly morphPosition1: GltfMeshPrimitiveAttributeReference | null;
  readonly morphNormal1: GltfMeshPrimitiveAttributeReference | null;
}

export function mapGltfMeshPrimitiveMorphTargetAttributeReferences(
  input: GltfMeshPrimitiveAccessorReferenceInput & {
    readonly primitive: Record<string, unknown>;
  },
): GltfMeshPrimitiveMorphTargetAttributeReferences {
  const targets = Array.isArray(input.primitive.targets)
    ? input.primitive.targets
    : [];
  const target0 = isRecord(targets[0]) ? targets[0] : {};
  const target1 = isRecord(targets[1]) ? targets[1] : {};

  return {
    morphPosition0: mapGltfMeshPrimitiveTargetAttributeReference(
      input,
      target0,
      "POSITION",
      "MORPH_POSITION_0",
    ),
    morphNormal0: mapGltfMeshPrimitiveTargetAttributeReference(
      input,
      target0,
      "NORMAL",
      "MORPH_NORMAL_0",
    ),
    morphPosition1: mapGltfMeshPrimitiveTargetAttributeReference(
      input,
      target1,
      "POSITION",
      "MORPH_POSITION_1",
    ),
    morphNormal1: mapGltfMeshPrimitiveTargetAttributeReference(
      input,
      target1,
      "NORMAL",
      "MORPH_NORMAL_1",
    ),
  };
}
