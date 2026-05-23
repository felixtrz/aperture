import type { SamplerHandle, TextureHandle } from "@aperture-engine/simulation";
import type { Color } from "@aperture-engine/simulation";

export type MaterialKind = "unlit" | "matcap" | "standard" | "debug-normal";
export type MaterialAlphaMode = "opaque" | "mask" | "blend";
export type MaterialCullMode = "back" | "front" | "none";
export type MaterialFrontFace = "ccw" | "cw";
export type DepthCompare =
  | "never"
  | "less"
  | "equal"
  | "less-equal"
  | "greater"
  | "not-equal"
  | "greater-equal"
  | "always";
export type BlendPreset = "none" | "alpha" | "premultiplied-alpha" | "additive";
export type ColorWriteMask = "all" | "none" | "rgb" | "alpha";

export type TextureDimension = "2d" | "cube";
export type TextureColorSpace = "srgb" | "linear" | "data";
export type TextureSemantic =
  | "base-color"
  | "emissive"
  | "clearcoat-roughness"
  | "sheen-color"
  | "sheen-roughness"
  | "iridescence"
  | "iridescence-thickness"
  | "metallic-roughness"
  | "normal"
  | "occlusion"
  | "data";
export type TextureFormat =
  | "rgba8unorm"
  | "rgba8unorm-srgb"
  | "bgra8unorm"
  | "bgra8unorm-srgb"
  | "r8unorm"
  | "rg8unorm"
  | "rgba16float"
  | "bc1-rgba-unorm"
  | "bc1-rgba-unorm-srgb"
  | "bc3-rgba-unorm"
  | "bc3-rgba-unorm-srgb"
  | "bc7-rgba-unorm"
  | "bc7-rgba-unorm-srgb"
  | "etc2-rgb8unorm"
  | "etc2-rgb8unorm-srgb"
  | "etc2-rgba8unorm"
  | "etc2-rgba8unorm-srgb"
  | "astc-4x4-unorm"
  | "astc-4x4-unorm-srgb";
export type TextureUsage = "sampled" | "copy-dst" | "render-attachment";
export type SamplerAddressMode = "clamp-to-edge" | "repeat" | "mirror-repeat";
export type SamplerFilterMode = "nearest" | "linear";

export interface DepthStateDescriptor {
  readonly test: boolean;
  readonly write: boolean;
  readonly compare: DepthCompare;
  readonly bias?: number;
  readonly biasSlopeScale?: number;
}

export interface BlendStateDescriptor {
  readonly preset: BlendPreset;
}

export interface RenderStateDescriptor {
  readonly alphaMode: MaterialAlphaMode;
  readonly alphaCutoff: number;
  readonly cullMode: MaterialCullMode;
  readonly frontFace: MaterialFrontFace;
  readonly depth: DepthStateDescriptor;
  readonly blend: BlendStateDescriptor;
  readonly colorWriteMask: ColorWriteMask;
}

export interface MaterialTextureBinding {
  readonly texture: TextureHandle | null;
  readonly sampler: SamplerHandle | null;
  readonly texCoord?: number;
  readonly transform?: MaterialTextureTransform;
}

export interface MaterialTextureTransform {
  readonly offset?: readonly [number, number];
  readonly scale?: readonly [number, number];
  readonly rotation?: number;
}

export interface TextureSourceData {
  readonly bytes: Uint8Array;
  readonly bytesPerRow: number;
  readonly rowsPerImage?: number;
}

export interface BaseMaterialAsset {
  readonly kind: MaterialKind;
  readonly label: string;
  readonly renderState: RenderStateDescriptor;
  readonly unsupportedFeatures: readonly MaterialUnsupportedFeature[];
}

export type MaterialUnsupportedFeature = "stencil" | "custom-shader";

export interface UnlitMaterialAsset extends BaseMaterialAsset {
  readonly kind: "unlit";
  readonly baseColorFactor: Color;
  readonly baseColorTexture: MaterialTextureBinding | null;
}

