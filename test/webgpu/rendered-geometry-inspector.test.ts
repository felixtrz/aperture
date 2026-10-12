import { describe, expect, it } from "vitest";
import type { MeshAsset } from "@aperture-engine/render";
import { createRenderedGeometryInspector } from "../../packages/webgpu/src/app/rendered-geometry-inspector.js";
import type { SubmittedGeometryDraw } from "../../packages/webgpu/src/app/rendered-geometry-inspector.js";

function mesh(): MeshAsset {
  // A non-zero byte offset and interleaved normals catch accidental assumptions
  // that POSITION starts at buffer offset zero or uses a tightly packed stream.
  const backing = new Float32Array(32);
  const data = backing.subarray(4, 22);
  data.set([0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1]);
  return {
    kind: "mesh",
    label: "submitted triangle",
    vertexStreams: [
      {
        id: "v",
        arrayStride: 24,
        vertexCount: 3,
        attributes: [
          { semantic: "POSITION", format: "float32x3", offset: 0 },
          { semantic: "NORMAL", format: "float32x3", offset: 12 },
        ],
        data,
      },
    ],
    indexBuffer: {
      format: "uint16",
      data: new Uint16Array([0, 1, 2]),
      indexCount: 3,
    },
    submeshes: [
      {
        label: "one",
        topology: "triangle-list",
        materialSlot: 0,
        vertexStart: 0,
        vertexCount: 3,
        indexStart: 0,
        indexCount: 3,
      },
    ],
    materialSlots: [{ index: 0, label: "one" }],
  };
}
function draw(key = "mesh-v1", id = 7): SubmittedGeometryDraw {
  return {
    renderId: id,
    viewId: 3,
    targetKey: "swapchain",
    meshKey: key,
    submesh: 0,
    materialSlot: 0,
    indexed: true,
    firstIndex: 0,
    indexCount: 3,
    baseVertex: 0,
    firstVertex: 0,
    vertexCount: 3,
    firstInstance: 4,
    instances: [{ renderId: id, entity: { index: id, generation: 2 } }],
    worldMatrices: new Float32Array([
      1, 0, 0, 0, 0, 2, 0, 0, 0, 0, 3, 0, 4, 5, 6, 1,
    ]),
  };
}
function setup() {
  const inspector = createRenderedGeometryInspector({});
  const source = mesh();
  inspector.uploaded({
    key: "mesh-v1",
    sourceKey: "mesh:0:1",
    sourceVersion: 1,
    mesh: source,
    reused: false,
  });
  return { inspector, source };
}

function record(
  inspector: ReturnType<typeof createRenderedGeometryInspector>,
  input: {
    readonly frame: number;
    readonly draws: readonly SubmittedGeometryDraw[];
    readonly unsupportedRoute?:
      | "custom-wgsl"
      | "user-pass"
      | "unsupported-route";
  },
) {
  return {
    commit(submitted: boolean) {
      const frame = inspector.beginFrame(input.frame);
      if (submitted) frame?.submitted(input);
      frame?.close();
    },
  };
}

