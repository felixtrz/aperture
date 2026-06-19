import { describe, expect, it } from "vitest";

import {
  RENDER_FRAME_PHASES,
  RenderWorld,
  createRenderFrameQueueDiagnosticsSummary,
  createRenderFramePlanScratch,
  describeRenderFramePhases,
  planRenderFrameFromSnapshot,
  writeRenderFramePlanFromSnapshot,
  type BatchCompatibilityKey,
  type GetOrCreateRenderPipelineResult,
  type MeshGpuBufferResource,
  type RenderSnapshot,
  type RenderSortKey,
  type UnlitBindGroupResource,
} from "@aperture-engine/webgpu/test-support";

const BATCH: BatchCompatibilityKey = {
  pipelineKey: "pipeline:unlit",
  materialKey: "material:red",
  meshLayoutKey: "mesh-layout:triangle",
  topology: "triangle-list",
  instanced: false,
  skinned: false,
  morphed: false,
};
const TEXTURED_BATCH: BatchCompatibilityKey = {
  ...BATCH,
  pipelineKey: "pipeline:unlit/baseColorTexture",
  materialKey: "material:textured",
};
const STANDARD_BATCH: BatchCompatibilityKey = {
  ...BATCH,
  pipelineKey: "standard|opaque|back|less|none",
};

