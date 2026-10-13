import type { Vec3Like, Vec4Like } from "@aperture-engine/simulation";
import type { DebugNormalMaterialAsset, CustomWgslMaterialAsset, CustomWgslMaterialPipelineKeyInput, MaterialUnsupportedFeature, MatcapMaterialAsset, RenderStateDescriptor, SamplerAsset, StandardMaterialAsset, TextureAsset, UnlitMaterialAsset, WgslShaderAsset } from "./types.js";
export declare function createDefaultRenderState(overrides?: Partial<RenderStateDescriptor>): RenderStateDescriptor;
export declare function createUnlitMaterialAsset(input?: Partial<Omit<UnlitMaterialAsset, "kind" | "label" | "renderState" | "baseColorFactor">> & {
    readonly label?: string;
    readonly renderState?: Partial<RenderStateDescriptor>;
    readonly baseColorFactor?: Vec4Like;
}): UnlitMaterialAsset;
export declare function createMatcapMaterialAsset(input?: Partial<Omit<MatcapMaterialAsset, "kind" | "label" | "renderState" | "baseColorFactor">> & {
    readonly label?: string;
    readonly renderState?: Partial<RenderStateDescriptor>;
    readonly baseColorFactor?: Vec4Like;
}): MatcapMaterialAsset;
export declare function createStandardMaterialAsset(input?: Partial<Omit<StandardMaterialAsset, "kind" | "label" | "renderState" | "baseColorFactor">> & {
    readonly label?: string;
    readonly renderState?: Partial<RenderStateDescriptor>;
    readonly baseColorFactor?: Vec4Like;
}): StandardMaterialAsset;
export interface StandardMaterialPatch {
    readonly baseColorFactor?: Vec4Like;
    readonly renderState?: Partial<RenderStateDescriptor>;
    readonly metallicFactor?: number;
    readonly roughnessFactor?: number;
    readonly emissiveFactor?: Vec3Like;
    readonly occlusionStrength?: number;
    readonly normalScale?: number;
    readonly ior?: number;
    readonly transmissionFactor?: number;
    readonly thickness?: number;
    readonly attenuationColor?: Vec3Like;
    readonly attenuationDistance?: number;
    readonly sheenColorFactor?: Vec3Like;
    readonly sheenRoughnessFactor?: number;
    readonly iridescenceFactor?: number;
    readonly label?: string;
}
export interface UnlitMaterialPatch {
    readonly baseColorFactor?: Vec4Like;
    readonly renderState?: Partial<RenderStateDescriptor>;
    readonly label?: string;
}
export interface MatcapMaterialPatch {
    readonly baseColorFactor?: Vec4Like;
    readonly renderState?: Partial<RenderStateDescriptor>;
    readonly label?: string;
}
export declare function patchStandardMaterial(prev: StandardMaterialAsset, patch: StandardMaterialPatch): StandardMaterialAsset;
export declare function patchUnlitMaterial(prev: UnlitMaterialAsset, patch: UnlitMaterialPatch): UnlitMaterialAsset;
export declare function patchMatcapMaterial(prev: MatcapMaterialAsset, patch: MatcapMaterialPatch): MatcapMaterialAsset;
export declare function createDebugNormalMaterialAsset(input?: {
    readonly label?: string;
    readonly renderState?: Partial<RenderStateDescriptor>;
    readonly unsupportedFeatures?: readonly MaterialUnsupportedFeature[];
}): DebugNormalMaterialAsset;
export declare function createTextureAsset(input: Omit<TextureAsset, "kind" | "depthOrLayers" | "mipLevelCount" | "usage"> & Partial<Pick<TextureAsset, "depthOrLayers" | "mipLevelCount" | "usage">>): TextureAsset;
export declare function createSamplerAsset(input?: Partial<Omit<SamplerAsset, "kind" | "label">> & {
    readonly label?: string;
}): SamplerAsset;
export declare function createWgslShaderAsset(input: {
    readonly label?: string;
    readonly source: string;
    readonly url?: string;
    readonly virtualPath?: string;
}): WgslShaderAsset;
export declare function createCustomWgslMaterialAsset(input: Omit<CustomWgslMaterialAsset, "sourceDiscriminator" | "shaderLanguage" | "renderState" | "pipelineKey" | "bindings" | "dependencies"> & {
    readonly renderState?: Partial<RenderStateDescriptor>;
    readonly pipelineKey?: Partial<CustomWgslMaterialPipelineKeyInput>;
    readonly bindings?: CustomWgslMaterialAsset["bindings"];
    readonly dependencies?: CustomWgslMaterialAsset["dependencies"];
}): CustomWgslMaterialAsset;
//# sourceMappingURL=factories.d.ts.map