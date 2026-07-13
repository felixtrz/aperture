import { type AssetRegistry } from "@aperture-engine/simulation";
import type {
  PackedSnapshotViewUniforms,
  PointsPacket,
  RenderSnapshot,
} from "@aperture-engine/render";
import type { WebGpuCanvasLike } from "../gpu/initialize-webgpu.js";
import { createWebGpuBuffer } from "../gpu/buffer.js";
import { WEBGPU_BUFFER_USAGE_FLAGS } from "../resources/meshes/mesh-buffer-descriptors.js";
import {
  createPointRenderPipelineResource,
  pointPipelineCacheKey,
  type CreatePointRenderPipelineResourceResult,
  type PointRenderPipelineResource,
} from "../render/points/point-pipeline.js";
import { packPointInstances } from "../render/points/point-geometry.js";
import type { RenderPassCommand } from "../render/passes/render-pass-commands.js";
import type { TonemapOperator } from "../output/output-stage-tonemap.js";
import type { OutputColorSpace } from "../output/output-stage-color-space.js";
import {
  webGpuAppScenePassColorFormat,
  webGpuAppUsesHdrScenePass,
} from "./render-color-format.js";
import { webGpuAppCanvasDimensions } from "./canvas.js";
import type { WebGpuAppResourceCache } from "./resource-cache.js";

interface WebGpuAppPointContext {
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

export interface PointFrameReport {
  /** Point-cloud entities drawn this frame. */
  readonly clouds: number;
  /** Total points across all clouds. */
  readonly points: number;
  /** Point instances actually drawn. */
  readonly drawnPoints: number;
}

export interface PointFrameResources {
  readonly valid: boolean;
  readonly commands: readonly RenderPassCommand[];
  readonly diagnostics: readonly unknown[];
  readonly report?: PointFrameReport;
}

const POINT_VIEW_UNIFORM_FLOAT_COUNT = 20;

export async function preparePointFrameResourcesForSnapshot(options: {
  readonly app: WebGpuAppPointContext;
  readonly assets: AssetRegistry;
  readonly cache: WebGpuAppResourceCache;
  readonly snapshot: RenderSnapshot;
  readonly viewUniforms: PackedSnapshotViewUniforms;
}): Promise<PointFrameResources> {
  const points = options.snapshot.points ?? [];

  // Byte-identity: a frame with no points submits no point pass, builds no
  // pipeline, and returns no report — indistinguishable from a pre-E1 frame.
  if (points.length === 0) {
    return { valid: true, commands: [], diagnostics: [] };
  }

  const pipelineResult = await getOrCreateWebGpuAppPointPipeline(
    options.app,
    options.cache,
  );

  if (!pipelineResult.valid || pipelineResult.resource === null) {
    return {
      valid: false,
      commands: [],
      diagnostics: pipelineResult.diagnostics,
      report: basePointReport(points, 0),
    };
  }

  return createPointFrameResources({
    app: options.app,
    snapshot: options.snapshot,
    points,
    viewUniforms: options.viewUniforms,
    pipeline: pipelineResult.resource,
  });
}

function createPointFrameResources(options: {
  readonly app: WebGpuAppPointContext;
  readonly snapshot: RenderSnapshot;
  readonly points: readonly PointsPacket[];
  readonly viewUniforms: PackedSnapshotViewUniforms;
  readonly pipeline: PointRenderPipelineResource;
}): PointFrameResources {
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
          code: "pointFrame.createBindGroupUnavailable",
          message: "WebGPU device cannot create point-cloud bind groups.",
        },
      ],
      report: basePointReport(options.points, 0),
    };
  }

  const viewData = pointViewUniformData(
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
          code: "pointFrame.missingView",
          message:
            "Point-cloud rendering requires at least one view uniform record.",
        },
      ],
      report: basePointReport(options.points, 0),
    };
  }

  const packed = packPointInstances(options.snapshot, options.points);
  const viewBuffer = createWebGpuBuffer({
    device,
    descriptor: {
      label: "Point/ViewUniforms",
      size: viewData.byteLength,
      usage:
        WEBGPU_BUFFER_USAGE_FLAGS.UNIFORM | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST,
      initialData: viewData,
    },
  });
  const instanceBuffer = createWebGpuBuffer({
    device,
    descriptor: {
      label: "Point/Instances",
      size: packed.data.byteLength,
      usage:
        WEBGPU_BUFFER_USAGE_FLAGS.STORAGE | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST,
      initialData: packed.data,
    },
  });

  if (!viewBuffer.ok) {
    diagnostics.push({
      code: "pointFrame.viewBufferFailed",
      message: viewBuffer.message,
    });
  }

  if (!instanceBuffer.ok) {
    diagnostics.push({
      code: "pointFrame.instanceBufferFailed",
      message: instanceBuffer.message,
    });
  }

  if (!viewBuffer.ok || !instanceBuffer.ok) {
    return {
      valid: false,
      commands,
      diagnostics,
      report: basePointReport(options.points, 0),
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
          code: "pointFrame.missingPipelineLayouts",
          message: "Point-cloud pipeline does not expose bind group layouts.",
        },
      ],
      report: basePointReport(options.points, 0),
    };
  }

  const viewBindGroup = device.createBindGroup({
    label: "Point/ViewBindGroup",
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: viewBuffer.buffer } }],
  });
  const instanceBindGroup = device.createBindGroup({
    label: "Point/InstanceBindGroup",
    layout: pipeline.getBindGroupLayout(1),
    entries: [{ binding: 0, resource: { buffer: instanceBuffer.buffer } }],
  });

  let drawnPoints = 0;

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
        resourceKey: "point:view",
        bindGroup: viewBindGroup,
      },
      {
        kind: "setBindGroup",
        renderId: batch.renderId,
        index: 1,
        resourceKey: "point:instances",
        bindGroup: instanceBindGroup,
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
    drawnPoints += batch.instanceCount;
  }

  return {
    valid: diagnostics.length === 0,
    commands,
    diagnostics,
    report: basePointReport(options.points, drawnPoints),
  };
}

