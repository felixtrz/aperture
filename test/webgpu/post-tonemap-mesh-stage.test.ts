import { describe, expect, it } from "vitest";

import {
  MATERIAL_POST_TONEMAP_STAGE_FEATURE,
  MATERIAL_UNTONEMAPPED_FEATURE,
} from "@aperture-engine/render";
import {
  RenderWorld,
  createRenderFramePlanScratch,
  createWebGpuAppResourceCache,
  getOrCreateWebGpuAppPipeline,
  resolveWebGpuPipelineRenderState,
  webGpuAppOverlayCommandsWithPostTonemapMeshDraws,
  webGpuAppPostTonemapMeshRenderIds,
  webGpuAppUsesPostTonemapMeshStage,
  writeRenderFramePlanFromSnapshot,
  type BatchCompatibilityKey,
  type GetOrCreateRenderPipelineResult,
  type MeshGpuBufferResource,
  type RenderPassCommand,
  type RenderSnapshot,
  type RenderSortKey,
  type UnlitBindGroupResource,
} from "@aperture-engine/webgpu/test-support";

// The mesh sibling of the particle renderer's post-tonemap stage. A material
// that opts in must (a) resolve a PRESENTATION pipeline instead of a scene
// pipeline, and (b) have its draws pulled out of the scene command stream into
// the overlay stream the post route encodes AFTER its tonemap boundary — which
// is what makes the draw blend in display space instead of in the HDR buffer.

const SCENE_PIPELINE_KEY = "unlit|blend|back|less|alpha";
const POST_TONEMAP_PIPELINE_KEY = `unlit|${MATERIAL_POST_TONEMAP_STAGE_FEATURE}|${MATERIAL_UNTONEMAPPED_FEATURE}|blend|back|less|alpha`;

const SCENE_BATCH: BatchCompatibilityKey = {
  pipelineKey: SCENE_PIPELINE_KEY,
  materialKey: "material:board",
  meshLayoutKey: "mesh-layout:triangle",
  topology: "triangle-list",
  instanced: false,
  skinned: false,
  morphed: false,
};
const POST_TONEMAP_BATCH: BatchCompatibilityKey = {
  ...SCENE_BATCH,
  pipelineKey: POST_TONEMAP_PIPELINE_KEY,
  materialKey: "material:pad",
};