describe("submitted geometry receipts", () => {
  it("allocates no capture and returns an explicit opt-in reason by default", () => {
    const inspector = createRenderedGeometryInspector();
    inspector.uploaded({
      key: "ignored",
      sourceKey: "mesh:0:1",
      sourceVersion: 1,
      mesh: mesh(),
      reused: false,
    });
    record(inspector, { frame: 0, draws: [draw()] }).commit(true);
    expect(inspector.inspect()).toMatchObject({
      status: "unavailable",
      retainedBytes: 0,
      frame: null,
      omissions: [{ reason: "capture-disabled" }],
    });
  });
  it("reports no submission instead of inspecting an unsubmitted snapshot", () => {
    expect(setup().inspector.inspect().omissions[0]?.reason).toBe(
      "no-submitted-frame",
    );
  });
  it("returns true interleaved source arrays, indices and every world matrix as detached copies", () => {
    const { inspector, source } = setup();
    const submitted = draw();
    const pending = record(inspector, {
      frame: 17,
      draws: [submitted, draw("mesh-v1", 8)],
    });
    pending.commit(true);
    submitted.worldMatrices.fill(0);
    (source.vertexStreams[0]!.data as Float32Array).fill(99);
    source.indexBuffer!.data.fill(0);
    const first = inspector.inspect();
    expect(first.status).toBe("complete");
    expect(first.frame).toBe(17);
    expect(first.meshes).toHaveLength(1);
    expect(Array.from(first.meshes[0]!.positions)).toEqual([
      0, 0, 0, 1, 0, 0, 0, 1, 0,
    ]);
    expect(Array.from(first.meshes[0]!.normals!)).toEqual([
      0, 0, 1, 0, 0, 1, 0, 0, 1,
    ]);
    expect(Array.from(first.meshes[0]!.indices!)).toEqual([0, 1, 2]);
    expect(first.draws).toHaveLength(2);
    expect(Array.from(first.draws[0]!.worldMatrices).slice(12)).toEqual([
      4, 5, 6, 1,
    ]);
    first.meshes[0]!.positions.fill(42);
    first.draws[0]!.worldMatrices.fill(42);
    expect(inspector.inspect().meshes[0]!.positions[0]).toBe(0);
    expect(inspector.inspect().draws[0]!.worldMatrices[0]).toBe(1);
    expect(first.copiedBytes).toBe(72 + 6 + 128);
  });
  it("preserves old uploaded bytes outside partial update ranges and pins old frames", () => {
    const { inspector, source } = setup();
    record(inspector, { frame: 1, draws: [draw()] }).commit(true);
    const stream = source.vertexStreams[0]!;
    (stream.data as Float32Array)[0] = 5;
    (stream.data as Float32Array)[6] = 99; // deliberately outside the upload
    const changed: MeshAsset = {
      ...source,
      vertexStreams: [
        { ...stream, updateRanges: [{ byteOffset: 0, byteLength: 4 }] },
      ],
    };
    inspector.uploaded({
      key: "mesh-v2",
      previousKey: "mesh-v1",
      sourceKey: "mesh:0:1",
      sourceVersion: 2,
      mesh: changed,
      reused: true,
    });
    inspector.releaseMesh("mesh-v1");
    expect(inspector.inspect().meshes[0]!.positions[0]).toBe(0);
    record(inspector, { frame: 2, draws: [draw("mesh-v2")] }).commit(true);
    expect(Array.from(inspector.inspect().meshes[0]!.positions)).toEqual([
      5, 0, 0, 1, 0, 0, 0, 1, 0,
    ]);
    expect(inspector.inspect().meshes[0]!.sourceVersion).toBe(2);
  });
  it("treats empty update ranges as an unchanged GPU upload", () => {
    const { inspector, source } = setup();
    (source.vertexStreams[0]!.data as Float32Array).fill(99);
    inspector.uploaded({
      key: "mesh-v2",
      previousKey: "mesh-v1",
      sourceKey: "mesh:0:1",
      sourceVersion: 2,
      mesh: {
        ...source,
        vertexStreams: source.vertexStreams.map((stream) => ({
          ...stream,
          updateRanges: [],
        })),
      },
      reused: true,
    });
    record(inspector, { frame: 2, draws: [draw("mesh-v2")] }).commit(true);
    expect(inspector.inspect().meshes[0]!.positions[0]).toBe(0);
  });
  it("does not replace the last submitted frame on a failed attempt", () => {
    const { inspector } = setup();
    record(inspector, { frame: 1, draws: [draw()] }).commit(true);
    record(inspector, { frame: 2, draws: [] }).commit(false);
    expect(inspector.inspect()).toMatchObject({
      frame: 1,
      submissionSerial: 1,
    });
  });
  it("keeps non-indexed sources and absent normals explicit", () => {
    const inspector = createRenderedGeometryInspector({});
    const original = mesh();
    inspector.uploaded({
      key: "nonindexed",
      sourceKey: "mesh:0:1",
      sourceVersion: 1,
      reused: false,
      mesh: {
        kind: original.kind,
        label: original.label,
        submeshes: original.submeshes,
        materialSlots: original.materialSlots,
        vertexStreams: original.vertexStreams.map((stream) => ({
          ...stream,
          attributes: stream.attributes.filter(
            (attribute) => attribute.semantic !== "NORMAL",
          ),
        })),
      },
    });
    record(inspector, {
      frame: 1,
      draws: [{ ...draw("nonindexed"), indexed: false, indexCount: 0 }],
    }).commit(true);
    expect(inspector.inspect().meshes[0]).toMatchObject({
      indices: null,
      normals: null,
    });
  });
  it("preserves uint32 indices without downcasting", () => {
    const inspector = createRenderedGeometryInspector({});
    const original = mesh();
    inspector.uploaded({
      key: "u32",
      sourceKey: "mesh:0:1",
      sourceVersion: 1,
      reused: false,
      mesh: {
        ...original,
        indexBuffer: { format: "uint32", data: new Uint32Array([0, 1, 2]) },
      },
    });
    record(inspector, { frame: 1, draws: [draw("u32")] }).commit(true);
    expect(inspector.inspect().meshes[0]!.indices).toBeInstanceOf(Uint32Array);
  });
  it.each(["custom-wgsl", "user-pass", "unsupported-route"] as const)(
    "reports %s as unavailable",
    (unsupportedRoute) => {
      const { inspector } = setup();
      record(inspector, { frame: 1, draws: [draw()], unsupportedRoute }).commit(
        true,
      );
      expect(inspector.inspect()).toMatchObject({
        status: "unavailable",
        meshes: [],
        draws: [],
        omissions: [{ reason: unsupportedRoute }],
      });
    },
  );
  it("reports deformation omissions instead of claiming complete static geometry", () => {
    const { inspector } = setup();
    record(inspector, {
      frame: 1,
      draws: [
        {
          ...draw(),
          omission: {
            reason: "skinned",
            renderId: 7,
            message: "Bone matrices deform this draw.",
          },
        },
      ],
    }).commit(true);
    expect(inspector.inspect()).toMatchObject({
      status: "partial",
      meshes: [],
      draws: [],
      omissions: [{ reason: "skinned" }],
    });
  });
  it("bounds output before allocating and does not truncate a draw's instance list", () => {
    const { inspector } = setup();
    record(inspector, { frame: 1, draws: [draw()] }).commit(true);
    expect(inspector.inspect({ maxBytes: 77 })).toMatchObject({
      status: "partial",
      copiedBytes: 0,
      meshes: [],
      draws: [],
      omissions: [{ reason: "request-budget" }],
    });
    expect(() => inspector.inspect({ maxBytes: Infinity })).toThrow(RangeError);
    expect(() => inspector.inspect({ maxInstances: -1 })).toThrow(RangeError);
    expect(() => inspector.inspect({ maxDraws: 1.5 })).toThrow(RangeError);
  });
  it("bounds overlapping submitted receipts and releases closed frames, cache entries and disposal", () => {
    const inspector = createRenderedGeometryInspector({
      maxRetainedBytes: 150,
    });
    inspector.uploaded({
      key: "mesh-v1",
      sourceKey: "mesh:0:1",
      sourceVersion: 1,
      reused: false,
      mesh: mesh(),
    });
    const first = inspector.beginFrame(1)!;
    first.submitted({ draws: [draw()] });
    expect(inspector.inspect().retainedBytes).toBe(142);
    const second = inspector.beginFrame(2)!;
    second.submitted({ draws: [draw()] });
    expect(inspector.inspect()).toMatchObject({
      status: "unavailable",
      frame: 2,
      omissions: [{ reason: "capture-budget" }],
    });
    second.close();
    first.close();
    expect(inspector.inspect().retainedBytes).toBe(78);
    inspector.releaseMesh("mesh-v1");
    expect(inspector.inspect().retainedBytes).toBe(0);
    inspector.dispose();
    expect(() => inspector.inspect()).toThrow("disposed");
  });
  it("refuses unverifiable partial uploads with no preceding receipt", () => {
    const inspector = createRenderedGeometryInspector({});
    const source = mesh();
    inspector.uploaded({
      key: "partial",
      sourceKey: "mesh:0:1",
      sourceVersion: 2,
      reused: true,
      mesh: {
        ...source,
        vertexStreams: source.vertexStreams.map((stream) => ({
          ...stream,
          updateRanges: [],
        })),
      },
    });
    record(inspector, { frame: 2, draws: [draw("partial")] }).commit(true);
    expect(inspector.inspect().omissions[0]?.reason).toBe(
      "missing-upload-receipt",
    );
  });
  it("preserves the uploader's actual zero padding inside a uint16 partial update", () => {
    const { inspector, source } = setup();
    source.indexBuffer!.data[0] = 2;
    inspector.uploaded({
      key: "mesh-v2",
      previousKey: "mesh-v1",
      sourceKey: "mesh:0:1",
      sourceVersion: 2,
      mesh: {
        ...source,
        indexBuffer: {
          ...source.indexBuffer!,
          updateRanges: [{ byteOffset: 0, byteLength: 2 }],
        },
      },
      reused: true,
    });
    record(inspector, { frame: 2, draws: [draw("mesh-v2")] }).commit(true);
    expect(Array.from(inspector.inspect().meshes[0]!.indices!)).toEqual([
      2, 0, 2,
    ]);
  });
});
