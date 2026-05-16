import { describe, expect, it } from "vitest";

import {
  RenderWorld,
  planRenderFrameFromSnapshot,
  type BatchCompatibilityKey,
  type GetOrCreateRenderPipelineResult,
  type MeshGpuBufferResource,
  type RenderSnapshot,
  type RenderSortKey,
  type UnlitBindGroupResource,
} from "../../src/index.js";

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

describe("render frame snapshot planning helper", () => {
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
    expect(result.summary.counts).toMatchObject({
      apply: { active: 2, created: 2 },
      binding: { planned: 2, applied: 2, ready: 2, blocked: 0 },
      draw: { packages: 2, descriptors: 2, drawList: 2, resolved: 2 },
      command: { drawCount: 2, nonIndexedDrawCount: 2 },
    });
    expect(result.commandPlan.drawCount).toBe(2);
    expect(
      result.commandPlan.commands
        .filter((command) => command.kind === "draw")
        .map((command) => command.renderId),
    ).toEqual([7, 9]);
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
        phase: "draw-list",
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
        phase: "draw-list",
        code: "renderPassDrawList.missingBindGroupResource",
        renderId: 11,
      },
    ]);
  });
});

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

function texturedPacket(worldTransformOffset = 0) {
  return {
    ...packet(11, worldTransformOffset),
    material: { kind: "material", id: "textured" },
    batchKey: TEXTURED_BATCH,
    sortKey: texturedSortKey(),
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
