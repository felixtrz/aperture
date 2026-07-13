import { describe, expect, it } from "vitest";

import {
  buildUserPassNode,
  finalizeUserIndirectDrawReport,
  readUserIndirectDrawInstanceCounts,
  resolveUserIndirectDrawCommands,
  type UserIndirectDrawTarget,
  type WebGpuAppPassResolvers,
} from "@aperture-engine/webgpu/test-support";
import type { RenderPassCommand } from "@aperture-engine/webgpu/test-support";

// C2 (three.js parity plan): the user-surface indirect-draw path. A custom
// render pass records ctx.drawIndirect / ctx.drawIndexedIndirect against a GPU
// argument buffer a compute pass wrote; the route validates (dropping degraded
// draws with a structured fallback reason), reads the drawn instance count off
// the GPU, and surfaces it in the frame report.

function fakeResolvers(
  buffers: Readonly<Record<string, unknown>> = {},
): WebGpuAppPassResolvers {
  return {
    view: (handle) => ({ view: handle }),
    buffer: (handle) => buffers[handle],
    createBindGroup: (entries) => ({ bindGroup: entries }),
  };
}

describe("ctx.drawIndirect / drawIndexedIndirect command recording (C2)", () => {
  it("records a non-indexed indirect draw carrying the resolved buffer + offset", () => {
    const argsBuffer = { id: "cull-args" };
    const node = buildUserPassNode(
      {
        name: "indirect-draw",
        kind: "render",
        writes: ["scene-color"],
        encode(ctx) {
          ctx.setPipeline({ pipeline: 1 });
          ctx.drawIndirect(ctx.buffer("cull-args"), 16);
        },
      },
      fakeResolvers({ "cull-args": argsBuffer }),
    );

    expect(node.kind).toBe("render");
    const commands = node.kind === "render" ? node.commands : [];
    const indirect = commands.find((c) => c.kind === "drawIndirect");
    expect(indirect).toMatchObject({
      kind: "drawIndirect",
      buffer: argsBuffer,
      offset: 16,
    });
  });

  it("records an indexed indirect draw (offset defaults to 0)", () => {
    const argsBuffer = { id: "cull-args" };
    const node = buildUserPassNode(
      {
        name: "indexed-indirect",
        kind: "render",
        writes: ["scene-color"],
        encode(ctx) {
          ctx.setIndexBuffer({ ib: 1 }, "uint16");
          ctx.drawIndexedIndirect(ctx.buffer("cull-args"));
        },
      },
      fakeResolvers({ "cull-args": argsBuffer }),
    );

    const commands = node.kind === "render" ? node.commands : [];
    expect(
      commands.find((c) => c.kind === "drawIndexedIndirect"),
    ).toMatchObject({
      kind: "drawIndexedIndirect",
      buffer: argsBuffer,
      offset: 0,
    });
  });

  it("throws when a compute pass calls the render-only drawIndirect sink", () => {
    expect(() =>
      buildUserPassNode(
        {
          name: "bad-compute",
          kind: "compute",
          writes: [{ handle: "args" }],
          encode(ctx) {
            ctx.drawIndirect({}, 0);
          },
        },
        fakeResolvers(),
      ),
    ).toThrow(/drawIndirect/);
  });
});

function drawIndirectCommand(
  buffer: unknown,
  offset: number,
): RenderPassCommand {
  return {
    kind: "drawIndirect",
    renderId: 0,
    resourceKey: "k",
    buffer,
    offset,
    vertexCount: 0,
    instanceCount: 0,
    firstVertex: 0,
    firstInstance: 0,
  };
}

describe("resolveUserIndirectDrawCommands (C2)", () => {
  it("keeps valid indirect draws and emits a readback target per draw", () => {
    const buffer = { id: "args" };
    const result = resolveUserIndirectDrawCommands({
      passName: "cull",
      commands: [
        { kind: "setPipeline", renderId: 0, pipelineKey: "p", pipeline: {} },
        drawIndirectCommand(buffer, 0),
      ],
    });

    expect(result.commands).toHaveLength(2);
    expect(result.report).toMatchObject({
      status: "recorded",
      valid: true,
      indirectDraws: 1,
      nonIndexedIndirectDraws: 1,
      skippedDraws: 0,
      drawnInstanceCount: null,
    });
    // The visible instance count is the 2nd u32 (offset + 4) of the record.
    expect(result.targets).toEqual<UserIndirectDrawTarget[]>([
      {
        passName: "cull",
        buffer,
        byteOffset: 0,
        instanceCountByteOffset: 4,
        indexed: false,
      },
    ]);
  });

  it("drops an indirect draw whose buffer did not resolve (buffer-unresolved)", () => {
    const result = resolveUserIndirectDrawCommands({
      passName: "cull",
      commands: [drawIndirectCommand(undefined, 0)],
    });

    expect(result.commands).toHaveLength(0);
    expect(result.targets).toHaveLength(0);
    expect(result.report.status).toBe("fallback");
    expect(result.report.valid).toBe(false);
    expect(result.report.skippedDraws).toBe(1);
    expect(result.report.fallbackReasons).toEqual([
      "indirect-buffer-unresolved",
    ]);
    expect(result.report.diagnostics[0]?.code).toBe(
      "indirectDraw.bufferUnresolved",
    );
  });

  it("drops an indirect draw whose offset is not 4-byte aligned (offset-misaligned)", () => {
    const result = resolveUserIndirectDrawCommands({
      passName: "cull",
      commands: [drawIndirectCommand({ id: "args" }, 6)],
    });

    expect(result.commands).toHaveLength(0);
    expect(result.report.fallbackReasons).toEqual([
      "indirect-offset-misaligned",
    ]);
    expect(result.report.diagnostics[0]?.code).toBe(
      "indirectDraw.offsetMisaligned",
    );
  });

  it("reports inactive when no indirect draws were recorded", () => {
    const result = resolveUserIndirectDrawCommands({
      passName: "plain",
      commands: [
        {
          kind: "draw",
          renderId: 0,
          vertexCount: 3,
          instanceCount: 1,
          firstVertex: 0,
          firstInstance: 0,
        },
      ],
    });

    expect(result.report.status).toBe("inactive");
    expect(result.report.indirectDraws).toBe(0);
  });
});