describe("post-tonemap mesh render stage", () => {
  describe("stage availability", () => {
    it("is available only when a post stack tone-maps the HDR scene buffer afterwards", () => {
      expect(
        webGpuAppUsesPostTonemapMeshStage({
          initialization: { format: "bgra8unorm" },
          sceneRenderFormat: "rgba16float",
          postEffects: [{ enabled: true }],
        }),
      ).toBe(true);

      // No HDR scene buffer: mesh materials already tonemap in-material and
      // write display-space color to the 8-bit swapchain, so a scene-stage
      // draw ALREADY blends in display space.
      expect(
        webGpuAppUsesPostTonemapMeshStage({
          initialization: { format: "bgra8unorm" },
          sceneRenderFormat: "bgra8unorm",
          postEffects: [{ enabled: true }],
        }),
      ).toBe(false);

      // HDR but every post effect disabled: there is no overlay boundary to
      // encode into, so routing would address a pass that never runs.
      expect(
        webGpuAppUsesPostTonemapMeshStage({
          initialization: { format: "bgra8unorm" },
          sceneRenderFormat: "rgba16float",
          postEffects: [{ enabled: false }],
        }),
      ).toBe(false);
    });

    it("selects only the post-tonemap draws from a snapshot", () => {
      expect([
        ...webGpuAppPostTonemapMeshRenderIds(hdrApp(), stageSnapshot()),
      ]).toEqual([9]);

      expect([
        ...webGpuAppPostTonemapMeshRenderIds(nonHdrApp(), stageSnapshot()),
      ]).toEqual([]);
    });
  });

  describe("draw-stage pipeline selection", () => {
    it("builds a presentation pipeline that skips the tonemap when toneMapped is false", async () => {
      const created = await createPipeline({
        app: hdrPipelineApp(),
        pipelineKey: POST_TONEMAP_PIPELINE_KEY,
        renderStage: "post-tonemap",
      });

      // Swapchain format, a single color target (the overlay boundary has no
      // motion-vector or indirect attachment) and sample count 1.
      expect(created.descriptor.fragment.targets).toHaveLength(1);
      expect(created.descriptor.fragment.targets[0]?.format).toBe("bgra8unorm");
      expect(created.descriptor.multisample?.count ?? 1).toBe(1);
      // `toneMapped: false` writes the authored color through untouched, which
      // is what lets the blend match a three.js `toneMapped: false` overlay.
      expect(created.shaderSource).not.toContain("ACESInputMat");

      // The same stage WITH the default `toneMapped: true` still applies the
      // app's operator to its own fragment value — it only moves the BLEND
      // into display space. That is the particle renderer's contract too.
      const toneMapped = await createPipeline({
        app: hdrPipelineApp(),
        pipelineKey: `unlit|${MATERIAL_POST_TONEMAP_STAGE_FEATURE}|blend|back|less|alpha`,
        renderStage: "post-tonemap",
      });

      expect(toneMapped.descriptor.fragment.targets[0]?.format).toBe(
        "bgra8unorm",
      );
      expect(toneMapped.shaderSource).toContain("ACESInputMat");
    });

    it("keeps the scene pipeline on the HDR scene buffer for the same material family", async () => {
      const created = await createPipeline({
        app: hdrPipelineApp(),
        pipelineKey: SCENE_PIPELINE_KEY,
      });

      expect(created.descriptor.fragment.targets[0]?.format).toBe(
        "rgba16float",
      );
    });

    it("falls back to the scene pipeline when the app has no post stack", async () => {
      const created = await createPipeline({
        app: nonHdrPipelineApp(),
        pipelineKey: POST_TONEMAP_PIPELINE_KEY,
        renderStage: "post-tonemap",
      });

      expect(created.descriptor.fragment.targets[0]?.format).toBe("bgra8unorm");
      expect(created.descriptor.multisample?.count ?? 1).toBe(4);
    });

    it("never writes depth from a post-tonemap pipeline", () => {
      // The overlay boundary binds the scene depth attachment READ-ONLY, so an
      // opaque-alphaMode overlay must not ask for depth writes.
      expect(
        resolveWebGpuPipelineRenderState(
          `unlit|${MATERIAL_POST_TONEMAP_STAGE_FEATURE}|opaque|back|less|none`,
          "depth24plus",
        ).depthWriteEnabled,
      ).toBe(false);
      expect(
        resolveWebGpuPipelineRenderState(
          "unlit|opaque|back|less|none",
          "depth24plus",
        ).depthWriteEnabled,
      ).toBe(true);
    });
  });

  describe("queue and pass placement", () => {
    it("splits post-tonemap draws out of the scene command plan", () => {
      const scenePipeline = pipelineWithKey(SCENE_PIPELINE_KEY);
      const postTonemapPipeline = pipelineWithKey(POST_TONEMAP_PIPELINE_KEY);
      const plan = writeRenderFramePlanFromSnapshot({
        snapshot: stageSnapshot(),
        renderWorld: new RenderWorld(),
        transforms: stageTransforms(),
        resolveMeshResourceKey: () => "mesh:quad",
        resolveMaterialResourceKey: (draw) => draw.batchKey.materialKey,
        meshResources: [mesh()],
        pipelineKeysByRenderId: new Map([
          [7, SCENE_PIPELINE_KEY],
          [9, POST_TONEMAP_PIPELINE_KEY],
        ]),
        pipelines: [scenePipeline, postTonemapPipeline],
        bindGroups: stageBindGroups(),
        postTonemapRenderIds: new Set([9]),
        scratch: scratch(),
      });

      expect(plan.summary.ready).toBe(true);
      expect(drawRenderIds(plan.commandPlan.commands)).toEqual([7]);
      expect(drawRenderIds(plan.postTonemapCommandPlan.commands)).toEqual([9]);

      // Each plan writes its own command stream, so the post-tonemap draw
      // re-emits every piece of state the scene stream had already set.
      expect(
        plan.postTonemapCommandPlan.commands.some(
          (command) =>
            command.kind === "setPipeline" &&
            command.pipelineKey === POST_TONEMAP_PIPELINE_KEY,
        ),
      ).toBe(true);
      expect(
        plan.postTonemapCommandPlan.commands.filter(
          (command) => command.kind === "setBindGroup",
        ),
      ).toHaveLength(3);
    });

    it("leaves the scene plan untouched when nothing opts in", () => {
      const plan = writeRenderFramePlanFromSnapshot({
        snapshot: stageSnapshot(),
        renderWorld: new RenderWorld(),
        transforms: stageTransforms(),
        resolveMeshResourceKey: () => "mesh:quad",
        resolveMaterialResourceKey: (draw) => draw.batchKey.materialKey,
        meshResources: [mesh()],
        pipelineKeysByRenderId: new Map([
          [7, SCENE_PIPELINE_KEY],
          [9, POST_TONEMAP_PIPELINE_KEY],
        ]),
        pipelines: [
          pipelineWithKey(SCENE_PIPELINE_KEY),
          pipelineWithKey(POST_TONEMAP_PIPELINE_KEY),
        ],
        bindGroups: stageBindGroups(),
        scratch: scratch(),
      });

      expect(drawRenderIds(plan.commandPlan.commands)).toEqual([7, 9]);
      expect(plan.postTonemapCommandPlan.commands).toEqual([]);
    });

    it("orders mesh overlays under the particle and UI feature overlays", () => {
      const meshOverlay = [drawCommand(9)];
      const featureOverlay = [drawCommand(41)];

      expect(
        webGpuAppOverlayCommandsWithPostTonemapMeshDraws(
          meshOverlay,
          featureOverlay,
        ),
      ).toEqual([...meshOverlay, ...featureOverlay]);
      expect(
        webGpuAppOverlayCommandsWithPostTonemapMeshDraws([], featureOverlay),
      ).toBe(featureOverlay);
    });
  });
});

