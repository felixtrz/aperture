// A1 (three.js parity plan): renderer-owned frame resources for the custom
// WGSL lit contract (`lighting: "lit"` -> `@group(3)`). One bind group is
// built per frame from the SAME renderer-owned resources the standard path
// consumes — the packed light buffers (light-packing), the auto-shadow
// frame's directional receiver resources, and the app environment's IBL
// textures — plus always-present fallbacks (zeroed buffer, 1x1 black
// textures) for whatever the frame lacks, so ONE explicit pipeline layout
// works every frame and lit pipelines never rebuild on resource presence.
// The bind group is cached across frames and shared across every lit custom
// material (explicit layouts are shareable; auto layouts are not).

import {
  APERTURE_LIT_CONTRACT_VERSION,
  APERTURE_LIT_IBL_BRDF_LUT_FLAG,
  APERTURE_LIT_IBL_IRRADIANCE_FLAG,
  APERTURE_LIT_IBL_SPECULAR_FLAG,
  PACKED_VIEW_UNIFORM_FLOAT_STRIDE,
  VIEW_FOG_COLOR_FLOAT_OFFSET,
  VIEW_FOG_PARAMS_FLOAT_OFFSET,
  type PackedSnapshotViewUniforms,
  type PreparedCustomWgslMaterial,
  type RenderSnapshot,
} from "@aperture-engine/render";
import {
  createLightBufferDescriptorScratch,
  writeLightBufferDescriptor,
  type LightBufferDescriptorScratch,
} from "../lighting/light-packing.js";
import {
  createCustomWgslLitBindGroupLayoutDescriptor,
  createCustomWgslLitTransformBindGroupLayoutDescriptor,
  createCustomWgslLitViewBindGroupLayoutDescriptor,
  CUSTOM_WGSL_LIT_BIND_GROUP_LAYOUT_KEY,
  type CustomWgslLitBindGroupResource,
} from "../materials/custom-wgsl/custom-wgsl-lit-contract.js";

export type { CustomWgslLitBindGroupResource } from "../materials/custom-wgsl/custom-wgsl-lit-contract.js";
import { createCustomWgslMaterialBindGroupLayoutDescriptor } from "../materials/custom-wgsl/custom-wgsl-material.js";
import { createCustomWgslSkinnedTransformBindGroupLayoutDescriptor } from "../materials/custom-wgsl/custom-wgsl-skinning-contract.js";
import type {
  StandardFrameIblResources,
  StandardFrameShadowReceiverResources,
} from "../materials/standard/standard-frame-resources.js";

export type CustomWgslLitDiagnosticCode =
  | "customWgslMaterial.litContractUnavailable"
  | "customWgslMaterial.litResourceCreationFailed"
  | "customWgslMaterial.litBindGroupCreationFailed";

export interface CustomWgslLitDiagnostic {
  readonly code: CustomWgslLitDiagnosticCode;
  readonly severity: "error";
  readonly message: string;
}

export interface CustomWgslLitReuseCounters {
  litBindGroupsCreated: number;
  litBindGroupsReused: number;
  dynamicBufferWrites: number;
}

export interface CustomWgslLitDeviceLike {
  createBindGroupLayout?: (descriptor: unknown) => unknown;
  createPipelineLayout?: (descriptor: unknown) => unknown;
  createBindGroup?: (descriptor: {
    readonly label: string;
    readonly layout: unknown;
    readonly entries: readonly {
      readonly binding: number;
      readonly resource: unknown;
    }[];
  }) => unknown;
  createBuffer?: (descriptor: unknown) => unknown;
  createTexture?: (descriptor: unknown) => {
    createView?: (descriptor?: unknown) => unknown;
  };
  createSampler?: (descriptor: unknown) => unknown;
  queue?: {
    writeBuffer?: (
      buffer: unknown,
      bufferOffset: number,
      data: ArrayBufferLike | ArrayBufferView,
      dataOffset?: number,
      size?: number,
    ) => void;
  };
}

