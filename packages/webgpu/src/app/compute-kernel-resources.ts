// C3 (three.js parity plan): realize a data-described compute-kernel dispatch
// into a `GPUComputePipeline` + `GPUBindGroup`, mirroring the custom WGSL
// material pipeline realization but for compute. This is the piece that lets a
// user dispatch a WGSL kernel with typed bindings while NEVER touching
// `createComputePipeline` / `createBindGroup` / `createBuffer` — the raw
// `app.addComputePass(encode)` path stays for full control.
//
// Bindings reuse the SAME `CustomWgslBindingDeclaration` union as materials and
// resolve through the SAME wiring:
//   - storage-buffer → C1's `resolveAppBufferAssetResource` (one GPU buffer per
//     handle@version, shared with material.storage bindings + instance streams)
//   - uniform-buffer → std140-packed static uniform buffer (cached per kernel)
//   - texture / sampler → the app texture/sampler resource caches
// The compute pipeline is built with `layout: "auto"` (the WGSL declares the
// group(0) layout) and cached per resolved-source + entry point, so the dispatch
// reuses one pipeline across frames.

import {
  assetHandleKey,
  type AssetRegistry,
  type ShaderHandle,
} from "@aperture-engine/simulation";
import {
  bufferAssetUsageIsWritable,
  normalizeComputeKernelWorkgroups,
  packComputeKernelUniformBytes,
  validateComputeKernelAsset,
  type BufferAsset,
  type ComputeKernelAsset,
  type ComputeKernelWorkgroups,
  type CustomWgslBindingDeclaration,
  type WgslShaderAsset,
} from "@aperture-engine/render";
import { createWebGpuBuffer } from "../gpu/buffer.js";
import {
  resolveAppBufferAssetResource,
  type CustomWgslAppStorageBufferReuseCounters,
  type CustomWgslAppStorageBufferResource,
} from "./custom-wgsl-storage-buffer-resources.js";
import {
  prepareAppSamplerResource,
  prepareAppTextureResource,
  type AppTextureSamplerResourceCache,
  type AppTextureSamplerResourceReuseReport,
  type WebGpuAppTextureSamplerPreparationDiagnostic,
} from "./app-texture-sampler-resources.js";

/**
 * Cached realized pipeline for one compute kernel (keyed by resolved shader
 * source + entry point). Holds the shader module + pipeline and any static
 * uniform buffers so per-frame realization does not recreate them.
 */
export interface ComputeKernelPipelineCacheEntry {
  readonly cacheKey: string;
  readonly pipeline: unknown;
  readonly shaderModule: unknown;
  /** Static uniform buffers keyed by `binding:valuesHash`. */
  readonly uniformBuffers: Map<string, unknown>;
}

export interface ComputeKernelDispatchRealization {
  readonly pipeline: unknown;
  readonly bindGroup: unknown;
  readonly workgroups: readonly [number, number, number];
  /**
   * Registered ids of WRITABLE (`usage: "storage"`) BufferAssets this dispatch
   * writes — the kernel pass declares them as graph writes so a draw reading the
   * same id is ordered after the compute pass (writer-before-reader). Lets a
   * kernel omit an explicit `writes` list for its storage outputs.
   */
  readonly writableBufferIds: readonly string[];
}

export type ComputeKernelDispatchDiagnosticCode =
  | "computeKernel.invalidAsset"
  | "computeKernel.deviceUnavailable"
  | "computeKernel.shaderSourceUnavailable"
  | "computeKernel.pipelineCreationFailed"
  | "computeKernel.bindingResourceUnavailable"
  | "computeKernel.bindGroupCreationFailed";

export interface ComputeKernelDispatchDiagnostic {
  readonly code: ComputeKernelDispatchDiagnosticCode;
  readonly severity: "error";
  readonly message: string;
  readonly pass: string;
  readonly binding?: number;
}

export interface ComputeKernelDispatchResult {
  readonly valid: boolean;
  readonly realization: ComputeKernelDispatchRealization | null;
  readonly writableBufferIds: readonly string[];
  readonly diagnostics: readonly ComputeKernelDispatchDiagnostic[];
}

