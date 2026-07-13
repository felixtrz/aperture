import { vec4 } from "@aperture-engine/simulation";
import type { Vec3Like, Vec4, Vec4Like } from "@aperture-engine/simulation";
import type {
  DebugNormalMaterialAsset,
  CustomMaterialDependencyDeclaration,
  CustomWgslMaterialAsset,
  CustomWgslMaterialPipelineKeyInput,
  CustomWgslShaderRef,
  DepthCompare,
  MaterialUnsupportedFeature,
  MatcapMaterialAsset,
  RenderStateDescriptor,
  SamplerAsset,
  StandardMaterialAsset,
  StencilFaceStateDescriptor,
  StencilOperation,
  StencilStateDescriptor,
  TextureAsset,
  UnlitMaterialAsset,
  WgslShaderAsset,
} from "./types.js";

export function createDefaultRenderState(
  overrides: Partial<RenderStateDescriptor> = {},
): RenderStateDescriptor {
  return {
    alphaMode: overrides.alphaMode ?? "opaque",
    alphaCutoff: overrides.alphaCutoff ?? 0.5,
    cullMode: overrides.cullMode ?? "back",
    frontFace: overrides.frontFace ?? "ccw",
    depth: overrides.depth ?? {
      test: true,
      write: true,
      compare: "less",
    },
    blend: overrides.blend ?? { preset: "none" },
    colorWriteMask: overrides.colorWriteMask ?? "all",
    // D1: stencil is present ONLY when authored, so the default render state
    // object stays byte-identical (absent ⇒ no pipeline-key token, depth-only
    // attachment).
    ...(overrides.stencil === undefined ? {} : { stencil: overrides.stencil }),
    // D2: per-material clip planes are present ONLY when authored (never in the
    // pipeline key), so non-clipping materials stay byte-identical.
    ...(overrides.clipPlanes === undefined
      ? {}
      : { clipPlanes: overrides.clipPlanes }),
  };
}

// D1: the WebGPU defaults for a stencil face (a functional no-op) and masks
// (0xFFFFFFFF read/write, reference 0). three.js uses the same all-pass keep
// default when `stencilWrite` is first enabled.
const STENCIL_DEFAULT_MASK = 0xffffffff;

const DEFAULT_STENCIL_FACE: StencilFaceStateDescriptor = {
  compare: "always",
  failOp: "keep",
  depthFailOp: "keep",
  passOp: "keep",
};

/** @public */
export interface StencilFaceStateInput {
  readonly compare?: DepthCompare;
  readonly failOp?: StencilOperation;
  readonly depthFailOp?: StencilOperation;
  readonly passOp?: StencilOperation;
}

/** @public */
export interface StencilStateInput {
  readonly reference?: number;
  readonly readMask?: number;
  readonly writeMask?: number;
  // Shorthands applied to BOTH faces unless a per-face override is given.
  readonly compare?: DepthCompare;
  readonly failOp?: StencilOperation;
  readonly depthFailOp?: StencilOperation;
  readonly passOp?: StencilOperation;
  readonly front?: StencilFaceStateInput;
  readonly back?: StencilFaceStateInput;
}

/**
 * D1: build a fully-defaulted {@link StencilStateDescriptor} from ergonomic,
 * three.js-shaped input. Face shorthands (`compare`/`failOp`/`depthFailOp`/
 * `passOp`) apply to both faces; `front`/`back` override per face. Masks
 * default to 0xFFFFFFFF and the reference to 0 (the WebGPU/three.js defaults).
 * Non-finite masks/reference are clamped to unsigned 32-bit integers so the
 * pipeline-key token is deterministic.
 */
