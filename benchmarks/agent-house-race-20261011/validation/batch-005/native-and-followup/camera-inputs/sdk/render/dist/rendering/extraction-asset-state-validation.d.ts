import type { AssetRegistry, Entity, EnvironmentMapHandle, MaterialHandle, SamplerHandle, TextureHandle } from "@aperture-engine/simulation";
import type { SourceMaterialAsset, TextureAsset } from "../materials/index.js";
import type { RenderDiagnostic } from "./snapshot.js";
export declare function validateMaterialTextureDependencies(material: SourceMaterialAsset, materialHandle: MaterialHandle, assets: AssetRegistry, entity: Entity, diagnostics: RenderDiagnostic[]): boolean;
export declare function validateTextureAssetState(handle: TextureHandle, assets: AssetRegistry, entity: Entity, diagnostics: RenderDiagnostic[]): boolean;
export declare function validateSkyboxTextureAssetState(handle: TextureHandle, assets: AssetRegistry, entity: Entity, diagnostics: RenderDiagnostic[]): TextureAsset | null;
export declare function validateSamplerAssetState(handle: SamplerHandle, assets: AssetRegistry, entity: Entity, diagnostics: RenderDiagnostic[]): boolean;
export declare function validateEnvironmentMapAssetState(handle: EnvironmentMapHandle, assets: AssetRegistry, entity: Entity, diagnostics: RenderDiagnostic[]): boolean;
//# sourceMappingURL=extraction-asset-state-validation.d.ts.map