export interface MatcapMaterialAsset extends BaseMaterialAsset {
  readonly kind: "matcap";
  readonly baseColorFactor: Color;
  readonly matcapTexture: MaterialTextureBinding | null;
}

export interface StandardMaterialAsset extends BaseMaterialAsset {
  readonly kind: "standard";
  readonly baseColorFactor: Color;
  readonly baseColorTexture: MaterialTextureBinding | null;
  readonly metallicFactor: number;
  readonly roughnessFactor: number;
  readonly clearcoatFactor: number;
  readonly clearcoatTexture: MaterialTextureBinding | null;
  readonly clearcoatRoughnessFactor: number;
  readonly clearcoatRoughnessTexture: MaterialTextureBinding | null;
  readonly transmissionFactor: number;
  readonly transmissionTexture: MaterialTextureBinding | null;
  readonly sheenColorFactor: readonly [number, number, number];
  readonly sheenColorTexture: MaterialTextureBinding | null;
  readonly sheenRoughnessFactor: number;
  readonly sheenRoughnessTexture: MaterialTextureBinding | null;
  readonly iridescenceFactor: number;
  readonly iridescenceTexture: MaterialTextureBinding | null;
  readonly iridescenceThicknessTexture: MaterialTextureBinding | null;
  readonly iridescenceIor: number;
  readonly iridescenceThicknessMinimum: number;
  readonly iridescenceThicknessMaximum: number;
  readonly metallicRoughnessTexture: MaterialTextureBinding | null;
  readonly normalTexture: MaterialTextureBinding | null;
  readonly normalScale: number;
  readonly occlusionTexture: MaterialTextureBinding | null;
  readonly occlusionStrength: number;
  readonly emissiveFactor: readonly [number, number, number];
  readonly emissiveTexture: MaterialTextureBinding | null;
}

export interface DebugNormalMaterialAsset extends BaseMaterialAsset {
  readonly kind: "debug-normal";
}

export type MaterialAsset =
  | UnlitMaterialAsset
  | MatcapMaterialAsset
  | StandardMaterialAsset
  | DebugNormalMaterialAsset;

export interface TextureAsset {
  readonly kind: "texture";
  readonly label: string;
  readonly dimension: TextureDimension;
  readonly width: number;
  readonly height: number;
  readonly depthOrLayers: number;
  readonly format: TextureFormat;
  readonly colorSpace: TextureColorSpace;
  readonly semantic: TextureSemantic;
  readonly mipLevelCount: number;
  readonly usage: readonly TextureUsage[];
  readonly sourceData?: TextureSourceData;
}

export interface SamplerAsset {
  readonly kind: "sampler";
  readonly label: string;
  readonly addressModeU: SamplerAddressMode;
  readonly addressModeV: SamplerAddressMode;
  readonly addressModeW: SamplerAddressMode;
  readonly magFilter: SamplerFilterMode;
  readonly minFilter: SamplerFilterMode;
  readonly mipmapFilter: SamplerFilterMode;
  readonly lodMinClamp: number;
  readonly lodMaxClamp: number;
  readonly maxAnisotropy: number;
}

export type MaterialDiagnosticCode =
  | "material.missingTextureHandle"
  | "material.missingSamplerHandle"
  | "material.invalidAlphaCutoff"
  | "material.unsupportedFeature"
  | "material.invalidTextureColorSpace"
  | "material.invalidTextureColorSpaceFormat"
  | "material.incompatibleRenderState";

export interface MaterialValidationDiagnostic {
  readonly code: MaterialDiagnosticCode;
  readonly message: string;
  readonly field?: string;
}

export interface MaterialValidationReport {
  readonly valid: boolean;
  readonly diagnostics: readonly MaterialValidationDiagnostic[];
}

export interface MaterialPipelineKeyInput {
  readonly shaderFamily: MaterialKind;
  readonly features: readonly string[];
  readonly alphaMode: MaterialAlphaMode;
  readonly cullMode: MaterialCullMode;
  readonly frontFace: MaterialFrontFace;
  readonly depth: DepthStateDescriptor;
  readonly blend: BlendStateDescriptor;
  readonly colorWriteMask: ColorWriteMask;
}
