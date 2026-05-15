import { describe, expect, it } from "vitest";

import {
  planRenderPassDrawList,
  type DrawCommandDescriptor,
  type GetOrCreateRenderPipelineResult,
  type UnlitBindGroupResource,
} from "../../src/index.js";

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

  it("keeps draw list records in stable render id order", () => {
    const plan = planRenderPassDrawList({
      drawCommands: [drawCommand(3), drawCommand(1), drawCommand(2)],
      pipelines: [pipeline("pipeline:unlit")],
      bindGroups: bindGroups("material:white"),
    });

    expect(plan.draws.map((draw) => draw.renderId)).toEqual([1, 2, 3]);
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