interface CustomWgslLitLayoutResources {
  readonly litLayout: unknown;
  readonly viewLayout: unknown;
  readonly transformLayout: unknown;
  /**
   * F3: the group(1) transforms layout WITH the joint palette (@binding 1)
   * added, used as the explicit pipeline layout's group(1) for a lit+skinned
   * material (created lazily on first need so lit-only frames stay
   * byte-identical). The palette rides an extra binding in the transforms group
   * rather than a new group, so the explicit pipeline layout stays 4 groups.
   */
  skinnedTransformLayout: unknown | null;
  /** Explicit group(2) layouts keyed by material bindGroupLayout.resourceKey. */
  readonly materialLayouts: Map<string, unknown>;
  /** Explicit pipeline layouts keyed by material bindGroupLayout.resourceKey. */
  readonly pipelineLayouts: Map<string, unknown>;
}

interface CustomWgslLitFallbackResources {
  readonly storageBuffer: unknown;
  readonly depthTextureView: unknown;
  readonly comparisonSampler: unknown;
  readonly cubeTextureView: unknown;
  readonly lutTextureView: unknown;
  readonly filteringSampler: unknown;
}

interface CustomWgslLitGrowableBuffer {
  buffer: unknown;
  byteCapacity: number;
}

export interface CustomWgslLitFrameCache {
  layouts: CustomWgslLitLayoutResources | null;
  fallbacks: CustomWgslLitFallbackResources | null;
  readonly lightScratch: LightBufferDescriptorScratch;
  lightFloatBuffer: CustomWgslLitGrowableBuffer | null;
  lightMetadataBuffer: CustomWgslLitGrowableBuffer | null;
  paramsBuffer: unknown | null;
  readonly paramsData: ArrayBuffer;
  readonly paramsUints: Uint32Array;
  readonly paramsFloats: Float32Array;
  paramsValueKey: string;
  bindGroup: CustomWgslLitBindGroupResource | null;
  readonly bindGroupSignature: unknown[];
  bindGroupGeneration: number;
  readonly entrySignature: unknown[];
  readonly entriesScratch: { binding: number; resource: unknown }[];
}

const LIT_PARAMS_BYTE_LENGTH = 48;
const LIT_PARAMS_FLOAT_COUNT = LIT_PARAMS_BYTE_LENGTH / 4;

export function createCustomWgslLitFrameCache(): CustomWgslLitFrameCache {
  const paramsData = new ArrayBuffer(LIT_PARAMS_BYTE_LENGTH);

  return {
    layouts: null,
    fallbacks: null,
    lightScratch: createLightBufferDescriptorScratch(),
    lightFloatBuffer: null,
    lightMetadataBuffer: null,
    paramsBuffer: null,
    paramsData,
    paramsUints: new Uint32Array(paramsData, 0, 4),
    paramsFloats: new Float32Array(paramsData),
    paramsValueKey: "",
    bindGroup: null,
    bindGroupSignature: [],
    bindGroupGeneration: 0,
    entrySignature: [],
    entriesScratch: [],
  };
}

export interface PrepareCustomWgslLitFrameResourcesResult {
  readonly valid: boolean;
  readonly bindGroup: CustomWgslLitBindGroupResource | null;
  readonly diagnostics: readonly CustomWgslLitDiagnostic[];
}

/**
 * Explicit pipeline layout for a lit custom material: [group(0) view,
 * group(1) transforms, group(2) material bindings, group(3) lit contract].
 * Cached per material bind-group-layout identity; requires the lit layouts
 * (call after a successful prepareCustomWgslLitFrameResources).
 */
