import { type StandardTextureShaderFeatures } from "./standard-shader-features.js";
export declare function usesCompactClusteredLocalMultiShadow(features: StandardTextureShaderFeatures): boolean;
export declare function standardTextureVariantComment(features: StandardTextureShaderFeatures): string;
export declare function standardTextureUvExpression(features: StandardTextureShaderFeatures, field: "baseColor" | "metallicRoughness" | "clearcoat" | "clearcoatRoughness" | "transmission" | "sheenColor" | "sheenRoughness" | "iridescence" | "iridescenceThickness" | "normal" | "occlusion" | "emissive"): string;
//# sourceMappingURL=standard-shader-variant-utils.d.ts.map