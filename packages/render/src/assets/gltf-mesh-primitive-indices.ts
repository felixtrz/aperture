import type {
  GltfMeshPrimitiveIndexReference,
  GltfMeshPrimitiveMappingDiagnostic,
} from "./gltf-mesh-primitive-types.js";
import { toDiagnosticValue } from "./gltf-mesh-primitive-utils.js";
import { validGltfAccessorReference } from "./gltf-mesh-primitive-accessor-reference.js";

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

  if (!validGltfAccessorReference(input.root, accessorIndex)) {
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
