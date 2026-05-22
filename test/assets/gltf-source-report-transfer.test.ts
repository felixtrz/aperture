import { describe, expect, it } from "vitest";

import {
  createGltfSourceAssetTransferPackage,
  validateMeshAsset,
  type GltfAssetMappingReport,
  type GltfMeshAssetConstructionReport,
} from "@aperture-engine/core";

describe("glTF source asset report transfer packaging", () => {
  it("moves upload bytes to main while keeping extraction metadata usable", () => {
    const textureBytes = new Uint8Array([255, 0, 0, 255]);
    const vertexData = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    const indexData = new Uint16Array([0, 1, 2]);
    const assetMapping = mappingFixture(textureBytes);
    const meshConstruction = meshConstructionFixture(vertexData, indexData);
    const transferPackage = createGltfSourceAssetTransferPackage({
      assetMapping,
      meshConstruction,
    });
    const extractionMesh =
      transferPackage.extractionThread.meshConstruction.meshes[0]?.mesh;
    const extractionTexture =
      transferPackage.extractionThread.assetMapping.textures[0]?.texture;

    expect(transferPackage.transferList).toEqual(
      expect.arrayContaining([
        textureBytes.buffer,
        vertexData.buffer,
        indexData.buffer,
      ]),
    );
    expect(transferPackage.transferredByteLength).toBe(
      textureBytes.buffer.byteLength +
        vertexData.buffer.byteLength +
        indexData.buffer.byteLength,
    );
    expect(extractionMesh?.vertexStreams[0]?.data.byteLength).toBe(0);
    expect(extractionMesh?.indexBuffer?.data.byteLength).toBe(0);
    expect(extractionMesh?.indexBuffer?.indexCount).toBe(3);
    expect(extractionMesh === null || extractionMesh === undefined).toBe(false);
    if (extractionMesh === null || extractionMesh === undefined) {
      throw new Error("Expected metadata-only extraction mesh.");
    }
    expect(validateMeshAsset(extractionMesh).valid).toBe(true);
    expect(extractionTexture?.sourceData).toBeUndefined();
    expect(extractionTexture?.width).toBe(1);

    const clonedMainThread = structuredClone(transferPackage.mainThread, {
      transfer: [...transferPackage.transferList],
    });

    expect(vertexData.byteLength).toBe(0);
    expect(indexData.byteLength).toBe(0);
    expect(textureBytes.byteLength).toBe(0);
    expect(
      clonedMainThread.meshConstruction.meshes[0]?.mesh?.vertexStreams[0]?.data
        .byteLength,
    ).toBe(36);
    expect(
      clonedMainThread.meshConstruction.meshes[0]?.mesh?.indexBuffer?.data
        .length,
    ).toBe(3);
    expect(
      clonedMainThread.assetMapping.textures[0]?.texture?.sourceData?.bytes
        .byteLength,
    ).toBe(4);
  });

  it("compacts subrange views before transfer to avoid moving whole source buffers", () => {
    const textureBuffer = new ArrayBuffer(32);
    const vertexBuffer = new ArrayBuffer(80);
    const indexBuffer = new ArrayBuffer(24);
    const textureBytes = new Uint8Array(textureBuffer, 8, 4);
    const vertexData = new Float32Array(vertexBuffer, 4, 9);
    const indexData = new Uint16Array(indexBuffer, 2, 3);
    const assetMapping = mappingFixture(textureBytes);
    const meshConstruction = meshConstructionFixture(vertexData, indexData);
    const transferPackage = createGltfSourceAssetTransferPackage({
      assetMapping,
      meshConstruction,
    });
    const mainTextureBytes =
      transferPackage.mainThread.assetMapping.textures[0]?.texture?.sourceData
        ?.bytes;
    const mainVertexData =
      transferPackage.mainThread.meshConstruction.meshes[0]?.mesh
        ?.vertexStreams[0]?.data;
    const mainIndexData =
      transferPackage.mainThread.meshConstruction.meshes[0]?.mesh?.indexBuffer
        ?.data;

    expect(transferPackage.transferList).not.toContain(textureBuffer);
    expect(transferPackage.transferList).not.toContain(vertexBuffer);
    expect(transferPackage.transferList).not.toContain(indexBuffer);
    expect(mainTextureBytes?.buffer).not.toBe(textureBuffer);
    expect(mainVertexData?.buffer).not.toBe(vertexBuffer);
    expect(mainIndexData?.buffer).not.toBe(indexBuffer);
    expect(transferPackage.transferredByteLength).toBe(
      textureBytes.byteLength + vertexData.byteLength + indexData.byteLength,
    );

    const clonedMainThread = structuredClone(transferPackage.mainThread, {
      transfer: [...transferPackage.transferList],
    });

    expect(textureBytes.byteLength).toBe(4);
    expect(vertexData.byteLength).toBe(36);
    expect(indexData.byteLength).toBe(6);
    expect(
      clonedMainThread.assetMapping.textures[0]?.texture?.sourceData?.bytes
        .byteLength,
    ).toBe(4);
    expect(
      clonedMainThread.meshConstruction.meshes[0]?.mesh?.vertexStreams[0]?.data
        .byteLength,
    ).toBe(36);
    expect(
      clonedMainThread.meshConstruction.meshes[0]?.mesh?.indexBuffer?.data
        .byteLength,
    ).toBe(6);
  });
});

