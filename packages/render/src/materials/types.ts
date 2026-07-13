import type {
  BufferHandle,
  RenderTargetHandle,
  SamplerHandle,
  ShaderHandle,
  TextureHandle,
} from "@aperture-engine/simulation";
import type { Color } from "@aperture-engine/simulation";
import type { InstanceAttributeLayoutInput } from "./instance-attributes.js";

export type MaterialKind = "unlit" | "matcap" | "standard" | "debug-normal";
export const BUILT_IN_MATERIAL_KINDS = [
  "unlit",
  "matcap",
  "standard",
  "debug-normal",
] as const satisfies readonly MaterialKind[];

export type MaterialFamilyKey = MaterialKind | (string & {});
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

export interface TextureMipLevelSourceData {
  readonly bytes: Uint8Array;
  readonly bytesPerRow: number;
  readonly rowsPerImage?: number;
  readonly width: number;
  readonly height: number;
}

export interface TextureSourceData {
  readonly bytes: Uint8Array;
  readonly bytesPerRow: number;
  readonly rowsPerImage?: number;
  readonly mipLevels?: readonly TextureMipLevelSourceData[];
}

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };
export type JsonRecord = { readonly [key: string]: JsonValue };

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
  // Refractive transmission volume (KHR_materials_ior + KHR_materials_volume).
  // `ior` drives the Snell refraction vector; `thickness` scales the refracted
  // ray length; `attenuationColor`/`attenuationDistance` drive Beer-Lambert
  // absorption through the volume. `attenuationDistance` of 0 is the JSON-safe
  // sentinel for "no absorption" (the glTF default is +Infinity, which is not
  // JSON-serializable); a bounded volume uses a positive distance.
  readonly ior: number;
  readonly thickness: number;
  readonly attenuationColor: readonly [number, number, number];
  readonly attenuationDistance: number;
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

export type SourceMaterialAsset = MaterialAsset | CustomWgslMaterialAsset;

export type CustomWgslShaderStage = "vertex" | "fragment";

/**
 * Lighting integration mode for a custom WGSL material. `"unlit"` (the
 * default when absent) keeps today's contract: groups 0-2 bound, group(3)
 * reserved and untouched. `"lit"` opts into the renderer-owned group(3) lit
 * contract (`APERTURE_LIT_WGSL_HEADER` is prepended to the module; user code
 * must not declare `@group(3)` itself). Only `"lit"` participates in
 * validation and the pipeline key — absent/`"unlit"` materials keep
 * byte-identical keys.
 */
export type CustomWgslMaterialLighting = "unlit" | "lit";

export type CustomWgslBindingKind =
  | "uniform-buffer"
  | "storage-buffer"
  | "texture"
  | "sampler";

export interface WgslShaderAsset {
  readonly kind: "shader";
  readonly language: "wgsl";
  readonly label: string;
  readonly source: string;
  readonly url?: string;
  readonly virtualPath?: string;
}

export type CustomWgslShaderRef =
  | {
      readonly kind: "shader-asset";
      readonly handle: ShaderHandle;
    }
  | {
      readonly kind: "inline-wgsl";
      readonly code: string;
      readonly virtualPath?: string;
    };

/** @public */
export type CustomWgslUniformFieldType =
  | "float32"
  | "Float32"
  | "int32"
  | "Int32"
  | "uint32"
  | "Uint32"
  | "vec2"
  | "Vec2"
  | "vec3"
  | "Vec3"
  | "vec4"
  | "Vec4"
  | "Color"
  | "mat4x4";

/** @public */
export interface CustomWgslUniformField {
  readonly type: CustomWgslUniformFieldType;
  readonly default?: JsonPrimitive | readonly number[];
}

export interface BaseCustomWgslBindingDeclaration {
  readonly name: string;
  readonly binding: number;
  readonly kind: CustomWgslBindingKind;
  readonly visibility: readonly CustomWgslShaderStage[];
  readonly label?: string;
}

export interface CustomWgslUniformBindingDeclaration extends BaseCustomWgslBindingDeclaration {
  readonly kind: "uniform-buffer";
  readonly fields: Readonly<Record<string, CustomWgslUniformField>>;
  readonly values?: Readonly<Record<string, JsonPrimitive | readonly number[]>>;
  readonly runtimeUniformKey?: string;
}

/** @public */
export interface CustomWgslStorageBindingDeclaration extends BaseCustomWgslBindingDeclaration {
  readonly kind: "storage-buffer";
  readonly access?: "read" | "read-write";
  readonly resourceKey?: string;
  /**
   * Renderer-independent buffer source asset realized as the read-only
   * storage binding. Required for the app route: without a handle the
   * binding cannot resolve a GPU buffer.
   */
  readonly buffer?: BufferHandle;
  /**
   * Keyed dynamic-update channel (mirror of `runtimeUniformKey`): when set,
   * extracted `RuntimeBuffer` packets with this key write ranges of the
   * realized GPU buffer via `queue.writeBuffer` with zero pipeline rebuilds.
   */
  readonly runtimeBufferKey?: string;
}

/** @public */
export interface CustomWgslTextureBindingDeclaration extends BaseCustomWgslBindingDeclaration {
  readonly kind: "texture";
  readonly texture: TextureHandle;
  readonly sampleType?:
    | "float"
    | "unfilterable-float"
    | "depth"
    | "sint"
    | "uint";
  readonly viewDimension?: "2d" | "cube";
  readonly multisampled?: boolean;
}

