import { describe, expect, it } from "vitest";

import {
  createResolveRenderPassResourcesScratch,
  resolveRenderPassResources,
  writeResolveRenderPassResources,
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

  it("preserves occlusion-query draw metadata during resource resolution", () => {
    const result = resolveRenderPassResources({
      drawList: [{ ...drawListRecord(1), occlusionQuery: true }],
      pipelines: [pipeline("pipeline:unlit")],
      bindGroups: bindGroups(),
      meshResources: [meshResource(1)],
    });

    expect(result.valid).toBe(true);
    expect(result.draws[0]).toMatchObject({
      renderId: 1,
      occlusionQuery: true,
    });
  });

  it("preserves submesh range metadata during resource resolution", () => {
    const result = resolveRenderPassResources({
      drawList: [
        {
          ...drawListRecord(1),
          vertexStart: 4,
          vertexCount: 8,
          indexStart: 6,
          indexCount: 12,
        },
      ],
      pipelines: [pipeline("pipeline:unlit")],
      bindGroups: bindGroups(),
      meshResources: [meshResource(1)],
    });

    expect(result.valid).toBe(true);
    expect(result.draws[0]).toMatchObject({
      vertexStart: 4,
      vertexCount: 8,
      indexStart: 6,
      indexCount: 12,
    });
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

  it("resolves instance tint vertex buffers outside mesh resources", () => {
    const vertexBuffer = { label: "vertex" };
    const tintBuffer = { label: "instance-tint" };
    const result = resolveRenderPassResources({
      drawList: [
        {
          ...drawListRecord(1),
          vertexBufferKeys: ["mesh:1/vertex", "instance-tint-buffer:frame"],
        },
      ],
      pipelines: [pipeline("pipeline:unlit")],
      bindGroups: bindGroups(),
      meshResources: [meshResource(1, vertexBuffer)],
      instanceTintResources: [
        {
          streamId: "instanceTint",
          resourceKey: "instance-tint-buffer:frame",
          buffer: tintBuffer,
          vertexCount: 2,
          offsets: [{ renderId: 1, sourceOffset: 0, packedOffset: 0 }],
        },
      ],
    });

    expect(result.valid).toBe(true);
    expect(result.draws[0]?.vertexBuffers).toMatchObject([
      { resourceKey: "mesh:1/vertex", buffer: vertexBuffer },
      { resourceKey: "instance-tint-buffer:frame", buffer: tintBuffer },
    ]);
  });

  it("resolves custom instance attribute vertex buffers outside mesh resources", () => {
    const vertexBuffer = { label: "vertex" };
    const attributeBuffer = { label: "instance-attributes" };
    const result = resolveRenderPassResources({
      drawList: [
        {
          ...drawListRecord(1),
          vertexBufferKeys: [
            "mesh:1/vertex",
            "instance-attribute-buffer:frame",
          ],
        },
      ],
      pipelines: [pipeline("pipeline:unlit")],
      bindGroups: bindGroups(),
      meshResources: [meshResource(1, vertexBuffer)],
      instanceAttributeResources: [
        {
          streamId: "instanceAttributes",
          resourceKey: "instance-attribute-buffer:frame",
          buffer: attributeBuffer,
          vertexCount: 2,
          layout: {
            attributes: [],
            stride: 8,
            strideFloats: 2,
            layoutKey: "phase-sway",
          },
          offsets: [{ renderId: 1, sourcePacketIndex: 0, packedOffset: 0 }],
        },
      ],
    });

    expect(result.valid).toBe(true);
    expect(result.draws[0]?.vertexBuffers).toMatchObject([
      { resourceKey: "mesh:1/vertex", buffer: vertexBuffer },
      {
        resourceKey: "instance-attribute-buffer:frame",
        buffer: attributeBuffer,
      },
    ]);
  });

  it("can reuse caller-owned resource scratch on the frame hot path", () => {
    const scratch = createResolveRenderPassResourcesScratch(2);
    const options = {
      drawList: [drawListRecord(1), drawListRecord(2)],
      pipelines: [pipeline("pipeline:unlit")],
      bindGroups: bindGroups(),
      meshResources: [meshResource(1), meshResource(2)],
    };
    const first = writeResolveRenderPassResources(options, scratch);
    const firstDraws = [...first.draws];
    const firstBindGroups = first.draws.map((draw) => draw.bindGroups);
    const firstVertexBuffers = first.draws.map((draw) => draw.vertexBuffers);
    const firstIndexBuffers = first.draws.map((draw) => draw.indexBuffer);
    const second = writeResolveRenderPassResources(
      { ...options, drawList: [drawListRecord(2), drawListRecord(1)] },
      scratch,
    );

    expect(second).toBe(first);
    expect(new Set(second.draws)).toEqual(new Set(firstDraws));
    expect(second.draws.map((draw) => draw.renderId)).toEqual([2, 1]);
    expect(second.draws[0]?.bindGroups).toBe(firstBindGroups[0]);
    expect(second.draws[1]?.vertexBuffers).toBe(firstVertexBuffers[1]);
    expect(second.draws[0]?.indexBuffer).toBe(firstIndexBuffers[0]);
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