export function createStencilState(
  input: StencilStateInput = {},
): StencilStateDescriptor {
  const shared: StencilFaceStateInput = {
    ...(input.compare === undefined ? {} : { compare: input.compare }),
    ...(input.failOp === undefined ? {} : { failOp: input.failOp }),
    ...(input.depthFailOp === undefined
      ? {}
      : { depthFailOp: input.depthFailOp }),
    ...(input.passOp === undefined ? {} : { passOp: input.passOp }),
  };

  return {
    readMask: normalizeStencilMask(input.readMask, STENCIL_DEFAULT_MASK),
    writeMask: normalizeStencilMask(input.writeMask, STENCIL_DEFAULT_MASK),
    reference: normalizeStencilMask(input.reference, 0),
    front: stencilFace(shared, input.front),
    back: stencilFace(shared, input.back),
  };
}

function stencilFace(
  shared: StencilFaceStateInput,
  face: StencilFaceStateInput | undefined,
): StencilFaceStateDescriptor {
  const merged = { ...shared, ...(face ?? {}) };

  return {
    compare: merged.compare ?? DEFAULT_STENCIL_FACE.compare,
    failOp: merged.failOp ?? DEFAULT_STENCIL_FACE.failOp,
    depthFailOp: merged.depthFailOp ?? DEFAULT_STENCIL_FACE.depthFailOp,
    passOp: merged.passOp ?? DEFAULT_STENCIL_FACE.passOp,
  };
}

function normalizeStencilMask(
  value: number | undefined,
  fallback: number,
): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.trunc(value) >>> 0;
}

export function createUnlitMaterialAsset(
  input: Partial<
    Omit<
      UnlitMaterialAsset,
      "kind" | "label" | "renderState" | "baseColorFactor"
    >
  > & {
    readonly label?: string;
    readonly renderState?: Partial<RenderStateDescriptor>;
    readonly baseColorFactor?: Vec4Like;
  } = {},
): UnlitMaterialAsset {
  return {
    kind: "unlit",
    label: input.label ?? "Unlit Material",
    renderState: createDefaultRenderState(input.renderState),
    baseColorFactor: materialColor(input.baseColorFactor),
    baseColorTexture: input.baseColorTexture ?? null,
    unsupportedFeatures: input.unsupportedFeatures ?? [],
  };
}

export function createMatcapMaterialAsset(
  input: Partial<
    Omit<
      MatcapMaterialAsset,
      "kind" | "label" | "renderState" | "baseColorFactor"
    >
  > & {
    readonly label?: string;
    readonly renderState?: Partial<RenderStateDescriptor>;
    readonly baseColorFactor?: Vec4Like;
  } = {},
): MatcapMaterialAsset {
  return {
    kind: "matcap",
    label: input.label ?? "Matcap Material",
    renderState: createDefaultRenderState(input.renderState),
    baseColorFactor: materialColor(input.baseColorFactor),
    matcapTexture: input.matcapTexture ?? null,
    unsupportedFeatures: input.unsupportedFeatures ?? [],
  };
}