describe("render frame snapshot planning helper", () => {
  it("documents the canonical WebGPU render-frame phase taxonomy", () => {
    expect(RENDER_FRAME_PHASES).toEqual([
      "apply",
      "prepare",
      "queue",
      "resolve",
      "command",
      "submit",
    ]);
    expect(describeRenderFramePhases().map((phase) => phase.phase)).toEqual(
      RENDER_FRAME_PHASES,
    );
    expect(describeRenderFramePhases().map((phase) => phase.summary)).toContain(
      "Resolve draw packages into draw descriptors, draw lists, and pass resources.",
    );
  });

  it("plans from snapshot through render pass commands", () => {
    const result = planRenderFrameFromSnapshot({
      snapshot: snapshot(),
      renderWorld: new RenderWorld(),
      transforms: transforms(),
      resolveMeshResourceKey: () => "mesh:triangle",
      resolveMaterialResourceKey: () => "material:red",
      meshResources: [mesh()],
      pipelines: [pipeline()],
      bindGroups: bindGroups(),
    });

    expect(result.summary.ready).toBe(true);
    expect(result.summary.phaseOrder).toEqual([
      "apply",
      "prepare",
      "queue",
      "resolve",
      "command",
      "submit",
    ]);
    expect(result.summary.phases).toMatchObject({
      apply: { ready: true, counts: { active: 2, created: 2 } },
      prepare: { ready: true, counts: { planned: 2, applied: 2 } },
      queue: { ready: true, counts: { ready: 2, blocked: 0, packages: 2 } },
      resolve: { ready: true, counts: { descriptors: 2, resolved: 1 } },
      command: { ready: true, counts: { drawCount: 1 } },
      submit: { ready: true, counts: { submitted: 0, plannedDraws: 1 } },
    });
    expect(result.summary.counts).toMatchObject({
      apply: { active: 2, created: 2 },
      binding: { planned: 2, applied: 2, ready: 2, blocked: 0 },
      draw: { packages: 2, descriptors: 2, drawList: 1, resolved: 1 },
      command: { drawCount: 1, nonIndexedDrawCount: 1 },
    });
    expect(result.commandPlan.drawCount).toBe(1);
    expect(
      result.commandPlan.commands
        .filter((command) => command.kind === "draw")
        .map((command) => ({
          renderId: command.renderId,
          instanceCount: command.instanceCount,
        })),
    ).toEqual([{ renderId: 7, instanceCount: 2 }]);
  });

  it("can reuse caller-owned summary scratch across frame plans", () => {
    const scratch = createRenderFramePlanScratch();
    const first = writeReadyFrameWithScratch(scratch);
    const firstResult = first;
    const firstSummary = first.summary;
    const firstApplyPhase = first.summary.phases.apply;
    const firstDiagnostics = first.summary.diagnostics;
    const second = writeReadyFrameWithScratch(scratch);

    expect(second).toBe(firstResult);
    expect(second.summary).toBe(firstSummary);
    expect(second.summary.phases.apply).toBe(firstApplyPhase);
    expect(second.summary.diagnostics).toBe(firstDiagnostics);
    expect(second.summary.ready).toBe(true);
    expect(second.summary.counts.draw.packages).toBe(2);
  });

  it("summarizes an empty render-world queue without exposing frame payloads", () => {
    const result = planRenderFrameFromSnapshot({
      snapshot: emptySnapshot(),
      renderWorld: new RenderWorld(),
      transforms: emptyTransforms(),
      resolveMeshResourceKey: () => "mesh:triangle",
      resolveMaterialResourceKey: () => "material:red",
      meshResources: [mesh()],
      pipelines: [pipeline()],
      bindGroups: bindGroups(),
    });
    const summary = createRenderFrameQueueDiagnosticsSummary(result);

    expect(summary).toEqual({
      ready: false,
      readyDrawCount: 0,
      blockedDrawCount: 0,
      packageCount: 0,
      packagePoolSize: 0,
      packageSlotsReused: 0,
      packageSlotsCreated: 0,
      missingPackedTransformCount: 0,
      draw: {
        packages: 0,
        descriptors: 0,
        drawList: 0,
        resolved: 0,
      },
      stateSort: expect.objectContaining({
        phase: "opaque",
        recordCount: 0,
      }),
      diagnostics: {
        total: 1,
        byCode: {
          "renderWorld.empty": 1,
        },
      },
    });
    expect(JSON.stringify(summary)).not.toContain("meshDraws");
  });

  it("summarizes ready queue package reuse as scalar counts", () => {
    const scratch = createRenderFramePlanScratch();

    writeReadyFrameWithScratch(scratch);
    const result = writeReadyFrameWithScratch(scratch);
    const summary = createRenderFrameQueueDiagnosticsSummary(result);

    expect(summary).toEqual({
      ready: true,
      readyDrawCount: 2,
      blockedDrawCount: 0,
      packageCount: 2,
      packagePoolSize: 2,
      packageSlotsReused: 2,
      packageSlotsCreated: 0,
      missingPackedTransformCount: 0,
      draw: {
        packages: 2,
        descriptors: 2,
        drawList: 1,
        resolved: 1,
      },
      stateSort: expect.objectContaining({
        phase: "opaque",
        recordCount: 2,
      }),
      diagnostics: {
        total: 0,
        byCode: {},
      },
    });
    const serialized = JSON.stringify(summary);

    expect(serialized).not.toContain("packet");
    expect(serialized).not.toContain("pipeline-handle");
    expect(serialized).not.toContain("bind-group");
  });

  it("summarizes missing resource binding diagnostics without planning draws", () => {
    const result = planRenderFrameFromSnapshot({
      snapshot: snapshot(),
      renderWorld: new RenderWorld(),
      transforms: transforms(),
      resolveMeshResourceKey: () => null,
      resolveMaterialResourceKey: () => "material:red",
      meshResources: [mesh()],
      pipelines: [pipeline()],
      bindGroups: bindGroups(),
    });

    expect(result.summary.ready).toBe(false);
    expect(result.summary.counts).toMatchObject({
      binding: { planned: 2, applied: 2, ready: 0, blocked: 2 },
      draw: { packages: 0, descriptors: 0, drawList: 0, resolved: 0 },
      command: { drawCount: 0 },
    });
    expect(
      result.summary.diagnostics.map((diagnostic) => diagnostic.code),
    ).toEqual([
      "renderFrameSnapshotBinding.missingMeshResource",
      "renderFrameSnapshotBinding.missingMeshResource",
      "renderWorld.missingMeshResource",
      "renderWorld.missingMeshResource",
      "renderDrawPackage.blockedDraw",
      "renderDrawPackage.blockedDraw",
    ]);
    expect(
      result.summary.diagnostics.map((diagnostic) => diagnostic.phase),
    ).toEqual(["prepare", "prepare", "queue", "queue", "queue", "queue"]);
  });

  it("summarizes blocked queue diagnostics separately from prepare failures", () => {
    const result = planRenderFrameFromSnapshot({
      snapshot: snapshot(),
      renderWorld: new RenderWorld(),
      transforms: transforms(),
      resolveMeshResourceKey: () => null,
      resolveMaterialResourceKey: () => "material:red",
      meshResources: [mesh()],
      pipelines: [pipeline()],
      bindGroups: bindGroups(),
    });
    const summary = createRenderFrameQueueDiagnosticsSummary(result);

    expect(summary).toMatchObject({
      ready: false,
      readyDrawCount: 0,
      blockedDrawCount: 2,
      packageCount: 0,
      missingPackedTransformCount: 0,
      diagnostics: {
        total: 4,
        byCode: {
          "renderWorld.missingMeshResource": 2,
          "renderDrawPackage.blockedDraw": 2,
        },
      },
    });
  });

  it("summarizes missing packed transform package diagnostics", () => {
    const result = planRenderFrameFromSnapshot({
      snapshot: snapshot(),
      renderWorld: new RenderWorld(),
      transforms: missingPackedTransforms(),
      resolveMeshResourceKey: () => "mesh:triangle",
      resolveMaterialResourceKey: () => "material:red",
      meshResources: [mesh()],
      pipelines: [pipeline()],
      bindGroups: bindGroups(),
    });
    const summary = createRenderFrameQueueDiagnosticsSummary(result);

    expect(summary).toMatchObject({
      ready: false,
      readyDrawCount: 2,
      blockedDrawCount: 0,
      packageCount: 0,
      missingPackedTransformCount: 2,
      diagnostics: {
        total: 2,
        byCode: {
          "renderDrawPackage.missingPackedTransform": 2,
        },
      },
    });
  });

  it("keeps textured unlit material bind groups associated with resolved draws", () => {
    const result = planRenderFrameFromSnapshot({
      snapshot: texturedSnapshot(),
      renderWorld: new RenderWorld(),
      transforms: texturedTransforms(),
      resolveMeshResourceKey: () => "mesh:triangle",
      resolveMaterialResourceKey: () => "material:textured",
      meshResources: [mesh()],
      pipelines: [texturedPipeline()],
      bindGroups: texturedBindGroups(),
    });

    expect(result.summary.ready).toBe(true);
    expect(result.summary.counts).toMatchObject({
      binding: { planned: 1, applied: 1, ready: 1, blocked: 0 },
      draw: { packages: 1, descriptors: 1, drawList: 1, resolved: 1 },
      command: { drawCount: 1, nonIndexedDrawCount: 1 },
    });
    expect(result.drawList.draws[0]?.bindGroupKeys).toEqual([
      "bind:0",
      "bind:1",
      "bind:2:textured",
    ]);
    expect(result.resources.draws[0]?.bindGroups).toMatchObject([
      { group: 0, resourceKey: "bind:0" },
      { group: 1, resourceKey: "bind:1" },
      { group: 2, resourceKey: "bind:2:textured" },
    ]);
    expect(
      result.commandPlan.commands
        .filter((command) => command.kind === "setBindGroup")
        .map((command) => ({
          index: command.index,
          resourceKey: command.resourceKey,
        })),
    ).toEqual([
      { index: 0, resourceKey: "bind:0" },
      { index: 1, resourceKey: "bind:1" },
      { index: 2, resourceKey: "bind:2:textured" },
    ]);
  });

  it("keeps shared and material bind groups scoped to each pipeline in mixed frames", () => {
    const result = planRenderFrameFromSnapshot({
      snapshot: mixedPipelineSnapshot(),
      renderWorld: new RenderWorld(),
      transforms: mixedPipelineTransforms(),
      resolveMeshResourceKey: () => "mesh:triangle",
      resolveMaterialResourceKey: (draw) => draw.batchKey.materialKey,
      meshResources: [mesh()],
      pipelines: [pipeline(), texturedPipeline()],
      bindGroups: multiPipelineBindGroups(),
    });

    expect(result.summary.ready).toBe(true);
    expect(result.summary.counts).toMatchObject({
      binding: { planned: 2, applied: 2, ready: 2, blocked: 0 },
      draw: { packages: 2, descriptors: 2, drawList: 2, resolved: 2 },
      command: { drawCount: 2, nonIndexedDrawCount: 2 },
    });
    expect(result.drawList.draws.map(drawPipelineAndBindGroups)).toEqual([
      {
        renderId: 7,
        pipelineKey: "pipeline:unlit",
        bindGroupKeys: [
          "bind:0:pipeline:unlit",
          "bind:1:pipeline:unlit",
          "bind:2:material:red",
        ],
      },
      {
        renderId: 11,
        pipelineKey: "pipeline:unlit/baseColorTexture",
        bindGroupKeys: [
          "bind:0:pipeline:unlit/baseColorTexture",
          "bind:1:pipeline:unlit/baseColorTexture",
          "bind:2:material:textured",
        ],
      },
    ]);
    expect(
      result.resources.draws.map((draw) => ({
        renderId: draw.renderId,
        pipelineKey: draw.pipelineKey,
        bindGroups: draw.bindGroups.map((bindGroup) => ({
          group: bindGroup.group,
          resourceKey: bindGroup.resourceKey,
        })),
      })),
    ).toEqual([
      {
        renderId: 7,
        pipelineKey: "pipeline:unlit",
        bindGroups: [
          { group: 0, resourceKey: "bind:0:pipeline:unlit" },
          { group: 1, resourceKey: "bind:1:pipeline:unlit" },
          { group: 2, resourceKey: "bind:2:material:red" },
        ],
      },
      {
        renderId: 11,
        pipelineKey: "pipeline:unlit/baseColorTexture",
        bindGroups: [
          {
            group: 0,
            resourceKey: "bind:0:pipeline:unlit/baseColorTexture",
          },
          {
            group: 1,
            resourceKey: "bind:1:pipeline:unlit/baseColorTexture",
          },
          { group: 2, resourceKey: "bind:2:material:textured" },
        ],
      },
    ]);
  });

  it("resolves default-layout bind groups against renderer pipeline resource keys", () => {
    const result = planRenderFrameFromSnapshot({
      snapshot: sharedStandardPipelineSnapshot(),
      renderWorld: new RenderWorld(),
      transforms: sharedStandardPipelineTransforms(),
      resolveMeshResourceKey: () => "mesh:triangle",
      resolveMaterialResourceKey: (draw) => draw.batchKey.materialKey,
      meshResources: [mesh()],
      pipelineKeysByRenderId: new Map([
        [17, "gpu-pipeline:standard:red"],
        [19, "gpu-pipeline:standard:blue"],
      ]),
      pipelines: [
        pipelineWithKey("gpu-pipeline:standard:red"),
        pipelineWithKey("gpu-pipeline:standard:blue"),
      ],
      bindGroups: standardResourceKeyScopedBindGroups(),
    });

    expect(result.summary.ready).toBe(true);
    expect(result.drawList.draws.map(drawPipelineAndBindGroups)).toEqual([
      {
        renderId: 19,
        pipelineKey: "gpu-pipeline:standard:blue",
        bindGroupKeys: [
          "bind:0:gpu-pipeline:standard:blue",
          "bind:1:gpu-pipeline:standard:blue",
          "bind:2:material:blue:gpu-pipeline:standard:blue",
          "bind:3:gpu-pipeline:standard:blue",
        ],
      },
      {
        renderId: 17,
        pipelineKey: "gpu-pipeline:standard:red",
        bindGroupKeys: [
          "bind:0:gpu-pipeline:standard:red",
          "bind:1:gpu-pipeline:standard:red",
          "bind:2:material:red:gpu-pipeline:standard:red",
          "bind:3:gpu-pipeline:standard:red",
        ],
      },
    ]);
    expect(
      result.commandPlan.commands
        .filter((command) => command.kind === "setPipeline")
        .map((command) => command.pipelineKey),
    ).toEqual(["gpu-pipeline:standard:blue", "gpu-pipeline:standard:red"]);
  });

  it("diagnoses missing pipeline-scoped shared bind groups in mixed frames", () => {
    const result = planRenderFrameFromSnapshot({
      snapshot: mixedPipelineSnapshot(),
      renderWorld: new RenderWorld(),
      transforms: mixedPipelineTransforms(),
      resolveMeshResourceKey: () => "mesh:triangle",
      resolveMaterialResourceKey: (draw) => draw.batchKey.materialKey,
      meshResources: [mesh()],
      pipelines: [pipeline(), texturedPipeline()],
      bindGroups: multiPipelineBindGroups().filter(
        (bindGroup) =>
          bindGroup.resourceKey !== "bind:1:pipeline:unlit/baseColorTexture",
      ),
    });

    expect(result.summary.ready).toBe(false);
    expect(result.summary.counts).toMatchObject({
      binding: { planned: 2, applied: 2, ready: 2, blocked: 0 },
      draw: { packages: 2, descriptors: 2, drawList: 1, resolved: 1 },
      command: { drawCount: 1, nonIndexedDrawCount: 1 },
    });
    expect(result.drawList.draws.map((draw) => draw.renderId)).toEqual([7]);
    expect(result.drawList.diagnostics).toMatchObject([
      {
        code: "renderPassDrawList.missingBindGroupResource",
        renderId: 11,
        bindGroup: { group: 1 },
      },
    ]);
    expect(result.summary.diagnostics).toMatchObject([
      {
        phase: "resolve",
        source: "draw-list",
        code: "renderPassDrawList.missingBindGroupResource",
        renderId: 11,
      },
    ]);
  });

  it("diagnoses missing textured unlit material bind group resources", () => {
    const result = planRenderFrameFromSnapshot({
      snapshot: texturedSnapshot(),
      renderWorld: new RenderWorld(),
      transforms: texturedTransforms(),
      resolveMeshResourceKey: () => "mesh:triangle",
      resolveMaterialResourceKey: () => "material:textured",
      meshResources: [mesh()],
      pipelines: [texturedPipeline()],
      bindGroups: texturedBindGroups().filter((group) => group.group !== 2),
    });

    expect(result.summary.ready).toBe(false);
    expect(result.summary.counts).toMatchObject({
      binding: { planned: 1, applied: 1, ready: 1, blocked: 0 },
      draw: { packages: 1, descriptors: 1, drawList: 0, resolved: 0 },
      command: { drawCount: 0 },
    });
    expect(result.drawList.diagnostics).toMatchObject([
      {
        code: "renderPassDrawList.missingBindGroupResource",
        renderId: 11,
        bindGroup: {
          group: 2,
          materialResourceKey: "material:textured",
        },
      },
    ]);
    expect(result.summary.diagnostics).toMatchObject([
      {
        phase: "resolve",
        source: "draw-list",
        code: "renderPassDrawList.missingBindGroupResource",
        renderId: 11,
      },
    ]);
  });
});

