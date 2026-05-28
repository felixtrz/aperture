import type {
  GltfMeshPrimitiveAttributeReference,
  GltfMeshPrimitiveAttributeReferences,
  GltfMeshPrimitiveAttributeSemantic,
  GltfMeshPrimitiveIndexReference,
  GltfMeshPrimitiveMappingDiagnostic,
} from "./gltf-mesh-primitive-types.js";
import { isRecord, toDiagnosticValue } from "./gltf-mesh-primitive-utils.js";

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

  const position = mapAttributeReference(input, attributes, "POSITION");
  if (position === null) {
    return null;
  }

  const normal = mapAttributeReference(input, attributes, "NORMAL");
  const texcoord0 = mapAttributeReference(input, attributes, "TEXCOORD_0");
  const texcoord1 = mapAttributeReference(input, attributes, "TEXCOORD_1");
  const tangent = mapAttributeReference(input, attributes, "TANGENT");
  const color0 = mapAttributeReference(input, attributes, "COLOR_0");
  const joints0 = mapAttributeReference(input, attributes, "JOINTS_0");
  const weights0 = mapAttributeReference(input, attributes, "WEIGHTS_0");
  const morphTargets = mapMorphTargetAttributeReferences(input);
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

export function mapGltfMeshPrimitiveIndexReference(input: {
  readonly root: Record<string, unknown>;
  readonly primitive: Record<string, unknown>;
  readonly meshIndex: number;
  readonly primitiveIndex: number;
  readonly diagnostics: GltfMeshPrimitiveMappingDiagnostic[];
}): GltfMeshPrimitiveIndexReference | null {
  const accessorIndex = input.primitive.indices;
  if (accessorIndex === undefined) {
    return null;
  }

  if (!validAccessorReference(input.root, accessorIndex)) {
    input.diagnostics.push({
      layer: "mesh",
      code: "gltfMesh.invalidAccessorReference",
      severity: "error",
      meshIndex: input.meshIndex,
      primitiveIndex: input.primitiveIndex,
      field: `meshes[${input.meshIndex}].primitives[${input.primitiveIndex}].indices`,
      value: toDiagnosticValue(accessorIndex),
      ...(typeof accessorIndex === "number" ? { accessorIndex } : {}),
      message: `glTF mesh ${input.meshIndex} primitive ${input.primitiveIndex} has an invalid indices accessor reference.`,
    });
    return null;
  }

  return { accessorIndex };
}

function mapMorphTargetAttributeReferences(input: {
  readonly root: Record<string, unknown>;
  readonly primitive: Record<string, unknown>;
  readonly meshIndex: number;
  readonly primitiveIndex: number;
  readonly diagnostics: GltfMeshPrimitiveMappingDiagnostic[];
}): {
  readonly morphPosition0: GltfMeshPrimitiveAttributeReference | null;
  readonly morphNormal0: GltfMeshPrimitiveAttributeReference | null;
  readonly morphPosition1: GltfMeshPrimitiveAttributeReference | null;
  readonly morphNormal1: GltfMeshPrimitiveAttributeReference | null;
} {
  const targets = Array.isArray(input.primitive.targets)
    ? input.primitive.targets
    : [];
  const target0 = isRecord(targets[0]) ? targets[0] : {};
  const target1 = isRecord(targets[1]) ? targets[1] : {};

  return {
    morphPosition0: mapTargetAttributeReference(
      input,
      target0,
      "POSITION",
      "MORPH_POSITION_0",
    ),
    morphNormal0: mapTargetAttributeReference(
      input,
      target0,
      "NORMAL",
      "MORPH_NORMAL_0",
    ),
    morphPosition1: mapTargetAttributeReference(
      input,
      target1,
      "POSITION",
      "MORPH_POSITION_1",
    ),
    morphNormal1: mapTargetAttributeReference(
      input,
      target1,
      "NORMAL",
      "MORPH_NORMAL_1",
    ),
  };
}

function mapTargetAttributeReference(
  input: {
    readonly root: Record<string, unknown>;
    readonly meshIndex: number;
    readonly primitiveIndex: number;
    readonly diagnostics: GltfMeshPrimitiveMappingDiagnostic[];
  },
  target: Record<string, unknown>,
  targetSemantic: "POSITION" | "NORMAL",
  semantic: GltfMeshPrimitiveAttributeSemantic,
): GltfMeshPrimitiveAttributeReference | null {
  const accessorIndex = target[targetSemantic];

  if (accessorIndex === undefined) {
    return null;
  }

  if (!validAccessorReference(input.root, accessorIndex)) {
    input.diagnostics.push({
      layer: "mesh",
      code: "gltfMesh.invalidAccessorReference",
      severity: "error",
      meshIndex: input.meshIndex,
      primitiveIndex: input.primitiveIndex,
      attribute: semantic,
      field: `meshes[${input.meshIndex}].primitives[${input.primitiveIndex}].targets.${targetSemantic}`,
      value: toDiagnosticValue(accessorIndex),
      ...(typeof accessorIndex === "number" ? { accessorIndex } : {}),
      message: `glTF mesh ${input.meshIndex} primitive ${input.primitiveIndex} has an invalid ${semantic} accessor reference.`,
    });
    return null;
  }

  return { semantic, accessorIndex };
}

function mapAttributeReference(
  input: {
    readonly root: Record<string, unknown>;
    readonly meshIndex: number;
    readonly primitiveIndex: number;
    readonly diagnostics: GltfMeshPrimitiveMappingDiagnostic[];
  },
  attributes: Record<string, unknown>,
  semantic: GltfMeshPrimitiveAttributeSemantic,
): GltfMeshPrimitiveAttributeReference | null {
  const accessorIndex = attributes[semantic];
  if (accessorIndex === undefined) {
    if (semantic === "POSITION") {
      input.diagnostics.push({
        layer: "mesh",
        code: "gltfMesh.missingPosition",
        severity: "error",
        meshIndex: input.meshIndex,
        primitiveIndex: input.primitiveIndex,
        attribute: semantic,
        field: `meshes[${input.meshIndex}].primitives[${input.primitiveIndex}].attributes.POSITION`,
        message: `glTF mesh ${input.meshIndex} primitive ${input.primitiveIndex} must include a POSITION attribute.`,
      });
    }
    return null;
  }

  if (!validAccessorReference(input.root, accessorIndex)) {
    input.diagnostics.push({
      layer: "mesh",
      code: "gltfMesh.invalidAccessorReference",
      severity: "error",
      meshIndex: input.meshIndex,
      primitiveIndex: input.primitiveIndex,
      attribute: semantic,
      field: `meshes[${input.meshIndex}].primitives[${input.primitiveIndex}].attributes.${semantic}`,
      value: toDiagnosticValue(accessorIndex),
      ...(typeof accessorIndex === "number" ? { accessorIndex } : {}),
      message: `glTF mesh ${input.meshIndex} primitive ${input.primitiveIndex} has an invalid ${semantic} accessor reference.`,
    });
    return null;
  }

  return { semantic, accessorIndex };
}

function validAccessorReference(
  root: Record<string, unknown>,
  accessorIndex: unknown,
): accessorIndex is number {
  return (
    Number.isInteger(accessorIndex) &&
    typeof accessorIndex === "number" &&
    accessorIndex >= 0 &&
    Array.isArray(root.accessors) &&
    accessorIndex < root.accessors.length
  );
}