export function createStandardMaterialAsset(
  input: Partial<
    Omit<
      StandardMaterialAsset,
      "kind" | "label" | "renderState" | "baseColorFactor"
    >
  > & {
    readonly label?: string;
    readonly renderState?: Partial<RenderStateDescriptor>;
    readonly baseColorFactor?: Vec4Like;
  } = {},
): StandardMaterialAsset {
  return {
    kind: "standard",
    label: input.label ?? "Standard Material",
    renderState: createDefaultRenderState(input.renderState),
    baseColorFactor: materialColor(input.baseColorFactor),
    baseColorTexture: input.baseColorTexture ?? null,
    metallicFactor: input.metallicFactor ?? 1,
    roughnessFactor: input.roughnessFactor ?? 1,
    clearcoatFactor: input.clearcoatFactor ?? 0,
    clearcoatTexture: input.clearcoatTexture ?? null,
    clearcoatRoughnessFactor: input.clearcoatRoughnessFactor ?? 0,
    clearcoatRoughnessTexture: input.clearcoatRoughnessTexture ?? null,
    transmissionFactor: input.transmissionFactor ?? 0,
    transmissionTexture: input.transmissionTexture ?? null,
    // KHR_materials_ior default is 1.5; KHR_materials_volume defaults to no
    // bounded volume (thickness 0, white attenuation). attenuationDistance uses
    // 0 as the JSON-safe sentinel for "no Beer-Lambert absorption" (the glTF
    // default attenuationDistance is +Infinity, which is not JSON-serializable).
    ior: input.ior ?? 1.5,
    thickness: input.thickness ?? 0,
    attenuationColor: input.attenuationColor ?? [1, 1, 1],
    attenuationDistance: input.attenuationDistance ?? 0,
    sheenColorFactor: input.sheenColorFactor ?? [0, 0, 0],
    sheenColorTexture: input.sheenColorTexture ?? null,
    sheenRoughnessFactor: input.sheenRoughnessFactor ?? 0,
    sheenRoughnessTexture: input.sheenRoughnessTexture ?? null,
    iridescenceFactor: input.iridescenceFactor ?? 0,
    iridescenceTexture: input.iridescenceTexture ?? null,
    iridescenceThicknessTexture: input.iridescenceThicknessTexture ?? null,
    iridescenceIor: input.iridescenceIor ?? 1.3,
    iridescenceThicknessMinimum: input.iridescenceThicknessMinimum ?? 100,
    iridescenceThicknessMaximum: input.iridescenceThicknessMaximum ?? 400,
    metallicRoughnessTexture: input.metallicRoughnessTexture ?? null,
    normalTexture: input.normalTexture ?? null,
    normalScale: input.normalScale ?? 1,
    occlusionTexture: input.occlusionTexture ?? null,
    occlusionStrength: input.occlusionStrength ?? 1,
    emissiveFactor: input.emissiveFactor ?? [0, 0, 0],
    emissiveTexture: input.emissiveTexture ?? null,
    unsupportedFeatures: input.unsupportedFeatures ?? [],
  };
}

// M7-T6: runtime material parameter mutation. Each patch* returns a NEW frozen
// asset with the provided scalar/color uniform fields merged over `prev` — `prev`
// is never mutated. Mutation flows through the versioned asset registry
// (markReady), not GPU state, so the existing version-gated mirror re-prepares
// the GPU material. Patches that stay inside the current shader variant (e.g.
// clearcoatFactor 0.2 -> 0.8) keep the pipeline key stable and never recompile;
// a patch that crosses a variant boundary (e.g. clearcoatFactor 0 -> 0.5 enables
// the clearcoat feature) changes the pipeline key and pays one pipeline build on
// the next prepared frame — still data-only, no live GPU objects involved.

const COLOR4_PATCH_FIELDS = new Set<string>(["baseColorFactor"]);
const VEC3_PATCH_FIELDS = new Set<string>([
  "emissiveFactor",
  "attenuationColor",
  "sheenColorFactor",
]);

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
  readonly clearcoatFactor?: number;
  readonly clearcoatRoughnessFactor?: number;
  readonly iridescenceFactor?: number;
  readonly iridescenceIor?: number;
  readonly iridescenceThicknessMinimum?: number;
  readonly iridescenceThicknessMaximum?: number;
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

function materialColor(value: Vec4Like | undefined): Vec4 {
  if (value === undefined) {
    return vec4(1, 1, 1, 1);
  }

  return vec4(
    readVec4Component(value, 0),
    readVec4Component(value, 1),
    readVec4Component(value, 2),
    readVec4Component(value, 3),
  );
}

function readVec4Component(value: Vec4Like, index: number): number {
  const component = value[index];
  if (component === undefined) {
    throw new RangeError(
      `Material baseColorFactor is missing numeric value at index ${index}.`,
    );
  }
  return component;
}

export function patchStandardMaterial(
  prev: StandardMaterialAsset,
  patch: StandardMaterialPatch,
): StandardMaterialAsset {
  return mergeMaterialAsset(prev, patch);
}

export function patchUnlitMaterial(
  prev: UnlitMaterialAsset,
  patch: UnlitMaterialPatch,
): UnlitMaterialAsset {
  return mergeMaterialAsset(prev, patch);
}

export function patchMatcapMaterial(
  prev: MatcapMaterialAsset,
  patch: MatcapMaterialPatch,
): MatcapMaterialAsset {
  return mergeMaterialAsset(prev, patch);
}