export function getOrCreateCustomWgslLitPipelineLayout(options: {
  readonly device: CustomWgslLitDeviceLike;
  readonly cache: CustomWgslLitFrameCache;
  readonly material: PreparedCustomWgslMaterial;
  readonly diagnostics: CustomWgslLitDiagnostic[];
}): unknown | null {
  const layouts = options.cache.layouts;

  if (
    layouts === null ||
    options.device.createBindGroupLayout === undefined ||
    options.device.createPipelineLayout === undefined
  ) {
    options.diagnostics.push({
      code: "customWgslMaterial.litContractUnavailable",
      severity: "error",
      message:
        "Custom WGSL lit pipeline layout creation requires the prepared lit contract layouts (createBindGroupLayout/createPipelineLayout).",
    });
    return null;
  }

  const layoutKey = options.material.bindGroupLayout.resourceKey;
  const cached = layouts.pipelineLayouts.get(layoutKey);

  if (cached !== undefined) {
    return cached;
  }

  try {
    let materialLayout = layouts.materialLayouts.get(layoutKey);

    if (materialLayout === undefined) {
      materialLayout = options.device.createBindGroupLayout(
        createCustomWgslMaterialBindGroupLayoutDescriptor(options.material),
      );
      layouts.materialLayouts.set(layoutKey, materialLayout);
    }

    // F3: a lit+skinned material swaps group(1) for the transforms layout that
    // also carries the joint palette (@binding 1), keeping the explicit pipeline
    // layout at 4 groups [view, transform(+skin), material, lit]. A lit-only
    // material keeps the byte-identical single-binding transform layout.
    let transformLayout = layouts.transformLayout;

    if (options.material.skinned === true) {
      if (layouts.skinnedTransformLayout === null) {
        layouts.skinnedTransformLayout = options.device.createBindGroupLayout(
          createCustomWgslSkinnedTransformBindGroupLayoutDescriptor(),
        );
      }

      transformLayout = layouts.skinnedTransformLayout;
    }

    const pipelineLayout = options.device.createPipelineLayout({
      label: `custom-wgsl/lit/${options.material.materialKey}:pipeline-layout`,
      bindGroupLayouts: [
        layouts.viewLayout,
        transformLayout,
        materialLayout,
        layouts.litLayout,
      ],
    });

    layouts.pipelineLayouts.set(layoutKey, pipelineLayout);
    return pipelineLayout;
  } catch (cause) {
    options.diagnostics.push({
      code: "customWgslMaterial.litResourceCreationFailed",
      severity: "error",
      message: `Failed to create the custom WGSL lit pipeline layout for '${options.material.materialKey}': ${messageFromCause(cause)}`,
    });
    return null;
  }
}

/**
 * Build (or reuse) the shared group(3) lit bind group for this frame. Light
 * data packs into persistent storage buffers (grow-on-demand, dirty-window
 * queue.writeBuffer updates — no steady-state allocations); shadow and IBL
 * entries reference the SAME renderer-owned resources the standard material
 * path binds when present, and renderer-owned fallbacks otherwise.
 */