describe("finalizeUserIndirectDrawReport (C2)", () => {
  it("folds the read-back drawn count in and flips status to readback", () => {
    const base = resolveUserIndirectDrawCommands({
      passName: "cull",
      commands: [drawIndirectCommand({ id: "args" }, 0)],
    }).report;

    const finalized = finalizeUserIndirectDrawReport(base, {
      drawnInstanceCount: 42,
    });

    expect(finalized.status).toBe("readback");
    expect(finalized.drawnInstanceCount).toBe(42);
    expect(finalized.valid).toBe(true);
  });

  it("keeps drawnInstanceCount null and records a readback fallback", () => {
    const base = resolveUserIndirectDrawCommands({
      passName: "cull",
      commands: [drawIndirectCommand({ id: "args" }, 0)],
    }).report;

    const finalized = finalizeUserIndirectDrawReport(base, {
      drawnInstanceCount: null,
      fallback: {
        reason: "indirect-readback-unavailable",
        code: "indirectDraw.readbackUnavailable",
        message: "no readback",
      },
    });

    expect(finalized.drawnInstanceCount).toBeNull();
    expect(finalized.fallbackReasons).toContain(
      "indirect-readback-unavailable",
    );
    expect(finalized.valid).toBe(false);
  });

  it("is a no-op when there were no valid indirect draws", () => {
    const base = resolveUserIndirectDrawCommands({
      passName: "cull",
      commands: [drawIndirectCommand(undefined, 0)],
    }).report;

    const finalized = finalizeUserIndirectDrawReport(base, {
      drawnInstanceCount: 7,
    });

    expect(finalized.drawnInstanceCount).toBeNull();
    expect(finalized.status).toBe("fallback");
  });
});

describe("readUserIndirectDrawInstanceCounts (C2)", () => {
  function fakeReadbackDevice(counts: readonly number[]): {
    device: unknown;
    submits: number;
  } {
    const state = { submits: 0 };
    const packed = new Uint32Array(counts);
    const device = {
      createBuffer: () => ({
        mapAsync: () => Promise.resolve(),
        getMappedRange: () => packed.buffer,
        unmap: () => {},
        destroy: () => {},
      }),
      createCommandEncoder: () => ({
        copyBufferToBuffer: () => {},
        finish: () => ({}),
      }),
      queue: {
        submit: () => {
          state.submits += 1;
        },
      },
    };
    return { device, submits: state.submits };
  }

  const targets: UserIndirectDrawTarget[] = [
    {
      passName: "cull",
      buffer: { id: "args" },
      byteOffset: 0,
      instanceCountByteOffset: 4,
      indexed: false,
    },
  ];

  it("sums the read-back visible instance counts across targets", async () => {
    const { device } = fakeReadbackDevice([12]);
    const result = await readUserIndirectDrawInstanceCounts({
      device,
      targets,
      label: "frame",
    });

    expect(result.drawnInstanceCount).toBe(12);
    expect(result.fallback).toBeUndefined();
  });

  it("reports a fallback when the device cannot read back", async () => {
    const result = await readUserIndirectDrawInstanceCounts({
      device: {},
      targets,
      label: "frame",
    });

    expect(result.drawnInstanceCount).toBeNull();
    expect(result.fallback?.reason).toBe("indirect-readback-unavailable");
    expect(result.fallback?.code).toBe("indirectDraw.readbackUnavailable");
  });

  it("reports a fallback when the readback throws", async () => {
    const device = {
      createBuffer: () => {
        throw new Error("out of memory");
      },
      createCommandEncoder: () => ({
        copyBufferToBuffer: () => {},
        finish: () => ({}),
      }),
      queue: { submit: () => {} },
    };
    const result = await readUserIndirectDrawInstanceCounts({
      device,
      targets,
      label: "frame",
    });

    expect(result.drawnInstanceCount).toBeNull();
    expect(result.fallback?.reason).toBe("indirect-readback-failed");
  });

  it("returns null (no readback) when there are no targets", async () => {
    const { device } = fakeReadbackDevice([]);
    const result = await readUserIndirectDrawInstanceCounts({
      device,
      targets: [],
      label: "frame",
    });

    expect(result.drawnInstanceCount).toBeNull();
    expect(result.fallback).toBeUndefined();
  });
});
