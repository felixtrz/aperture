import { describe, expect, it } from "vitest";

import {
  createIndirectDrawCommandCache,
  prepareIndirectDrawCommands,
  type RenderPassCommand,
} from "@aperture-engine/webgpu";

describe("indirect draw command preparation", () => {
  it("packs compatible grouped indexed draws into an indirect argument buffer", () => {
    const writes: Uint32Array[] = [];
    const cache = createIndirectDrawCommandCache();
    const device = indirectDevice(writes);
    const commands: RenderPassCommand[] = [
      setPipelineCommand(),
      {
        kind: "drawIndexed",
        renderId: 7,
        indexCount: 36,
        instanceCount: 1000,
        firstIndex: 0,
        baseVertex: 0,
        firstInstance: 1,
      },
    ];

    const result = prepareIndirectDrawCommands({
      device,
      cache,
      commands,
      label: "instancing",
      supportsIndirectFirstInstance: true,
    });

    expect(result.report).toMatchObject({
      valid: true,
      status: "created",
      candidates: 1,
      indirectDraws: 1,
      directDraws: 0,
      indexedIndirectDraws: 1,
      bufferBytes: 20,
      fallbackReason: null,
    });
    expect(result.commands).toMatchObject([
      { kind: "setPipeline" },
      {
        kind: "drawIndexedIndirect",
        renderId: 7,
        offset: 0,
        indexCount: 36,
        instanceCount: 1000,
        firstInstance: 1,
      },
    ]);
    expect(writes).toHaveLength(1);
    expect([...writes[0]!.slice(0, 5)]).toEqual([36, 1000, 0, 0, 1]);
  });

  it("reuses an existing indirect argument buffer when capacity is sufficient", () => {
    const writes: Uint32Array[] = [];
    const cache = createIndirectDrawCommandCache();
    const commands: RenderPassCommand[] = [
      {
        kind: "draw",
        renderId: 9,
        vertexCount: 6,
        instanceCount: 4,
        firstVertex: 0,
        firstInstance: 0,
      },
    ];

    const first = prepareIndirectDrawCommands({
      device: indirectDevice(writes),
      cache,
      commands,
      label: "sprites",
      supportsIndirectFirstInstance: false,
    });
    const second = prepareIndirectDrawCommands({
      device: indirectDevice(writes),
      cache,
      commands,
      label: "sprites",
      supportsIndirectFirstInstance: false,
    });

    expect(first.report.status).toBe("created");
    expect(second.report.status).toBe("updated");
    expect(second.commands).toMatchObject([{ kind: "drawIndirect" }]);
    expect(writes).toHaveLength(2);
    expect([...writes[1]!.slice(0, 5)]).toEqual([6, 4, 0, 0, 0]);
  });

  it("falls back to direct draws when non-zero firstInstance is unsupported", () => {
    const commands: RenderPassCommand[] = [
      {
        kind: "drawIndexed",
        renderId: 7,
        indexCount: 36,
        instanceCount: 1000,
        firstIndex: 0,
        baseVertex: 0,
        firstInstance: 1,
      },
    ];
    const result = prepareIndirectDrawCommands({
      device: indirectDevice([]),
      cache: createIndirectDrawCommandCache(),
      commands,
      label: "instancing",
      supportsIndirectFirstInstance: false,
    });

    expect(result.commands).toBe(commands);
    expect(result.report).toMatchObject({
      status: "fallback",
      candidates: 1,
      indirectDraws: 0,
      directDraws: 1,
      fallbackReason: "first-instance-unsupported",
    });
  });
});

function indirectDevice(writes: Uint32Array[]) {
  return {
    createBuffer: (descriptor: unknown) => ({ descriptor }),
    queue: {
      writeBuffer: (
        _buffer: unknown,
        _bufferOffset: number,
        data: ArrayBufferLike | ArrayBufferView,
        dataOffset = 0,
        size?: number,
      ) => {
        const bytes = ArrayBuffer.isView(data)
          ? new Uint8Array(
              data.buffer,
              data.byteOffset + dataOffset,
              size ?? data.byteLength,
            )
          : new Uint8Array(data, dataOffset, size);
        writes.push(
          new Uint32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4),
        );
      },
    },
  };
}

function setPipelineCommand(): RenderPassCommand {
  return {
    kind: "setPipeline",
    renderId: 1,
    pipelineKey: "pipeline",
    pipeline: {},
  };
}
