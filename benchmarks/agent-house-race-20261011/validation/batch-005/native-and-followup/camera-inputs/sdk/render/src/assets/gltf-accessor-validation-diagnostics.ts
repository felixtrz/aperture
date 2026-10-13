import type { GltfPlannedMeshPrimitiveAsset } from "./gltf-mesh-primitive.js";
import type {
  GltfAccessorValidationContext,
  GltfAccessorValidationDiagnostic,
  GltfAccessorValidationDiagnosticSeverity,
  GltfAccessorValidationInput,
} from "./gltf-accessor-validation-types.js";

export function pushAccessorValidationDiagnostic(
  context: GltfAccessorValidationContext,
  primitive: GltfPlannedMeshPrimitiveAsset,
  input: GltfAccessorValidationInput,
  diagnostic: Omit<
    GltfAccessorValidationDiagnostic,
    | "severity"
    | "meshHandleKey"
    | "meshIndex"
    | "primitiveIndex"
    | "semantic"
    | "accessorIndex"
  > & {
    readonly severity?: GltfAccessorValidationDiagnosticSeverity;
  },
): void {
  context.diagnostics.push({
    severity: diagnostic.severity ?? "error",
    meshHandleKey: primitive.registeredHandleKey,
    meshIndex: primitive.meshIndex,
    primitiveIndex: primitive.primitiveIndex,
    semantic: input.semantic,
    accessorIndex: input.accessorIndex,
    ...diagnostic,
  });
}
