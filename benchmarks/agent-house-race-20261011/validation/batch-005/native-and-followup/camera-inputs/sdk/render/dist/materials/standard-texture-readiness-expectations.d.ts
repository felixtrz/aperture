export declare const STANDARD_TEXTURE_EXPECTATIONS: readonly [{
    readonly field: "baseColorTexture";
    readonly semantic: "base-color";
    readonly colorSpaces: readonly ["srgb"];
}, {
    readonly field: "metallicRoughnessTexture";
    readonly semantic: "metallic-roughness";
    readonly colorSpaces: readonly ["linear", "data"];
}, {
    readonly field: "clearcoatTexture";
    readonly semantic: "data";
    readonly colorSpaces: readonly ["linear", "data"];
}, {
    readonly field: "clearcoatRoughnessTexture";
    readonly semantic: "clearcoat-roughness";
    readonly colorSpaces: readonly ["linear", "data"];
}, {
    readonly field: "transmissionTexture";
    readonly semantic: "data";
    readonly colorSpaces: readonly ["linear", "data"];
}, {
    readonly field: "sheenColorTexture";
    readonly semantic: "sheen-color";
    readonly colorSpaces: readonly ["srgb"];
}, {
    readonly field: "sheenRoughnessTexture";
    readonly semantic: "sheen-roughness";
    readonly colorSpaces: readonly ["linear", "data"];
}, {
    readonly field: "iridescenceTexture";
    readonly semantic: "iridescence";
    readonly colorSpaces: readonly ["linear", "data"];
}, {
    readonly field: "iridescenceThicknessTexture";
    readonly semantic: "iridescence-thickness";
    readonly colorSpaces: readonly ["linear", "data"];
}, {
    readonly field: "normalTexture";
    readonly semantic: "normal";
    readonly colorSpaces: readonly ["linear", "data"];
}, {
    readonly field: "occlusionTexture";
    readonly semantic: "occlusion";
    readonly colorSpaces: readonly ["linear", "data"];
}, {
    readonly field: "emissiveTexture";
    readonly semantic: "emissive";
    readonly colorSpaces: readonly ["srgb"];
}];
export declare const SUPPORTED_STANDARD_TEXCOORDS: readonly [0, 1];
export declare function isSupportedStandardTexCoord(texCoord: number): boolean;
//# sourceMappingURL=standard-texture-readiness-expectations.d.ts.map