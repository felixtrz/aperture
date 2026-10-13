import type { StandardMaterialTextureExpectation } from "./standard-texture-readiness-types.js";

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
] as const satisfies readonly StandardMaterialTextureExpectation[];

export const SUPPORTED_STANDARD_TEXCOORDS = [0, 1] as const;

export function isSupportedStandardTexCoord(texCoord: number): boolean {
  return SUPPORTED_STANDARD_TEXCOORDS.includes(
    texCoord as (typeof SUPPORTED_STANDARD_TEXCOORDS)[number],
  );
}
