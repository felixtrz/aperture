import { describe, expect, it } from "vitest";

import {
  MATERIAL_POST_TONEMAP_STAGE_FEATURE,
  MATERIAL_UNTONEMAPPED_FEATURE,
} from "@aperture-engine/render";
import {
  assembleWebGpuAppPostProcessedSwapchainTarget,
  createWebGpuAppOverlayDepthResolveCache,
  createWebGpuAppResourceCache,
  createWebGpuPostPassTextureCacheSlot,
  getOrCreateWebGpuAppPipeline,
  prepareWebGpuAppOverlayDepthResolve,
  WEBGPU_APP_OVERLAY_DEPTH_RESOLVE_WGSL,
  type BatchCompatibilityKey,
  type RenderPassCommand,
} from "@aperture-engine/webgpu/test-support";

// The overlay boundary composites into the SINGLE-SAMPLE presentation target,
// so it cannot bind a multisampled depth attachment. Without a single-sample
// copy of the scene depth, every post-tonemap draw in an MSAA app is painted
// unconditionally over the resolved frame — a board decal covers the character
// standing on it — while the very same app at sampleCount 1 occludes it
// correctly. These tests pin the copy and the pipeline agreement it enables.

const POST_TONEMAP_PIPELINE_KEY = `unlit|${MATERIAL_POST_TONEMAP_STAGE_FEATURE}|${MATERIAL_UNTONEMAPPED_FEATURE}|blend|back|less|alpha`;

const POST_TONEMAP_BATCH: BatchCompatibilityKey = {
  pipelineKey: POST_TONEMAP_PIPELINE_KEY,
  materialKey: "material:pad",
  meshLayoutKey: "mesh-layout:triangle",
  topology: "triangle-list",
  instanced: false,
  skinned: false,
  morphed: false,
};

