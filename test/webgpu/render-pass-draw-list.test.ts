import { describe, expect, it } from "vitest";

import {
  createRenderPassDrawListScratch,
  planRenderPassDrawList,
  writeRenderPassDrawList,
  type DrawCommandDescriptor,
  type GetOrCreateRenderPipelineResult,
  type UnlitBindGroupResource,
} from "@aperture-engine/webgpu";

describe("render pass draw list planning", () => {
  it("combines ready draw commands, pipelines, and bind groups", () => {
    const plan = planRenderPassDrawList({
      drawCommands: [drawCommand(2), drawCommand(1)],
      pipelines: [pipeline("pipeline:unlit")],
      bindGroups: bindGroups("material:white"),
    });

    expect(plan.valid).toBe(true);
    expect(plan.diagnostics).toEqual([]);
    expect(plan.draws).toMatchObject([
      {
        renderId: 2,
        pipelineKey: "pipeline:unlit",
        bindGroupKeys: [
          "bind-group:view",
          "bind-group:transforms",
          "bind-group:material:white",
        ],
        vertexBufferKeys: ["mesh:2/vertex"],
        vertexCount: 24,
        indexBufferKey: "mesh:2/index",
        indexCount: 6,
        instanceCount: 1,
      },
      {
        renderId: 1,
        pipelineKey: "pipeline:unlit",
        bindGroupKeys: [
          "bind-group:view",
          "bind-group:transforms",
          "bind-group:material:white",
        ],
        vertexBufferKeys: ["mesh:1/vertex"],
        vertexCount: 24,
        indexBufferKey: "mesh:1/index",
        indexCount: 6,
        instanceCount: 1,
      },
    ]);
  });

  it("diagnoses missing pipeline resources", () => {
    const plan = planRenderPassDrawList({
      drawCommands: [drawCommand(1, { pipelineKey: "pipeline:missing" })],
      pipelines: [pipeline("pipeline:unlit")],
      bindGroups: bindGroups("material:white"),
    });

    expect(plan.valid).toBe(false);
    expect(plan.draws).toEqual([]);
    expect(plan.diagnostics).toMatchObject([
      {
        code: "renderPassDrawList.missingPipelineResource",
        renderId: 1,
        pipelineKey: "pipeline:missing",
      },
    ]);
  });

  it("diagnoses missing bind group resources", () => {
    const plan = planRenderPassDrawList({
      drawCommands: [drawCommand(1, { materialResourceKey: "material:blue" })],
      pipelines: [pipeline("pipeline:unlit")],
      bindGroups: bindGroups("material:white"),
    });

    expect(plan.valid).toBe(false);
    expect(plan.draws).toEqual([]);
    expect(plan.diagnostics).toMatchObject([
      {
        code: "renderPassDrawList.missingBindGroupResource",
        renderId: 1,
        bindGroup: { group: 2, materialResourceKey: "material:blue" },
      },
    ]);
  });

  it("preserves draw command order", () => {
    const plan = planRenderPassDrawList({
      drawCommands: [drawCommand(3), drawCommand(1), drawCommand(2)],
      pipelines: [pipeline("pipeline:unlit")],
      bindGroups: bindGroups("material:white"),
    });

    expect(plan.draws.map((draw) => draw.renderId)).toEqual([3, 1, 2]);
  });

  it("prefers pipeline-specific shared bind groups when present", () => {
    const plan = planRenderPassDrawList({
      drawCommands: [
        drawCommand(1, { pipelineKey: "pipeline:factor" }),
        drawCommand(2, { pipelineKey: "pipeline:textured" }),
      ],
      pipelines: [pipeline("pipeline:factor"), pipeline("pipeline:textured")],
      bindGroups: [
        ...pipelineScopedSharedBindGroups("pipeline:factor"),
        ...pipelineScopedSharedBindGroups("pipeline:textured"),
        bindGroups("material:white")[2] as UnlitBindGroupResource,
      ],
    });

    expect(plan.valid).toBe(true);
    expect(plan.draws.map((draw) => draw.bindGroupKeys.slice(0, 2))).toEqual([
      [
        "bind-group:view:pipeline:factor",
        "bind-group:transforms:pipeline:factor",
      ],
      [
        "bind-group:view:pipeline:textured",
        "bind-group:transforms:pipeline:textured",
      ],
    ]);
  });

  it("can reuse caller-owned draw-list scratch on the frame hot path", () => {
    const scratch = createRenderPassDrawListScratch(2);
    const options = {
      drawCommands: [drawCommand(1), drawCommand(2)],
      pipelines: [pipeline("pipeline:unlit")],
      bindGroups: bindGroups("material:white"),
    };
    const first = writeRenderPassDrawList(options, scratch);
    const firstDraws = [...first.draws];
    const firstBindGroupKeys = first.draws.map((draw) => draw.bindGroupKeys);
    const firstVertexBufferKeys = first.draws.map(
      (draw) => draw.vertexBufferKeys,
    );
    const second = writeRenderPassDrawList(
      { ...options, drawCommands: [drawCommand(2), drawCommand(1)] },
      scratch,
    );

    expect(second).toBe(first);
    expect(new Set(second.draws)).toEqual(new Set(firstDraws));
    expect(second.draws.map((draw) => draw.renderId)).toEqual([2, 1]);
    expect(second.draws[0]?.bindGroupKeys).toBe(firstBindGroupKeys[0]);
    expect(second.draws[1]?.bindGroupKeys).toBe(firstBindGroupKeys[1]);
    expect(second.draws[0]?.vertexBufferKeys).toBe(firstVertexBufferKeys[0]);
    expect(second.draws[1]?.vertexBufferKeys).toBe(firstVertexBufferKeys[1]);
  });
});