function writeReadyFrameWithScratch(
  scratch: ReturnType<typeof createRenderFramePlanScratch>,
) {
  return writeRenderFramePlanFromSnapshot({
    snapshot: snapshot(),
    renderWorld: new RenderWorld(),
    transforms: transforms(),
    resolveMeshResourceKey: () => "mesh:triangle",
    resolveMaterialResourceKey: () => "material:red",
    meshResources: [mesh()],
    pipelines: [pipeline()],
    bindGroups: bindGroups(),
    scratch,
  });
}

function emptySnapshot(): RenderSnapshot {
  return {
    frame: 1,
    views: [],
    meshDraws: [],
    lights: [],
    environments: [],
    shadowRequests: [],
    bounds: [],
    transforms: new Float32Array(),
    viewMatrices: new Float32Array(),
    diagnostics: [],
    report: {
      views: 0,
      meshDraws: 0,
      lights: 0,
      environments: 0,
      shadowRequests: 0,
      bounds: 0,
      diagnostics: 0,
    },
  } as unknown as RenderSnapshot;
}

function snapshot(): RenderSnapshot {
  return {
    frame: 1,
    views: [],
    meshDraws: [packet(7, 0), packet(9, 16)],
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

function packet(renderId: number, worldTransformOffset: number) {
  return {
    renderId,
    entity: { index: renderId, generation: 1 },
    mesh: { kind: "mesh", id: "triangle" },
    material: { kind: "material", id: "red" },
    submesh: 0,
    materialSlot: 0,
    worldTransformOffset,
    boundsIndex: -1,
    layerMask: 1,
    sortKey: sortKey(renderId),
    batchKey: BATCH,
  };
}

function texturedSnapshot(): RenderSnapshot {
  return {
    frame: 1,
    views: [],
    meshDraws: [texturedPacket()],
    lights: [],
    environments: [],
    shadowRequests: [],
    bounds: [],
    transforms: new Float32Array(16),
    viewMatrices: new Float32Array(),
    diagnostics: [],
    report: {
      views: 0,
      meshDraws: 1,
      lights: 0,
      environments: 0,
      shadowRequests: 0,
      bounds: 0,
      diagnostics: 0,
    },
  } as unknown as RenderSnapshot;
}

function mixedPipelineSnapshot(): RenderSnapshot {
  return {
    frame: 1,
    views: [],
    meshDraws: [packet(7, 0), texturedPacket(16)],
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

function sharedStandardPipelineSnapshot(): RenderSnapshot {
  return {
    frame: 1,
    views: [],
    meshDraws: [
      standardPacket(17, 0, "material:red"),
      standardPacket(19, 16, "material:blue"),
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

function texturedPacket(worldTransformOffset = 0) {
  return {
    ...packet(11, worldTransformOffset),
    material: { kind: "material", id: "textured" },
    batchKey: TEXTURED_BATCH,
    sortKey: texturedSortKey(),
  };
}

function standardPacket(
  renderId: number,
  worldTransformOffset: number,
  materialKey: "material:red" | "material:blue",
) {
  return {
    ...packet(renderId, worldTransformOffset),
    material: {
      kind: "material",
      id: materialKey === "material:red" ? "red" : "blue",
    },
    batchKey: { ...STANDARD_BATCH, materialKey },
    sortKey: {
      ...sortKey(renderId),
      pipelineKey: STANDARD_BATCH.pipelineKey,
      materialKey,
    },
  };
}

function sortKey(stableId: number): RenderSortKey {
  return {
    queue: "opaque",
    viewId: 0,
    layer: 0,
    order: 0,
    pipelineKey: "pipeline:unlit",
    materialKey: "material:red",
    meshKey: "mesh:triangle",
    depth: 0,
    stableId,
  };
}

function texturedSortKey(): RenderSortKey {
  return {
    ...sortKey(11),
    pipelineKey: "pipeline:unlit/baseColorTexture",
    materialKey: "material:textured",
  };
}

function transforms() {
  return {
    data: new Float32Array(32),
    offsets: [
      { renderId: 7, sourceOffset: 0, packedOffset: 0 },
      { renderId: 9, sourceOffset: 16, packedOffset: 16 },
    ],
    diagnostics: [],
  };
}

function emptyTransforms() {
  return {
    data: new Float32Array(),
    offsets: [],
    diagnostics: [],
  };
}

function missingPackedTransforms() {
  return {
    data: new Float32Array(32),
    offsets: [],
    diagnostics: [],
  };
}

function texturedTransforms() {
  return {
    data: new Float32Array(16),
    offsets: [{ renderId: 11, sourceOffset: 0, packedOffset: 0 }],
    diagnostics: [],
  };
}

function mixedPipelineTransforms() {
  return {
    data: new Float32Array(32),
    offsets: [
      { renderId: 7, sourceOffset: 0, packedOffset: 0 },
      { renderId: 11, sourceOffset: 16, packedOffset: 16 },
    ],
    diagnostics: [],
  };
}

function sharedStandardPipelineTransforms() {
  return {
    data: new Float32Array(32),
    offsets: [
      { renderId: 17, sourceOffset: 0, packedOffset: 0 },
      { renderId: 19, sourceOffset: 16, packedOffset: 16 },
    ],
    diagnostics: [],
  };
}

function pipeline(): GetOrCreateRenderPipelineResult {
  return {
    ok: true,
    status: "miss",
    key: "pipeline:unlit",
    pipeline: "pipeline-handle",
    diagnostics: [],
  };
}

function texturedPipeline(): GetOrCreateRenderPipelineResult {
  return {
    ok: true,
    status: "miss",
    key: "pipeline:unlit/baseColorTexture",
    pipeline: "pipeline-handle:textured",
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

function bindGroups(): readonly UnlitBindGroupResource[] {
  return [0, 1, 2].map((group) => ({
    group,
    resourceKey: `bind:${group}`,
    layoutKey: `layout:${group}`,
    bindGroup: `bind-group:${group}`,
    entryResourceKeys: group === 2 ? ["material:red"] : [`resource:${group}`],
  }));
}

function texturedBindGroups(): readonly UnlitBindGroupResource[] {
  return [
    {
      group: 0,
      resourceKey: "bind:0",
      layoutKey: "layout:0",
      bindGroup: "bind-group:0",
      entryResourceKeys: ["resource:0"],
    },
    {
      group: 1,
      resourceKey: "bind:1",
      layoutKey: "layout:1",
      bindGroup: "bind-group:1",
      entryResourceKeys: ["resource:1"],
    },
    {
      group: 2,
      resourceKey: "bind:2:textured",
      layoutKey: "layout:2",
      bindGroup: "bind-group:2:textured",
      entryResourceKeys: [
        "material:textured",
        "texture:base-color",
        "sampler:base-color",
      ],
    },
  ];
}

function multiPipelineBindGroups(): readonly UnlitBindGroupResource[] {
  return [
    pipelineScopedBindGroup(0, BATCH.pipelineKey),
    pipelineScopedBindGroup(1, BATCH.pipelineKey),
    materialBindGroup("material:red"),
    pipelineScopedBindGroup(0, TEXTURED_BATCH.pipelineKey),
    pipelineScopedBindGroup(1, TEXTURED_BATCH.pipelineKey),
    materialBindGroup("material:textured"),
  ];
}

function standardResourceKeyScopedBindGroups(): readonly UnlitBindGroupResource[] {
  return [
    standardPipelineScopedBindGroup(0, "gpu-pipeline:standard:red"),
    standardPipelineScopedBindGroup(1, "gpu-pipeline:standard:red"),
    standardPipelineScopedBindGroup(3, "gpu-pipeline:standard:red"),
    standardMaterialBindGroup("material:red", "gpu-pipeline:standard:red"),
    standardPipelineScopedBindGroup(0, "gpu-pipeline:standard:blue"),
    standardPipelineScopedBindGroup(1, "gpu-pipeline:standard:blue"),
    standardPipelineScopedBindGroup(3, "gpu-pipeline:standard:blue"),
    standardMaterialBindGroup("material:blue", "gpu-pipeline:standard:blue"),
  ];
}

function pipelineScopedBindGroup(
  group: 0 | 1,
  pipelineKey: string,
): UnlitBindGroupResource {
  return {
    group,
    resourceKey: `bind:${group}:${pipelineKey}`,
    layoutKey: `layout:${group}:${pipelineKey}`,
    bindGroup: `bind-group:${group}:${pipelineKey}`,
    entryResourceKeys: [`resource:${group}`, pipelineKey],
  };
}

function standardPipelineScopedBindGroup(
  group: 0 | 1 | 3,
  pipelineKey: string,
): UnlitBindGroupResource {
  return {
    group,
    resourceKey: `bind:${group}:${pipelineKey}`,
    layoutKey: `layout:${group}:${pipelineKey}`,
    bindGroup: `bind-group:${group}:${pipelineKey}`,
    entryResourceKeys: [`resource:${group}`, pipelineKey],
  };
}

function standardMaterialBindGroup(
  materialResourceKey: string,
  pipelineKey: string,
): UnlitBindGroupResource {
  return {
    group: 2,
    resourceKey: `bind:2:${materialResourceKey}:${pipelineKey}`,
    layoutKey: `layout:2:${pipelineKey}`,
    bindGroup: `bind-group:2:${materialResourceKey}:${pipelineKey}`,
    entryResourceKeys: [materialResourceKey, pipelineKey],
  };
}

function materialBindGroup(
  materialResourceKey: string,
): UnlitBindGroupResource {
  return {
    group: 2,
    resourceKey: `bind:2:${materialResourceKey}`,
    layoutKey: "layout:2",
    bindGroup: `bind-group:2:${materialResourceKey}`,
    entryResourceKeys: [materialResourceKey],
  };
}

function drawPipelineAndBindGroups(draw: {
  readonly renderId: number;
  readonly pipelineKey: string;
  readonly bindGroupKeys: readonly string[];
}) {
  return {
    renderId: draw.renderId,
    pipelineKey: draw.pipelineKey,
    bindGroupKeys: draw.bindGroupKeys,
  };
}

function mesh(): MeshGpuBufferResource {
  return {
    resourceKey: "mesh:triangle",
    vertexCount: 3,
    vertexBuffers: [
      {
        streamId: "positions",
        resourceKey: "mesh:triangle:positions",
        buffer: "vertex-buffer-handle",
        vertexCount: 3,
      },
    ],
  };
}
