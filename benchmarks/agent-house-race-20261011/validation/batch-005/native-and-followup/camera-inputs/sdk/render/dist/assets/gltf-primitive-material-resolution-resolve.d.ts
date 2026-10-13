import type { GltfPlannedMeshPrimitiveAsset } from "./gltf-mesh-primitive.js";
import type { GltfSourceAssetRegistrationReport } from "./gltf-source-registration.js";
import type { GltfResolvedPrimitiveMaterial, GltfUnresolvedPrimitiveMaterial } from "./gltf-primitive-material-resolution-types.js";
type PrimitiveMaterialResolution = {
    readonly kind: "resolved";
    readonly value: GltfResolvedPrimitiveMaterial;
} | {
    readonly kind: "unresolved";
    readonly value: GltfUnresolvedPrimitiveMaterial;
};
export interface PrimitiveMaterialResolutionContext {
    readonly registrationReport: GltfSourceAssetRegistrationReport;
    readonly availableMaterialHandleKeys: ReadonlySet<string>;
    readonly defaultMaterialHandleKey?: string;
    readonly keyPrefix: string;
}
export declare function resolvePrimitiveMaterial(context: PrimitiveMaterialResolutionContext, primitive: GltfPlannedMeshPrimitiveAsset): PrimitiveMaterialResolution;
export {};
//# sourceMappingURL=gltf-primitive-material-resolution-resolve.d.ts.map