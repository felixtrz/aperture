import { describe, expect, it } from "vitest";

import {
  AssetRegistry,
  createPackedSnapshotViewUniformsScratch,
  createRenderSortKey,
  createWebGpuAppResourceCache,
  linePipelineCacheKey,
  pointPipelineCacheKey,
  prepareLineFrameResourcesForSnapshot,
  preparePointFrameResourcesForSnapshot,
  writePackedSnapshotViewUniforms,
  type LinePacket,
  type PointsPacket,
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

function linePacket(): LinePacket {
  return {
    renderId: 5,
    entity: { index: 5, generation: 1 },
    vertexOffset: 0,
    vertexCount: 3,
    color: [0.1, 0.8, 1, 1],
    width: 6,
    dashSize: 0,
    gapSize: 0,
    dashOffset: 0,
    worldTransformOffset: 0,
    boundsIndex: 0,
    layerMask: 1,
    sortKey: createRenderSortKey({
      queue: "transparent",
      viewId: 1,
      layer: 1,
      pipelineKey: "fat-line",
      materialKey: "fat-line",
      meshKey: "fat-line-segment",
      stableId: 5,
    }),
  };
}

function pointsPacket(): PointsPacket {
  return {
    renderId: 9,
    entity: { index: 9, generation: 1 },
    vertexOffset: 0,
    vertexCount: 3,
    color: [1, 1, 1, 1],
    size: 10,
    sizeAttenuation: true,
    round: true,
    worldTransformOffset: 0,
    boundsIndex: 0,
    layerMask: 1,
    sortKey: createRenderSortKey({
      queue: "transparent",
      viewId: 1,
      layer: 1,
      pipelineKey: "point-cloud",
      materialKey: "point-cloud",
      meshKey: "point-quad",
      stableId: 9,
    }),
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

describe("E1 fat-line frame resources", () => {
  it("is inert (byte-identical) when a snapshot carries no lines", async () => {
    const cache = createWebGpuAppResourceCache();
    const fixture = deviceFixture();
    const snapshot = baseSnapshot({});
    const viewUniforms = writePackedSnapshotViewUniforms(
      snapshot,
      createPackedSnapshotViewUniformsScratch(),
    );

    const result = await prepareLineFrameResourcesForSnapshot({
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

  it("builds one instanced draw per line over the shared segment pipeline", async () => {
    const cache = createWebGpuAppResourceCache();
    const fixture = deviceFixture();
    const snapshot = baseSnapshot({
      lines: [linePacket()],
      lineVertices: Float32Array.from([0, 0, 0, 1, 0, 0, 2, 0, 0]),
    });
    const viewUniforms = writePackedSnapshotViewUniforms(
      snapshot,
      createPackedSnapshotViewUniformsScratch(),
    );

    const result = await prepareLineFrameResourcesForSnapshot({
      app: appContext(fixture.device),
      assets: new AssetRegistry(),
      cache,
      snapshot,
      viewUniforms,
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
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
    expect(fixture.renderPipelineDescriptors).toEqual([
      expect.objectContaining({
        depthStencil: expect.objectContaining({
          depthWriteEnabled: false,
          depthCompare: "less-equal",
        }),
      }),
    ]);
    expect(result.report).toMatchObject({
      lines: 1,
      segments: 2,
      drawnSegments: 2,
    });
  });

  it("pins the no-op fat-line pipeline cache key", () => {
    expect(linePipelineCacheKey("bgra8unorm", "depth24plus", 1)).toBe(
      "aperture/fat-line:bgra8unorm:depth24plus:samples-1",
    );
  });
});

describe("E1 point-cloud frame resources", () => {
  it("is inert (byte-identical) when a snapshot carries no points", async () => {
    const cache = createWebGpuAppResourceCache();
    const fixture = deviceFixture();
    const snapshot = baseSnapshot({});
    const viewUniforms = writePackedSnapshotViewUniforms(
      snapshot,
      createPackedSnapshotViewUniformsScratch(),
    );

    const result = await preparePointFrameResourcesForSnapshot({
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
    expect([...cache.pointPipelines.keys()]).toEqual([]);
  });

  it("builds one instanced draw per cloud over the shared point pipeline", async () => {
    const cache = createWebGpuAppResourceCache();
    const fixture = deviceFixture();
    const snapshot = baseSnapshot({
      points: [pointsPacket()],
      pointVertices: Float32Array.from([0, 0, 0, 1, 0, 0, 2, 0, 0]),
      pointColors: Float32Array.from([1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 1]),
    });
    const viewUniforms = writePackedSnapshotViewUniforms(
      snapshot,
      createPackedSnapshotViewUniformsScratch(),
    );

    const result = await preparePointFrameResourcesForSnapshot({
      app: appContext(fixture.device),
      assets: new AssetRegistry(),
      cache,
      snapshot,
      viewUniforms,
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect([...cache.pointPipelines.keys()]).toEqual([
      "aperture/point-cloud:bgra8unorm:depth24plus:samples-1",
    ]);
    const draws = result.commands.filter((command) => command.kind === "draw");
    expect(draws).toEqual([
      expect.objectContaining({
        vertexCount: 6,
        instanceCount: 3,
        firstInstance: 0,
      }),
    ]);
    expect(result.report).toMatchObject({
      clouds: 1,
      points: 3,
      drawnPoints: 3,
    });
  });

  it("pins the no-op point-cloud pipeline cache key", () => {
    expect(pointPipelineCacheKey("bgra8unorm", "depth24plus", 1)).toBe(
      "aperture/point-cloud:bgra8unorm:depth24plus:samples-1",
    );
  });
});
