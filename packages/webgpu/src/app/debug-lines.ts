import { type AssetRegistry } from "@aperture-engine/simulation";
import type {
  DebugLinesSnapshot,
  PackedSnapshotViewUniforms,
  RenderSnapshot,
} from "@aperture-engine/render";
import { createWebGpuBuffer } from "../gpu/buffer.js";
import { WEBGPU_BUFFER_USAGE_FLAGS } from "../resources/meshes/mesh-buffer-descriptors.js";
import { LINE_SEGMENT_FLOAT_STRIDE } from "../render/lines/line-geometry.js";
import type { LineRenderPipelineResource } from "../render/lines/line-pipeline.js";
import type { RenderPassCommand } from "../render/passes/render-pass-commands.js";
import {
  getOrCreateWebGpuAppLinePipeline,
  lineViewUniformData,
  type WebGpuAppLineContext,
} from "./lines.js";
import type { WebGpuAppResourceCache } from "./resource-cache.js";

/** Stable renderId for the single debug-overlay draw batch. */
const DEBUG_LINES_RENDER_ID = 0x7fff_fffe;

export interface DebugLineFrameReport {
  /** Line segments drawn this frame through the debug overlay. */
  readonly segments: number;
  /** Segment instances actually issued as draw work. */
  readonly drawnSegments: number;
}

export interface DebugLineFrameResources {
  readonly valid: boolean;
  readonly commands: readonly RenderPassCommand[];
  readonly diagnostics: readonly unknown[];
  readonly report?: DebugLineFrameReport;
}

/**
 * Prepare the immediate-mode debug-draw overlay (E3). The transient
 * `snapshot.debugLines` world-space segment soup is packed into the SAME
 * per-segment instance layout the E1 fat-line pipeline consumes and drawn with
 * that exact pipeline — no second line rasterizer. A frame with no debug lines
 * builds no pipeline, submits no commands, and returns no report, so it is
 * byte-identical to a pre-E3 frame.
 */
export async function prepareDebugLineFrameResourcesForSnapshot(options: {
  readonly app: WebGpuAppLineContext;
  readonly assets: AssetRegistry;
  readonly cache: WebGpuAppResourceCache;
  readonly snapshot: RenderSnapshot;
  readonly viewUniforms: PackedSnapshotViewUniforms;
}): Promise<DebugLineFrameResources> {
  const debugLines = options.snapshot.debugLines;

  if (debugLines === undefined || debugLines.segmentCount === 0) {
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
      report: { segments: debugLines.segmentCount, drawnSegments: 0 },
    };
  }

  return createDebugLineFrameResources({
    app: options.app,
    snapshot: options.snapshot,
    debugLines,
    viewUniforms: options.viewUniforms,
    pipeline: pipelineResult.resource,
  });
}

