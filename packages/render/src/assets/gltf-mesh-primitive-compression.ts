import {
  integerField,
  isRecord,
  toDiagnosticValue,
} from "./gltf-mesh-primitive-utils.js";
import type {
  GltfCompressedMeshPrimitiveAttributeReference,
  GltfCompressedMeshPrimitiveReference,
  GltfMeshPrimitiveAttributeReference,
  GltfMeshPrimitiveAttributeReferences,
  GltfMeshPrimitiveMappingDiagnostic,
  GltfMeshPrimitiveMappingOptions,
} from "./gltf-mesh-primitive-types.js";

export function inspectUnsupportedCompression(input: {
  readonly options: GltfMeshPrimitiveMappingOptions;
  readonly primitive: Record<string, unknown>;
  readonly meshIndex: number;
  readonly primitiveIndex: number;
  readonly diagnostics: GltfMeshPrimitiveMappingDiagnostic[];
}): void {
  const extensions = input.primitive.extensions;
  if (!isRecord(extensions)) {
    return;
  }

  const supported = new Set(
    input.options.supportedCompressedPrimitiveExtensions ?? [],
  );
  for (const extensionName of [
    "KHR_draco_mesh_compression",
    "EXT_meshopt_compression",
  ]) {
    if (extensions[extensionName] !== undefined) {
      if (
        extensionName === "KHR_draco_mesh_compression" &&
        supported.has(extensionName)
      ) {
        continue;
      }

      input.diagnostics.push({
        layer: "mesh",
        code: "gltfMesh.unsupportedCompressedPrimitive",
        severity: "error",
        meshIndex: input.meshIndex,
        primitiveIndex: input.primitiveIndex,
        extensionName,
        message: `glTF mesh ${input.meshIndex} primitive ${input.primitiveIndex} uses unsupported compressed primitive extension '${extensionName}'.`,
      });
    }
  }
}

export function mapCompressedPrimitive(
  input: {
    readonly options: GltfMeshPrimitiveMappingOptions;
    readonly root: Record<string, unknown>;
    readonly primitive: Record<string, unknown>;
    readonly meshIndex: number;
    readonly primitiveIndex: number;
    readonly diagnostics: GltfMeshPrimitiveMappingDiagnostic[];
  },
  attributes: GltfMeshPrimitiveAttributeReferences,
): GltfCompressedMeshPrimitiveReference | null {
  const supported = new Set(
    input.options.supportedCompressedPrimitiveExtensions ?? [],
  );
  if (!supported.has("KHR_draco_mesh_compression")) {
    return null;
  }

  const extensions = input.primitive.extensions;
  const extension = isRecord(extensions)
    ? extensions.KHR_draco_mesh_compression
    : undefined;
  if (extension === undefined) {
    return null;
  }

  if (!isRecord(extension)) {
    input.diagnostics.push({
      layer: "mesh",
      code: "gltfMesh.invalidCompressedPrimitive",
      severity: "error",
      meshIndex: input.meshIndex,
      primitiveIndex: input.primitiveIndex,
      extensionName: "KHR_draco_mesh_compression",
      field: `meshes[${input.meshIndex}].primitives[${input.primitiveIndex}].extensions.KHR_draco_mesh_compression`,
      value: toDiagnosticValue(extension),
      message: `glTF mesh ${input.meshIndex} primitive ${input.primitiveIndex} has a malformed KHR_draco_mesh_compression extension object.`,
    });
    return null;
  }

  const bufferView = integerField(extension.bufferView);
  if (
    bufferView === null ||
    bufferView < 0 ||
    !Array.isArray(input.root.bufferViews) ||
    bufferView >= input.root.bufferViews.length
  ) {
    input.diagnostics.push({
      layer: "mesh",
      code: "gltfMesh.invalidCompressedPrimitive",
      severity: "error",
      meshIndex: input.meshIndex,
      primitiveIndex: input.primitiveIndex,
      extensionName: "KHR_draco_mesh_compression",
      field: `meshes[${input.meshIndex}].primitives[${input.primitiveIndex}].extensions.KHR_draco_mesh_compression.bufferView`,
      value: toDiagnosticValue(extension.bufferView),
      message: `glTF mesh ${input.meshIndex} primitive ${input.primitiveIndex} has an invalid Draco bufferView reference.`,
    });
    return null;
  }

  if (!isRecord(extension.attributes)) {
    input.diagnostics.push({
      layer: "mesh",
      code: "gltfMesh.invalidCompressedPrimitive",
      severity: "error",
      meshIndex: input.meshIndex,
      primitiveIndex: input.primitiveIndex,
      extensionName: "KHR_draco_mesh_compression",
      field: `meshes[${input.meshIndex}].primitives[${input.primitiveIndex}].extensions.KHR_draco_mesh_compression.attributes`,
      value: toDiagnosticValue(extension.attributes),
      message: `glTF mesh ${input.meshIndex} primitive ${input.primitiveIndex} must map Draco attribute unique ids by glTF semantic.`,
    });
    return null;
  }

  const compressedAttributes: GltfCompressedMeshPrimitiveAttributeReference[] =
    [];
  for (const attribute of flattenAttributeReferences(attributes)) {
    const uniqueId = integerField(extension.attributes[attribute.semantic]);
    if (uniqueId === null || uniqueId < 0) {
      input.diagnostics.push({
        layer: "mesh",
        code: "gltfMesh.invalidCompressedPrimitive",
        severity: "error",
        meshIndex: input.meshIndex,
        primitiveIndex: input.primitiveIndex,
        extensionName: "KHR_draco_mesh_compression",
        attribute: attribute.semantic,
        field: `meshes[${input.meshIndex}].primitives[${input.primitiveIndex}].extensions.KHR_draco_mesh_compression.attributes.${attribute.semantic}`,
        value: toDiagnosticValue(extension.attributes[attribute.semantic]),
        message: `glTF mesh ${input.meshIndex} primitive ${input.primitiveIndex} is missing a Draco unique attribute id for ${attribute.semantic}.`,
      });
      continue;
    }

    compressedAttributes.push({ semantic: attribute.semantic, uniqueId });
  }

  if (
    compressedAttributes.some((attribute) => attribute.semantic === "POSITION")
  ) {
    return {
      extensionName: "KHR_draco_mesh_compression",
      bufferView,
      attributes: compressedAttributes,
    };
  }

  return null;
}

function flattenAttributeReferences(
  attributes: GltfMeshPrimitiveAttributeReferences,
): readonly GltfMeshPrimitiveAttributeReference[] {
  return [
    attributes.position,
    attributes.normal,
    attributes.texcoord0,
    attributes.texcoord1,
    attributes.tangent,
    attributes.color0,
    attributes.joints0,
    attributes.weights0,
    attributes.morphPosition0,
    attributes.morphNormal0,
    attributes.morphPosition1,
    attributes.morphNormal1,
  ].filter(
    (attribute): attribute is GltfMeshPrimitiveAttributeReference =>
      attribute !== undefined,
  );
}
