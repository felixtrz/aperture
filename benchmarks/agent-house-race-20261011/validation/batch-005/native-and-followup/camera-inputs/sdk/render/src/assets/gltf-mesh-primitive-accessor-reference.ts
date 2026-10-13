import type {
  GltfMeshPrimitiveAttributeReference,
  GltfMeshPrimitiveAttributeSemantic,
  GltfMeshPrimitiveMappingDiagnostic,
} from "./gltf-mesh-primitive-types.js";
import { toDiagnosticValue } from "./gltf-mesh-primitive-utils.js";

export interface GltfMeshPrimitiveAccessorReferenceInput {
  readonly root: Record<string, unknown>;
  readonly meshIndex: number;
  readonly primitiveIndex: number;
  readonly diagnostics: GltfMeshPrimitiveMappingDiagnostic[];
}

export function mapGltfMeshPrimitiveAttributeReference(
  input: GltfMeshPrimitiveAccessorReferenceInput,
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

  if (!validGltfAccessorReference(input.root, accessorIndex)) {
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

export function mapGltfMeshPrimitiveTargetAttributeReference(
  input: GltfMeshPrimitiveAccessorReferenceInput,
  target: Record<string, unknown>,
  targetSemantic: "POSITION" | "NORMAL",
  semantic: GltfMeshPrimitiveAttributeSemantic,
): GltfMeshPrimitiveAttributeReference | null {
  const accessorIndex = target[targetSemantic];

  if (accessorIndex === undefined) {
    return null;
  }

  if (!validGltfAccessorReference(input.root, accessorIndex)) {
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

export function validGltfAccessorReference(
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