function mergeMaterialAsset<T extends object>(prev: T, patch: object): T {
  const next: Record<string, unknown> = {
    ...(prev as Record<string, unknown>),
  };
  for (const [key, value] of Object.entries(patch)) {
    // Only update fields the asset already has, so a cross-kind patch (e.g. a
    // metallicFactor aimed at an unlit asset) never grows a spurious field.
    if (value === undefined || !(key in prev)) {
      continue;
    }
    if (COLOR4_PATCH_FIELDS.has(key)) {
      next[key] = new Float32Array(value as ArrayLike<number>);
    } else if (VEC3_PATCH_FIELDS.has(key)) {
      next[key] = Array.from(value as ArrayLike<number>);
    } else if (key === "renderState") {
      next[key] = mergeRenderState(
        (prev as { readonly renderState?: RenderStateDescriptor }).renderState,
        value as Partial<RenderStateDescriptor>,
      );
    } else {
      next[key] = value;
    }
  }
  return Object.freeze(next) as T;
}

function mergeRenderState(
  previous: RenderStateDescriptor | undefined,
  patch: Partial<RenderStateDescriptor>,
): RenderStateDescriptor {
  const fallback = createDefaultRenderState();

  return createDefaultRenderState({
    ...(previous ?? fallback),
    ...patch,
    depth:
      patch.depth === undefined
        ? (previous?.depth ?? fallback.depth)
        : { ...(previous?.depth ?? fallback.depth), ...patch.depth },
    blend:
      patch.blend === undefined
        ? (previous?.blend ?? fallback.blend)
        : { ...(previous?.blend ?? fallback.blend), ...patch.blend },
    // D1: a patch's `stencil` replaces the whole sub-state (it is a small,
    // fully-specified descriptor); an absent patch keeps the previous value so
    // non-stencil merges stay byte-identical.
    ...mergeRenderStateStencil(previous?.stencil, patch.stencil),
  });
}

function mergeRenderStateStencil(
  previous: StencilStateDescriptor | undefined,
  patch: StencilStateDescriptor | undefined,
): Pick<Partial<RenderStateDescriptor>, "stencil"> {
  const next = patch ?? previous;

  return next === undefined ? {} : { stencil: next };
}

export function createDebugNormalMaterialAsset(
  input: {
    readonly label?: string;
    readonly renderState?: Partial<RenderStateDescriptor>;
    readonly unsupportedFeatures?: readonly MaterialUnsupportedFeature[];
  } = {},
): DebugNormalMaterialAsset {
  return {
    kind: "debug-normal",
    label: input.label ?? "Debug Normal Material",
    renderState: createDefaultRenderState(input.renderState),
    unsupportedFeatures: input.unsupportedFeatures ?? [],
  };
}

export function createTextureAsset(
  input: Omit<
    TextureAsset,
    "kind" | "depthOrLayers" | "mipLevelCount" | "usage"
  > &
    Partial<Pick<TextureAsset, "depthOrLayers" | "mipLevelCount" | "usage">>,
): TextureAsset {
  return {
    kind: "texture",
    depthOrLayers: input.depthOrLayers ?? 1,
    mipLevelCount: input.mipLevelCount ?? 1,
    usage: input.usage ?? ["sampled"],
    ...input,
  };
}

export function createSamplerAsset(
  input: Partial<Omit<SamplerAsset, "kind" | "label">> & {
    readonly label?: string;
  } = {},
): SamplerAsset {
  return {
    kind: "sampler",
    label: input.label ?? "Sampler",
    addressModeU: input.addressModeU ?? "repeat",
    addressModeV: input.addressModeV ?? "repeat",
    addressModeW: input.addressModeW ?? "repeat",
    magFilter: input.magFilter ?? "linear",
    minFilter: input.minFilter ?? "linear",
    mipmapFilter: input.mipmapFilter ?? "linear",
    lodMinClamp: input.lodMinClamp ?? 0,
    lodMaxClamp: input.lodMaxClamp ?? 32,
    maxAnisotropy: input.maxAnisotropy ?? 1,
    // B4: present only for comparison samplers so ordinary samplers keep a
    // byte-identical asset shape.
    ...(input.compare === undefined ? {} : { compare: input.compare }),
  };
}