function drawCommand(
  renderId: number,
  overrides: Partial<DrawCommandDescriptor> = {},
): DrawCommandDescriptor {
  return {
    renderId,
    pipelineKey: overrides.pipelineKey ?? "pipeline:unlit",
    topology: "triangle-list",
    meshResourceKey: `mesh:${renderId}`,
    materialResourceKey: overrides.materialResourceKey ?? "material:white",
    vertexBufferKeys: [`mesh:${renderId}/vertex`],
    vertexCount: overrides.vertexCount ?? 24,
    indexBufferKey: `mesh:${renderId}/index`,
    indexCount: 6,
    transformPackedOffset: renderId * 16,
  };
}

function pipeline(key: string): GetOrCreateRenderPipelineResult {
  return {
    ok: true,
    status: "miss",
    key,
    pipeline: {},
    diagnostics: [],
  };
}

function bindGroups(materialResourceKey: string): UnlitBindGroupResource[] {
  return [
    {
      group: 0,
      resourceKey: "bind-group:view",
      layoutKey: "layout:view",
      bindGroup: {},
      entryResourceKeys: ["view-uniform-buffer:main"],
    },
    {
      group: 1,
      resourceKey: "bind-group:transforms",
      layoutKey: "layout:transforms",
      bindGroup: {},
      entryResourceKeys: ["buffer:transforms"],
    },
    {
      group: 2,
      resourceKey: `bind-group:${materialResourceKey}`,
      layoutKey: "layout:material",
      bindGroup: {},
      entryResourceKeys: [materialResourceKey],
    },
  ];
}

function pipelineScopedSharedBindGroups(
  pipelineKey: string,
): UnlitBindGroupResource[] {
  return [
    {
      group: 0,
      resourceKey: `bind-group:view:${pipelineKey}`,
      layoutKey: `layout:view:${pipelineKey}`,
      bindGroup: {},
      entryResourceKeys: ["view-uniform-buffer:main", pipelineKey],
    },
    {
      group: 1,
      resourceKey: `bind-group:transforms:${pipelineKey}`,
      layoutKey: `layout:transforms:${pipelineKey}`,
      bindGroup: {},
      entryResourceKeys: ["buffer:transforms", pipelineKey],
    },
  ];
}
