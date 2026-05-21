import { describe, expect, it } from "vitest";

import {
  createDrawCommandDescriptorScratch,
  createDrawCommandDescriptors,
  writeDrawCommandDescriptors,
  type BatchCompatibilityKey,
  type MeshGpuBufferResource,
  type RenderWorldDrawPackage,
} from "@aperture-engine/webgpu";

const BATCH: BatchCompatibilityKey = {
  pipelineKey: "unlit",
  materialKey: "mat",
  meshLayoutKey: "layout",
  topology: "triangle-list",
  instanced: false,
  skinned: false,
  morphed: false,
};

describe("draw command descriptor planning", () => {
  it("creates indexed draw descriptors in package order", () => {
    const result = createDrawCommandDescriptors(
      [drawPackage(2, "mesh:a"), drawPackage(1, "mesh:a")],
      [meshResource("mesh:a", true)],
    );

    expect(result.diagnostics).toEqual([]);
    expect(result.descriptors).toMatchObject([
      {
        renderId: 2,
        vertexBufferKeys: ["mesh:a/vertex"],
        vertexCount: 24,
        indexBufferKey: "mesh:a/index",
        indexCount: 6,
      },
      {
        renderId: 1,
        vertexBufferKeys: ["mesh:a/vertex"],
        vertexCount: 24,
        indexBufferKey: "mesh:a/index",
        indexCount: 6,
      },
    ]);
  });

  it("creates non-indexed draw descriptors", () => {
    expect(
      createDrawCommandDescriptors(
        [drawPackage(1, "mesh:a")],
        [meshResource("mesh:a", false)],
      ).descriptors[0],
    ).toMatchObject({
      vertexCount: 24,
      indexBufferKey: null,
      indexCount: null,
    });
  });

  it("reports missing mesh resources", () => {
    expect(
      createDrawCommandDescriptors([drawPackage(1, "mesh:missing")], [])
        .diagnostics,
    ).toMatchObject([
      {
        code: "drawCommand.missingMeshResource",
        renderId: 1,
        resourceKey: "mesh:missing",
      },
    ]);
  });

  it("appends the instance tint vertex buffer for instance-tint pipelines", () => {
    const result = createDrawCommandDescriptors(
      [
        drawPackage(
          1,
          "mesh:a",
          "standard|instance-tint|opaque|back|less|none",
        ),
      ],
      [meshResource("mesh:a", true)],
      {
        instanceTintResources: [
          {
            streamId: "instanceTint",
            resourceKey: "instance-tint-buffer:frame",
            buffer: {},
            vertexCount: 2,
            offsets: [{ renderId: 1, sourceOffset: 0, packedOffset: 0 }],
          },
        ],
      },
    );

    expect(result.diagnostics).toEqual([]);
    expect(result.descriptors[0]?.vertexBufferKeys).toEqual([
      "mesh:a/vertex",
      "instance-tint-buffer:frame",
    ]);
  });

  it("does not treat substring matches as an instance-tint feature", () => {
    const result = createDrawCommandDescriptors(
      [drawPackage(1, "mesh:a", "standard|not-instance-tint|opaque")],
      [meshResource("mesh:a", true)],
    );

    expect(result.diagnostics).toEqual([]);
    expect(result.descriptors[0]?.vertexBufferKeys).toEqual(["mesh:a/vertex"]);
  });

  it("diagnoses instance-tint pipelines without a tint buffer", () => {
    const result = createDrawCommandDescriptors(
      [
        drawPackage(
          1,
          "mesh:a",
          "standard|instance-tint|opaque|back|less|none",
        ),
      ],
      [meshResource("mesh:a", true)],
    );

    expect(result.descriptors).toEqual([]);
    expect(result.diagnostics).toMatchObject([
      {
        code: "drawCommand.missingInstanceTintResource",
        renderId: 1,
      },
    ]);
  });

  it("can reuse caller-owned descriptor scratch on the frame hot path", () => {
    const scratch = createDrawCommandDescriptorScratch(2);
    const packages = [drawPackage(1, "mesh:a"), drawPackage(2, "mesh:a")];
    const resources = [meshResource("mesh:a", true)];
    const first = writeDrawCommandDescriptors(packages, resources, scratch);
    const firstDescriptors = [...first.descriptors];
    const firstVertexKeys = first.descriptors.map(
      (descriptor) => descriptor.vertexBufferKeys,
    );
    const second = writeDrawCommandDescriptors(
      [drawPackage(2, "mesh:a"), drawPackage(1, "mesh:a")],
      resources,
      scratch,
    );

    expect(second).toBe(first);
    expect(new Set(second.descriptors)).toEqual(new Set(firstDescriptors));
    expect(second.descriptors.map((descriptor) => descriptor.renderId)).toEqual(
      [2, 1],
    );
    expect(
      second.descriptors.map((descriptor) => descriptor.vertexBufferKeys),
    ).toEqual(firstVertexKeys);
    expect(second.descriptors[0]?.vertexBufferKeys).toBe(firstVertexKeys[0]);
    expect(second.descriptors[1]?.vertexBufferKeys).toBe(firstVertexKeys[1]);
  });
});

function drawPackage(
  renderId: number,
  meshResourceKey: string,
  pipelineKey = "unlit",
): RenderWorldDrawPackage {
  return {
    renderId,
    batchKey: { ...BATCH, pipelineKey },
    meshResourceKey,
    materialResourceKey: "material:a",
    packet: { instanceTintOffset: 0 },
    transformPackedOffset: renderId * 16,
  } as unknown as RenderWorldDrawPackage;
}

function meshResource(
  resourceKey: string,
  indexed: boolean,
): MeshGpuBufferResource {
  return {
    resourceKey,
    vertexCount: 24,
    vertexBuffers: [
      {
        streamId: "main",
        resourceKey: `${resourceKey}/vertex`,
        buffer: {},
        vertexCount: 24,
      },
    ],
    ...(indexed
      ? {
          indexBuffer: {
            resourceKey: `${resourceKey}/index`,
            buffer: {},
            format: "uint16",
            indexCount: 6,
          },
        }
      : {}),
  };
}