describe("overlay depth resolve", () => {
  it("copies multisampled scene depth into a single-sample attachment", () => {
    const device = recordingDevice();
    const plan = prepareWebGpuAppOverlayDepthResolve({
      device: device.device,
      cache: createWebGpuAppOverlayDepthResolveCache(),
      depthAttachment: msaaDepthAttachment(),
      colorFormat: "bgra8unorm",
      label: "app",
    });

    expect(plan).not.toBeNull();
    expect(plan?.diagnostics).toEqual([]);
    expect(plan?.view).not.toBeNull();

    // A single-sample depth texture the size of the scene depth.
    const created = device.textures.at(-1);
    expect(created?.sampleCount).toBe(1);
    expect(created?.format).toBe("depth24plus");
    expect(created?.size).toEqual([1280, 800, 1]);

    // Depth-only: the pass writes depth with an always-pass compare and masks
    // the color target off, so the already-composited image is untouched.
    const pipeline = device.pipelines[0];
    expect(pipeline?.depthStencil).toEqual({
      format: "depth24plus",
      depthWriteEnabled: true,
      depthCompare: "always",
    });
    expect(pipeline?.fragment.targets[0]).toEqual({
      format: "bgra8unorm",
      writeMask: 0,
    });

    // The MULTISAMPLED view is what the copy reads.
    expect(device.bindGroups[0]?.entries[0]?.resource).toBe("msaa-depth-view");

    expect(plan?.commands.map((command) => command.kind)).toEqual([
      "setPipeline",
      "setBindGroup",
      "draw",
    ]);
  });

  it("declines with no work when the app is already single-sample", () => {
    const device = recordingDevice();
    const plan = prepareWebGpuAppOverlayDepthResolve({
      device: device.device,
      cache: createWebGpuAppOverlayDepthResolveCache(),
      depthAttachment: { ...msaaDepthAttachment(), sampleCount: 1 },
      colorFormat: "bgra8unorm",
      label: "app",
    });

    // The caller binds its own depth attachment; nothing is allocated.
    expect(plan).toBeNull();
    expect(device.textures).toEqual([]);
    expect(device.pipelines).toEqual([]);
  });

  it("reuses the copy's texture, pipeline and bind group across frames", () => {
    const device = recordingDevice();
    const cache = createWebGpuAppOverlayDepthResolveCache();
    const depthAttachment = msaaDepthAttachment();

    for (let frame = 0; frame < 3; frame += 1) {
      prepareWebGpuAppOverlayDepthResolve({
        device: device.device,
        cache,
        depthAttachment,
        colorFormat: "bgra8unorm",
        label: "app",
      });
    }

    expect(device.textures).toHaveLength(1);
    expect(device.pipelines).toHaveLength(1);
    expect(device.bindGroups).toHaveLength(1);
  });

  it("degrades to an undepth-tested overlay, with a diagnostic, on a device that cannot build the copy", () => {
    const plan = prepareWebGpuAppOverlayDepthResolve({
      device: { createTexture: () => ({ createView: () => ({}) }) },
      cache: createWebGpuAppOverlayDepthResolveCache(),
      depthAttachment: msaaDepthAttachment(),
      colorFormat: "bgra8unorm",
      label: "app",
    });

    expect(plan?.view).toBeNull();
    expect(plan?.commands).toEqual([]);
    expect(plan?.diagnostics[0]?.code).toBe(
      "webgpu.overlayDepthResolve.deviceUnavailable",
    );
  });

  it("reads sample 0 of the multisampled depth and writes only frag_depth", () => {
    expect(WEBGPU_APP_OVERLAY_DEPTH_RESOLVE_WGSL).toContain(
      "texture_depth_multisampled_2d",
    );
    expect(WEBGPU_APP_OVERLAY_DEPTH_RESOLVE_WGSL).toContain(
      "textureLoad(sceneDepth, vec2i(position.xy), 0)",
    );
    expect(WEBGPU_APP_OVERLAY_DEPTH_RESOLVE_WGSL).toContain(
      "@builtin(frag_depth)",
    );
    expect(WEBGPU_APP_OVERLAY_DEPTH_RESOLVE_WGSL).not.toContain("@location(0)");
  });

  it("orders the copy between the post stack and the overlay without deadlocking the frame graph", () => {
    const result = assembleMsaaOverlayPostTarget();

    expect(result.valid).toBe(true);

    const order = result.graph?.order ?? [];
    const resolveIndex = order.indexOf("post:post:overlay-depth-resolve");
    const overlayIndex = order.indexOf("post:post:ui-overlay");

    expect(resolveIndex).toBeGreaterThanOrEqual(0);
    expect(overlayIndex).toBeGreaterThan(resolveIndex);
    // Ordered by the write-after-write edge alone. Declaring a READ of the
    // presentation image here would point this node and the overlay at each
    // other — read-after-write edges run from every writer of a handle to each
    // reader — and the topological sort would report a cycle, drop both nodes,
    // and fail the frame with no diagnostic to explain it.
    expect(order.indexOf("post:post:1:blur")).toBeLessThan(resolveIndex);
  });

  it("leaves the single-sample frame graph untouched", () => {
    const result = assembleMsaaOverlayPostTarget({ msaa: false });
    const order = result.graph?.order ?? [];

    expect(result.valid).toBe(true);
    expect(order).not.toContain("post:post:overlay-depth-resolve");
    expect(order).toContain("post:post:ui-overlay");
  });

  it("gives post-tonemap mesh pipelines a depth attachment at every sample count", async () => {
    // The pipeline's depthStencil format must MATCH the overlay boundary's
    // attachment or the draw fails validation. Both sample counts land in the
    // same single-sample boundary, so both declare depth.
    for (const sampleCount of [1, 4]) {
      const created = await createPostTonemapPipeline(sampleCount);

      expect(created.multisample?.count ?? 1).toBe(1);
      expect(created.depthStencil?.format).toBe("depth24plus");
      // Read-only: the boundary binds the copy with depthReadOnly.
      expect(created.depthStencil?.depthWriteEnabled).toBe(false);
    }
  });
});