/** @public */
export interface CustomWgslSamplerBindingDeclaration extends BaseCustomWgslBindingDeclaration {
  readonly kind: "sampler";
  readonly sampler: SamplerHandle;
  readonly samplerType?: "filtering" | "non-filtering" | "comparison";
}

export type CustomWgslBindingDeclaration =
  | CustomWgslUniformBindingDeclaration
  | CustomWgslStorageBindingDeclaration
  | CustomWgslTextureBindingDeclaration
  | CustomWgslSamplerBindingDeclaration;

export type CustomMaterialDependencyDeclaration =
  | {
      readonly kind: "shader";
      readonly handle: ShaderHandle;
    }
  | {
      readonly kind: "texture";
      readonly handle: TextureHandle;
    }
  | {
      readonly kind: "sampler";
      readonly handle: SamplerHandle;
    }
  | {
      readonly kind: "buffer";
      readonly handle: BufferHandle;
    };

export interface CustomWgslMaterialPipelineKeyInput {
  readonly features: readonly string[];
  readonly specialization: Readonly<Record<string, string | number | boolean>>;
}

/** @public */
export interface CustomWgslMaterialEntryPoints {
  readonly vertex: string;
  readonly fragment: string;
  /**
   * Optional shadow-caster vertex entry point (the analog of three.js
   * `customDepthMaterial`/`castShadowPositionNode`). When present, meshes using
   * this material render into shadow maps through a per-material depth-only
   * caster pipeline whose vertex stage is compiled from the SAME WGSL module
   * using this entry point, so vertex displacement applied by the main vertex
   * entry can be mirrored into the shadow silhouette.
   *
   * Caster bind contract (mirrors the built-in position-only caster):
   * - `@group(0) @binding(0) var<uniform>` — a struct whose first member is
   *   the active shadow pass's light `viewProjection: mat4x4<f32>`.
   * - `@group(0) @binding(1) var<storage, read> array<mat4x4<f32>>` — caster
   *   world transforms, indexed by `@builtin(instance_index)`.
   * - `@group(1)` — reserved (bound empty by the renderer).
   * - `@group(2)` — this material's own bindings (uniform/texture/sampler/
   *   storage), exactly as declared for the main pass; bindings the caster
   *   entry point reads must include `"vertex"` visibility.
   * - Vertex input: `@location(0) position: vec3f` (the mesh POSITION stream
   *   only) plus `@builtin(instance_index)`; the output is
   *   `@builtin(position) vec4f` (no fragment stage runs).
   */
  readonly shadowVertex?: string;
}

/**
 * One declared color target of an MRT custom material (B3). Index in the
 * `colorTargets` array is the fragment `@location` the target binds to:
 * - Index 0 is the pass color the camera renders into and must declare
 *   `format: "swapchain"` (the sentinel for "the pass's own color format")
 *   with no `renderTarget` pairing.
 * - Every index >= 1 must pair a facade `RenderTargetAsset` handle whose
 *   realized color texture the frame attaches at that location; the declared
 *   format must match the target's realized format at render time.
 * `writeMask` defaults to `"all"`. Declarations are data-only (handles, not
 * textures) and participate in the pipeline key ONLY when present, so
 * materials without `colorTargets` keep byte-identical keys.
 */
export interface CustomWgslColorTargetDeclaration {
  readonly format:
    | "swapchain"
    | "rgba8unorm"
    | "rgba8unorm-srgb"
    | "bgra8unorm"
    | "bgra8unorm-srgb"
    | "rgba16float";
  readonly writeMask?: ColorWriteMask;
  readonly renderTarget?: RenderTargetHandle;
}

export interface CustomWgslMaterialAsset {
  readonly sourceDiscriminator: "custom-material-source";
  readonly shaderLanguage: "wgsl";
  readonly familyKey: MaterialFamilyKey;
  readonly label: string;
  readonly shader: CustomWgslShaderRef;
  readonly entryPoints: CustomWgslMaterialEntryPoints;
  /** Opt-in group(3) lit contract; absent means `"unlit"` (see the type). */
  readonly lighting?: CustomWgslMaterialLighting;
  /**
   * MRT declaration (B3): N color targets the fragment entry writes via
   * `@location(0..N-1)`. Absent means the single pass color target.
   */
  readonly colorTargets?: readonly CustomWgslColorTargetDeclaration[];
  readonly renderState: RenderStateDescriptor;
  readonly pipelineKey: CustomWgslMaterialPipelineKeyInput;
  readonly bindings: readonly CustomWgslBindingDeclaration[];
  readonly dependencies: readonly CustomMaterialDependencyDeclaration[];
  readonly instanceAttributes?: InstanceAttributeLayoutInput;
  readonly metadata?: JsonRecord;
}

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
  readonly shaderFamily: MaterialFamilyKey;
  readonly features: readonly string[];
  readonly alphaMode: MaterialAlphaMode;
  readonly cullMode: MaterialCullMode;
  readonly frontFace: MaterialFrontFace;
  readonly depth: DepthStateDescriptor;
  readonly blend: BlendStateDescriptor;
  readonly colorWriteMask: ColorWriteMask;
}