export function prepareCustomWgslLitFrameResources(options: {
  readonly device: CustomWgslLitDeviceLike;
  readonly snapshot: Pick<RenderSnapshot, "lights" | "transforms"> &
    Partial<Pick<RenderSnapshot, "shadowRequests">>;
  readonly viewUniforms: PackedSnapshotViewUniforms;
  readonly cache: CustomWgslLitFrameCache;
  readonly reuse: CustomWgslLitReuseCounters;
  readonly shadowReceiverResources?:
    | StandardFrameShadowReceiverResources
    | undefined;
  readonly iblResources?: StandardFrameIblResources | undefined;
}): PrepareCustomWgslLitFrameResourcesResult {
  const diagnostics: CustomWgslLitDiagnostic[] = [];
  const { device, cache } = options;

  if (
    device.createBindGroupLayout === undefined ||
    device.createPipelineLayout === undefined ||
    device.createBindGroup === undefined ||
    device.createBuffer === undefined ||
    device.createTexture === undefined ||
    device.createSampler === undefined
  ) {
    return {
      valid: false,
      bindGroup: null,
      diagnostics: [
        {
          code: "customWgslMaterial.litContractUnavailable",
          severity: "error",
          message:
            "WebGPU device cannot realize the custom WGSL lit contract (createBindGroupLayout/createPipelineLayout/createBindGroup/createBuffer/createTexture/createSampler required).",
        },
      ],
    };
  }

  if (cache.layouts === null) {
    try {
      cache.layouts = {
        litLayout: device.createBindGroupLayout(
          createCustomWgslLitBindGroupLayoutDescriptor(),
        ),
        viewLayout: device.createBindGroupLayout(
          createCustomWgslLitViewBindGroupLayoutDescriptor(),
        ),
        transformLayout: device.createBindGroupLayout(
          createCustomWgslLitTransformBindGroupLayoutDescriptor(),
        ),
        skinnedTransformLayout: null,
        materialLayouts: new Map(),
        pipelineLayouts: new Map(),
      };
    } catch (cause) {
      return creationFailure(
        `Failed to create the custom WGSL lit bind group layouts: ${messageFromCause(cause)}`,
      );
    }
  }

  if (cache.fallbacks === null) {
    try {
      cache.fallbacks = createLitFallbackResources(device);
    } catch (cause) {
      return creationFailure(
        `Failed to create the custom WGSL lit fallback resources: ${messageFromCause(cause)}`,
      );
    }
  }

  const fallbacks = cache.fallbacks;
  const descriptor = writeLightBufferDescriptor(
    options.snapshot,
    cache.lightScratch,
    { resourceKey: "custom-wgsl-lit/lights" },
  );
  let lightFloats: unknown = fallbacks.storageBuffer;
  let lightMetadata: unknown = fallbacks.storageBuffer;

  if (descriptor.count > 0) {
    try {
      const floatBuffer = ensureLitGrowableBuffer({
        device,
        cache,
        slot: "lightFloatBuffer",
        label: "custom-wgsl-lit/lights/floats",
        data: descriptor.packed.floats,
        dirty: descriptor.floatsDirty,
        reuse: options.reuse,
      });
      const metadataBuffer = ensureLitGrowableBuffer({
        device,
        cache,
        slot: "lightMetadataBuffer",
        label: "custom-wgsl-lit/lights/metadata",
        data: descriptor.packed.metadata,
        dirty: descriptor.metadataDirty,
        reuse: options.reuse,
      });

      lightFloats = floatBuffer.buffer;
      lightMetadata = metadataBuffer.buffer;
    } catch (cause) {
      return creationFailure(
        `Failed to realize the custom WGSL lit light buffers: ${messageFromCause(cause)}`,
      );
    }
  }

  const shadow = resolveLitShadowResources(options.shadowReceiverResources);
  const ibl = resolveLitIblResources(options.iblResources);

  try {
    writeLitParams({
      device,
      cache,
      lightCount: descriptor.count,
      directionalShadowCount: shadow.present ? 1 : 0,
      iblFlags: ibl.flags,
      viewUniforms: options.viewUniforms,
      reuse: options.reuse,
    });
  } catch (cause) {
    return creationFailure(
      `Failed to realize the custom WGSL lit params uniform: ${messageFromCause(cause)}`,
    );
  }

  const signature = cache.entrySignature;

  signature.length = 0;
  signature.push(
    lightFloats,
    lightMetadata,
    cache.paramsBuffer,
    shadow.matrices ?? fallbacks.storageBuffer,
    shadow.depthView ?? fallbacks.depthTextureView,
    shadow.sampler ?? fallbacks.comparisonSampler,
    ibl.irradianceView ?? fallbacks.cubeTextureView,
    ibl.specularView ?? fallbacks.cubeTextureView,
    ibl.brdfLutView ?? fallbacks.lutTextureView,
    ibl.sampler ?? fallbacks.filteringSampler,
  );

  if (
    cache.bindGroup !== null &&
    signaturesMatch(cache.bindGroupSignature, signature)
  ) {
    options.reuse.litBindGroupsReused += 1;
    return { valid: true, bindGroup: cache.bindGroup, diagnostics };
  }

  const entries = cache.entriesScratch;

  entries.length = 0;

  for (let binding = 0; binding < signature.length; binding += 1) {
    const resource = signature[binding];

    entries.push({
      binding,
      // Buffer bindings (0-3) wrap in { buffer }; texture views and samplers
      // bind directly.
      resource: binding <= 3 ? { buffer: resource } : resource,
    });
  }

  try {
    cache.bindGroupGeneration += 1;

    const bindGroup: CustomWgslLitBindGroupResource = {
      group: 3,
      // The generation suffix makes recreation observable to draw-list and
      // render-bundle caches (mirroring the custom shadow-caster resource).
      resourceKey: `bind-group:custom-wgsl-lit/group-3#${cache.bindGroupGeneration}`,
      layoutKey: CUSTOM_WGSL_LIT_BIND_GROUP_LAYOUT_KEY,
      bindGroup: device.createBindGroup({
        label: CUSTOM_WGSL_LIT_BIND_GROUP_LAYOUT_KEY,
        layout: cache.layouts.litLayout,
        entries,
      }),
      entryResourceKeys: [
        `bind-group:custom-wgsl-lit/group-3#${cache.bindGroupGeneration}`,
      ],
    };

    cache.bindGroup = bindGroup;
    cache.bindGroupSignature.length = 0;
    cache.bindGroupSignature.push(...signature);
    options.reuse.litBindGroupsCreated += 1;

    return { valid: true, bindGroup, diagnostics };
  } catch (cause) {
    return {
      valid: false,
      bindGroup: null,
      diagnostics: [
        ...diagnostics,
        {
          code: "customWgslMaterial.litBindGroupCreationFailed",
          severity: "error",
          message: `Failed to create the custom WGSL lit group(3) bind group: ${messageFromCause(cause)}`,
        },
      ],
    };
  }
}

