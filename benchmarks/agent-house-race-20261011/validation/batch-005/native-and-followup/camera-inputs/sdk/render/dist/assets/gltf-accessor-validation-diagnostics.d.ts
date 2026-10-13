import type { GltfPlannedMeshPrimitiveAsset } from "./gltf-mesh-primitive.js";
import type { GltfAccessorValidationContext, GltfAccessorValidationDiagnostic, GltfAccessorValidationDiagnosticSeverity, GltfAccessorValidationInput } from "./gltf-accessor-validation-types.js";
export declare function pushAccessorValidationDiagnostic(context: GltfAccessorValidationContext, primitive: GltfPlannedMeshPrimitiveAsset, input: GltfAccessorValidationInput, diagnostic: Omit<GltfAccessorValidationDiagnostic, "severity" | "meshHandleKey" | "meshIndex" | "primitiveIndex" | "semantic" | "accessorIndex"> & {
    readonly severity?: GltfAccessorValidationDiagnosticSeverity;
}): void;
//# sourceMappingURL=gltf-accessor-validation-diagnostics.d.ts.map