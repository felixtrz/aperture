import { type AssetRegistry } from "@aperture-engine/simulation";
import type {
  LinePacket,
  PackedSnapshotViewUniforms,
  RenderSnapshot,
} from "@aperture-engine/render";
import type { WebGpuCanvasLike } from "../gpu/initialize-webgpu.js";
import { createWebGpuBuffer } from "../gpu/buffer.js";
import { WEBGPU_BUFFER_USAGE_FLAGS } from "../resources/meshes/mesh-buffer-descriptors.js";
import {
  createLineRenderPipelineResource,
  linePipelineCacheKey,
  type CreateLineRenderPipelineResourceResult,
  type LineRenderPipelineResource,
} from "../render/lines/line-pipeline.js";
import { packLineSegmentInstances } from "../render/lines/line-geometry.js";
import type { RenderPassCommand } from "../render/passes/render-pass-commands.js";
import type { TonemapOperator } from "../output/output-stage-tonemap.js";
import type { OutputColorSpace } from "../output/output-stage-color-space.js";
import {
  webGpuAppScenePassColorFormat,
  webGpuAppUsesHdrScenePass,
} from "./render-color-format.js";
import { webGpuAppCanvasDimensions } from "./canvas.js";
import type { WebGpuAppResourceCache } from "./resource-cache.js";

interface WebGpuAppLineContext {
  readonly canvas?: WebGpuCanvasLike;
  readonly initialization: {
    readonly device: unknown;
    readonly format: string;
  };
  readonly msaa: {
    readonly sampleCount: number;
  };
  readonly tonemap?: TonemapOperator;
  readonly outputColorSpace?: OutputColorSpace;
  readonly sceneRenderFormat?: string;
}

export interface LineFrameReport {
  /** Line entities drawn this frame. */
  readonly lines: number;
  /** Total polyline segments across all lines. */
  readonly segments: number;
  /** Segment instances actually drawn. */
  readonly drawnSegments: number;
}

export interface LineFrameResources {
  readonly valid: boolean;
  readonly commands: readonly RenderPassCommand[];
  readonly diagnostics: readonly unknown[];
  readonly report?: LineFrameReport;
}

const LINE_VIEW_UNIFORM_FLOAT_COUNT = 20;

export async function prepareLineFrameResourcesForSnapshot(options: {
  readonly app: WebGpuAppLineContext;
  readonly assets: AssetRegistry;
  readonly cache: WebGpuAppResourceCache;
  readonly snapshot: RenderSnapshot;
  readonly viewUniforms: PackedSnapshotViewUniforms;
}): Promise<LineFrameResources> {
  const lines = options.snapshot.lines ?? [];

  // Byte-identity: a frame with no lines submits no line pass, builds no
  // pipeline, and returns no report — indistinguishable from a pre-E1 frame.
  if (lines.length === 0) {
    return { valid: true, commands: [], diagnostics: [] };
  }

  const pipelineResult = await getOrCreateWebGpuAppLinePipeline(
    options.app,
    options.cache,
  );

  if (!pipelineResult.valid || pipelineResult.resource === null) {
    return {
      valid: false,
      commands: [],
      diagnostics: pipelineResult.diagnostics,
      report: baseLineReport(lines, 0),
    };
  }

  return createLineFrameResources({
    app: options.app,
    snapshot: options.snapshot,
    lines,
    viewUniforms: options.viewUniforms,
    pipeline: pipelineResult.resource,
  });
}