function creationFailure(
  message: string,
): PrepareCustomWgslLitFrameResourcesResult {
  return {
    valid: false,
    bindGroup: null,
    diagnostics: [
      {
        code: "customWgslMaterial.litResourceCreationFailed",
        severity: "error",
        message,
      },
    ],
  };
}

const BUFFER_USAGE = () =>
  (
    globalThis as {
      GPUBufferUsage?: { STORAGE: number; UNIFORM: number; COPY_DST: number };
    }
  ).GPUBufferUsage ?? { STORAGE: 0x80, UNIFORM: 0x40, COPY_DST: 0x08 };

const TEXTURE_USAGE = () =>
  (
    globalThis as {
      GPUTextureUsage?: { TEXTURE_BINDING: number; RENDER_ATTACHMENT: number };
    }
  ).GPUTextureUsage ?? { TEXTURE_BINDING: 0x04, RENDER_ATTACHMENT: 0x10 };

function createLitFallbackResources(
  device: CustomWgslLitDeviceLike,
): CustomWgslLitFallbackResources {
  const bufferUsage = BUFFER_USAGE();
  const textureUsage = TEXTURE_USAGE();
  // One zeroed 64-byte storage buffer backs every absent storage binding
  // (lights + shadow matrices); apertureLitParams counts are authoritative,
  // so shaders never read meaningful data from it. WebGPU zero-initializes.
  const storageBuffer = device.createBuffer?.({
    label: "custom-wgsl-lit/fallback-storage",
    size: 64,
    usage: bufferUsage.STORAGE,
  });
  const depthTexture = device.createTexture?.({
    label: "custom-wgsl-lit/fallback-shadow-map",
    size: [1, 1, 1],
    format: "depth24plus",
    usage: textureUsage.TEXTURE_BINDING | textureUsage.RENDER_ATTACHMENT,
  });
  const cubeTexture = device.createTexture?.({
    label: "custom-wgsl-lit/fallback-ibl-cube",
    size: [1, 1, 6],
    format: "rgba8unorm",
    usage: textureUsage.TEXTURE_BINDING,
  });
  const lutTexture = device.createTexture?.({
    label: "custom-wgsl-lit/fallback-brdf-lut",
    size: [1, 1, 1],
    format: "rgba8unorm",
    usage: textureUsage.TEXTURE_BINDING,
  });
  const depthTextureView = depthTexture?.createView?.({
    label: "custom-wgsl-lit/fallback-shadow-map:view",
  });
  const cubeTextureView = cubeTexture?.createView?.({
    label: "custom-wgsl-lit/fallback-ibl-cube:view",
    dimension: "cube",
  });
  const lutTextureView = lutTexture?.createView?.({
    label: "custom-wgsl-lit/fallback-brdf-lut:view",
  });
  const comparisonSampler = device.createSampler?.({
    label: "custom-wgsl-lit/fallback-shadow-sampler",
    compare: "less-equal",
  });
  const filteringSampler = device.createSampler?.({
    label: "custom-wgsl-lit/fallback-ibl-sampler",
    magFilter: "linear",
    minFilter: "linear",
    mipmapFilter: "linear",
  });

  if (
    storageBuffer === undefined ||
    depthTextureView === undefined ||
    cubeTextureView === undefined ||
    lutTextureView === undefined ||
    comparisonSampler === undefined ||
    filteringSampler === undefined
  ) {
    throw new Error(
      "device returned undefined for a lit fallback resource (buffer/texture view/sampler).",
    );
  }

  return {
    storageBuffer,
    depthTextureView,
    comparisonSampler,
    cubeTextureView,
    lutTextureView,
    filteringSampler,
  };
}

