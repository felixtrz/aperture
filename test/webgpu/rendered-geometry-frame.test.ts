import { describe, expect, it, vi } from "vitest";
import { createBoxMeshAsset, type MeshAsset } from "@aperture-engine/render";
import {
  createRenderedGeometryInspector,
  type SubmittedGeometryDraw,
} from "../../packages/webgpu/src/app/rendered-geometry-inspector.js";
import {
  recordRenderedGeometrySceneSubmission,
  recordRenderedGeometrySceneSubmissionBatch,
} from "../../packages/webgpu/src/app/rendered-geometry-frame.js";
import { createWebGpuAppOwnedResources } from "../../packages/webgpu/src/app/owned-resources.js";
import { createWorldTransformGpuBuffer } from "../../packages/webgpu/src/resources/transforms/world-transform-buffer.js";

function fixture() {
  const inspector = createRenderedGeometryInspector({});
  inspector.uploaded({
    key: "mesh-v1",
    sourceKey: "mesh:0:1",
    sourceVersion: 1,
    mesh: createBoxMeshAsset(),
    reused: false,
  });
  const draw: SubmittedGeometryDraw = {
    renderId: 7,
    viewId: 3,
    targetKey: "canvas",
    meshKey: "mesh-v1",
    submesh: 0,
    materialSlot: 0,
    indexed: true,
    firstIndex: 0,
    indexCount: 36,
    baseVertex: 0,
    firstVertex: 0,
    vertexCount: 24,
    firstInstance: 0,
    instances: [{ renderId: 7, entity: { index: 7, generation: 2 } }],
    worldMatrices: new Float32Array([
      1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 3, 4, 5, 1,
    ]),
  };
  const recipe = {
    capture(_commands: readonly unknown[], viewId: number, targetKey: string) {
      return { draws: [{ ...draw, viewId, targetKey }], omissions: [] };
    },
  };
  return { inspector, draw, recipe };
}
function submitted(input: ReturnType<typeof fixture>, frameNumber: number) {
  const frame = input.inspector.beginFrame(frameNumber)!;
  recordRenderedGeometrySceneSubmission({
    frame,
    recipe: input.recipe,
    commands: [],
    viewId: 3,
    targetKey: "canvas",
    submitted: true,
    encoded: true,
  });
  return frame;
}

