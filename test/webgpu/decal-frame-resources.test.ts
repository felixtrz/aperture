import { describe, expect, it } from "vitest";

import {
  AssetRegistry,
  createPackedSnapshotViewUniformsScratch,
  createRenderSortKey,
  createTextureAsset,
  createTextureHandle,
  createWebGpuAppResourceCache,
  decalPipelineCacheKey,
  decalTextureBatches,
  packDecalInstances,
  prepareDecalFrameResourcesForSnapshot,
  writePackedSnapshotViewUniforms,
  type DecalPacket,
  type RenderSnapshot,
} from "@aperture-engine/webgpu/test-support";

import { createWebGpuAppResourceReuseReport } from "../../packages/webgpu/src/app/report.js";

describe("decal app frame resources", () => {
  it("is inert (byte-identical) when a snapshot carries no decals", async () => {
    const cache = createWebGpuAppResourceCache();
    const fixture = createDecalDeviceFixture();
    const snapshot = createDecalSnapshot([]);
    const viewUniforms = writePackedSnapshotViewUniforms(
      snapshot,
      createPackedSnapshotViewUniformsScratch(),
    );

    const result = await prepareDecalFrameResourcesForSnapshot({
      app: appContext(fixture.device),
      assets: new AssetRegistry(),
      cache,
      snapshot,
      viewUniforms,
      reuse: createWebGpuAppResourceReuseReport(),
    });

    // No pass, no pipeline, no report — indistinguishable from a pre-D4 frame.
    expect(result.valid).toBe(true);
    expect(result.commands).toEqual([]);
    expect(result.report).toBeUndefined();
    expect(fixture.renderPipelineDescriptors).toEqual([]);
    expect([...cache.decalPipelines.keys()]).toEqual([]);
  });

  it("builds one instanced, depth-biased draw per contiguous texture batch", async () => {
    const texture = createTextureHandle("decal-bullet");
    const assets = new AssetRegistry();
    const cache = createWebGpuAppResourceCache();
    const fixture = createDecalDeviceFixture();
    const snapshot = createDecalSnapshot([
      createDecalPacket(10, texture, 0),
      createDecalPacket(20, texture, 16),
    ]);
    const viewUniforms = writePackedSnapshotViewUniforms(
      snapshot,
      createPackedSnapshotViewUniformsScratch(),
    );

    registerDecalTexture(assets, texture);

    const result = await prepareDecalFrameResourcesForSnapshot({
      app: appContext(fixture.device),
      assets,
      cache,
      snapshot,
      viewUniforms,
      reuse: createWebGpuAppResourceReuseReport(),
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect([...cache.decalPipelines.keys()]).toEqual([
      "aperture/decal-projected:bgra8unorm:depth24plus:samples-1",
    ]);
    // One shared pipeline, one instanced draw covering both decals.
    const draws = result.commands.filter((command) => command.kind === "draw");
    expect(draws).toEqual([
      expect.objectContaining({
        vertexCount: 6,
        instanceCount: 2,
        firstInstance: 0,
      }),
    ]);
    // Depth-biased projected quad: never writes depth, tests less-equal.
    expect(fixture.renderPipelineDescriptors).toEqual([
      expect.objectContaining({
        depthStencil: expect.objectContaining({
          depthWriteEnabled: false,
          depthCompare: "less-equal",
        }),
      }),
    ]);
    expect(result.report).toMatchObject({
      capacity: 6,
      live: 2,
      evicted: 0,
      submitted: 2,
      drawn: 2,
      textureBatches: 1,
    });
  });

  it("pins the no-op decal pipeline cache key", () => {
    expect(decalPipelineCacheKey("bgra8unorm", "depth24plus", 1)).toBe(
      "aperture/decal-projected:bgra8unorm:depth24plus:samples-1",
    );
  });

  it("groups contiguous same-texture runs into batches", () => {
    const a = createTextureHandle("a");
    const b = createTextureHandle("b");
    const batches = decalTextureBatches([
      createDecalPacket(1, a, 0),
      createDecalPacket(2, a, 16),
      createDecalPacket(3, b, 32),
      createDecalPacket(4, a, 48),
    ]);

    expect(
      batches.map((batch) => ({
        first: batch.firstInstance,
        count: batch.instanceCount,
      })),
    ).toEqual([
      { first: 0, count: 2 },
      { first: 2, count: 1 },
      { first: 3, count: 1 },
    ]);
  });

  it("bakes the world matrix, tint, size and depth bias into each instance", () => {
    const texture = createTextureHandle("decal-bullet");
    const snapshot = createDecalSnapshot([createDecalPacket(10, texture, 16)]);
    const data = packDecalInstances(snapshot, snapshot.decals ?? []);

    // World matrix baked from transforms[16..32) (translation 5,6,7).
    expect(data[12]).toBe(5);
    expect(data[13]).toBe(6);
    expect(data[14]).toBe(7);
    // color rgba
    expect(data[16]).toBeCloseTo(1, 5);
    expect(data[17]).toBeCloseTo(0.5, 5);
    expect(data[18]).toBeCloseTo(0.25, 5);
    expect(data[19]).toBeCloseTo(0.8, 5);
    // params: width, height, depthOffset
    expect(data[20]).toBeCloseTo(0.8, 5);
    expect(data[21]).toBeCloseTo(0.6, 5);
    expect(data[22]).toBeCloseTo(0.03, 5);
  });
});

function appContext(device: unknown) {
  return {
    canvas: { width: 320, height: 180 } as never,
    initialization: { device, format: "bgra8unorm" },
    msaa: { sampleCount: 1 },
  };
}

function createDecalPacket(
  renderId: number,
  texture: ReturnType<typeof createTextureHandle>,
  worldTransformOffset: number,
): DecalPacket {
  return {
    renderId,
    entity: { index: renderId, generation: 1 },
    texture,
    color: [1, 0.5, 0.25, 0.8],
    width: 0.8,
    height: 0.6,
    depthOffset: 0.03,
    worldTransformOffset,
    boundsIndex: 0,
    layerMask: 1,
    sortKey: createRenderSortKey({
      queue: "transparent",
      viewId: 1,
      layer: 1,
      pipelineKey: "decal-projected",
      materialKey: `texture:${renderId}`,
      meshKey: "decal-quad",
      stableId: renderId,
    }),
  };
}

function createDecalSnapshot(decals: readonly DecalPacket[]): RenderSnapshot {
  return {
    frame: 1,
    views: [
      {
        viewId: 1,
        camera: { index: 1, generation: 1 },
        priority: 0,
        layerMask: 1,
        viewMatrixOffset: 16,
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
    ...(decals.length === 0 ? {} : { decals }),
    lights: [],
    environments: [],
    shadowRequests: [],
    bounds: [],
    transforms: new Float32Array([
      1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 0, 0, 0,
      0, 1, 0, 5, 6, 7, 1,
    ]),
    viewMatrices: new Float32Array([
      1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 0, 0, 0,
      0, 1, 0, 0, 0, 0, 1,
    ]),
    diagnostics: [],
    report: {
      views: 1,
      meshDraws: 0,
      ...(decals.length === 0
        ? {}
        : {
            decals: {
              capacity: 6,
              live: decals.length,
              evicted: 0,
              submitted: decals.length,
            },
          }),
      lights: 0,
      environments: 0,
      shadowRequests: 0,
      bounds: 0,
      diagnostics: 0,
    },
  };
}

function registerDecalTexture(
  assets: AssetRegistry,
  texture: ReturnType<typeof createTextureHandle>,
): void {
  assets.register(texture);
  assets.markReady(
    texture,
    createTextureAsset({
      label: "decal-bullet",
      dimension: "2d",
      width: 2,
      height: 2,
      format: "rgba8unorm-srgb",
      colorSpace: "srgb",
      semantic: "base-color",
      usage: ["sampled", "copy-dst"],
      sourceData: {
        bytes: new Uint8Array(2 * 2 * 4).fill(255),
        bytesPerRow: 8,
      },
    }),
  );
}

function createDecalDeviceFixture(): {
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
    createTexture: () => ({
      createView: () => ({ label: "decal-texture-view" }),
    }),
    createSampler: (descriptor: unknown) => ({ descriptor }),
    queue: {
      writeBuffer: () => undefined,
      writeTexture: () => undefined,
    },
  };

  return { device, renderPipelineDescriptors };
}
