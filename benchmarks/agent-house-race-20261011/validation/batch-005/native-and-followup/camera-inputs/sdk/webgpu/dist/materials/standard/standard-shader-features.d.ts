export declare const STANDARD_DIRECT_LIGHT_SHADER_VARIANT = "direct-lit-metallic-roughness";
export declare const STANDARD_BASE_COLOR_TEXTURE_SHADER_VARIANT = "direct-lit-metallic-roughness-base-color-texture";
export declare const STANDARD_METALLIC_ROUGHNESS_TEXTURE_SHADER_VARIANT = "direct-lit-metallic-roughness-texture";
export declare const STANDARD_BASE_COLOR_METALLIC_ROUGHNESS_TEXTURE_SHADER_VARIANT = "direct-lit-metallic-roughness-base-color-metallic-roughness-texture";
export declare const STANDARD_SHADOW_MAP_SHADER_VARIANT = "direct-lit-metallic-roughness-shadow-map";
export declare const STANDARD_CASCADED_SHADOW_MAP_SHADER_VARIANT = "direct-lit-metallic-roughness-cascaded-shadow-map";
export declare const STANDARD_POINT_SHADOW_MAP_SHADER_VARIANT = "direct-lit-metallic-roughness-point-shadow-map";
export declare const STANDARD_MULTI_SHADOW_MAP_SHADER_VARIANT = "direct-lit-metallic-roughness-multi-shadow-map";
export declare const STANDARD_DIFFUSE_IBL_SHADER_VARIANT = "direct-lit-metallic-roughness-diffuse-ibl";
export declare const STANDARD_SPECULAR_IBL_PROOF_SHADER_VARIANT = "direct-lit-metallic-roughness-diffuse-specular-ibl-proof";
export declare const STANDARD_CLEARCOAT_SHADER_VARIANT = "direct-lit-metallic-roughness-clearcoat";
export declare const STANDARD_TRANSMISSION_SHADER_VARIANT = "direct-lit-metallic-roughness-transmission";
export declare const STANDARD_SHEEN_SHADER_VARIANT = "direct-lit-metallic-roughness-sheen";
export declare const STANDARD_IRIDESCENCE_SHADER_VARIANT = "direct-lit-metallic-roughness-iridescence";
export interface StandardTextureShaderFeatures {
    readonly baseColorTexture: boolean;
    readonly metallicRoughnessTexture: boolean;
    readonly clearcoatTexture?: boolean;
    readonly clearcoatRoughnessTexture?: boolean;
    readonly transmissionTexture?: boolean;
    readonly sheenColorTexture?: boolean;
    readonly sheenRoughnessTexture?: boolean;
    readonly iridescenceTexture?: boolean;
    readonly iridescenceThicknessTexture?: boolean;
    readonly normalTexture: boolean;
    readonly occlusionTexture: boolean;
    readonly emissiveTexture: boolean;
    readonly shadowMap?: boolean;
    readonly cascadedShadowMap?: boolean;
    readonly pointShadowMap?: boolean;
    /** Automatic single directional map plus per-light point array. */
    readonly directionalPointShadowMap?: boolean;
    /**
     * Single-2D spot shadow receiver. Reuses the directional shadow-map bindings
     * (a spot is a perspective single-2D shadow), but additionally injects the
     * shadow factor into the spot light block. Distinguishes a spot-only frame
     * from a directional one (both use the `shadowMap` binding) so the spot block
     * is only shadowed when a spot shadow was actually baked.
     */
    readonly spotShadowMap?: boolean;
    readonly iblDiffuse?: boolean;
    readonly iblSpecularProof?: boolean;
    readonly iblSpecularBrdf?: boolean;
    readonly texCoord1?: boolean;
    readonly vertexColor?: boolean;
    readonly instanceTint?: boolean;
    readonly skinned?: boolean;
    readonly morphed?: boolean;
    readonly clearcoat?: boolean;
    readonly transmission?: boolean;
    readonly sheen?: boolean;
    readonly iridescence?: boolean;
    readonly fogLinear?: boolean;
    readonly fogExp?: boolean;
    readonly fogExp2?: boolean;
    readonly clusteredLocalLights?: boolean;
    readonly clusteredLocalLightCookies?: boolean;
    readonly clusteredLocalLightShadowCookies?: boolean;
    readonly clusteredLocalLightArrayCookies?: boolean;
    readonly clusteredLocalLightCubeCookies?: boolean;
    readonly clusteredLocalLightArrayShadows?: boolean;
    readonly clusteredLocalLightPointArrayShadows?: boolean;
}
export declare const STANDARD_MATERIAL_MVP_LIGHTING_MODEL: {
    readonly variant: "direct-lit-metallic-roughness";
    readonly brdf: "Cook-Torrance GGX direct lighting with Schlick Fresnel and Lambert diffuse.";
    readonly supported: readonly ["baseColorFactor", "baseColorTexture", "metallicFactor", "roughnessFactor", "metallicRoughnessTexture", "normalTexture", "emissiveFactor", "emissiveTexture", "occlusionTexture", "ambientLight", "directionalLight", "rectAreaLight", "diskAreaLight", "sphereAreaLight", "clearcoatFactor", "clearcoatTexture", "clearcoatRoughnessFactor", "clearcoatRoughnessTexture", "transmissionFactor", "transmissionTexture", "sheenColorFactor", "sheenColorTexture", "sheenRoughnessFactor", "sheenRoughnessTexture", "iridescenceFactor", "iridescenceTexture", "iridescenceThicknessTexture", "iridescenceIor", "iridescenceThicknessRange", "linearFog", "exponentialFog", "exponentialSquaredFog"];
    readonly deferred: readonly ["imageBasedLighting", "shadows"];
};
export declare function createStandardTextureShaderVariantKey(features: StandardTextureShaderFeatures): string;
export declare function standardTextureFeatureNames(features: StandardTextureShaderFeatures): string[];
export declare function hasStandardFogFeature(features: StandardTextureShaderFeatures): boolean;
export declare function hasStandardGenericOnlyFeature(features: StandardTextureShaderFeatures): boolean;
export declare function hasAnyStandardTextureFeature(features: StandardTextureShaderFeatures): boolean;
//# sourceMappingURL=standard-shader-features.d.ts.map