function assembleMsaaOverlayPostTarget(
  options: { readonly msaa?: boolean } = {},
) {
  const sampleCount = options.msaa === false ? 1 : 4;
  const texture = (label: string) => ({
    label,
    createView: () => ({ label: `${label}:view` }),
  });
  const pass = {
    setPipeline: () => {},
    setBindGroup: () => {},
    setVertexBuffer: () => {},
    setIndexBuffer: () => {},
    draw: () => {},
    drawIndexed: () => {},
    end: () => {},
  };
  const device = {
    createTexture: (descriptor: { readonly label?: string }) =>
      texture(descriptor.label ?? "texture"),
    createShaderModule: () => ({ label: "shader" }),
    createRenderPipeline: () => ({ getBindGroupLayout: () => ({}) }),
    createBindGroup: () => ({ label: "bind-group" }),
    createCommandEncoder: () => ({
      beginRenderPass: () => pass,
      finish: () => ({ label: "command-buffer" }),
    }),
    queue: { submit: () => {} },
  };
  const draw = (renderId: number): RenderPassCommand => ({
    kind: "draw",
    renderId,
    vertexCount: 3,
    instanceCount: 1,
    firstVertex: 0,
    firstInstance: 0,
  });
  const effect = (id: string, renderId: number) => ({
    id,
    prepare: () => ({
      effectId: id,
      label: id,
      commands: [draw(renderId)],
      diagnostics: [],
    }),
  });

  return assembleWebGpuAppPostProcessedSwapchainTarget({
    app: {
      initialization: {
        device,
        context: { getCurrentTexture: () => texture("swapchain") },
      },
      sceneRenderFormat: "rgba16float",
    },
    cache: {
      postPasses: {
        scene: createWebGpuPostPassTextureCacheSlot(),
        ping: createWebGpuPostPassTextureCacheSlot(),
        pong: createWebGpuPostPassTextureCacheSlot(),
        motionVector: createWebGpuPostPassTextureCacheSlot(),
        indirectColor: createWebGpuPostPassTextureCacheSlot(),
      },
      overlayDepthResolve: createWebGpuAppOverlayDepthResolveCache(),
    },
    snapshot: { frame: 0 },
    target: {
      source: "swapchain",
      view: { viewId: 7, clearDepth: 1, clearColor: [0, 0, 0, 1] },
      width: 4,
      height: 4,
      format: "rgba8unorm",
    },
    commands: [draw(1)],
    overlayCommands: [draw(30)],
    depthAttachment: {
      texture: texture("depth"),
      width: 4,
      height: 4,
      format: "depth24plus",
      sampleCount,
      view: { label: "depth-view" },
    },
    effects: [effect("tonemap", 10), effect("blur", 11)],
    label: "post",
    clearColor: [0, 0, 0, 1],
    useFrameGraph: true,
    ...(sampleCount === 1
      ? {}
      : {
          msaaColorTarget: {
            view: { label: "scene-msaa-view" },
            sampleCount,
          },
        }),
  } as never);
}

async function createPostTonemapPipeline(sampleCount: number): Promise<{
  readonly multisample?: { count: number };
  readonly depthStencil?: {
    readonly format: string;
    readonly depthWriteEnabled: boolean;
  };
}> {
  const descriptors: {
    multisample?: { count: number };
    depthStencil?: { format: string; depthWriteEnabled: boolean };
  }[] = [];
  const device = {
    createShaderModule() {
      return { compilationInfo: async () => ({ messages: [] }) };
    },
    createRenderPipeline(descriptor: {
      multisample?: { count: number };
      depthStencil?: { format: string; depthWriteEnabled: boolean };
    }) {
      descriptors.push(descriptor);
      return { kind: "render-pipeline" };
    },
  };
  const result = await getOrCreateWebGpuAppPipeline({
    app: {
      initialization: { format: "bgra8unorm", device },
      sceneRenderFormat: "rgba16float",
      postEffects: [{ enabled: true }],
      tonemap: "aces",
      outputColorSpace: "srgb",
      msaa: { sampleCount },
    } as never,
    cache: createWebGpuAppResourceCache(),
    reuse: { pipelineHits: 0, pipelineMisses: 0 } as never,
    kind: "unlit",
    pipelineKey: POST_TONEMAP_PIPELINE_KEY,
    batchKey: POST_TONEMAP_BATCH,
    renderStage: "post-tonemap",
  });

  expect(result.valid).toBe(true);

  const descriptor = descriptors[0];

  if (descriptor === undefined) {
    throw new Error("No render pipeline descriptor was created.");
  }

  return descriptor;
}

function msaaDepthAttachment() {
  return {
    format: "depth24plus",
    width: 1280,
    height: 800,
    sampleCount: 4,
    texture: { createView: () => ({}) },
    view: "msaa-depth-view",
  };
}

function recordingDevice() {
  const textures: {
    format: string;
    sampleCount?: number;
    size: readonly number[];
  }[] = [];
  const pipelines: {
    depthStencil?: unknown;
    fragment: { targets: unknown[] };
  }[] = [];
  const bindGroups: { entries: { resource: unknown }[] }[] = [];

  return {
    textures,
    pipelines,
    bindGroups,
    device: {
      createTexture(descriptor: {
        format: string;
        sampleCount?: number;
        size: readonly number[];
      }) {
        textures.push(descriptor);
        return { createView: () => ({ kind: "resolved-depth-view" }) };
      },
      createShaderModule() {
        return { kind: "shader-module" };
      },
      createRenderPipeline(descriptor: {
        depthStencil?: unknown;
        fragment: { targets: unknown[] };
      }) {
        pipelines.push(descriptor);
        return { getBindGroupLayout: () => ({ kind: "layout" }) };
      },
      createBindGroup(descriptor: { entries: { resource: unknown }[] }) {
        bindGroups.push(descriptor);
        return { kind: "bind-group" };
      },
    },
  };
}