describe("accepted geometry submission lifetime", () => {
  it("publishes before a later readback/report rejection", async () => {
    const input = fixture();
    const frame = submitted(input, 10);
    await expect(
      Promise.reject(new Error("later readback failed")),
    ).rejects.toThrow("readback");
    frame.close();
    expect(input.inspector.inspect()).toMatchObject({
      status: "complete",
      frame: 10,
      submissionSerial: 1,
    });
  });
  it("retains the previous submission on a pre-submit failure", () => {
    const input = fixture();
    submitted(input, 10).close();
    const next = input.inspector.beginFrame(11)!;
    recordRenderedGeometrySceneSubmission({
      frame: next,
      recipe: input.recipe,
      commands: [],
      viewId: 3,
      targetKey: "canvas",
      submitted: false,
      encoded: true,
    });
    next.close();
    expect(input.inspector.inspect()).toMatchObject({
      status: "complete",
      frame: 10,
      submissionSerial: 1,
    });
  });
  it("keeps newer submit order when older report work completes last", () => {
    const input = fixture();
    const older = submitted(input, 10);
    const newer = submitted(input, 11);
    newer.close();
    older.failedTarget("older target failed after the newer scene submitted");
    older.close();
    expect(input.inspector.inspect()).toMatchObject({
      status: "complete",
      frame: 11,
      submissionSerial: 2,
      omissions: [],
    });
  });
  it("records exact succeeded targets and a later failed target omission", () => {
    const input = fixture();
    const frame = submitted(input, 10);
    recordRenderedGeometrySceneSubmission({
      frame,
      recipe: input.recipe,
      commands: [],
      viewId: 4,
      targetKey: "offscreen:other",
      submitted: false,
      encoded: false,
    });
    frame.close();
    const result = input.inspector.inspect();
    expect(result.status).toBe("partial");
    expect(result.draws).toHaveLength(1);
    expect(result.draws[0]!.viewId).toBe(3);
    expect(result.omissions[0]!.reason).toBe("submission-failed");
  });
  it("records two FrameGraph views under one accepted submission serial", () => {
    const input = fixture();
    const frame = input.inspector.beginFrame(10)!;
    recordRenderedGeometrySceneSubmissionBatch({
      frame,
      recipe: input.recipe,
      submitted: true,
      views: [
        { commands: [], viewId: 3, targetKey: "canvas", encoded: true },
        { commands: [], viewId: 4, targetKey: "offscreen", encoded: true },
      ],
    });
    frame.close();
    expect(input.inspector.inspect().submissionSerial).toBe(1);
    expect(
      input.inspector
        .inspect()
        .draws.map((draw) => [draw.viewId, draw.targetKey]),
    ).toEqual([
      [3, "canvas"],
      [4, "offscreen"],
    ]);
  });
  it.each(["user-pass", "custom-wgsl"] as const)(
    "replaces older static geometry with explicit %s unavailable state",
    (unsupportedRoute) => {
      const input = fixture();
      submitted(input, 10).close();
      const frame = input.inspector.beginFrame(11)!;
      recordRenderedGeometrySceneSubmission({
        frame,
        recipe: input.recipe,
        commands: [],
        viewId: 3,
        targetKey: "canvas",
        submitted: true,
        encoded: true,
        unsupportedRoute,
      });
      frame.close();
      expect(input.inspector.inspect()).toMatchObject({
        status: "unavailable",
        frame: 11,
        meshes: [],
        draws: [],
        omissions: [{ reason: unsupportedRoute }],
      });
    },
  );
  it("does not present an accepted but unverified encoder as an old successful scene", () => {
    const input = fixture();
    submitted(input, 10).close();
    const frame = input.inspector.beginFrame(11)!;
    recordRenderedGeometrySceneSubmission({
      frame,
      recipe: input.recipe,
      commands: [],
      viewId: 3,
      targetKey: "canvas",
      submitted: true,
      encoded: false,
    });
    frame.close();
    expect(input.inspector.inspect()).toMatchObject({
      status: "partial",
      frame: 11,
      draws: [],
      omissions: [{ reason: "submission-failed" }],
    });
  });
});

describe("actual owned world-transform uploads", () => {
  it("decodes actual CPU-uploaded indirect bytes, including signed baseVertex, rather than mirrored fields", () => {
    const inspector = createRenderedGeometryInspector({});
    const buffer = {};
    inspector.deviceObserver.indirectBufferCreated(buffer, "args", 20);
    inspector.deviceObserver.bufferWritten(
      buffer,
      0,
      new Uint32Array([3, 2, 7, -3, 4]).buffer,
      0,
      20,
    );
    const command = {
      kind: "drawIndexedIndirect" as const,
      renderId: 7,
      resourceKey: "args",
      buffer,
      offset: 0,
      indexCount: 99,
      instanceCount: 99,
      firstIndex: 99,
      baseVertex: 99,
      firstInstance: 99,
    };
    expect(inspector.indirectCommand(command)).toEqual({
      kind: "drawIndexed",
      renderId: 7,
      indexCount: 3,
      instanceCount: 2,
      firstIndex: 7,
      baseVertex: -3,
      firstInstance: 4,
    });
    expect(inspector.indirectCommand({ ...command, buffer: {} })).toMatchObject(
      { kind: "drawIndexedIndirect" },
    );
    inspector.deviceObserver.bufferDestroyed(buffer);
    expect(inspector.inspect().retainedBytes).toBe(0);
  });
  it("observes actual full/range bytes, typed-array offsets, skipped writes and disposal", () => {
    const inspector = createRenderedGeometryInspector({});
    const raw = {
      queue: { writeBuffer: vi.fn() },
      createBuffer: () => ({ destroy: vi.fn() }),
      createBindGroup: (_descriptor: unknown) => ({}),
    };
    const owner = createWebGpuAppOwnedResources(raw, inspector.deviceObserver);
    const initial = new Float32Array([
      1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 3, 4, 5, 1,
    ]);
    const created = createWorldTransformGpuBuffer({
      device: owner.device,
      plan: {
        descriptor: { size: 256, usage: 8 },
        source: initial,
        offsets: [{ renderId: 7, sourceOffset: 0, packedOffset: 0 }],
      },
    });
    expect(created.valid).toBe(true);
    const group = owner.device.createBindGroup({
      entries: [{ binding: 0, resource: { buffer: created.resource!.buffer } }],
    });
    initial.fill(99); // does not refresh a skipped GPU write
    expect(inspector.worldBinding(group)!.matrices[12]).toBe(3);
    owner.device.queue.writeBuffer(
      created.resource!.buffer,
      48,
      new Float32Array([100, 9, 200]),
      1,
      1,
    );
    expect(inspector.worldBinding(group)!.matrices[12]).toBe(9);
    expect(inspector.worldBinding(group)!.matrices[13]).toBe(4);
    expect(inspector.inspect().retainedBytes).toBe(256);
    owner.dispose();
    expect(inspector.worldBinding(group)).toBeNull();
    expect(inspector.inspect().retainedBytes).toBe(0);
  });
});

