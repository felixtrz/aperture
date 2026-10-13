import { type AssetRegistry } from "@aperture-engine/simulation";
import type { CustomWgslMaterialAsset, PreparedCustomWgslMaterial } from "@aperture-engine/render";
import type { CustomWgslMaterialGpuResource } from "../materials/custom-wgsl/custom-wgsl-material.js";
import { type AppTextureSamplerResourceCache, type AppTextureSamplerResourceReuseReport, type WebGpuAppTextureSamplerPreparationDiagnostic } from "./app-texture-sampler-resources.js";
export interface CustomWgslAppTextureSamplerBindingResources {
    readonly valid: boolean;
    readonly resources: readonly CustomWgslMaterialGpuResource[];
    readonly textureKeys: readonly string[];
    readonly samplerKeys: readonly string[];
    readonly diagnostics: readonly (WebGpuAppTextureSamplerPreparationDiagnostic | CustomWgslAppTextureSamplerBindingDiagnostic)[];
}
interface CustomWgslAppTextureSamplerBindingDiagnostic {
    readonly code: "webGpuApp.customWgslBindingNotPrepared";
    readonly message: string;
    readonly binding: number;
}
export declare function prepareCustomWgslAppTextureSamplerBindingResources(options: {
    readonly assets: AssetRegistry;
    readonly device: unknown;
    readonly cache: AppTextureSamplerResourceCache;
    readonly reuse: AppTextureSamplerResourceReuseReport;
    readonly source: CustomWgslMaterialAsset;
    readonly material: PreparedCustomWgslMaterial;
}): CustomWgslAppTextureSamplerBindingResources;
export {};
//# sourceMappingURL=custom-wgsl-texture-sampler-resources.d.ts.map