import type { StandardTextureShaderFeatures } from "./standard-shader-features.js";
interface StandardIridescenceSamplingOptions {
    readonly textureSample: string | null;
    readonly thicknessTextureSample?: string | null;
}
export declare function applyStandardIridescenceSampling(code: string, options?: StandardIridescenceSamplingOptions): string;
export declare function standardIridescenceMaterialStatements(options?: StandardIridescenceSamplingOptions): string;
export declare function applyStandardClearcoatSampling(code: string, options?: {
    readonly textureSample: string | null;
    readonly roughnessTextureSample?: string | null;
}): string;
export declare function standardClearcoatMaterialStatements(options?: {
    readonly textureSample: string | null;
    readonly roughnessTextureSample?: string | null;
}): string;
export declare function applyStandardSheenSampling(code: string, options: {
    readonly colorTextureSample: string | null;
    readonly roughnessTextureSample: string | null;
}): string;
export declare function standardSheenMaterialStatements(options: {
    readonly colorTextureSample: string | null;
    readonly roughnessTextureSample: string | null;
}): string;
export declare function standardTransmissionColorMutationStatements(options: {
    readonly textureSample: string | null;
}): string;
export declare function applyStandardFogSampling(code: string, features: StandardTextureShaderFeatures): string;
export declare function applyStandardLightArguments(code: string): string;
export {};
//# sourceMappingURL=standard-shader-extension-sampling.d.ts.map