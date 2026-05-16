import { describe, expect, it } from "vitest";

import {
  createRenderPassCommandScratch,
  planRenderPassCommands,
  writeRenderPassCommands,
  type ResolvedRenderPassDraw,
} from "@aperture-engine/webgpu";

describe("render pass command planning", () => {
  it("plans indexed render pass commands", () => {
    const plan = planRenderPassCommands({ draws: [resolvedDraw(1)] });

    expect(plan.valid).toBe(true);
    expect(plan.drawCount).toBe(1);
    expect(plan.indexedDrawCount).toBe(1);
    expect(plan.nonIndexedDrawCount).toBe(0);
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
    readonly vertexCount?: number;
    readonly transformPackedOffset?: number;
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
    indexBuffer: indexed
      ? {
          resourceKey: `mesh:${renderId}/index`,
          buffer: { renderId, type: "index" },
          format: "uint16",
          indexCount: 6,
        }
      : null,
    indexCount: indexed ? (options.indexCount ?? 6) : null,
    instanceCount: 1,
    transformPackedOffset: options.transformPackedOffset ?? renderId * 16,
  };
}
