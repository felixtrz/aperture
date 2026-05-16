import { describe, expect, it } from "vitest";

import {
  createDrawCommandDescriptors,
  type BatchCompatibilityKey,
  type MeshGpuBufferResource,
  type RenderWorldDrawPackage,
} from "../../src/index.js";

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
});

function drawPackage(
  renderId: number,
  meshResourceKey: string,
): RenderWorldDrawPackage {
  return {
    renderId,
    batchKey: BATCH,
    meshResourceKey,
    materialResourceKey: "material:a",
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
