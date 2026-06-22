import { describe, expect, it } from "vitest";

import {
  AssetRegistry,
  createPackedSnapshotTransformsScratch,
  createPackedSnapshotViewUniformsScratch,
  createRenderSortKey,
  createTextureAsset,
  createTextureHandle,
  createWebGpuAppResourceCache,
  prepareSpriteFrameResourcesForSnapshot,
  writePackedSnapshotTransforms,
  writePackedSnapshotViewUniforms,
  type RenderSnapshot,
} from "@aperture-engine/webgpu/test-support";

import { createWebGpuAppResourceReuseReport } from "../../packages/webgpu/src/app/report.js";

describe("sprite app frame resources", () => {
  it("selects depth-disabled pipelines for mesh-less legacy sprite packets", async () => {
    const texture = createTextureHandle("sprite-marker");
    const assets = new AssetRegistry();
    const cache = createWebGpuAppResourceCache();
    const fixture = createSpriteDeviceFixture();
    const snapshot = createSpriteSnapshot(texture);
    const viewUniforms = writePackedSnapshotViewUniforms(
      snapshot,
      createPackedSnapshotViewUniformsScratch(),
    );
    const worldTransforms = writePackedSnapshotTransforms(
      snapshot,
      createPackedSnapshotTransformsScratch(),
    );

    registerTexture(assets, texture);

    const result = await prepareSpriteFrameResourcesForSnapshot({
      app: {
        canvas: { width: 320, height: 180 } as never,
        initialization: { device: fixture.device, format: "bgra8unorm" },
        msaa: { sampleCount: 1 },
      },
      assets,
      cache,
      snapshot,
      viewUniforms,
      worldTransforms,
      reuse: createWebGpuAppResourceReuseReport(),
    });

    expect(result.resources.valid).toBe(true);
    expect(result.resources.diagnostics).toEqual([]);
    expect([...cache.spritePipelines.keys()]).toEqual([
      "aperture/sprite-billboard:bgra8unorm:depth24plus:samples-1",
      "aperture/sprite-billboard:bgra8unorm:depth24plus:samples-1:depth-disabled",
    ]);
    expect(fixture.renderPipelineDescriptors).toEqual([
      expect.objectContaining({
        depthStencil: expect.objectContaining({ depthCompare: "less" }),
      }),
      expect.objectContaining({
        depthStencil: expect.objectContaining({ depthCompare: "always" }),
      }),
    ]);
    expect(
      result.resources.commands.filter((command) => command.kind === "draw"),
    ).toEqual([
      expect.objectContaining({ renderId: 10, firstInstance: 0 }),
      expect.objectContaining({ renderId: 20, firstInstance: 1 }),
    ]);
    expect(
      result.resources.commands.filter(
        (command) => command.kind === "setPipeline",
      ),
    ).toEqual([
      expect.objectContaining({
        renderId: 10,
        pipelineKey:
          "aperture/sprite-billboard:bgra8unorm:depth24plus:samples-1",
      }),
      expect.objectContaining({
        renderId: 20,
        pipelineKey:
          "aperture/sprite-billboard:bgra8unorm:depth24plus:samples-1:depth-disabled",
      }),
    ]);
  });
});

function createSpriteDeviceFixture(): {
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
      createView: () => ({ label: "sprite-texture-view" }),
    }),
    createSampler: (descriptor: unknown) => ({ descriptor }),
    queue: {
      writeBuffer: () => undefined,
      writeTexture: () => undefined,
    },
  };

  return { device, renderPipelineDescriptors };
}

function createSpriteSnapshot(
  texture: ReturnType<typeof createTextureHandle>,
): RenderSnapshot {
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
    spriteDraws: [
      createSpriteDraw(10, texture, 0),
      createSpriteDraw(20, texture, 16, "disabled"),
    ],
    lights: [],
    environments: [],
    shadowRequests: [],
    bounds: [],
    transforms: new Float32Array([
      1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 0, 0, 0,
      0, 1, 0, 1, 2, 3, 1,
    ]),
    viewMatrices: matrixPair(),
    diagnostics: [],
    report: {
      views: 1,
      meshDraws: 0,
      spriteDraws: 2,
      lights: 0,
      environments: 0,
      shadowRequests: 0,
      bounds: 0,
      diagnostics: 0,
    },
  };
}

function createSpriteDraw(
  renderId: number,
  texture: ReturnType<typeof createTextureHandle>,
  worldTransformOffset: number,
  depthMode: "test" | "disabled" = "test",
): NonNullable<RenderSnapshot["spriteDraws"]>[number] {
  return {
    renderId,
    entity: { index: renderId, generation: 1 },
    texture,
    depthMode,
    color: [1, 1, 1, 1],
    width: 1,
    height: 1,
    worldTransformOffset,
    boundsIndex: 0,
    layerMask: 1,
    sortKey: createRenderSortKey({
      queue: "transparent",
      viewId: 1,
      layer: 1,
      pipelineKey: "sprite-billboard",
      materialKey: "texture:sprite-marker",
      meshKey: "sprite-quad",
      stableId: renderId,
    }),
  };
}

function registerTexture(
  assets: AssetRegistry,
  texture: ReturnType<typeof createTextureHandle>,
): void {
  assets.register(texture);
  assets.markReady(
    texture,
    createTextureAsset({
      label: "sprite-marker",
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

function matrixPair(): Float32Array {
  return new Float32Array([
    1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 0, 0, 0,
    0, 1, 0, 0, 0, 0, 1,
  ]);
}