function ensureLitGrowableBuffer(input: {
  readonly device: CustomWgslLitDeviceLike;
  readonly cache: CustomWgslLitFrameCache;
  readonly slot: "lightFloatBuffer" | "lightMetadataBuffer";
  readonly label: string;
  readonly data: Float32Array | Int32Array;
  readonly dirty:
    | { readonly floatOffset: number; readonly floatCount: number }
    | null
    | undefined;
  readonly reuse: CustomWgslLitReuseCounters;
}): CustomWgslLitGrowableBuffer {
  const cache = input.cache;
  const existing = cache[input.slot];
  const bufferUsage = BUFFER_USAGE();

  if (existing === null || existing.byteCapacity < input.data.byteLength) {
    const buffer = input.device.createBuffer?.({
      label: input.label,
      size: input.data.byteLength,
      usage: bufferUsage.STORAGE | bufferUsage.COPY_DST,
    });

    if (buffer === undefined) {
      throw new Error(
        `device.createBuffer returned undefined (${input.label}).`,
      );
    }

    const grown: CustomWgslLitGrowableBuffer = {
      buffer,
      byteCapacity: input.data.byteLength,
    };

    cache[input.slot] = grown;
    writeLitBufferRange(input.device, buffer, 0, input.data, input.data.length);
    input.reuse.dynamicBufferWrites += 1;
    return grown;
  }

  // Dirty-window upload: null = byte-identical (skip), a range = upload just
  // the changed 4-byte-element window (AI-65 packing history).
  if (input.dirty !== null) {
    const offset = input.dirty?.floatOffset ?? 0;
    const count = input.dirty?.floatCount ?? input.data.length;

    if (count > 0) {
      writeLitBufferRange(
        input.device,
        existing.buffer,
        offset,
        input.data,
        count,
      );
      input.reuse.dynamicBufferWrites += 1;
    }
  }

  return existing;
}

function writeLitBufferRange(
  device: CustomWgslLitDeviceLike,
  buffer: unknown,
  elementOffset: number,
  data: Float32Array | Int32Array,
  elementCount: number,
): void {
  const queue = device.queue;

  if (queue?.writeBuffer === undefined) {
    throw new Error("device.queue.writeBuffer is unavailable.");
  }

  // Invoke through the queue so the real GPUQueue keeps its `this` binding.
  queue.writeBuffer(
    buffer,
    elementOffset * 4,
    data.buffer,
    data.byteOffset + elementOffset * 4,
    elementCount * 4,
  );
}

function writeLitParams(input: {
  readonly device: CustomWgslLitDeviceLike;
  readonly cache: CustomWgslLitFrameCache;
  readonly lightCount: number;
  readonly directionalShadowCount: number;
  readonly iblFlags: number;
  readonly viewUniforms: PackedSnapshotViewUniforms;
  readonly reuse: CustomWgslLitReuseCounters;
}): void {
  const cache = input.cache;
  const bufferUsage = BUFFER_USAGE();

  cache.paramsUints[0] = input.lightCount;
  cache.paramsUints[1] = input.directionalShadowCount;
  cache.paramsUints[2] = input.iblFlags;
  cache.paramsUints[3] = APERTURE_LIT_CONTRACT_VERSION;

  // Fog comes from the FIRST packed view (the custom routes render one view);
  // absent views leave fog disabled (mode 0).
  const packedOffset =
    (input.viewUniforms.views[0]?.packedOffset ?? -1) *
    PACKED_VIEW_UNIFORM_FLOAT_STRIDE;

  for (let index = 0; index < 4; index += 1) {
    cache.paramsFloats[4 + index] =
      packedOffset >= 0
        ? (input.viewUniforms.data[
            packedOffset + VIEW_FOG_COLOR_FLOAT_OFFSET + index
          ] ?? 0)
        : 0;
    cache.paramsFloats[8 + index] =
      packedOffset >= 0
        ? (input.viewUniforms.data[
            packedOffset + VIEW_FOG_PARAMS_FLOAT_OFFSET + index
          ] ?? 0)
        : 0;
  }

  let valueKey = "";

  for (let index = 0; index < LIT_PARAMS_FLOAT_COUNT; index += 1) {
    valueKey += `${cache.paramsFloats[index]},`;
  }

  if (cache.paramsBuffer === null) {
    const buffer = input.device.createBuffer?.({
      label: "custom-wgsl-lit/params",
      size: LIT_PARAMS_BYTE_LENGTH,
      usage: bufferUsage.UNIFORM | bufferUsage.COPY_DST,
    });

    if (buffer === undefined) {
      throw new Error(
        "device.createBuffer returned undefined (custom-wgsl-lit/params).",
      );
    }

    cache.paramsBuffer = buffer;
    cache.paramsValueKey = "";
  }

  if (cache.paramsValueKey !== valueKey) {
    const queue = input.device.queue;

    if (queue?.writeBuffer === undefined) {
      throw new Error("device.queue.writeBuffer is unavailable.");
    }

    // Invoke through the queue so the real GPUQueue keeps its `this` binding.
    queue.writeBuffer(
      cache.paramsBuffer,
      0,
      cache.paramsData,
      0,
      LIT_PARAMS_BYTE_LENGTH,
    );
    cache.paramsValueKey = valueKey;
    input.reuse.dynamicBufferWrites += 1;
  }
}