describe("public draw ranges and shared source geometry", () => {
  it("keeps baseVertex, index windows and multiplicity separate from a shared whole-source mesh", () => {
    const source: MeshAsset = {
      kind: "mesh",
      label: "two-source-triangles",
      vertexStreams: [
        {
          id: "p",
          arrayStride: 12,
          vertexCount: 6,
          attributes: [
            { semantic: "POSITION", format: "float32x3", offset: 0 },
          ],
          data: new Float32Array([
            0, 0, 0, 1, 0, 0, 0, 1, 0, 2, 0, 0, 3, 0, 0, 2, 1, 0,
          ]),
        },
      ],
      indexBuffer: {
        format: "uint16",
        data: new Uint16Array([5, 4, 3, 0, 1, 2]),
      },
      submeshes: [
        {
          label: "all",
          topology: "triangle-list",
          materialSlot: 0,
          vertexStart: 0,
          vertexCount: 6,
          indexStart: 0,
          indexCount: 6,
        },
      ],
      materialSlots: [{ index: 0, label: "one" }],
    };
    const input = fixture();
    input.inspector.uploaded({
      key: "range",
      sourceKey: "mesh:1:1",
      sourceVersion: 1,
      mesh: source,
      reused: false,
    });
    const frame = input.inspector.beginFrame(11)!;
    frame.submitted({
      draws: [
        {
          ...input.draw,
          meshKey: "range",
          firstIndex: 3,
          indexCount: 3,
          baseVertex: 3,
          vertexCount: 6,
        },
        {
          ...input.draw,
          renderId: 8,
          meshKey: "range",
          firstIndex: 0,
          indexCount: 3,
          baseVertex: 0,
          vertexCount: 6,
        },
      ],
    });
    frame.close();
    const result = input.inspector.inspect();
    expect(result.meshes).toHaveLength(1);
    expect(result.meshes[0]!.positions.length / 3).toBe(6);
    const selected = result.draws.map((draw) =>
      Array.from(
        result.meshes[0]!.indices!.subarray(
          draw.firstIndex,
          draw.firstIndex + draw.indexCount,
        ),
        (index) => index + draw.baseVertex,
      ),
    );
    expect(selected).toEqual([
      [3, 4, 5],
      [5, 4, 3],
    ]);
    expect(new Set(selected.flat()).size).toBe(3); // unused source vertices stay unused
    expect(
      result.draws.reduce(
        (count, draw) => count + (draw.indexCount / 3) * draw.instances.length,
        0,
      ),
    ).toBe(2);
  });
});
