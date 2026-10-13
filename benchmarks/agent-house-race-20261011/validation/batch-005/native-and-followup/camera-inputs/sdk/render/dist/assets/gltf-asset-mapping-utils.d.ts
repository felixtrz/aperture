import type { GltfMaterialTextureBindingResolverDiagnostic, GltfMaterialTextureSlot, GltfTextureMappingDiagnostic } from "../materials/index.js";
import type { GltfAssetMappingDiagnostic, GltfAssetMappingOptions } from "./gltf-asset-mapping-types.js";
export declare function textureDiagnosticToResolverDiagnostic(diagnostic: GltfTextureMappingDiagnostic): GltfMaterialTextureBindingResolverDiagnostic;
export declare function textureDiagnosticToAssetDiagnostic(diagnostic: GltfTextureMappingDiagnostic): GltfAssetMappingDiagnostic;
export declare function collectMaterialTextureSlots(material: unknown): readonly {
    readonly slot: GltfMaterialTextureSlot;
    readonly textureIndex: number;
}[];
export declare function textureReportKey(textureIndex: number, slot: GltfMaterialTextureSlot): string;
export declare function plannedHandleKey(options: GltfAssetMappingOptions, kind: "material" | "sampler" | "texture", index: number, slot?: GltfMaterialTextureSlot): string;
export declare function samplerSourceForTexture(root: Record<string, unknown>, textureIndex: number): Record<string, unknown> | null;
export declare function arrayField(root: Record<string, unknown>, field: string): readonly unknown[];
export declare function stringArray(value: unknown): readonly string[];
export declare function isRecord(value: unknown): value is Record<string, unknown>;
//# sourceMappingURL=gltf-asset-mapping-utils.d.ts.map