interface ResolvedLitShadowResources {
  readonly present: boolean;
  readonly matrices: unknown | null;
  readonly depthView: unknown | null;
  readonly sampler: unknown | null;
}

// The lit contract v1 exposes the DIRECTIONAL single-map receiver only; the
// top-level receiver set is directional for the plain/cascaded/multi kinds
// (cascaded binds matrix 0 = the first cascade). Point/spot-only frames fall
// back (directionalShadowCount = 0, apertureDirectionalShadow = 1.0).
function resolveLitShadowResources(
  receiver: StandardFrameShadowReceiverResources | undefined,
): ResolvedLitShadowResources {
  const kind = receiver?.shadowKind;
  const directional =
    receiver !== undefined &&
    (kind === undefined ||
      kind === "directional" ||
      kind === "directional-cascaded" ||
      kind.startsWith("multi"));

  if (!directional) {
    return { present: false, matrices: null, depthView: null, sampler: null };
  }

  const matrices = receiver.matrixBufferResource.resource?.buffer ?? null;
  const depthView =
    receiver.depthTextureResources.resources.find(
      (resource) =>
        resource.allocation.resource !== null &&
        resource.viewDimension === "2d",
    )?.allocation.resource?.view ?? null;
  const sampler = receiver.samplerResource.resource?.sampler ?? null;
  const present = matrices !== null && depthView !== null && sampler !== null;

  return present
    ? { present, matrices, depthView, sampler }
    : { present: false, matrices: null, depthView: null, sampler: null };
}

interface ResolvedLitIblResources {
  readonly flags: number;
  readonly irradianceView: unknown | null;
  readonly specularView: unknown | null;
  readonly brdfLutView: unknown | null;
  readonly sampler: unknown | null;
}

function resolveLitIblResources(
  ibl: StandardFrameIblResources | undefined,
): ResolvedLitIblResources {
  const irradianceView =
    ibl?.diffuseTextureResource?.resources.find(
      (resource) => resource.valid && resource.resource !== null,
    )?.resource?.view ?? null;
  const specularView =
    ibl?.specularTextureResource?.resources.find(
      (resource) => resource.valid && resource.resource !== null,
    )?.resource?.view ?? null;
  const sampler =
    ibl?.samplerResource?.resources.find(
      (resource) => resource.valid && resource.resource !== null,
    )?.resource?.sampler ?? null;
  const brdfLutView =
    ibl?.brdfLutTextureResource?.ready === true
      ? (ibl.brdfLutTextureResource.resource?.view ?? null)
      : null;
  const flags =
    (irradianceView !== null && sampler !== null
      ? APERTURE_LIT_IBL_IRRADIANCE_FLAG
      : 0) |
    (specularView !== null && sampler !== null
      ? APERTURE_LIT_IBL_SPECULAR_FLAG
      : 0) |
    (brdfLutView !== null ? APERTURE_LIT_IBL_BRDF_LUT_FLAG : 0);

  return { flags, irradianceView, specularView, brdfLutView, sampler };
}

function signaturesMatch(
  previous: readonly unknown[],
  next: readonly unknown[],
): boolean {
  if (previous.length !== next.length) {
    return false;
  }

  for (let index = 0; index < previous.length; index += 1) {
    if (previous[index] !== next[index]) {
      return false;
    }
  }

  return true;
}

function messageFromCause(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