function createLineFrameResources(options: {
  readonly app: WebGpuAppLineContext;
  readonly snapshot: RenderSnapshot;
  readonly lines: readonly LinePacket[];
  readonly viewUniforms: PackedSnapshotViewUniforms;
  readonly pipeline: LineRenderPipelineResource;
}): LineFrameResources {
  const diagnostics: unknown[] = [];
  const commands: RenderPassCommand[] = [];
  const device = options.app.initialization.device as {
    readonly createBindGroup?: (descriptor: unknown) => unknown;
  } & Parameters<typeof createWebGpuBuffer>[0]["device"];

  if (device.createBindGroup === undefined) {
    return {
      valid: false,
      commands,
      diagnostics: [
        {
          code: "lineFrame.createBindGroupUnavailable",
          message: "WebGPU device cannot create fat-line bind groups.",
        },
      ],
      report: baseLineReport(options.lines, 0),
    };
  }

  const viewData = lineViewUniformData(
    options.app,
    options.viewUniforms,
    options.snapshot,
  );

  if (viewData === null) {
    return {
      valid: false,
      commands,
      diagnostics: [
        {
          code: "lineFrame.missingView",
          message:
            "Fat-line rendering requires at least one view uniform record.",
        },
      ],
      report: baseLineReport(options.lines, 0),
    };
  }

  const packed = packLineSegmentInstances(options.snapshot, options.lines);
  const viewBuffer = createWebGpuBuffer({
    device,
    descriptor: {
      label: "Line/ViewUniforms",
      size: viewData.byteLength,
      usage:
        WEBGPU_BUFFER_USAGE_FLAGS.UNIFORM | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST,
      initialData: viewData,
    },
  });
  const instanceBuffer = createWebGpuBuffer({
    device,
    descriptor: {
      label: "Line/Segments",
      size: packed.data.byteLength,
      usage:
        WEBGPU_BUFFER_USAGE_FLAGS.STORAGE | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST,
      initialData: packed.data,
    },
  });

  if (!viewBuffer.ok) {
    diagnostics.push({
      code: "lineFrame.viewBufferFailed",
      message: viewBuffer.message,
    });
  }

  if (!instanceBuffer.ok) {
    diagnostics.push({
      code: "lineFrame.instanceBufferFailed",
      message: instanceBuffer.message,
    });
  }

  if (!viewBuffer.ok || !instanceBuffer.ok) {
    return {
      valid: false,
      commands,
      diagnostics,
      report: baseLineReport(options.lines, 0),
    };
  }

  const pipeline = options.pipeline.pipeline as {
    readonly getBindGroupLayout?: (group: number) => unknown;
  };

  if (pipeline.getBindGroupLayout === undefined) {
    return {
      valid: false,
      commands,
      diagnostics: [
        {
          code: "lineFrame.missingPipelineLayouts",
          message: "Fat-line pipeline does not expose bind group layouts.",
        },
      ],
      report: baseLineReport(options.lines, 0),
    };
  }

  const viewBindGroup = device.createBindGroup({
    label: "Line/ViewBindGroup",
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: viewBuffer.buffer } }],
  });
  const segmentBindGroup = device.createBindGroup({
    label: "Line/SegmentBindGroup",
    layout: pipeline.getBindGroupLayout(1),
    entries: [{ binding: 0, resource: { buffer: instanceBuffer.buffer } }],
  });

  let drawnSegments = 0;

  for (const batch of packed.batches) {
    commands.push(
      {
        kind: "setPipeline",
        renderId: batch.renderId,
        pipelineKey: options.pipeline.cacheKey,
        pipeline: options.pipeline.pipeline,
      },
      {
        kind: "setBindGroup",
        renderId: batch.renderId,
        index: 0,
        resourceKey: "line:view",
        bindGroup: viewBindGroup,
      },
      {
        kind: "setBindGroup",
        renderId: batch.renderId,
        index: 1,
        resourceKey: "line:segments",
        bindGroup: segmentBindGroup,
      },
      {
        kind: "draw",
        renderId: batch.renderId,
        vertexCount: 6,
        instanceCount: batch.instanceCount,
        firstVertex: 0,
        firstInstance: batch.firstInstance,
      },
    );
    drawnSegments += batch.instanceCount;
  }

  return {
    valid: diagnostics.length === 0,
    commands,
    diagnostics,
    report: baseLineReport(options.lines, drawnSegments),
  };
}

export async function getOrCreateWebGpuAppLinePipeline(
  app: WebGpuAppLineContext,
  cache: WebGpuAppResourceCache,
): Promise<CreateLineRenderPipelineResourceResult> {
  const colorFormat = webGpuAppScenePassColorFormat(app);
  const isHdr = webGpuAppUsesHdrScenePass(app);
  const tonemap: TonemapOperator = isHdr ? "none" : (app.tonemap ?? "none");
  const outputColorSpace: OutputColorSpace = isHdr
    ? "linear"
    : (app.outputColorSpace ?? "linear");
  const key = linePipelineCacheKey(
    colorFormat,
    cache.sceneDepthFormat,
    app.msaa.sampleCount,
    tonemap,
    outputColorSpace,
  );
  const cached = cache.linePipelines.get(key);

  if (cached !== undefined) {
    return cached;
  }

  const result = await createLineRenderPipelineResource({
    device: app.initialization.device as Parameters<
      typeof createLineRenderPipelineResource
    >[0]["device"],
    colorFormat,
    depthFormat: cache.sceneDepthFormat,
    sampleCount: app.msaa.sampleCount,
    tonemap,
    outputColorSpace,
  });

  cache.linePipelines.set(key, result);
  return result;
}

function lineViewUniformData(
  app: WebGpuAppLineContext,
  viewUniforms: PackedSnapshotViewUniforms,
  snapshot: RenderSnapshot,
): Float32Array | null {
  const record = viewUniforms.views[0];

  if (record === undefined) {
    return null;
  }

  const base = record.packedOffset;

  if (base + 16 > viewUniforms.data.length) {
    return null;
  }

  const dimensions =
    app.canvas === undefined
      ? { width: 1, height: 1 }
      : webGpuAppCanvasDimensions(app.canvas);
  const view = snapshot.views.find(
    (candidate) => candidate.viewId === record.viewId,
  );
  const viewport = view?.viewport ?? [0, 0, 1, 1];
  const data = new Float32Array(LINE_VIEW_UNIFORM_FLOAT_COUNT);

  // viewProjection (16 floats).
  for (let index = 0; index < 16; index += 1) {
    data[index] = viewUniforms.data[base + index] ?? 0;
  }

  // viewport in pixels: x, y offset then width, height.
  data[16] = dimensions.width * (viewport[0] ?? 0);
  data[17] = dimensions.height * (viewport[1] ?? 0);
  data[18] = Math.max(1, dimensions.width * (viewport[2] ?? 1));
  data[19] = Math.max(1, dimensions.height * (viewport[3] ?? 1));
  return data;
}

function baseLineReport(
  lines: readonly LinePacket[],
  drawnSegments: number,
): LineFrameReport {
  let segments = 0;

  for (const line of lines) {
    segments += Math.max(0, line.vertexCount - 1);
  }

  return { lines: lines.length, segments, drawnSegments };
}
