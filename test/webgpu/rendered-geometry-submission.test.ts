import { describe, expect, it } from "vitest";
import {
  collectSubmittedStaticGeometry,
  type StaticGeometryDrawBinding,
} from "../../packages/webgpu/src/app/rendered-geometry-submission.js";
import type { RenderPassCommand } from "../../packages/webgpu/src/render/passes/render-pass-commands.js";

function fixture() {
  const binding: StaticGeometryDrawBinding = {
    renderId: 7,
    entity: { index: 7, generation: 2 },
    meshKey: "prepared-v1",
    positionBufferKey: "vertices",
    worldTransformBindGroupKey: "worlds",
    sourceVertexCount: 3,
    submesh: 0,
    materialSlot: 0,
    topology: "triangle-list",
    skinned: false,
    morphed: false,
  };
  const second = {
    ...binding,
    renderId: 19,
    entity: { index: 19, generation: 3 },
  };
  const matrices = new Float32Array(48);
  matrices.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 3, 4, 5, 1], 16);
  matrices.set([2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 2, 0, 6, 7, 8, 1], 32);
  const commands: RenderPassCommand[] = [
    {
      kind: "setBindGroup",
      renderId: 7,
      index: 1,
      resourceKey: "worlds",
      bindGroup: {},
    },
    {
      kind: "setVertexBuffer",
      renderId: 7,
      slot: 0,
      resourceKey: "vertices",
      buffer: {},
    },
    {
      kind: "drawIndexed",
      renderId: 7,
      indexCount: 3,
      instanceCount: 2,
      firstIndex: 0,
      baseVertex: 0,
      firstInstance: 1,
    },
  ];
  return {
    binding,
    commands,
    input: {
      commands,
      viewId: 4,
      targetKey: "canvas",
      meshRenderIds: new Set([7, 19]),
      draws: new Map([
        [7, binding],
        [19, second],
      ]),
      transforms: new Map([
        [
          "worlds",
          {
            matrices,
            slots: new Map([
              [1, binding],
              [2, second],
            ]),
          },
        ],
      ]),
    },
  };
}

describe("submitted static geometry command bindings", () => {
  it("retains every instance from real GPU slot order, rather than repeating the representative packet", () => {
    const { input } = fixture();
    const result = collectSubmittedStaticGeometry(input);
    expect(result.omissions).toEqual([]);
    expect(result.draws[0]!.instances.map((entry) => entry.renderId)).toEqual([
      7, 19,
    ]);
    expect(Array.from(result.draws[0]!.worldMatrices).slice(12, 16)).toEqual([
      3, 4, 5, 1,
    ]);
    expect(Array.from(result.draws[0]!.worldMatrices).slice(28)).toEqual([
      6, 7, 8, 1,
    ]);
  });
  it("reports a replaced bind group instead of using stale transforms", () => {
    const { input, commands } = fixture();
    commands.splice(2, 0, {
      kind: "setBindGroup",
      renderId: 7,
      index: 1,
      resourceKey: "different",
      bindGroup: {},
    });
    expect(collectSubmittedStaticGeometry(input).omissions[0]!.reason).toBe(
      "missing-instance-binding",
    );
  });
  it("does not accept an old world group retained at an unrelated binding index", () => {
    const { input, commands } = fixture();
    commands.splice(
      2,
      0,
      {
        kind: "setBindGroup",
        renderId: 7,
        index: 0,
        resourceKey: "worlds",
        bindGroup: {},
      },
      {
        kind: "setBindGroup",
        renderId: 7,
        index: 1,
        resourceKey: "different",
        bindGroup: {},
      },
    );
    expect(collectSubmittedStaticGeometry(input).omissions[0]!.reason).toBe(
      "missing-instance-binding",
    );
  });
  it("matches POSITION at its actual stream slot rather than any bound vertex buffer", () => {
    const { input, commands, binding } = fixture();
    input.draws.set(7, { ...binding, positionBufferSlot: 2 });
    expect(collectSubmittedStaticGeometry(input).omissions[0]!.reason).toBe(
      "missing-instance-binding",
    );
    commands.splice(2, 0, {
      kind: "setVertexBuffer",
      renderId: 7,
      slot: 2,
      resourceKey: "vertices",
      buffer: {},
    });
    expect(collectSubmittedStaticGeometry(input).omissions).toEqual([]);
  });
  it("does not reinstate packets removed from the final submitted command span", () => {
    const { input } = fixture();
    expect(
      collectSubmittedStaticGeometry({
        ...input,
        commands: input.commands.slice(0, 2),
      }).draws,
    ).toEqual([]);
  });
  it("reports a submitted mesh without a binding instead of treating it as a scope exclusion", () => {
    const { input } = fixture();
    input.draws.delete(7);
    expect(collectSubmittedStaticGeometry(input).omissions[0]!.reason).toBe(
      "missing-upload-receipt",
    );
  });
  it.each(["skinned", "morphed"] as const)("reports %s draws", (feature) => {
    const { input, binding } = fixture();
    input.draws.set(7, { ...binding, [feature]: true });
    expect(collectSubmittedStaticGeometry(input).omissions[0]!.reason).toBe(
      feature,
    );
  });
  it("does not claim CPU fields as indirect GPU argument readback", () => {
    const { input } = fixture();
    const commands: RenderPassCommand[] = [
      {
        kind: "drawIndexedIndirect",
        renderId: 7,
        resourceKey: "indirect",
        buffer: {},
        offset: 0,
        indexCount: 3,
        instanceCount: 2,
        firstIndex: 0,
        baseVertex: 0,
        firstInstance: 1,
      },
    ];
    expect(
      collectSubmittedStaticGeometry({ ...input, commands }).omissions[0]!
        .reason,
    ).toBe("unsupported-route");
  });
});