export async function getOrCreateWebGpuAppPointPipeline(
  app: WebGpuAppPointContext,
  cache: WebGpuAppResourceCache,
): Promise<CreatePointRenderPipelineResourceResult> {
  const colorFormat = webGpuAppScenePassColorFormat(app);
  const isHdr = webGpuAppUsesHdrScenePass(app);
  const tonemap: TonemapOperator = isHdr ? "none" : (app.tonemap ?? "none");
  const outputColorSpace: OutputColorSpace = isHdr
    ? "linear"
    : (app.outputColorSpace ?? "linear");
  const key = pointPipelineCacheKey(
    colorFormat,
    cache.sceneDepthFormat,
    app.msaa.sampleCount,
    tonemap,
    outputColorSpace,
  );
  const cached = cache.pointPipelines.get(key);

  if (cached !== undefined) {
    return cached;
  }

  const result = await createPointRenderPipelineResource({
    device: app.initialization.device as Parameters<
      typeof createPointRenderPipelineResource
    >[0]["device"],
    colorFormat,
    depthFormat: cache.sceneDepthFormat,
    sampleCount: app.msaa.sampleCount,
    tonemap,
    outputColorSpace,
  });

  cache.pointPipelines.set(key, result);
  return result;
}

function pointViewUniformData(
  app: WebGpuAppPointContext,
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
  const data = new Float32Array(POINT_VIEW_UNIFORM_FLOAT_COUNT);

  for (let index = 0; index < 16; index += 1) {
    data[index] = viewUniforms.data[base + index] ?? 0;
  }

  data[16] = dimensions.width * (viewport[0] ?? 0);
  data[17] = dimensions.height * (viewport[1] ?? 0);
  data[18] = Math.max(1, dimensions.width * (viewport[2] ?? 1));
  data[19] = Math.max(1, dimensions.height * (viewport[3] ?? 1));
  return data;
}

function basePointReport(
  points: readonly PointsPacket[],
  drawnPoints: number,
): PointFrameReport {
  let total = 0;

  for (const cloud of points) {
    total += cloud.vertexCount;
  }

  return { clouds: points.length, points: total, drawnPoints };
}