interface ComputeKernelDeviceLike {
  readonly createShaderModule?: (descriptor: {
    readonly code: string;
    readonly label?: string;
  }) => unknown;
  readonly createComputePipeline?: (descriptor: unknown) => unknown;
  readonly createBindGroup?: (descriptor: unknown) => unknown;
}

/**
 * Build (or reuse) the compute pipeline + bind group for a data-described
 * kernel dispatch. Never throws: a missing device method, an unresolved binding
 * resource, or a pipeline-creation error degrades to a structured diagnostic and
 * a `null` realization (the pass records no commands and reports loudly) rather
 * than a device error.
 */
export function realizeComputeKernelDispatch(input: {
  readonly device: unknown;
  readonly assets: AssetRegistry;
  readonly storageBuffers: Map<string, CustomWgslAppStorageBufferResource>;
  readonly storageReuse: CustomWgslAppStorageBufferReuseCounters;
  readonly textureSamplers: AppTextureSamplerResourceCache;
  readonly textureSamplerReuse: AppTextureSamplerResourceReuseReport;
  readonly pipelineCache: Map<string, ComputeKernelPipelineCacheEntry>;
  readonly kernel: ComputeKernelAsset;
  readonly workgroups: ComputeKernelWorkgroups;
  readonly passName: string;
}): ComputeKernelDispatchResult {
  const diagnostics: ComputeKernelDispatchDiagnostic[] = [];
  const writableBufferIds: string[] = [];
  const passName = input.passName;
  const prefix = `Compute kernel pass '${passName}'`;
  const failResult = (): ComputeKernelDispatchResult => ({
    valid: false,
    realization: null,
    writableBufferIds,
    diagnostics,
  });

  const validation = validateComputeKernelAsset(
    input.kernel,
    input.kernel.label,
  );
  if (!validation.valid) {
    diagnostics.push({
      code: "computeKernel.invalidAsset",
      severity: "error",
      message: `${prefix} dispatched an invalid kernel: ${validation.diagnostics
        .filter((diagnostic) => diagnostic.severity === "error")
        .map((diagnostic) => diagnostic.message)
        .join(" ")}`,
      pass: passName,
    });
    return failResult();
  }

  const device = input.device as ComputeKernelDeviceLike | null | undefined;
  if (
    device == null ||
    typeof device.createShaderModule !== "function" ||
    typeof device.createComputePipeline !== "function" ||
    typeof device.createBindGroup !== "function"
  ) {
    diagnostics.push({
      code: "computeKernel.deviceUnavailable",
      severity: "error",
      message: `${prefix} requires a WebGPU device exposing createShaderModule/createComputePipeline/createBindGroup.`,
      pass: passName,
    });
    return failResult();
  }

  const shader = resolveKernelShaderSource(input.kernel, input.assets);
  if (shader === null) {
    diagnostics.push({
      code: "computeKernel.shaderSourceUnavailable",
      severity: "error",
      message: `${prefix} could not resolve its WGSL shader source (a shader-asset handle may not be ready).`,
      pass: passName,
    });
    return failResult();
  }

  const cacheKey = `${shader.sourceKey}::${input.kernel.entryPoint}`;
  let entry = input.pipelineCache.get(cacheKey);
  if (entry === undefined) {
    let shaderModule: unknown;
    let pipeline: unknown;
    try {
      shaderModule = device.createShaderModule({
        label: `compute-kernel:${input.kernel.label}`,
        code: shader.code,
      });
      pipeline = device.createComputePipeline({
        label: `compute-kernel:${input.kernel.label}:pipeline`,
        layout: "auto",
        compute: { module: shaderModule, entryPoint: input.kernel.entryPoint },
      });
    } catch (error) {
      diagnostics.push({
        code: "computeKernel.pipelineCreationFailed",
        severity: "error",
        message: `${prefix} failed to create its compute pipeline: ${errorMessage(error)}`,
        pass: passName,
      });
      return failResult();
    }
    entry = { cacheKey, pipeline, shaderModule, uniformBuffers: new Map() };
    input.pipelineCache.set(cacheKey, entry);
  }

  const pipeline = entry.pipeline as {
    readonly getBindGroupLayout?: (index: number) => unknown;
  };
  if (typeof pipeline.getBindGroupLayout !== "function") {
    diagnostics.push({
      code: "computeKernel.pipelineCreationFailed",
      severity: "error",
      message: `${prefix} compute pipeline does not expose getBindGroupLayout(0) for an auto-layout bind group.`,
      pass: passName,
    });
    return failResult();
  }

  const bindGroupEntries: {
    readonly binding: number;
    readonly resource: unknown;
  }[] = [];
  const orderedBindings = [...input.kernel.bindings].sort(
    (left, right) => left.binding - right.binding,
  );
  for (const binding of orderedBindings) {
    const resource = resolveKernelBindingResource({
      binding,
      device,
      assets: input.assets,
      storageBuffers: input.storageBuffers,
      storageReuse: input.storageReuse,
      textureSamplers: input.textureSamplers,
      textureSamplerReuse: input.textureSamplerReuse,
      uniformBuffers: entry.uniformBuffers,
      kernelLabel: input.kernel.label,
      writableBufferIds,
    });
    if (!resource.ok) {
      diagnostics.push({
        code: "computeKernel.bindingResourceUnavailable",
        severity: "error",
        message: `${prefix} ${resource.message}`,
        pass: passName,
        binding: binding.binding,
      });
      return failResult();
    }
    bindGroupEntries.push({
      binding: binding.binding,
      resource: resource.resource,
    });
  }

  let bindGroup: unknown;
  try {
    bindGroup = device.createBindGroup({
      label: `compute-kernel:${input.kernel.label}:bind-group`,
      layout: pipeline.getBindGroupLayout(0),
      entries: bindGroupEntries,
    });
  } catch (error) {
    diagnostics.push({
      code: "computeKernel.bindGroupCreationFailed",
      severity: "error",
      message: `${prefix} failed to create its bind group: ${errorMessage(error)}`,
      pass: passName,
    });
    return failResult();
  }

  return {
    valid: true,
    realization: {
      pipeline: entry.pipeline,
      bindGroup,
      workgroups: normalizeComputeKernelWorkgroups(input.workgroups),
      writableBufferIds,
    },
    writableBufferIds,
    diagnostics,
  };
}

