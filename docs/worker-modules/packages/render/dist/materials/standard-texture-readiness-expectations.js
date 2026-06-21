export const STANDARD_TEXTURE_EXPECTATIONS = [
    {
        field: "baseColorTexture",
        semantic: "base-color",
        colorSpaces: ["srgb"],
    },
    {
        field: "metallicRoughnessTexture",
        semantic: "metallic-roughness",
        colorSpaces: ["linear", "data"],
    },
    {
        field: "clearcoatTexture",
        semantic: "data",
        colorSpaces: ["linear", "data"],
    },
    {
        field: "clearcoatRoughnessTexture",
        semantic: "clearcoat-roughness",
        colorSpaces: ["linear", "data"],
    },
    {
        field: "transmissionTexture",
        semantic: "data",
        colorSpaces: ["linear", "data"],
    },
    {
        field: "sheenColorTexture",
        semantic: "sheen-color",
        colorSpaces: ["srgb"],
    },
    {
        field: "sheenRoughnessTexture",
        semantic: "sheen-roughness",
        colorSpaces: ["linear", "data"],
    },
    {
        field: "iridescenceTexture",
        semantic: "iridescence",
        colorSpaces: ["linear", "data"],
    },
    {
        field: "iridescenceThicknessTexture",
        semantic: "iridescence-thickness",
        colorSpaces: ["linear", "data"],
    },
    {
        field: "normalTexture",
        semantic: "normal",
        colorSpaces: ["linear", "data"],
    },
    {
        field: "occlusionTexture",
        semantic: "occlusion",
        colorSpaces: ["linear", "data"],
    },
    {
        field: "emissiveTexture",
        semantic: "emissive",
        colorSpaces: ["srgb"],
    },
];
export const SUPPORTED_STANDARD_TEXCOORDS = [0, 1];
export function isSupportedStandardTexCoord(texCoord) {
    return SUPPORTED_STANDARD_TEXCOORDS.includes(texCoord);
}
//# sourceMappingURL=standard-texture-readiness-expectations.js.map