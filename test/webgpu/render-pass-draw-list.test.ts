import { describe, expect, it } from "vitest";

import {
  createRenderPassDrawListScratch,
  planRenderPassDrawList,
  skinningJointBufferResourceKeyForRenderId,
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

  it("coalesces compatible draw commands into one instanced draw", () => {
    const drawCommands = Array.from({ length: 100 }, (_, index) =>
      drawCommand(index + 1, {
        meshResourceKey: "mesh:cube",
        vertexBufferKeys: ["mesh:cube/vertex"],
        indexBufferKey: "mesh:cube/index",
        transformPackedOffset: index * 16,
      }),
    );
    const plan = planRenderPassDrawList({
      drawCommands,
      pipelines: [pipeline("pipeline:unlit")],
      bindGroups: bindGroups("material:white"),
    });

    expect(plan.valid).toBe(true);
    expect(plan.diagnostics).toEqual([]);
    expect(plan.draws).toHaveLength(1);
    expect(plan.draws[0]).toMatchObject({
      renderId: 1,
      meshResourceKey: "mesh:cube",
      instanceCount: 100,
      transformPackedOffset: 0,
    });
  });

  it("keeps separate draws when compatible commands have transform gaps", () => {
    const plan = planRenderPassDrawList({
      drawCommands: [
        drawCommand(1, {
          meshResourceKey: "mesh:cube",
          vertexBufferKeys: ["mesh:cube/vertex"],
          indexBufferKey: "mesh:cube/index",
          transformPackedOffset: 0,
        }),
        drawCommand(2, {
          meshResourceKey: "mesh:cube",
          vertexBufferKeys: ["mesh:cube/vertex"],
          indexBufferKey: "mesh:cube/index",
          transformPackedOffset: 48,
        }),
      ],
      pipelines: [pipeline("pipeline:unlit")],
      bindGroups: bindGroups("material:white"),
    });

    expect(plan.draws).toHaveLength(2);
    expect(plan.draws.map((draw) => draw.instanceCount)).toEqual([1, 1]);
  });

  it("does not coalesce occlusion-query draw commands", () => {
    const plan = planRenderPassDrawList({
      drawCommands: [
        drawCommand(1, {
          meshResourceKey: "mesh:cube",
          vertexBufferKeys: ["mesh:cube/vertex"],
          indexBufferKey: "mesh:cube/index",
          transformPackedOffset: 0,
          occlusionQuery: true,
        }),
        drawCommand(2, {
          meshResourceKey: "mesh:cube",
          vertexBufferKeys: ["mesh:cube/vertex"],
          indexBufferKey: "mesh:cube/index",
          transformPackedOffset: 16,
          occlusionQuery: true,
        }),
      ],
      pipelines: [pipeline("pipeline:unlit")],
      bindGroups: bindGroups("material:white"),
    });

    expect(plan.valid).toBe(true);
    expect(plan.draws).toHaveLength(2);
    expect(plan.draws.map((draw) => draw.occlusionQuery)).toEqual([true, true]);
  });

  it("does not coalesce compatible commands with different submesh ranges", () => {
    const plan = planRenderPassDrawList({
      drawCommands: [
        drawCommand(1, {
          meshResourceKey: "mesh:cube",
          vertexBufferKeys: ["mesh:cube/vertex"],
          indexBufferKey: "mesh:cube/index",
          indexStart: 0,
          indexCount: 6,
          transformPackedOffset: 0,
        }),
        drawCommand(2, {
          meshResourceKey: "mesh:cube",
          vertexBufferKeys: ["mesh:cube/vertex"],
          indexBufferKey: "mesh:cube/index",
          indexStart: 6,
          indexCount: 6,
          transformPackedOffset: 16,
        }),
      ],
      pipelines: [pipeline("pipeline:unlit")],
      bindGroups: bindGroups("material:white"),
    });

    expect(plan.valid).toBe(true);
    expect(plan.draws).toMatchObject([
      { renderId: 1, indexStart: 0, indexCount: 6, instanceCount: 1 },
      { renderId: 2, indexStart: 6, indexCount: 6, instanceCount: 1 },
    ]);
  });

  it("preserves submesh ranges on draw records", () => {
    const plan = planRenderPassDrawList({
      drawCommands: [
        drawCommand(1, {
          vertexStart: 4,
          vertexCount: 8,
          indexStart: 6,
          indexCount: 12,
        }),
      ],
      pipelines: [pipeline("pipeline:unlit")],
      bindGroups: bindGroups("material:white"),
    });

    expect(plan.valid).toBe(true);
    expect(plan.draws[0]).toMatchObject({
      vertexStart: 4,
      vertexCount: 8,
      indexStart: 6,
      indexCount: 12,
    });
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

  it("requires light bind groups for standard material draw selection", () => {
    const plan = planRenderPassDrawList({
      drawCommands: [
        drawCommand(1, {
          pipelineKey: "standard|opaque|back|less|none",
          materialResourceKey: "material-buffer:Standard/uniform",
        }),
      ],
      pipelines: [pipeline("standard|opaque|back|less|none")],
      bindGroups: [
        ...bindGroups("material-buffer:Standard/uniform"),
        lightBindGroup(),
      ],
    });

    expect(plan.valid).toBe(true);
    expect(plan.diagnostics).toEqual([]);
    expect(plan.draws[0]?.bindGroupKeys).toEqual([
      "bind-group:view",
      "bind-group:transforms",
      "bind-group:material-buffer:Standard/uniform",
      "bind-group:lights",
    ]);
  });

  it("uses transmission-scoped light bind groups without blocking opaque standard draws", () => {
    const opaquePipeline = "standard|opaque|back|less|none";
    const transmissionPipeline = "standard|transmission|blend|back|less|alpha";
    const materialResourceKey = "material-buffer:Standard/uniform";
    const plan = planRenderPassDrawList({
      drawCommands: [
        drawCommand(1, {
          pipelineKey: opaquePipeline,
          materialResourceKey,
        }),
        drawCommand(2, {
          pipelineKey: transmissionPipeline,
          materialResourceKey,
        }),
      ],
      pipelines: [pipeline(opaquePipeline), pipeline(transmissionPipeline)],
      bindGroups: [
        ...bindGroups(materialResourceKey),
        lightBindGroup(),
        transmissionLightBindGroup(transmissionPipeline),
      ],
    });

    expect(plan.valid).toBe(true);
    expect(plan.draws.map((draw) => draw.bindGroupKeys[3])).toEqual([
      "bind-group:lights",
      "bind-group:lights:transmission",
    ]);
  });

  it("diagnoses unprepared standard material lighting resources instead of falling back", () => {
    const plan = planRenderPassDrawList({
      drawCommands: [
        drawCommand(1, {
          pipelineKey: "standard|opaque|back|less|none",
          materialResourceKey: "material-buffer:Standard/uniform",
        }),
      ],
      pipelines: [pipeline("standard|opaque|back|less|none")],
      bindGroups: bindGroups("material-buffer:Standard/uniform"),
    });

    expect(plan.valid).toBe(false);
    expect(plan.draws).toEqual([]);
    expect(plan.diagnostics).toMatchObject([
      {
        code: "renderPassDrawList.missingBindGroupResource",
        renderId: 1,
        bindGroup: { group: 3 },
      },
    ]);
  });

  it("preserves mixed unlit and standard draw ordering with distinct pipeline keys", () => {
    const plan = planRenderPassDrawList({
      drawCommands: [
        drawCommand(2, {
          pipelineKey: "standard|opaque|back|less|none",
          materialResourceKey: "material-buffer:Standard/uniform",
        }),
        drawCommand(1, {
          pipelineKey: "unlit|opaque|back|less|none",
          materialResourceKey: "material-buffer:Unlit/uniform",
        }),
      ],
      pipelines: [
        pipeline("unlit|opaque|back|less|none"),
        pipeline("standard|opaque|back|less|none"),
      ],
      bindGroups: [
        ...bindGroups("material-buffer:Standard/uniform"),
        {
          ...materialBindGroup("material-buffer:Unlit/uniform"),
          resourceKey: "bind-group:material-buffer:Unlit/uniform",
        },
        lightBindGroup(),
      ],
    });

    expect(plan.valid).toBe(true);
    expect(plan.draws.map((draw) => draw.renderId)).toEqual([2, 1]);
    expect(plan.draws.map((draw) => draw.pipelineKey)).toEqual([
      "standard|opaque|back|less|none",
      "unlit|opaque|back|less|none",
    ]);
  });

  it("selects pipeline-scoped material bind groups for live route changes", () => {
    const materialResourceKey = "material-buffer:Standard/uniform";
    const directPipeline = "standard|opaque|back|less|none";
    const shadowPipeline = "standard|shadowMap|opaque|back|less|none";
    const plan = planRenderPassDrawList({
      drawCommands: [
        drawCommand(1, {
          pipelineKey: directPipeline,
          materialResourceKey,
        }),
        drawCommand(2, {
          pipelineKey: shadowPipeline,
          materialResourceKey,
        }),
      ],
      pipelines: [pipeline(directPipeline), pipeline(shadowPipeline)],
      bindGroups: [
        ...pipelineScopedSharedBindGroups(directPipeline),
        ...pipelineScopedSharedBindGroups(shadowPipeline),
        {
          ...materialBindGroup(materialResourceKey),
          resourceKey: "bind-group:standard-direct-material",
          entryResourceKeys: [materialResourceKey, directPipeline],
        },
        {
          ...materialBindGroup(materialResourceKey),
          resourceKey: "bind-group:standard-shadow-material",
          entryResourceKeys: [materialResourceKey, shadowPipeline],
        },
        lightBindGroup(),
      ],
    });

    expect(plan.valid).toBe(true);
    expect(plan.draws.map((draw) => draw.bindGroupKeys[2])).toEqual([
      "bind-group:standard-direct-material",
      "bind-group:standard-shadow-material",
    ]);
  });

  it("selects draw-scoped skinning joint bind groups for skinned standard draws", () => {
    const skinnedPipeline = "standard|skinned|opaque|back|less|none";
    const materialResourceKey = "material-buffer:Standard/uniform";
    const plan = planRenderPassDrawList({
      drawCommands: [
        drawCommand(10, {
          pipelineKey: skinnedPipeline,
          materialResourceKey,
        }),
        drawCommand(11, {
          pipelineKey: skinnedPipeline,
          materialResourceKey,
        }),
      ],
      pipelines: [pipeline(skinnedPipeline)],
      bindGroups: [
        bindGroups(materialResourceKey)[0] as UnlitBindGroupResource,
        skinningSharedBindGroup(10),
        skinningSharedBindGroup(11),
        materialBindGroup(materialResourceKey),
        lightBindGroup(),
      ],
    });

    expect(plan.valid).toBe(true);
    expect(plan.draws.map((draw) => draw.bindGroupKeys[1])).toEqual([
      "bind-group:transforms-skinning:10",
      "bind-group:transforms-skinning:11",
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
    meshResourceKey: overrides.meshResourceKey ?? `mesh:${renderId}`,
    materialResourceKey: overrides.materialResourceKey ?? "material:white",
    vertexBufferKeys: overrides.vertexBufferKeys ?? [`mesh:${renderId}/vertex`],
    vertexCount: overrides.vertexCount ?? 24,
    ...(overrides.vertexStart === undefined
      ? {}
      : { vertexStart: overrides.vertexStart }),
    indexBufferKey:
      overrides.indexBufferKey === undefined
        ? `mesh:${renderId}/index`
        : overrides.indexBufferKey,
    indexCount: overrides.indexCount ?? 6,
    ...(overrides.indexStart === undefined
      ? {}
      : { indexStart: overrides.indexStart }),
    transformPackedOffset: overrides.transformPackedOffset ?? renderId * 16,
    ...(overrides.occlusionQuery === true ? { occlusionQuery: true } : {}),
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
    materialBindGroup(materialResourceKey),
  ];
}

function materialBindGroup(
  materialResourceKey: string,
): UnlitBindGroupResource {
  return {
    group: 2,
    resourceKey: `bind-group:${materialResourceKey}`,
    layoutKey: "layout:material",
    bindGroup: {},
    entryResourceKeys: [materialResourceKey],
  };
}

function lightBindGroup(): UnlitBindGroupResource {
  return {
    group: 3,
    resourceKey: "bind-group:lights",
    layoutKey: "layout:lights",
    bindGroup: {},
    entryResourceKeys: [
      "light-buffer:main/floats",
      "light-buffer:main/metadata",
    ],
  };
}

function transmissionLightBindGroup(
  pipelineKey: string,
): UnlitBindGroupResource {
  return {
    group: 3,
    resourceKey: "bind-group:lights:transmission",
    layoutKey: "layout:lights:transmission",
    bindGroup: {},
    entryResourceKeys: [
      "light-buffer:main/floats",
      "light-buffer:main/metadata",
      "standard-transmission-grab:scene-color:960:960:bgra8unorm",
      "standard-transmission-grab:sampler",
      pipelineKey,
    ],
  };
}

function skinningSharedBindGroup(renderId: number): UnlitBindGroupResource {
  return {
    group: 1,
    resourceKey: `bind-group:transforms-skinning:${renderId}`,
    layoutKey: "layout:transforms-skinning",
    bindGroup: {},
    entryResourceKeys: [
      "buffer:transforms",
      skinningJointBufferResourceKeyForRenderId(renderId),
    ],
  };
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