interface ResolvedKernelShaderSource {
  readonly code: string;
  /** Stable identity for pipeline caching: source hash or shader handle@version. */
  readonly sourceKey: string;
}

function resolveKernelShaderSource(
  kernel: ComputeKernelAsset,
  assets: AssetRegistry,
): ResolvedKernelShaderSource | null {
  const shader = kernel.shader;

  if (shader.kind === "inline-wgsl") {
    if (typeof shader.code !== "string" || shader.code.length === 0) {
      return null;
    }
    return { code: shader.code, sourceKey: `inline:${fnv1a(shader.code)}` };
  }

  const handle = shader.handle as ShaderHandle;
  const entry = assets.get<"shader", WgslShaderAsset>(handle);
  if (entry === undefined || entry.status !== "ready" || entry.asset === null) {
    return null;
  }
  const code = entry.asset.source;
  if (typeof code !== "string" || code.length === 0) {
    return null;
  }
  return {
    code,
    sourceKey: `asset:${assetHandleKey(handle)}@${String(entry.version)}`,
  };
}

type ResolveKernelBindingResult =
  | { readonly ok: true; readonly resource: unknown }
  | { readonly ok: false; readonly message: string };

function resolveKernelBindingResource(input: {
  readonly binding: CustomWgslBindingDeclaration;
  readonly device: unknown;
  readonly assets: AssetRegistry;
  readonly storageBuffers: Map<string, CustomWgslAppStorageBufferResource>;
  readonly storageReuse: CustomWgslAppStorageBufferReuseCounters;
  readonly textureSamplers: AppTextureSamplerResourceCache;
  readonly textureSamplerReuse: AppTextureSamplerResourceReuseReport;
  readonly uniformBuffers: Map<string, unknown>;
  readonly kernelLabel: string;
  readonly writableBufferIds: string[];
}): ResolveKernelBindingResult {
  const binding = input.binding;

  if (binding.kind === "storage-buffer") {
    if (binding.buffer === undefined) {
      return {
        ok: false,
        message: `storage binding ${String(binding.binding)} ('${binding.name}') does not reference a buffer handle.`,
      };
    }
    const resolved = resolveAppBufferAssetResource({
      assets: input.assets,
      device: input.device,
      cache: input.storageBuffers,
      reuse: input.storageReuse,
      handle: binding.buffer,
    });
    if (resolved === null) {
      return {
        ok: false,
        message: `storage binding ${String(binding.binding)} ('${binding.name}') could not realize BufferAsset '${binding.buffer.id}' (missing / not-ready / invalid).`,
      };
    }
    const bufferEntry = input.assets.get<"buffer", BufferAsset>(binding.buffer);
    if (
      bufferEntry?.asset != null &&
      bufferAssetUsageIsWritable(bufferEntry.asset.usage) &&
      !input.writableBufferIds.includes(binding.buffer.id)
    ) {
      input.writableBufferIds.push(binding.buffer.id);
    }
    return { ok: true, resource: { buffer: resolved.buffer } };
  }

  if (binding.kind === "uniform-buffer") {
    const bytes = packComputeKernelUniformBytes(binding.fields, binding.values);
    const uniformKey = `${String(binding.binding)}:${fnv1aBytes(bytes)}`;
    const cached = input.uniformBuffers.get(uniformKey);
    if (cached !== undefined) {
      return { ok: true, resource: { buffer: cached } };
    }
    const usage = gpuBufferUsage();
    const created = createWebGpuBuffer({
      device: input.device as Parameters<
        typeof createWebGpuBuffer
      >[0]["device"],
      descriptor: {
        label: `compute-kernel:${input.kernelLabel}:uniform:${String(binding.binding)}`,
        size: bytes.byteLength,
        usage: usage.UNIFORM | usage.COPY_DST,
        initialData: bytes,
      },
    });
    if (!created.ok) {
      return {
        ok: false,
        message: `uniform binding ${String(binding.binding)} ('${binding.name}') could not create its uniform buffer: ${created.message}`,
      };
    }
    input.uniformBuffers.set(uniformKey, created.buffer);
    return { ok: true, resource: { buffer: created.buffer } };
  }

  if (binding.kind === "texture") {
    if (binding.texture === undefined) {
      return {
        ok: false,
        message: `texture binding ${String(binding.binding)} ('${binding.name}') does not reference a texture handle.`,
      };
    }
    const textureDiagnostics: WebGpuAppTextureSamplerPreparationDiagnostic[] =
      [];
    const texture = prepareAppTextureResource({
      assets: input.assets,
      device: input.device,
      cache: input.textureSamplers,
      handle: binding.texture,
      reuse: input.textureSamplerReuse,
      diagnostics: textureDiagnostics,
    });
    if (texture === null) {
      return {
        ok: false,
        message: `texture binding ${String(binding.binding)} ('${binding.name}') could not realize its texture: ${textureDiagnostics.map((diagnostic) => diagnostic.message).join(" ")}`,
      };
    }
    return { ok: true, resource: texture.resource.view };
  }

  // sampler
  const samplerDiagnostics: WebGpuAppTextureSamplerPreparationDiagnostic[] = [];
  const sampler = prepareAppSamplerResource({
    assets: input.assets,
    device: input.device,
    cache: input.textureSamplers,
    handle: binding.sampler,
    reuse: input.textureSamplerReuse,
    diagnostics: samplerDiagnostics,
  });
  if (sampler === null) {
    return {
      ok: false,
      message: `sampler binding ${String(binding.binding)} ('${binding.name}') could not realize its sampler: ${samplerDiagnostics.map((diagnostic) => diagnostic.message).join(" ")}`,
    };
  }
  return { ok: true, resource: sampler.resource.sampler };
}

function gpuBufferUsage(): {
  readonly UNIFORM: number;
  readonly COPY_DST: number;
} {
  return (
    (
      globalThis as {
        readonly GPUBufferUsage?: { UNIFORM: number; COPY_DST: number };
      }
    ).GPUBufferUsage ?? { UNIFORM: 0x40, COPY_DST: 0x08 }
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function fnv1a(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index) & 0xff;
    hash = Math.imul(hash, 0x01000193);
    hash ^= (value.charCodeAt(index) >> 8) & 0xff;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16);
}

function fnv1aBytes(bytes: Uint8Array): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < bytes.length; index += 1) {
    hash ^= bytes[index] ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }
  return `${String(bytes.byteLength)}:${(hash >>> 0).toString(16)}`;
}