function drawRenderIds(commands: readonly RenderPassCommand[]): number[] {
  return commands
    .filter(
      (command) => command.kind === "draw" || command.kind === "drawIndexed",
    )
    .map((command) => command.renderId);
}

function drawCommand(renderId: number): RenderPassCommand {
  return {
    kind: "draw",
    renderId,
    vertexCount: 3,
    instanceCount: 1,
    firstVertex: 0,
    firstInstance: 0,
  };
}

async function createPipeline(input: {
  readonly app: unknown;
  readonly pipelineKey: string;
  readonly renderStage?: "scene" | "post-tonemap";
}) {
  const descriptors: {
    fragment: { targets: { format: string }[] };
    multisample?: { count: number };
  }[] = [];
  const shaderSources: string[] = [];
  const device = {
    createShaderModule(descriptor: { code: string }) {
      shaderSources.push(descriptor.code);
      return { compilationInfo: async () => ({ messages: [] }) };
    },
    createRenderPipeline(descriptor: {
      fragment: { targets: { format: string }[] };
      multisample?: { count: number };
    }) {
      descriptors.push(descriptor);
      return { kind: "render-pipeline" };
    },
  };
  const app = {
    ...(input.app as object),
    initialization: {
      ...((input.app as { initialization: object }).initialization as object),
      device,
    },
  };
  const result = await getOrCreateWebGpuAppPipeline({
    app: app as never,
    cache: createWebGpuAppResourceCache(),
    reuse: { pipelineHits: 0, pipelineMisses: 0 } as never,
    kind: "unlit",
    pipelineKey: input.pipelineKey,
    batchKey:
      input.pipelineKey === POST_TONEMAP_PIPELINE_KEY
        ? POST_TONEMAP_BATCH
        : SCENE_BATCH,
    ...(input.renderStage === undefined
      ? {}
      : { renderStage: input.renderStage }),
  });

  expect(result.valid).toBe(true);

  const descriptor = descriptors[0];

  if (descriptor === undefined) {
    throw new Error("No render pipeline descriptor was created.");
  }

  return { descriptor, shaderSource: shaderSources.join("\n") };
}

