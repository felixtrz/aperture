import { invertMat4 } from "@aperture-engine/simulation";
import {
  type ProceduralSkyPacket,
  type RenderSnapshot,
} from "@aperture-engine/render";
import { createWebGpuBuffer, writeWebGpuBufferData } from "../gpu/buffer.js";
import { WEBGPU_BUFFER_USAGE_FLAGS } from "../resources/meshes/mesh-buffer-descriptors.js";
import { WEBGPU_APP_DEPTH_FORMAT } from "../resources/textures/depth-texture-resource.js";
import {
  createProceduralSkyRenderPipelineResource,
  PROCEDURAL_SKY_UNIFORM_FLOAT_COUNT,
  proceduralSkyPipelineCacheKey,
  type CreateProceduralSkyRenderPipelineResourceResult,
} from "../render/skybox/procedural-sky-pipeline.js";
import type { RenderPassCommand } from "../render/passes/render-pass-commands.js";
import { webGpuAppScenePassColorFormat } from "./render-color-format.js";
import type {
  ProceduralSkyUniformResource,
  WebGpuAppResourceCache,
} from "./resource-cache.js";
import type { WebGpuAppResourceReuseReport } from "./app.js";

interface WebGpuAppProceduralSkyContext {
  readonly initialization: {
    readonly device: unknown;
    readonly format: string;
  };
  readonly sceneRenderFormat?: string;
  readonly msaa: {
    readonly sampleCount: number;
  };
}

interface ProceduralSkyFrameCommands {
  readonly valid: boolean;
  readonly commands: readonly RenderPassCommand[];
  readonly diagnostics: readonly unknown[];
}

export async function writeProceduralSkyCommandsForView(options: {
  readonly app: WebGpuAppProceduralSkyContext;
  readonly cache: WebGpuAppResourceCache;
  readonly snapshot: RenderSnapshot;
  readonly view: RenderSnapshot["views"][number];
  readonly target: RenderPassCommand[];
  readonly reuse: WebGpuAppResourceReuseReport;
}): Promise<ProceduralSkyFrameCommands> {
  options.target.length = 0;

  const sky = selectProceduralSkyForView(
    options.snapshot.proceduralSkies ?? [],
    options.view,
  );

  if (sky === null) {
    return { valid: true, commands: options.target, diagnostics: [] };
  }

  const diagnostics: unknown[] = [];
  const pipeline = await getOrCreateWebGpuAppProceduralSkyPipeline(
    options.app,
    options.cache,
    options.reuse,
  );

  diagnostics.push(...pipeline.diagnostics);

  if (!pipeline.valid || pipeline.resource === null) {
    return { valid: false, commands: options.target, diagnostics };
  }

  const device = options.app.initialization.device as {
    readonly createBindGroup?: (descriptor: unknown) => unknown;
  } & Parameters<typeof createWebGpuBuffer>[0]["device"];
  const pipelineHandle = pipeline.resource.pipeline as {
    readonly getBindGroupLayout?: (group: number) => unknown;
  };

  if (pipelineHandle.getBindGroupLayout === undefined) {
    diagnostics.push({
      code: "proceduralSkyFrame.missingPipelineLayouts",
      message: "Procedural sky pipeline does not expose bind group layouts.",
    });
    return { valid: false, commands: options.target, diagnostics };
  }

  if (device.createBindGroup === undefined) {
    diagnostics.push({
      code: "proceduralSkyFrame.createBindGroupUnavailable",
      message: "WebGPU device cannot create procedural sky bind groups.",
    });
    return { valid: false, commands: options.target, diagnostics };
  }

  const uniformData = createProceduralSkyUniformData({
    snapshot: options.snapshot,
    view: options.view,
    sky,
    diagnostics,
  });

  if (uniformData === null) {
    return { valid: false, commands: options.target, diagnostics };
  }

  const uniformResource = getOrCreateProceduralSkyUniformResource({
    cache: options.cache,
    device,
    pipeline: pipelineHandle,
    view: options.view,
    sky,
    data: uniformData,
    reuse: options.reuse,
    diagnostics,
  });

  if (uniformResource === null) {
    return { valid: false, commands: options.target, diagnostics };
  }

  options.target.push(
    {
      kind: "setPipeline",
      renderId: sky.skyId,
      pipelineKey: pipeline.resource.cacheKey,
      pipeline: pipeline.resource.pipeline,
    },
    {
      kind: "setBindGroup",
      renderId: sky.skyId,
      index: 0,
      resourceKey: uniformResource.key,
      bindGroup: uniformResource.bindGroup,
    },
    {
      kind: "draw",
      renderId: sky.skyId,
      vertexCount: 3,
      instanceCount: 1,
      firstVertex: 0,
      firstInstance: 0,
    },
  );

  return {
    valid: diagnostics.length === 0,
    commands: options.target,
    diagnostics,
  };
}

function selectProceduralSkyForView(
  skies: readonly ProceduralSkyPacket[],
  view: RenderSnapshot["views"][number],
): ProceduralSkyPacket | null {
  for (const sky of skies) {
    if ((sky.layerMask & view.layerMask) !== 0) {
      return sky;
    }
  }

  return null;
}

