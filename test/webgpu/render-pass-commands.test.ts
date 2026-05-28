import { describe, expect, it } from "vitest";

import {
  createRenderPassCommandScratch,
  planRenderPassCommands,
  writeRenderPassCommands,
  type ResolvedRenderPassDraw,
} from "@aperture-engine/webgpu/test-support";

describe("render pass command planning", () => {
  it("plans indexed render pass commands", () => {
    const plan = planRenderPassCommands({ draws: [resolvedDraw(1)] });

    expect(plan.valid).toBe(true);
    expect(plan.drawCount).toBe(1);
    expect(plan.indexedDrawCount).toBe(1);
    expect(plan.nonIndexedDrawCount).toBe(0);
    expect(plan.pressure).toMatchObject({
      resolvedDraws: 1,
      drawCommands: 1,
      stateCommands: {
        planned: 5,
        emitted: 5,
        elided: 0,
      },
    });
    expect(plan.commands).toMatchObject([
      { kind: "setPipeline", renderId: 1, pipelineKey: "pipeline:unlit" },
      { kind: "setBindGroup", renderId: 1, index: 0, resourceKey: "bind:view" },
      {
        kind: "setBindGroup",
        renderId: 1,
        index: 1,
        resourceKey: "bind:transforms",
      },
      {
        kind: "setVertexBuffer",
        renderId: 1,
        slot: 0,
        resourceKey: "mesh:1/vertex",
      },
      {
        kind: "setIndexBuffer",
        renderId: 1,
        resourceKey: "mesh:1/index",
        format: "uint16",
      },
      {
        kind: "drawIndexed",
        renderId: 1,
        indexCount: 6,
        instanceCount: 1,
        firstInstance: 1,
      },
    ]);
  });

  it("elides redundant state commands between adjacent compatible draws", () => {
    const first = resolvedDraw(1);
    const second = {
      ...resolvedDraw(2),
      pipelineKey: first.pipelineKey,
      pipeline: first.pipeline,
      bindGroups: first.bindGroups,
      vertexBuffers: first.vertexBuffers,
      indexBuffer: first.indexBuffer,
      indexCount: first.indexCount,
    };
    const plan = planRenderPassCommands({ draws: [first, second] });

    expect(plan.valid).toBe(true);
    expect(plan.drawCount).toBe(2);
    expect(plan.commands).toMatchObject([
      { kind: "setPipeline", renderId: 1, pipelineKey: "pipeline:unlit" },
      { kind: "setBindGroup", renderId: 1, index: 0, resourceKey: "bind:view" },
      {
        kind: "setBindGroup",
        renderId: 1,
        index: 1,
        resourceKey: "bind:transforms",
      },
      {
        kind: "setVertexBuffer",
        renderId: 1,
        slot: 0,
        resourceKey: "mesh:1/vertex",
      },
      {
        kind: "setIndexBuffer",
        renderId: 1,
        resourceKey: "mesh:1/index",
        format: "uint16",
      },
      { kind: "drawIndexed", renderId: 1, firstInstance: 1 },
      { kind: "drawIndexed", renderId: 2, firstInstance: 2 },
    ]);
    expect(plan.pressure).toMatchObject({
      resolvedDraws: 2,
      drawCommands: 2,
      stateCommands: {
        planned: 10,
        emitted: 5,
        elided: 5,
        setPipeline: { planned: 2, emitted: 1, elided: 1 },
        setBindGroup: { planned: 4, emitted: 2, elided: 2 },
        setVertexBuffer: { planned: 2, emitted: 1, elided: 1 },
        setIndexBuffer: { planned: 2, emitted: 1, elided: 1 },
      },
    });
  });

  it("emits only the state commands whose tracked resources changed", () => {
    const first = resolvedDraw(1);
    const second = {
      ...resolvedDraw(2),
      pipelineKey: first.pipelineKey,
      pipeline: first.pipeline,
      bindGroups: [
        first.bindGroups[0]!,
        {
          group: 1,
          resourceKey: "bind:transforms:updated",
          bindGroup: { group: 1, version: 2 },
        },
      ],
      vertexBuffers: first.vertexBuffers,
      indexBuffer: first.indexBuffer,
      indexCount: first.indexCount,
    };
    const plan = planRenderPassCommands({ draws: [first, second] });

    expect(plan.valid).toBe(true);
    expect(
      plan.commands
        .filter((command) => command.kind !== "drawIndexed")
        .map((command) => ({
          kind: command.kind,
          renderId: command.renderId,
          resourceKey: "resourceKey" in command ? command.resourceKey : null,
        })),
    ).toEqual([
      { kind: "setPipeline", renderId: 1, resourceKey: null },
      { kind: "setBindGroup", renderId: 1, resourceKey: "bind:view" },
      {
        kind: "setBindGroup",
        renderId: 1,
        resourceKey: "bind:transforms",
      },
      { kind: "setVertexBuffer", renderId: 1, resourceKey: "mesh:1/vertex" },
      { kind: "setIndexBuffer", renderId: 1, resourceKey: "mesh:1/index" },
      {
        kind: "setBindGroup",
        renderId: 2,
        resourceKey: "bind:transforms:updated",
      },
    ]);
    expect(plan.pressure.stateCommands).toMatchObject({
      planned: 10,
      emitted: 6,
      elided: 4,
      setPipeline: { planned: 2, emitted: 1, elided: 1 },
      setBindGroup: { planned: 4, emitted: 3, elided: 1 },
      setVertexBuffer: { planned: 2, emitted: 1, elided: 1 },
      setIndexBuffer: { planned: 2, emitted: 1, elided: 1 },
    });
  });

  it("plans non-indexed render pass commands", () => {
    const plan = planRenderPassCommands({
      draws: [resolvedDraw(1, { indexed: false })],
    });

    expect(plan.valid).toBe(true);
    expect(plan.indexedDrawCount).toBe(0);
    expect(plan.nonIndexedDrawCount).toBe(1);
    expect(plan.commands.at(-1)).toMatchObject({
      kind: "draw",
      renderId: 1,
      vertexCount: 24,
      instanceCount: 1,
      firstInstance: 1,
    });
  });

  it("wraps occlusion-query draws with per-draw query commands", () => {
    const plan = planRenderPassCommands({
      draws: [resolvedDraw(7, { occlusionQuery: true })],
    });

    expect(plan.valid).toBe(true);
    expect(plan.occlusionQueryCount).toBe(1);
    expect(plan.occlusionQueryRenderIds).toEqual([7]);
    expect(plan.commands.map((command) => command.kind)).toEqual([
      "setPipeline",
      "setBindGroup",
      "setBindGroup",
      "setVertexBuffer",
      "setIndexBuffer",
      "beginOcclusionQuery",
      "drawIndexed",
      "endOcclusionQuery",
    ]);
    expect(plan.commands.at(-3)).toMatchObject({
      kind: "beginOcclusionQuery",
      renderId: 7,
      queryIndex: 0,
    });
    expect(plan.commands.at(-1)).toMatchObject({
      kind: "endOcclusionQuery",
      renderId: 7,
      queryIndex: 0,
    });
  });

  it("emits indexed and non-indexed submesh draw ranges", () => {
    const plan = planRenderPassCommands({
      draws: [
        resolvedDraw(1, {
          indexStart: 6,
          indexCount: 12,
        }),
        resolvedDraw(2, {
          indexed: false,
          vertexStart: 4,
          vertexCount: 8,
        }),
      ],
    });

    expect(plan.valid).toBe(true);
    expect(
      plan.commands.filter((command) => command.kind === "drawIndexed"),
    ).toMatchObject([
      {
        renderId: 1,
        indexCount: 12,
        firstIndex: 6,
      },
    ]);
    expect(
      plan.commands.filter((command) => command.kind === "draw"),
    ).toMatchObject([
      {
        renderId: 2,
        vertexCount: 8,
        firstVertex: 4,
      },
    ]);
  });

  it("sorts bind groups and preserves resolved draw order", () => {
    const plan = planRenderPassCommands({
      draws: [resolvedDraw(2), resolvedDraw(1)],
    });

    expect(
      plan.commands
        .filter((command) => command.kind === "drawIndexed")
        .map((command) => command.renderId),
    ).toEqual([2, 1]);
    expect(
      plan.commands
        .filter(
          (command) =>
            command.renderId === 1 && command.kind === "setBindGroup",
        )
        .map((command) => ("index" in command ? command.index : null)),
    ).toEqual([0, 1]);
  });

  it("diagnoses invalid indexed and non-indexed draw counts", () => {
    const plan = planRenderPassCommands({
      draws: [
        resolvedDraw(1, { indexCount: 0 }),
        resolvedDraw(2, { indexed: false, vertexCount: 0 }),
      ],
    });

    expect(plan.valid).toBe(false);
    expect(plan.drawCount).toBe(0);
    expect(plan.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "renderPassCommand.invalidIndexCount",
      "renderPassCommand.invalidVertexCount",
    ]);
  });

  it("diagnoses transform offsets that cannot map to storage-buffer instances", () => {
    const plan = planRenderPassCommands({
      draws: [resolvedDraw(1, { transformPackedOffset: 10 })],
    });

    expect(plan.valid).toBe(false);
    expect(plan.drawCount).toBe(0);
    expect(plan.commands).toEqual([]);
    expect(plan.diagnostics).toMatchObject([
      { code: "renderPassCommand.invalidTransformOffset", renderId: 1 },
    ]);
  });

  it("can reuse caller-owned command scratch on the frame hot path", () => {
    const scratch = createRenderPassCommandScratch(12);
    const first = writeRenderPassCommands(
      { draws: [resolvedDraw(1), resolvedDraw(2)] },
      scratch,
    );
    const firstCommands = [...first.commands];
    const second = writeRenderPassCommands(
      { draws: [resolvedDraw(2), resolvedDraw(1)] },
      scratch,
    );

    expect(second).toBe(first);
    expect(new Set(second.commands)).toEqual(new Set(firstCommands));
    expect(second.pressure).toBe(first.pressure);
    expect(
      second.commands
        .filter((command) => command.kind === "drawIndexed")
        .map((command) => command.renderId),
    ).toEqual([2, 1]);
  });
});

