import { describe, expect, it } from "vitest";

import {
  DEFAULT_MESH_UPLOAD_BUFFER_USAGE,
  createBoxMeshAsset,
  createMeshGpuUploadPlan,
  createMeshUploadBufferDescriptors,
  createPlaneMeshAsset,
  type MeshGpuUploadPlan,
} from "@aperture-engine/webgpu";

describe("mesh upload buffer descriptor planning", () => {
  it("maps box mesh upload plans to vertex and index buffer descriptors", () => {
    const box = createBoxMeshAsset({ label: "Cube" });
    const upload = required(createMeshGpuUploadPlan(box).plan);
    const result = createMeshUploadBufferDescriptors(upload);

    expect(result.diagnostics).toEqual([]);
    expect(result.plan).toMatchObject({
      label: "Cube",
      vertexBuffers: [
        {
          streamId: "primitive-interleaved",
          vertexCount: 24,
          descriptor: {
            label: "Cube/vertex:primitive-interleaved",
            size: 24 * 32,
            usage: DEFAULT_MESH_UPLOAD_BUFFER_USAGE.vertex,
          },
        },
      ],
      indexBuffer: {
        format: "uint16",
        indexCount: 36,
        descriptor: {
          label: "Cube/index",
          size: 36 * 2,
          usage: DEFAULT_MESH_UPLOAD_BUFFER_USAGE.index,
        },
      },
    });
    expect(result.plan?.vertexBuffers[0]?.source).toBe(
      box.vertexStreams[0]?.data,
    );
    expect(result.plan?.indexBuffer?.source).toBe(box.indexBuffer?.data);
  });

  it("maps plane mesh descriptors and supports non-indexed plans", () => {
    const plane = createPlaneMeshAsset({ label: "Ground" });
    const { indexBuffer: _indexBuffer, ...nonIndexed } = plane;
    const upload = required(createMeshGpuUploadPlan(nonIndexed).plan);
    const result = createMeshUploadBufferDescriptors(upload, {
      vertex: 123,
      index: 456,
    });

    expect(result.valid).toBe(true);
    expect(result.plan?.vertexBuffers[0]?.descriptor).toMatchObject({
      label: "Ground/vertex:primitive-interleaved",
      size: 4 * 32,
      usage: 123,
    });
    expect(result.plan?.vertexBuffers[0]?.vertexCount).toBe(4);
    expect(result.plan?.indexBuffer).toBeUndefined();
  });

  it("reports null plans, empty uploads, and invalid usage flags", () => {
    const empty: MeshGpuUploadPlan = {
      label: "Empty",
      vertexStreams: [],
      submeshes: [],
    };

    expect(createMeshUploadBufferDescriptors(null)).toMatchObject({
      valid: false,
      diagnostics: [{ code: "meshBuffer.nullPlan" }],
    });
    expect(
      createMeshUploadBufferDescriptors(empty).diagnostics.map(
        (diagnostic) => diagnostic.code,
      ),
    ).toEqual(["meshBuffer.emptyVertexUploads"]);
    expect(
      createMeshUploadBufferDescriptors(empty, {
        vertex: 0,
        index: Number.NaN,
      }).diagnostics.map((diagnostic) => diagnostic.code),
    ).toEqual([
      "meshBuffer.invalidUsageFlags",
      "meshBuffer.invalidUsageFlags",
      "meshBuffer.emptyVertexUploads",
    ]);
  });
});

function required<T>(value: T | null): T {
  if (value === null) {
    throw new Error("Expected test fixture value to exist.");
  }

  return value;
}