export function createWgslShaderAsset(input: {
  readonly label?: string;
  readonly source: string;
  readonly url?: string;
  readonly virtualPath?: string;
}): WgslShaderAsset {
  return {
    kind: "shader",
    language: "wgsl",
    label: input.label ?? input.virtualPath ?? input.url ?? "WGSL Shader",
    source: input.source,
    ...(input.url === undefined ? {} : { url: input.url }),
    ...(input.virtualPath === undefined
      ? {}
      : { virtualPath: input.virtualPath }),
  };
}

export function createCustomWgslMaterialAsset(
  input: Omit<
    CustomWgslMaterialAsset,
    | "sourceDiscriminator"
    | "shaderLanguage"
    | "renderState"
    | "pipelineKey"
    | "bindings"
    | "dependencies"
  > & {
    readonly renderState?: Partial<RenderStateDescriptor>;
    readonly pipelineKey?: Partial<CustomWgslMaterialPipelineKeyInput>;
    readonly bindings?: CustomWgslMaterialAsset["bindings"];
    readonly dependencies?: CustomWgslMaterialAsset["dependencies"];
  },
): CustomWgslMaterialAsset {
  return {
    sourceDiscriminator: "custom-material-source",
    shaderLanguage: "wgsl",
    familyKey: input.familyKey,
    label: input.label,
    shader: input.shader,
    entryPoints: input.entryPoints,
    ...(input.lighting === undefined ? {} : { lighting: input.lighting }),
    ...(input.colorTargets === undefined
      ? {}
      : { colorTargets: input.colorTargets }),
    renderState: createDefaultRenderState(input.renderState),
    pipelineKey: {
      features: input.pipelineKey?.features ?? [],
      specialization: input.pipelineKey?.specialization ?? {},
    },
    bindings: input.bindings ?? [],
    dependencies: input.dependencies ?? customWgslMaterialDependencies(input),
    ...(input.instanceAttributes === undefined
      ? {}
      : { instanceAttributes: input.instanceAttributes }),
    ...(input.instanceBuffer === undefined
      ? {}
      : { instanceBuffer: input.instanceBuffer }),
    ...(input.metadata === undefined ? {} : { metadata: input.metadata }),
  };
}

function customWgslMaterialDependencies(input: {
  readonly shader: CustomWgslShaderRef;
  readonly bindings?: CustomWgslMaterialAsset["bindings"];
  readonly instanceBuffer?: CustomWgslMaterialAsset["instanceBuffer"];
}): readonly CustomMaterialDependencyDeclaration[] {
  const dependencies: CustomMaterialDependencyDeclaration[] = [];

  if (input.shader.kind === "shader-asset") {
    dependencies.push({ kind: "shader", handle: input.shader.handle });
  }

  // C1: a buffer-backed instance stream gates material readiness on its
  // BufferAsset exactly like a storage binding's buffer does.
  if (input.instanceBuffer !== undefined) {
    dependencies.push({
      kind: "buffer",
      handle: input.instanceBuffer.buffer,
    });
  }

  for (const binding of input.bindings ?? []) {
    // B4: a renderer-owned texture source (e.g. scene-depth) carries no
    // handle, so it contributes no readiness dependency — the frame supplies
    // the resource. Only handle-backed texture bindings gate readiness.
    if (binding.kind === "texture" && binding.texture !== undefined) {
      dependencies.push({ kind: "texture", handle: binding.texture });
    }

    if (binding.kind === "sampler") {
      dependencies.push({ kind: "sampler", handle: binding.sampler });
    }

    if (binding.kind === "storage-buffer" && binding.buffer !== undefined) {
      dependencies.push({ kind: "buffer", handle: binding.buffer });
    }
  }

  return dependencies;
}