function resolvedDraw(
  renderId: number,
  options: {
    readonly indexed?: boolean;
    readonly indexCount?: number | null;
    readonly indexStart?: number | null;
    readonly vertexCount?: number;
    readonly vertexStart?: number;
    readonly transformPackedOffset?: number;
    readonly occlusionQuery?: boolean;
  } = {},
): ResolvedRenderPassDraw {
  const indexed = options.indexed ?? true;

  return {
    renderId,
    pipelineKey: "pipeline:unlit",
    pipeline: { renderId, type: "pipeline" },
    bindGroups: [
      {
        group: 1,
        resourceKey: "bind:transforms",
        bindGroup: { renderId, group: 1 },
      },
      {
        group: 0,
        resourceKey: "bind:view",
        bindGroup: { renderId, group: 0 },
      },
    ],
    vertexBuffers: [
      {
        resourceKey: `mesh:${renderId}/vertex`,
        buffer: { renderId, type: "vertex" },
        vertexCount: options.vertexCount ?? 24,
      },
    ],
    vertexCount: options.vertexCount ?? 24,
    vertexStart: options.vertexStart ?? 0,
    indexBuffer: indexed
      ? {
          resourceKey: `mesh:${renderId}/index`,
          buffer: { renderId, type: "index" },
          format: "uint16",
          indexCount: 6,
        }
      : null,
    indexCount: indexed ? (options.indexCount ?? 6) : null,
    indexStart: indexed ? (options.indexStart ?? 0) : null,
    instanceCount: 1,
    transformPackedOffset: options.transformPackedOffset ?? renderId * 16,
    ...(options.occlusionQuery === true ? { occlusionQuery: true } : {}),
  };
}
