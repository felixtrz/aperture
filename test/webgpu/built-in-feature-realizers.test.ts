import { describe, expect, it } from "vitest";
import {
  AssetRegistry,
  createPackedSnapshotViewUniformsScratch,
  createWebGpuAppResourceCache,
  writePackedSnapshotViewUniforms,
  type RenderSnapshot,
} from "@aperture-engine/webgpu/test-support";
import {
  prepareWebGpuFeatureFrameResources,
  webGpuParticleFrameReport,
} from "../../packages/webgpu/src/app/built-in-feature-realizers.js";
import { createWebGpuAppResourceReuseReport } from "../../packages/webgpu/src/app/report.js";

describe("built-in WebGPU feature realizers", () => {
  it("registers the built-in realizers at cache creation", () => {
    const cache = createWebGpuAppResourceCache();

    expect(
      cache.featureRealizers.list().map((realizer) => realizer.id),
    ).toEqual(["particles", "ui"]);
  });

  it("rejects realizers that collide with a built-in id at registration time", () => {
    const cache = createWebGpuAppResourceCache();

    for (const id of ["particles", "ui"]) {
      expect(() =>
        cache.featureRealizers.register({
          id,
          packetFamilies: [],
          prepareFrame: () => ({ valid: true, commandGroups: [] }),
        }),
      ).toThrow(`WebGPU feature realizer '${id}' is already registered.`);
    }

    // The failed registrations must not disturb the built-ins.
    expect(
      cache.featureRealizers.list().map((realizer) => realizer.id),
    ).toEqual(["particles", "ui"]);
  });

  it("prepares UI through an overlay command group and particles as an empty built-in feature", async () => {
    const snapshot = createPanelUiSnapshot();
    const cache = createWebGpuAppResourceCache();
    const options = {
      app: {
        canvas: { width: 320, height: 180 },
        initialization: {
          device: createPanelDevice(),
          format: "bgra8unorm",
        },
        msaa: { sampleCount: 1 },
      } as never,
      assets: new AssetRegistry(),
      cache,
      snapshot,
      viewUniforms: writePackedSnapshotViewUniforms(
        snapshot,
        createPackedSnapshotViewUniformsScratch(),
      ),
      reuse: createWebGpuAppResourceReuseReport(),
    };

    const frame = await prepareWebGpuFeatureFrameResources(options);
    const secondFrame = await prepareWebGpuFeatureFrameResources(options);

    expect(frame.valid).toBe(true);
    expect(frame.diagnostics).toEqual([]);
    expect(webGpuParticleFrameReport(frame).emitters).toBe(0);
    expect(frame.sceneGroups).toEqual([]);
    expect(frame.overlayCommands.map((command) => command.renderId)).toEqual([
      10, 10, 10, 10,
    ]);
    expect(
      cache.featureRealizers.list().map((realizer) => realizer.id),
    ).toEqual(["particles", "ui"]);
    expect(secondFrame.overlayCommands).toHaveLength(4);
    expect(cache.featureRealizers.list()).toHaveLength(2);
  });
});

function createPanelDevice(): unknown {
  return {
    createShaderModule: () => ({
      compilationInfo: async () => ({ messages: [] }),
    }),
    createRenderPipeline: () => ({
      getBindGroupLayout: (group: number) => ({ group }),
    }),
    createBuffer: (descriptor: { readonly label?: string }) => ({
      label: descriptor.label ?? "buffer",
      descriptor,
    }),
    createBindGroup: (descriptor: unknown) => ({ descriptor }),
    queue: {
      writeBuffer: () => undefined,
    },
  };
}

function createPanelUiSnapshot(): RenderSnapshot {
  return {
    frame: 2,
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
    uiNodes: [
      {
        uiId: 10,
        screenId: 1,
        entity: { index: 10, generation: 1 },
        parentUiId: 1,
        kind: "panel",
        rect: { x: 8, y: 10, width: 100, height: 40 },
        clip: { x: 8, y: 10, width: 50, height: 30 },
        layoutMode: "absolute",
        stackIndex: 1,
        zIndex: 0,
        layerMask: 1,
        opacity: 0.5,
        clipsChildren: true,
        scrollOffset: [0, 0],
        color: [1, 0, 0, 1],
      },
    ],
    uiHitRegions: [],
    lights: [],
    environments: [],
    shadowRequests: [],
    bounds: [],
    transforms: new Float32Array(0),
    viewMatrices: matrixPair(),
    diagnostics: [],
    report: {
      views: 1,
      meshDraws: 0,
      uiNodes: 1,
      uiHitRegions: 0,
      lights: 0,
      environments: 0,
      shadowRequests: 0,
      bounds: 0,
      diagnostics: 0,
    },
  };
}

function matrixPair(): Float32Array {
  return new Float32Array([
    1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 0, 0, 0,
    0, 1, 0, 0, 0, 0, 1,
  ]);
}
