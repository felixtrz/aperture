import { describe, expect, it } from "vitest";

import {
  AssetRegistry,
  createPackedSnapshotViewUniformsScratch,
  createWebGpuAppResourceCache,
  packDebugLineSegmentInstances,
  prepareDebugLineFrameResourcesForSnapshot,
  writePackedSnapshotViewUniforms,
  LINE_SEGMENT_FLOAT_STRIDE,
  type DebugLinesSnapshot,
  type RenderSnapshot,
} from "@aperture-engine/webgpu/test-support";

function appContext(device: unknown) {
  return {
    canvas: { width: 320, height: 180 } as never,
    initialization: { device, format: "bgra8unorm" },
    msaa: { sampleCount: 1 },
  };
}

const BASE_TRANSFORMS = new Float32Array([
  1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
]);
const BASE_VIEW_MATRICES = new Float32Array([
  1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
]);

function baseSnapshot(overrides: Partial<RenderSnapshot>): RenderSnapshot {
  return {
    frame: 1,
    views: [
      {
        viewId: 1,
        camera: { index: 1, generation: 1 },
        priority: 0,
        layerMask: 1,
        viewMatrixOffset: 0,
        projectionMatrixOffset: 0,
        viewProjectionMatrixOffset: 0,
        viewport: [0, 0, 1, 1],
        scissor: [0, 0, 1, 1],
        clearColor: [0, 0, 0, 1],
        clearDepth: 1,
        clearStencil: 0,
        renderTarget: null,
      },
    ],
    meshDraws: [],
    lights: [],
    environments: [],
    shadowRequests: [],
    bounds: [],
    transforms: BASE_TRANSFORMS,
    viewMatrices: BASE_VIEW_MATRICES,
    diagnostics: [],
    report: {
      views: 1,
      meshDraws: 0,
      lights: 0,
      environments: 0,
      shadowRequests: 0,
      bounds: 0,
      diagnostics: 0,
    },
    ...overrides,
  };
}

function debugLines(): DebugLinesSnapshot {
  return {
    segmentCount: 2,
    positions: Float32Array.from([0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 1, 0]),
    colors: Float32Array.from([1, 0.5, 0, 1, 0.2, 0.9, 1, 1]),
    widths: Float32Array.from([3, 5]),
  };
}

function deviceFixture(): {
  readonly device: unknown;
  readonly renderPipelineDescriptors: unknown[];
} {
  const renderPipelineDescriptors: unknown[] = [];
  const device = {
    createShaderModule: () => ({
      compilationInfo: async () => ({ messages: [] }),
    }),
    createRenderPipeline: (descriptor: unknown) => {
      renderPipelineDescriptors.push(descriptor);
      return {
        descriptor,
        getBindGroupLayout: (group: number) => ({ group }),
      };
    },
    createBuffer: (descriptor: { readonly label?: string }) => ({
      label: descriptor.label ?? "buffer",
      descriptor,
    }),
    createBindGroup: (descriptor: unknown) => ({ descriptor }),
    queue: { writeBuffer: () => undefined },
  };

  return { device, renderPipelineDescriptors };
}

describe("E3 debug-line packing", () => {
  it("packs each debug segment into the shared E1 instance layout", () => {
    const data = packDebugLineSegmentInstances(debugLines());
    expect(data).toHaveLength(2 * LINE_SEGMENT_FLOAT_STRIDE);

    // Segment 0: p0 (arc length 0), p1 (arc length 0), color0=color1, width, 0s.
    expect(Array.from(data.slice(0, LINE_SEGMENT_FLOAT_STRIDE))).toEqual([
      0, 0, 0, 0, 1, 0, 0, 0, 1, 0.5, 0, 1, 1, 0.5, 0, 1, 3, 0, 0, 0,
    ]);
    // Segment 1 width rides its own per-segment width.
    expect(data[LINE_SEGMENT_FLOAT_STRIDE + 16]).toBe(5);
  });
});

describe("E3 debug-line frame resources", () => {
  it("is inert (byte-identical) when a snapshot carries no debug lines", async () => {
    const cache = createWebGpuAppResourceCache();
    const fixture = deviceFixture();
    const snapshot = baseSnapshot({});
    const viewUniforms = writePackedSnapshotViewUniforms(
      snapshot,
      createPackedSnapshotViewUniformsScratch(),
    );

    const result = await prepareDebugLineFrameResourcesForSnapshot({
      app: appContext(fixture.device),
      assets: new AssetRegistry(),
      cache,
      snapshot,
      viewUniforms,
    });

    expect(result.valid).toBe(true);
    expect(result.commands).toEqual([]);
    expect(result.report).toBeUndefined();
    expect(fixture.renderPipelineDescriptors).toEqual([]);
    expect([...cache.linePipelines.keys()]).toEqual([]);
  });

  it("draws all debug segments in one instanced draw over the shared fat-line pipeline", async () => {
    const cache = createWebGpuAppResourceCache();
    const fixture = deviceFixture();
    const snapshot = baseSnapshot({ debugLines: debugLines() });
    const viewUniforms = writePackedSnapshotViewUniforms(
      snapshot,
      createPackedSnapshotViewUniformsScratch(),
    );

    const result = await prepareDebugLineFrameResourcesForSnapshot({
      app: appContext(fixture.device),
      assets: new AssetRegistry(),
      cache,
      snapshot,
      viewUniforms,
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    // Reuses the E1 fat-line pipeline cache — no second line rasterizer.
    expect([...cache.linePipelines.keys()]).toEqual([
      "aperture/fat-line:bgra8unorm:depth24plus:samples-1",
    ]);
    const draws = result.commands.filter((command) => command.kind === "draw");
    expect(draws).toEqual([
      expect.objectContaining({
        vertexCount: 6,
        instanceCount: 2,
        firstInstance: 0,
      }),
    ]);
    expect(result.report).toEqual({ segments: 2, drawnSegments: 2 });
  });
});
