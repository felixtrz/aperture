import { describe, expect, it } from "vitest";

import {
  resolveRenderPassResources,
  type GetOrCreateRenderPipelineResult,
  type MeshGpuBufferResource,
  type RenderPassDrawListRecord,
  type UnlitBindGroupResource,
} from "@aperture-engine/webgpu";

describe("render pass resource resolution", () => {
  it("resolves indexed draw list records into encoder-ready resources", () => {
    const pipelineHandle = { label: "pipeline" };
    const viewBindGroup = { label: "view" };
    const vertexBuffer = { label: "vertex" };
    const indexBuffer = { label: "index" };
    const result = resolveRenderPassResources({
      drawList: [drawListRecord(1)],
      pipelines: [pipeline("pipeline:unlit", pipelineHandle)],
      bindGroups: bindGroups(viewBindGroup),
      meshResources: [meshResource(1, vertexBuffer, indexBuffer)],
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.draws).toMatchObject([
      {
        renderId: 1,
        pipelineKey: "pipeline:unlit",
        pipeline: pipelineHandle,
        bindGroups: [
          {
            group: 0,
            resourceKey: "bind-group:view",
            bindGroup: viewBindGroup,
          },
        ],
        vertexBuffers: [
          {
            resourceKey: "mesh:1/vertex",
            buffer: vertexBuffer,
            vertexCount: 24,
          },
        ],
        vertexCount: 24,
        indexBuffer: {
          resourceKey: "mesh:1/index",
          buffer: indexBuffer,
          format: "uint16",
          indexCount: 6,
        },
        indexCount: 6,
        instanceCount: 1,
      },
    ]);
  });

  it("preserves draw list order during resource resolution", () => {
    const result = resolveRenderPassResources({
      drawList: [drawListRecord(2), drawListRecord(1)],
      pipelines: [pipeline("pipeline:unlit")],
      bindGroups: bindGroups(),
      meshResources: [meshResource(1), meshResource(2)],
    });

    expect(result.valid).toBe(true);
    expect(result.draws.map((draw) => draw.renderId)).toEqual([2, 1]);
  });

  it("diagnoses missing pipeline handles", () => {
    const result = resolveRenderPassResources({
      drawList: [drawListRecord(1)],
      pipelines: [],
      bindGroups: bindGroups(),
      meshResources: [meshResource()],
    });

    expect(result.valid).toBe(false);
    expect(result.draws).toEqual([]);
    expect(result.diagnostics).toMatchObject([
      {
        code: "renderPassResource.missingPipeline",
        renderId: 1,
        resourceKey: "pipeline:unlit",
      },
    ]);
  });

  it("diagnoses missing bind group handles", () => {
    const result = resolveRenderPassResources({
      drawList: [drawListRecord(1)],
      pipelines: [pipeline("pipeline:unlit")],
      bindGroups: [],
      meshResources: [meshResource()],
    });

    expect(result.valid).toBe(false);
    expect(result.draws).toEqual([]);
    expect(result.diagnostics).toMatchObject([
      {
        code: "renderPassResource.missingBindGroup",
        resourceKey: "bind-group:view",
      },
    ]);
  });

  it("diagnoses missing vertex buffer handles", () => {
    const result = resolveRenderPassResources({
      drawList: [drawListRecord(1)],
      pipelines: [pipeline("pipeline:unlit")],
      bindGroups: bindGroups(),
      meshResources: [meshResource(1, null)],
    });

    expect(result.valid).toBe(false);
    expect(result.draws).toEqual([]);
    expect(result.diagnostics).toMatchObject([
      {
        code: "renderPassResource.missingVertexBuffer",
        resourceKey: "mesh:1/vertex",
      },
    ]);
  });

  it("diagnoses missing index buffer handles when an index key is present", () => {
    const result = resolveRenderPassResources({
      drawList: [drawListRecord(1)],
      pipelines: [pipeline("pipeline:unlit")],
      bindGroups: bindGroups(),
      meshResources: [meshResource(1, {}, null)],
    });

    expect(result.valid).toBe(false);
    expect(result.draws).toEqual([]);
    expect(result.diagnostics).toMatchObject([
      {
        code: "renderPassResource.missingIndexBuffer",
        resourceKey: "mesh:1/index",
      },
    ]);
  });
});

function drawListRecord(renderId: number): RenderPassDrawListRecord {
  return {
    renderId,
    pipelineKey: "pipeline:unlit",
    bindGroupKeys: ["bind-group:view"],
    meshResourceKey: `mesh:${renderId}`,
    materialResourceKey: "material:white",
    vertexBufferKeys: [`mesh:${renderId}/vertex`],
    vertexCount: 24,
    indexBufferKey: `mesh:${renderId}/index`,
    indexCount: 6,
    instanceCount: 1,
    transformPackedOffset: renderId * 16,
  };
}

function pipeline(
  key: string,
  handle: unknown = {},
): GetOrCreateRenderPipelineResult {
  return {
    ok: true,
    status: "miss",
    key,
    pipeline: handle,
    diagnostics: [],
  };
}

function bindGroups(bindGroup: unknown = {}): UnlitBindGroupResource[] {
  return [
    {
      group: 0,
      resourceKey: "bind-group:view",
      layoutKey: "layout:view",
      bindGroup,
      entryResourceKeys: ["view"],
    },
  ];
}

function meshResource(
  renderId = 1,
  vertexBuffer: unknown | null = {},
  indexBuffer: unknown | null = {},
): MeshGpuBufferResource {
  return {
    resourceKey: `mesh:${renderId}`,
    vertexCount: 24,
    vertexBuffers:
      vertexBuffer === null
        ? []
        : [
            {
              streamId: "main",
              resourceKey: `mesh:${renderId}/vertex`,
              buffer: vertexBuffer,
              vertexCount: 24,
            },
          ],
    ...(indexBuffer === null
      ? {}
      : {
          indexBuffer: {
            resourceKey: `mesh:${renderId}/index`,
            buffer: indexBuffer,
            format: "uint16",
            indexCount: 6,
          },
        }),
  };
}