async function getOrCreateWebGpuAppProceduralSkyPipeline(
  app: WebGpuAppProceduralSkyContext,
  cache: WebGpuAppResourceCache,
  reuse: WebGpuAppResourceReuseReport,
): Promise<CreateProceduralSkyRenderPipelineResourceResult> {
  const colorFormat = webGpuAppScenePassColorFormat(app);
  const key = proceduralSkyPipelineCacheKey(
    colorFormat,
    WEBGPU_APP_DEPTH_FORMAT,
    app.msaa.sampleCount,
  );
  const cached = cache.proceduralSkyPipelines.get(key);

  if (cached !== undefined) {
    reuse.pipelineHits += 1;
    return cached;
  }

  reuse.pipelineMisses += 1;

  const result = await createProceduralSkyRenderPipelineResource({
    device: app.initialization.device as Parameters<
      typeof createProceduralSkyRenderPipelineResource
    >[0]["device"],
    colorFormat,
    depthFormat: WEBGPU_APP_DEPTH_FORMAT,
    sampleCount: app.msaa.sampleCount,
  });

  cache.proceduralSkyPipelines.set(key, result);
  return result;
}

function getOrCreateProceduralSkyUniformResource(input: {
  readonly cache: WebGpuAppResourceCache;
  readonly device: {
    readonly createBindGroup?: (descriptor: unknown) => unknown;
  } & Parameters<typeof createWebGpuBuffer>[0]["device"];
  readonly pipeline: {
    readonly getBindGroupLayout?: (group: number) => unknown;
  };
  readonly view: RenderSnapshot["views"][number];
  readonly sky: ProceduralSkyPacket;
  readonly data: Float32Array;
  readonly reuse: WebGpuAppResourceReuseReport;
  readonly diagnostics: unknown[];
}): ProceduralSkyUniformResource | null {
  const key = `procedural-sky:view:${String(input.view.viewId)}:sky:${String(input.sky.skyId)}`;
  const valueKey = proceduralSkyUniformValueKey(input.data);
  const cached = input.cache.proceduralSkyUniforms.get(key);

  if (cached !== undefined) {
    if (cached.valueKey !== valueKey) {
      if (!writeWebGpuBufferData(input.device, cached.buffer, input.data)) {
        input.diagnostics.push({
          code: "proceduralSkyFrame.uniformWriteFailed",
          message:
            "WebGPU device cannot write updated procedural sky uniform data.",
        });
        return null;
      }

      cached.valueKey = valueKey;
      input.reuse.dynamicBufferWrites += 1;
    }

    input.reuse.bindGroupsReused += 1;
    return cached;
  }

  const uniformBuffer = createWebGpuBuffer({
    device: input.device,
    descriptor: {
      label: `ProceduralSky/View/${String(input.view.viewId)}`,
      size: input.data.byteLength,
      usage:
        WEBGPU_BUFFER_USAGE_FLAGS.UNIFORM | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST,
      initialData: input.data,
    },
  });

  if (!uniformBuffer.ok) {
    input.diagnostics.push(
      bufferDiagnostic(
        "proceduralSkyFrame.uniformBufferFailed",
        uniformBuffer.message,
      ),
    );
    return null;
  }

  const bindGroup = input.device.createBindGroup?.({
    label: `ProceduralSky/ViewBindGroup/${String(input.view.viewId)}`,
    layout: input.pipeline.getBindGroupLayout?.(0),
    entries: [{ binding: 0, resource: { buffer: uniformBuffer.buffer } }],
  });

  if (bindGroup === undefined) {
    input.diagnostics.push({
      code: "proceduralSkyFrame.createBindGroupUnavailable",
      message: "WebGPU device cannot create procedural sky bind groups.",
    });
    return null;
  }

  const resource: ProceduralSkyUniformResource = {
    key,
    buffer: uniformBuffer.buffer,
    bindGroup,
    byteLength: input.data.byteLength,
    valueKey,
  };

  input.cache.proceduralSkyUniforms.set(key, resource);
  input.reuse.bindGroupsCreated += 1;
  input.reuse.dynamicBufferWrites += 1;
  return resource;
}

