import type {
  BufferHandle,
  RenderTargetHandle,
  SamplerHandle,
  ShaderHandle,
  TextureHandle,
  Vec4Like,
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

// E5 adds "3d" (volume textures — the migrated LUT) and "2d-array" (layered
// atlases) to the pre-E5 "2d"/"cube" set. Only surfaces that opt in (a custom
// material texture binding declaring the matching viewDimension) exercise them;
// every 2d/cube asset stays byte-identical.
export type TextureDimension = "2d" | "cube" | "3d" | "2d-array";
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

// D1 (stencil support). The stencil operation applied to a fragment's stored
// stencil value; the WebGPU `GPUStencilOperation` set. three.js analog:
// `Material.stencilFail`/`stencilZFail`/`stencilZPass` (keep/zero/replace/
// invert/incr/decr wrap+clamp).
export type StencilOperation =
  | "keep"
  | "zero"
  | "replace"
  | "invert"
  | "increment-clamp"
  | "decrement-clamp"
  | "increment-wrap"
  | "decrement-wrap";

/**
 * One face's stencil state (front or back). `compare` reuses {@link DepthCompare}
 * (the WebGPU compare-function set); `failOp`/`depthFailOp`/`passOp` mirror
 * three.js `stencilFail`/`stencilZFail`/`stencilZPass`.
 */
export interface StencilFaceStateDescriptor {
  readonly compare: DepthCompare;
  readonly failOp: StencilOperation;
  readonly depthFailOp: StencilOperation;
  readonly passOp: StencilOperation;
}

/**
 * D1: per-material stencil state. PRESENCE on `renderState.stencil` enables
 * stencil (the three.js `stencilWrite: true` gate); absence keeps today's
 * contract byte-for-byte (no stencil pipeline-key token, no depth-stencil
 * format upgrade). `reference` is the dynamic `setStencilReference` value
 * (three.js `stencilRef`); `readMask`/`writeMask` are the compare/write masks
 * (three.js `stencilFuncMask`/`stencilWriteMask`); `front`/`back` carry the
 * per-face compare + operations.
 */
export interface StencilStateDescriptor {
  readonly readMask: number;
  readonly writeMask: number;
  readonly reference: number;
  readonly front: StencilFaceStateDescriptor;
  readonly back: StencilFaceStateDescriptor;
}

export interface RenderStateDescriptor {
  readonly alphaMode: MaterialAlphaMode;
  readonly alphaCutoff: number;
  readonly cullMode: MaterialCullMode;
  readonly frontFace: MaterialFrontFace;
  readonly depth: DepthStateDescriptor;
  readonly blend: BlendStateDescriptor;
  readonly colorWriteMask: ColorWriteMask;
  // D1: absent by default. Present ⇒ stencil is enabled for this material and
  // its view's depth attachment is selected as a stencil-capable format
  // (`depth24plus-stencil8`). Absent keeps byte-identical pipeline keys and the
  // depth-only attachment.
  readonly stencil?: StencilStateDescriptor;
  // D2 (clipping planes): optional per-material world-space clip planes
  // `(nx, ny, nz, d)`; three.js `Material.clippingPlanes` analog. These union
  // with the per-camera planes (see `resolveClipPlanes`) capped at
  // MAX_CLIP_PLANES. Absent keeps the material on the byte-identical no-clip
  // path (the field never participates in the pipeline key). Rendering of
  // per-material planes is applied on top of the per-camera view planes.
  readonly clipPlanes?: readonly Vec4Like[];
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

// D1 dropped "stencil" — per-material stencil state is now supported through
// `renderState.stencil`. "custom-shader" remains the one unsupported feature
// flag for built-in materials.
export type MaterialUnsupportedFeature = "custom-shader";

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

// "compute" (C3) is used only by data-described compute kernels
// (ComputeKernelAsset) whose bindings reuse this union; custom MATERIAL binding
// validation still restricts visibility to vertex/fragment, so materials keep
// byte-identical pipeline keys.
export type CustomWgslShaderStage = "vertex" | "fragment" | "compute";

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
export type CustomWgslTextureSampleType =
  | "float"
  | "unfilterable-float"
  | "depth"
  | "sint"
  | "uint";

/** @public */
export type CustomWgslSamplerType =
  | "filtering"
  | "non-filtering"
  | "comparison";

/**
 * Renderer-owned texture the frame binds in place of a source asset (B4,
 * data-only per DECISIONS 0016). `"scene-depth"` binds the frame's stored
 * scene depth attachment (written by the opaque pass, sampled read-only by the
 * transparent draw) as a `texture_depth_2d` — or `texture_depth_multisampled_2d`
 * when `multisampled` is set to match the app's MSAA sample count. A binding
 * with a `source` needs no `texture` handle (and contributes no dependency);
 * one WITHOUT a source keeps the pre-B4 contract (a required `texture`).
 */
export type CustomWgslTextureBindingSource = "scene-depth";

/** @public */
export interface CustomWgslTextureBindingDeclaration extends BaseCustomWgslBindingDeclaration {
  readonly kind: "texture";
  readonly texture?: TextureHandle;
  readonly source?: CustomWgslTextureBindingSource;
  readonly sampleType?: CustomWgslTextureSampleType;
  // E5 extends the B4 "2d"/"cube" set with "3d" (`texture_3d<f32>`) and
  // "2d-array" (`texture_2d_array<f32>`). Non-"2d" values append a `dim:` token
  // to the pipeline key so 2d bindings keep byte-identical keys.
  readonly viewDimension?: "2d" | "cube" | "3d" | "2d-array";
  readonly multisampled?: boolean;
}

/** @public */
export interface CustomWgslSamplerBindingDeclaration extends BaseCustomWgslBindingDeclaration {
  readonly kind: "sampler";
  readonly sampler: SamplerHandle;
  readonly samplerType?: CustomWgslSamplerType;
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

/**
 * Buffer-backed instance-attribute stream (C1): the per-instance vertex data at
 * `@location(6+)` is sourced DIRECTLY from a realized {@link BufferAsset}
 * (zero CPU copies) instead of from CPU-authored `InstanceData` values. The
 * `attributes` layout drives the same instance-step vertex-buffer layout as
 * `defineInstanceAttributes` (slot 1, `stepMode: "instance"`); the `buffer`
 * handle is realized once per handle@version and shared with any storage
 * binding referencing the same buffer, so a compute pass can write it and the
 * draw consumes it the same frame (frame graph orders compute-before-draw).
 *
 * The buffer's element layout must match the declared attributes' packed
 * stride (`attributes` `strideFloats * 4`); rows are indexed by the draw's
 * `firstInstance + instanceIndex` (spawn/packed-transform order). A material
 * sources its instance stream from EITHER `instanceAttributes` (CPU) OR
 * `instanceBuffer` (GPU), never both.
 */
export interface CustomWgslInstanceBufferDeclaration {
  readonly buffer: BufferHandle;
  readonly attributes: InstanceAttributeLayoutInput;
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
   * F3: opt-in group(4) skinning contract. When `true`, the renderer prepends
   * `APERTURE_SKINNED_WGSL_HEADER` (the `apertureSkin(...)` helpers), binds the
   * mesh's joint palette at `@group(4)`, and adds the `JOINTS_0`/`WEIGHTS_0`
   * vertex attributes — so a custom vertex entry point skins without any
   * app-side GPU wiring. Composes with `lighting: "lit"` (group(4) does not
   * collide with the lit group(3)). Absent/`false` keeps byte-identical
   * pipeline keys + vertex layout. The material must be drawn on a mesh with
   * `Skin` data (JOINTS_0/WEIGHTS_0 + a joint palette); drawing it on an
   * un-skinned mesh emits a structured diagnostic, not a device error.
   */
  readonly skinned?: boolean;
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
  /**
   * Buffer-backed instance-attribute stream (C1). Present ⇒ the instance
   * vertex buffer (slot 1) is the realized `instanceBuffer.buffer` asset,
   * consumed zero-copy; mutually exclusive with `instanceAttributes`.
   */
  readonly instanceBuffer?: CustomWgslInstanceBufferDeclaration;
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
  /**
   * Depth comparison function (B4): when set the sampler is a comparison
   * sampler (`sampler_comparison` in WGSL, bound against a `samplerType:
   * "comparison"` layout), sampled with `textureSampleCompare`. Absent for an
   * ordinary filtering/non-filtering sampler.
   */
  readonly compare?: DepthCompare;
}

export type MaterialDiagnosticCode =
  | "material.missingTextureHandle"
  | "material.missingSamplerHandle"
  | "material.invalidAlphaCutoff"
  | "material.unsupportedFeature"
  | "material.invalidTextureColorSpace"
  | "material.invalidTextureColorSpaceFormat"
  | "material.incompatibleRenderState"
  | "material.invalidStencilState"
  | "material.clipPlanesExceedLimit";

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
  // D1: present ⇒ a `stencil:…` feature token is appended to the key so a
  // stencil material gets its own pipeline variant. Absent ⇒ no token, so
  // non-stencil materials keep byte-identical keys.
  readonly stencil?: StencilStateDescriptor;
}