function createDebugLineFrameResources(options: {
  readonly app: WebGpuAppLineContext;
  readonly snapshot: RenderSnapshot;
  readonly debugLines: DebugLinesSnapshot;
  readonly viewUniforms: PackedSnapshotViewUniforms;
  readonly pipeline: LineRenderPipelineResource;
}): DebugLineFrameResources {
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
          code: "debugLineFrame.createBindGroupUnavailable",
          message: "WebGPU device cannot create debug-line bind groups.",
        },
      ],
      report: { segments: options.debugLines.segmentCount, drawnSegments: 0 },
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
          code: "debugLineFrame.missingView",
          message:
            "Debug-line rendering requires at least one view uniform record.",
        },
      ],
      report: { segments: options.debugLines.segmentCount, drawnSegments: 0 },
    };
  }

  const instanceData = packDebugLineSegmentInstances(options.debugLines);
  const viewBuffer = createWebGpuBuffer({
    device,
    descriptor: {
      label: "DebugLine/ViewUniforms",
      size: viewData.byteLength,
      usage:
        WEBGPU_BUFFER_USAGE_FLAGS.UNIFORM | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST,
      initialData: viewData,
    },
  });
  const instanceBuffer = createWebGpuBuffer({
    device,
    descriptor: {
      label: "DebugLine/Segments",
      size: instanceData.byteLength,
      usage:
        WEBGPU_BUFFER_USAGE_FLAGS.STORAGE | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST,
      initialData: instanceData,
    },
  });

  if (!viewBuffer.ok) {
    diagnostics.push({
      code: "debugLineFrame.viewBufferFailed",
      message: viewBuffer.message,
    });
  }

  if (!instanceBuffer.ok) {
    diagnostics.push({
      code: "debugLineFrame.instanceBufferFailed",
      message: instanceBuffer.message,
    });
  }

  if (!viewBuffer.ok || !instanceBuffer.ok) {
    return {
      valid: false,
      commands,
      diagnostics,
      report: { segments: options.debugLines.segmentCount, drawnSegments: 0 },
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
          code: "debugLineFrame.missingPipelineLayouts",
          message: "Debug-line pipeline does not expose bind group layouts.",
        },
      ],
      report: { segments: options.debugLines.segmentCount, drawnSegments: 0 },
    };
  }

  const viewBindGroup = device.createBindGroup({
    label: "DebugLine/ViewBindGroup",
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: viewBuffer.buffer } }],
  });
  const segmentBindGroup = device.createBindGroup({
    label: "DebugLine/SegmentBindGroup",
    layout: pipeline.getBindGroupLayout(1),
    entries: [{ binding: 0, resource: { buffer: instanceBuffer.buffer } }],
  });

  commands.push(
    {
      kind: "setPipeline",
      renderId: DEBUG_LINES_RENDER_ID,
      pipelineKey: options.pipeline.cacheKey,
      pipeline: options.pipeline.pipeline,
    },
    {
      kind: "setBindGroup",
      renderId: DEBUG_LINES_RENDER_ID,
      index: 0,
      resourceKey: "debug-line:view",
      bindGroup: viewBindGroup,
    },
    {
      kind: "setBindGroup",
      renderId: DEBUG_LINES_RENDER_ID,
      index: 1,
      resourceKey: "debug-line:segments",
      bindGroup: segmentBindGroup,
    },
    {
      kind: "draw",
      renderId: DEBUG_LINES_RENDER_ID,
      vertexCount: 6,
      instanceCount: options.debugLines.segmentCount,
      firstVertex: 0,
      firstInstance: 0,
    },
  );

  return {
    valid: diagnostics.length === 0,
    commands,
    diagnostics,
    report: {
      segments: options.debugLines.segmentCount,
      drawnSegments: options.debugLines.segmentCount,
    },
  };
}

/**
 * Pack the debug-line world-space segment soup into the shared E1 per-segment
 * instance layout (five `vec4f`). Debug lines are solid (no dashes), so the arc
 * length is 0 and both endpoint colors are the segment color.
 */
export function packDebugLineSegmentInstances(
  debugLines: DebugLinesSnapshot,
): Float32Array {
  const count = debugLines.segmentCount;
  const data = new Float32Array(Math.max(1, count) * LINE_SEGMENT_FLOAT_STRIDE);

  for (let index = 0; index < count; index += 1) {
    const target = index * LINE_SEGMENT_FLOAT_STRIDE;
    const positionBase = index * 6;
    const colorBase = index * 4;
    const r = debugLines.colors[colorBase] ?? 1;
    const g = debugLines.colors[colorBase + 1] ?? 1;
    const b = debugLines.colors[colorBase + 2] ?? 1;
    const a = debugLines.colors[colorBase + 3] ?? 1;

    data[target] = debugLines.positions[positionBase] ?? 0;
    data[target + 1] = debugLines.positions[positionBase + 1] ?? 0;
    data[target + 2] = debugLines.positions[positionBase + 2] ?? 0;
    data[target + 3] = 0;
    data[target + 4] = debugLines.positions[positionBase + 3] ?? 0;
    data[target + 5] = debugLines.positions[positionBase + 4] ?? 0;
    data[target + 6] = debugLines.positions[positionBase + 5] ?? 0;
    data[target + 7] = 0;
    data[target + 8] = r;
    data[target + 9] = g;
    data[target + 10] = b;
    data[target + 11] = a;
    data[target + 12] = r;
    data[target + 13] = g;
    data[target + 14] = b;
    data[target + 15] = a;
    data[target + 16] = debugLines.widths[index] ?? 2;
    data[target + 17] = 0;
    data[target + 18] = 0;
    data[target + 19] = 0;
  }

  return data;
}