export function createProceduralSkyUniformData(input: {
  readonly snapshot: RenderSnapshot;
  readonly view: RenderSnapshot["views"][number];
  readonly sky: ProceduralSkyPacket;
  readonly diagnostics?: unknown[];
}): Float32Array | null {
  const diagnostics = input.diagnostics ?? [];
  const viewProjectionOffset = input.view.viewProjectionMatrixOffset;
  const viewMatrixOffset = input.view.viewMatrixOffset;

  if (!hasMatrixRange(input.snapshot.viewMatrices, viewProjectionOffset)) {
    diagnostics.push({
      code: "proceduralSkyFrame.viewProjectionOutOfRange",
      message: `Procedural sky view ${String(input.view.viewId)} view-projection matrix offset ${String(viewProjectionOffset)} is outside snapshot view matrix data.`,
    });
    return null;
  }

  if (!hasMatrixRange(input.snapshot.viewMatrices, viewMatrixOffset)) {
    diagnostics.push({
      code: "proceduralSkyFrame.viewMatrixOutOfRange",
      message: `Procedural sky view ${String(input.view.viewId)} view matrix offset ${String(viewMatrixOffset)} is outside snapshot view matrix data.`,
    });
    return null;
  }

  const viewProjection = input.snapshot.viewMatrices.subarray(
    viewProjectionOffset,
    viewProjectionOffset + 16,
  );
  const inverseViewProjection = invertMat4(viewProjection);

  if (inverseViewProjection === null) {
    diagnostics.push({
      code: "proceduralSkyFrame.viewProjectionNotInvertible",
      message: `Procedural sky view ${String(input.view.viewId)} has a non-invertible view-projection matrix.`,
    });
    return null;
  }

  if (!validSkyPacket(input.sky)) {
    diagnostics.push({
      code: "proceduralSkyFrame.invalidPacket",
      message: `Procedural sky ${String(input.sky.skyId)} contains non-finite render values.`,
    });
    return null;
  }

  const data = new Float32Array(PROCEDURAL_SKY_UNIFORM_FLOAT_COUNT);

  data.set(inverseViewProjection, 0);
  writeCameraPositionFromViewMatrix(
    data,
    16,
    input.snapshot.viewMatrices,
    viewMatrixOffset,
  );
  data.set(input.sky.topColor, 20);
  data[23] = input.sky.intensity;
  data.set(input.sky.horizonColor, 24);
  data[27] = input.sky.horizonPosition;
  data.set(input.sky.bottomColor, 28);
  data[31] = input.sky.horizonSoftness;
  data.set(input.sky.sunDirection, 32);
  data[35] = input.sky.sunRadius;
  data.set(input.sky.sunColor, 36);
  data[39] = input.sky.sunGlow;
  data[40] = input.sky.ditherStrength;
  data[41] = 0;
  data[42] = 0;
  data[43] = 0;
  return data;
}

function hasMatrixRange(values: Float32Array, sourceOffset: number): boolean {
  return sourceOffset >= 0 && sourceOffset + 16 <= values.length;
}

function writeCameraPositionFromViewMatrix(
  target: Float32Array,
  targetOffset: number,
  viewMatrices: Float32Array,
  viewMatrixOffset: number,
): void {
  const tx = viewMatrices[viewMatrixOffset + 12] ?? 0;
  const ty = viewMatrices[viewMatrixOffset + 13] ?? 0;
  const tz = viewMatrices[viewMatrixOffset + 14] ?? 0;

  target[targetOffset] = -(
    (viewMatrices[viewMatrixOffset] ?? 1) * tx +
    (viewMatrices[viewMatrixOffset + 1] ?? 0) * ty +
    (viewMatrices[viewMatrixOffset + 2] ?? 0) * tz
  );
  target[targetOffset + 1] = -(
    (viewMatrices[viewMatrixOffset + 4] ?? 0) * tx +
    (viewMatrices[viewMatrixOffset + 5] ?? 1) * ty +
    (viewMatrices[viewMatrixOffset + 6] ?? 0) * tz
  );
  target[targetOffset + 2] = -(
    (viewMatrices[viewMatrixOffset + 8] ?? 0) * tx +
    (viewMatrices[viewMatrixOffset + 9] ?? 0) * ty +
    (viewMatrices[viewMatrixOffset + 10] ?? 1) * tz
  );
  target[targetOffset + 3] = 1;
}

function validSkyPacket(sky: ProceduralSkyPacket): boolean {
  return (
    tupleFiniteNonNegative(sky.topColor) &&
    tupleFiniteNonNegative(sky.horizonColor) &&
    tupleFiniteNonNegative(sky.bottomColor) &&
    tupleFiniteNonNegative(sky.sunColor) &&
    tupleFinite(sky.sunDirection) &&
    finiteNonNegative(sky.intensity) &&
    finiteNonNegative(sky.horizonPosition) &&
    finiteNonNegative(sky.horizonSoftness) &&
    finiteNonNegative(sky.sunRadius) &&
    finiteNonNegative(sky.sunGlow) &&
    finiteNonNegative(sky.ditherStrength)
  );
}

function tupleFinite(values: ProceduralSkyPacket["topColor"]): boolean {
  return (
    Number.isFinite(values[0]) &&
    Number.isFinite(values[1]) &&
    Number.isFinite(values[2])
  );
}

function tupleFiniteNonNegative(
  values: ProceduralSkyPacket["topColor"],
): boolean {
  return (
    finiteNonNegative(values[0]) &&
    finiteNonNegative(values[1]) &&
    finiteNonNegative(values[2])
  );
}

function finiteNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function proceduralSkyUniformValueKey(data: Float32Array): string {
  const parts: string[] = [];

  for (let index = 0; index < data.length; index += 1) {
    parts.push((data[index] ?? 0).toPrecision(8));
  }

  return parts.join(",");
}

function bufferDiagnostic(code: string, message: string): unknown {
  return { code, message };
}
