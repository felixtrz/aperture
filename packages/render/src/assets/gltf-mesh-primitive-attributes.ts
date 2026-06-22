import type {
  GltfMeshPrimitiveAttributeReferences,
  GltfMeshPrimitiveMappingDiagnostic,
} from "./gltf-mesh-primitive-types.js";
import { mapGltfMeshPrimitiveAttributeReference } from "./gltf-mesh-primitive-accessor-reference.js";
import { mapGltfMeshPrimitiveMorphTargetAttributeReferences } from "./gltf-mesh-primitive-morph-targets.js";
import { isRecord } from "./gltf-mesh-primitive-utils.js";

export { mapGltfMeshPrimitiveIndexReference } from "./gltf-mesh-primitive-indices.js";

export function mapGltfMeshPrimitiveAttributes(input: {
  readonly root: Record<string, unknown>;
  readonly primitive: Record<string, unknown>;
  readonly meshIndex: number;
  readonly primitiveIndex: number;
  readonly diagnostics: GltfMeshPrimitiveMappingDiagnostic[];
}): GltfMeshPrimitiveAttributeReferences | null {
  const attributes = input.primitive.attributes;
  if (!isRecord(attributes)) {
    input.diagnostics.push({
      layer: "mesh",
      code: "gltfMesh.missingPosition",
      severity: "error",
      meshIndex: input.meshIndex,
      primitiveIndex: input.primitiveIndex,
      field: `meshes[${input.meshIndex}].primitives[${input.primitiveIndex}].attributes.POSITION`,
      message: `glTF mesh ${input.meshIndex} primitive ${input.primitiveIndex} must include a POSITION attribute.`,
    });
    return null;
  }

  const position = mapGltfMeshPrimitiveAttributeReference(
    input,
    attributes,
    "POSITION",
  );
  if (position === null) {
    return null;
  }

  const normal = mapGltfMeshPrimitiveAttributeReference(
    input,
    attributes,
    "NORMAL",
  );
  const texcoord0 = mapGltfMeshPrimitiveAttributeReference(
    input,
    attributes,
    "TEXCOORD_0",
  );
  const texcoord1 = mapGltfMeshPrimitiveAttributeReference(
    input,
    attributes,
    "TEXCOORD_1",
  );
  const tangent = mapGltfMeshPrimitiveAttributeReference(
    input,
    attributes,
    "TANGENT",
  );
  const color0 = mapGltfMeshPrimitiveAttributeReference(
    input,
    attributes,
    "COLOR_0",
  );
  const joints0 = mapGltfMeshPrimitiveAttributeReference(
    input,
    attributes,
    "JOINTS_0",
  );
  const weights0 = mapGltfMeshPrimitiveAttributeReference(
    input,
    attributes,
    "WEIGHTS_0",
  );
  const morphTargets =
    mapGltfMeshPrimitiveMorphTargetAttributeReferences(input);
  const hasOptionalAttributeError = input.diagnostics.some(
    (diagnostic) =>
      diagnostic.severity === "error" &&
      diagnostic.meshIndex === input.meshIndex &&
      diagnostic.primitiveIndex === input.primitiveIndex &&
      (diagnostic.attribute === "NORMAL" ||
        diagnostic.attribute === "TEXCOORD_0" ||
        diagnostic.attribute === "TEXCOORD_1" ||
        diagnostic.attribute === "TANGENT" ||
        diagnostic.attribute === "COLOR_0" ||
        diagnostic.attribute === "JOINTS_0" ||
        diagnostic.attribute === "WEIGHTS_0" ||
        diagnostic.attribute === "MORPH_POSITION_0" ||
        diagnostic.attribute === "MORPH_NORMAL_0" ||
        diagnostic.attribute === "MORPH_POSITION_1" ||
        diagnostic.attribute === "MORPH_NORMAL_1"),
  );
  if (hasOptionalAttributeError) {
    return null;
  }

  return {
    position,
    ...(normal === null ? {} : { normal }),
    ...(texcoord0 === null ? {} : { texcoord0 }),
    ...(texcoord1 === null ? {} : { texcoord1 }),
    ...(tangent === null ? {} : { tangent }),
    ...(color0 === null ? {} : { color0 }),
    ...(joints0 === null ? {} : { joints0 }),
    ...(weights0 === null ? {} : { weights0 }),
    ...(morphTargets.morphPosition0 === null
      ? {}
      : { morphPosition0: morphTargets.morphPosition0 }),
    ...(morphTargets.morphNormal0 === null
      ? {}
      : { morphNormal0: morphTargets.morphNormal0 }),
    ...(morphTargets.morphPosition1 === null
      ? {}
      : { morphPosition1: morphTargets.morphPosition1 }),
    ...(morphTargets.morphNormal1 === null
      ? {}
      : { morphNormal1: morphTargets.morphNormal1 }),
  };
}