function hdrApp() {
  return {
    initialization: { format: "bgra8unorm" },
    sceneRenderFormat: "rgba16float",
    postEffects: [{ enabled: true }],
  };
}

function nonHdrApp() {
  return {
    initialization: { format: "bgra8unorm" },
    sceneRenderFormat: "bgra8unorm",
    postEffects: [],
  };
}

function hdrPipelineApp() {
  return {
    ...hdrApp(),
    tonemap: "aces",
    outputColorSpace: "srgb",
    msaa: { sampleCount: 1 },
  };
}

function nonHdrPipelineApp() {
  return {
    ...nonHdrApp(),
    tonemap: "aces",
    outputColorSpace: "srgb",
    msaa: { sampleCount: 4 },
  };
}

function stageSnapshot(): RenderSnapshot {
  return {
    frame: 1,
    views: [],
    meshDraws: [
      stagePacket(7, 0, SCENE_BATCH),
      {
        ...stagePacket(9, 16, POST_TONEMAP_BATCH),
        renderStage: "post-tonemap",
      },
    ],
    lights: [],
    environments: [],
    shadowRequests: [],
    bounds: [],
    transforms: new Float32Array(32),
    viewMatrices: new Float32Array(),
    diagnostics: [],
    report: {
      views: 0,
      meshDraws: 2,
      lights: 0,
      environments: 0,
      shadowRequests: 0,
      bounds: 0,
      diagnostics: 0,
    },
  } as unknown as RenderSnapshot;
}

function stagePacket(
  renderId: number,
  worldTransformOffset: number,
  batchKey: BatchCompatibilityKey,
) {
  return {
    renderId,
    entity: { index: renderId, generation: 1 },
    mesh: { kind: "mesh", id: "quad" },
    material: { kind: "material", id: batchKey.materialKey },
    submesh: 0,
    materialSlot: 0,
    worldTransformOffset,
    boundsIndex: -1,
    layerMask: 1,
    sortKey: stageSortKey(renderId, batchKey),
    batchKey,
  };
}

function stageSortKey(
  stableId: number,
  batchKey: BatchCompatibilityKey,
): RenderSortKey {
  return {
    queue: "transparent",
    viewId: 0,
    layer: 0,
    order: 0,
    pipelineKey: batchKey.pipelineKey,
    materialKey: batchKey.materialKey,
    meshKey: "mesh:quad",
    depth: 0,
    stableId,
  };
}

function stageTransforms() {
  return {
    data: new Float32Array(32),
    offsets: [
      { renderId: 7, sourceOffset: 0, packedOffset: 0 },
      { renderId: 9, sourceOffset: 16, packedOffset: 16 },
    ],
    diagnostics: [],
  };
}

function pipelineWithKey(key: string): GetOrCreateRenderPipelineResult {
  return {
    ok: true,
    status: "miss",
    key,
    pipeline: `pipeline-handle:${key}`,
    diagnostics: [],
  };
}

function stageBindGroups(): readonly UnlitBindGroupResource[] {
  return [
    ...[0, 1, 2].map((group) => ({
      group,
      resourceKey: `bind:${group}`,
      layoutKey: `layout:${group}`,
      bindGroup: `bind-group:${group}`,
      entryResourceKeys:
        group === 2 ? ["material:board"] : [`resource:${group}`],
    })),
    {
      group: 2,
      resourceKey: "bind:2:pad",
      layoutKey: "layout:2",
      bindGroup: "bind-group:2:pad",
      entryResourceKeys: ["material:pad"],
    },
  ];
}

function mesh(): MeshGpuBufferResource {
  return {
    resourceKey: "mesh:quad",
    vertexCount: 3,
    vertexBuffers: [
      {
        streamId: "positions",
        resourceKey: "mesh:quad:positions",
        buffer: "vertex-buffer-handle",
        vertexCount: 3,
      },
    ],
  };
}

function scratch() {
  return createRenderFramePlanScratch();
}