function mappingFixture(bytes: Uint8Array): GltfAssetMappingReport {
  return {
    valid: true,
    root: { valid: true, diagnostics: [] },
    textures: [
      {
        handleKey: "texture:gltf:test:baseColorTexture",
        textureIndex: 0,
        slot: "baseColorTexture",
        texture: {
          kind: "texture",
          label: "base color",
          dimension: "2d",
          width: 1,
          height: 1,
          depthOrLayers: 1,
          format: "rgba8unorm-srgb",
          colorSpace: "srgb",
          semantic: "base-color",
          mipLevelCount: 1,
          usage: ["sampled", "copy-dst"],
          sourceData: { bytes, bytesPerRow: 4 },
        },
        report: {
          valid: true,
          texture: {
            kind: "texture",
            label: "base color",
            dimension: "2d",
            width: 1,
            height: 1,
            depthOrLayers: 1,
            format: "rgba8unorm-srgb",
            colorSpace: "srgb",
            semantic: "base-color",
            mipLevelCount: 1,
            usage: ["sampled", "copy-dst"],
          },
          sampler: null,
          textureIndex: 0,
          slot: "baseColorTexture",
          diagnostics: [],
        },
      },
    ],
    samplers: [],
    materials: [],
    diagnostics: [],
  } as GltfAssetMappingReport;
}

function meshConstructionFixture(
  vertexData: Float32Array,
  indexData: Uint16Array,
): GltfMeshAssetConstructionReport {
  return {
    valid: true,
    meshes: [
      {
        handleKey: "gltf:mesh:0:primitive:0",
        registeredHandleKey: "mesh:gltf:mesh:0:primitive:0",
        meshIndex: 0,
        primitiveIndex: 0,
        mesh: {
          kind: "mesh",
          label: "mesh:gltf:mesh:0:primitive:0",
          vertexStreams: [
            {
              id: "gltf-primitive-interleaved",
              arrayStride: 12,
              vertexCount: 3,
              attributes: [
                { semantic: "POSITION", format: "float32x3", offset: 0 },
              ],
              data: vertexData,
            },
          ],
          indexBuffer: { format: "uint16", data: indexData },
          submeshes: [
            {
              label: "default",
              topology: "triangle-list",
              materialSlot: 0,
              vertexStart: 0,
              vertexCount: 3,
              indexStart: 0,
              indexCount: 3,
            },
          ],
          materialSlots: [{ index: 0, label: "default" }],
          localAabb: { min: [0, 0, 0], max: [1, 1, 0] },
          localSphere: { center: [0.5, 0.5, 0], radius: Math.SQRT1_2 },
        },
      },
    ],
    diagnostics: [],
  };
}
