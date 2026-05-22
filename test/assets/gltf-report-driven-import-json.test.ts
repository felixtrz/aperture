import { describe, expect, it } from "vitest";

import {
  createGltfReportDrivenImportReport,
  gltfReportDrivenImportReportToJson,
  gltfReportDrivenImportReportToJsonValue,
} from "@aperture-engine/core";

describe("glTF report-driven import JSON", () => {
  it("serializes root, traversal, orchestration, and facade diagnostics", () => {
    const report = createGltfReportDrivenImportReport({
      root: {
        asset: { version: "2.0" },
        scenes: [{ nodes: [0] }, { nodes: [1] }],
        nodes: [{ name: "A" }, { name: "B" }],
      },
      provided: {
        root: { valid: true, diagnostics: [] },
      },
    });
    const json = gltfReportDrivenImportReportToJsonValue(report);
    const serialized = JSON.stringify(json);

    expect(json).toMatchObject({
      valid: false,
      root: { valid: true },
      sceneTraversal: {
        valid: false,
        sceneIndex: null,
        diagnostics: [{ code: "gltfScene.invalidSceneIndex" }],
      },
      orchestration: {
        valid: false,
        stages: expect.arrayContaining([
          expect.objectContaining({ stage: "root", status: "provided" }),
          expect.objectContaining({
            stage: "sceneTraversal",
            status: "failed",
          }),
        ]),
      },
      diagnostics: [{ code: "gltfImport.providedRootReport" }],
    });
    expect(JSON.parse(gltfReportDrivenImportReportToJson(report))).toEqual(
      json,
    );
    expect(serialized).not.toContain("vertexStreams");
    expect(serialized).not.toContain("AssetRegistry");
    expect(serialized).not.toContain("entitiesByKey");
    expect(serialized).not.toContain("RenderPacket");
    expect(serialized).not.toContain("GPU");
  });

  it("serializes optional asset mapping without raw image bytes", () => {
    const report = createGltfReportDrivenImportReport({
      root: {
        asset: { version: "2.0" },
        scene: 0,
        scenes: [{ nodes: [0] }],
        nodes: [{ name: "Root" }],
        materials: [
          {
            pbrMetallicRoughness: {
              baseColorTexture: { index: 0 },
            },
          },
        ],
        textures: [{ source: 0 }],
        images: [{ bufferView: 0, mimeType: "image/png" }],
      },
      createAssetMapping: true,
      resolveImageData: () => ({
        width: 1,
        height: 1,
        sourceData: {
          bytes: new Uint8Array([1, 2, 3, 4]),
          bytesPerRow: 4,
        },
      }),
    });
    const json = gltfReportDrivenImportReportToJsonValue(report);
    const serialized = JSON.stringify(json);

    expect(json.valid).toBe(true);
    expect(json.assetMapping).toMatchObject({
      valid: true,
      textures: [{ handleKey: "gltf:texture:0:baseColorTexture" }],
      materials: [{ handleKey: "material:gltf:material:0" }],
    });
    expect(serialized).not.toContain("Uint8Array");
    expect(serialized).not.toContain("[1,2,3,4]");
    expect(serialized).not.toContain("entitiesByKey");
    expect(serialized).not.toContain("RenderPacket");
    expect(serialized).not.toContain("GPU");
  });

  it("serializes optional mesh mapping without raw typed arrays", () => {
    const bytes = new Uint8Array(36);
    const view = new DataView(bytes.buffer);
    [0, 0, 0, 1, 0, 0, 0, 1, 0].forEach((value, index) =>
      view.setFloat32(index * 4, value, true),
    );
    const report = createGltfReportDrivenImportReport({
      root: {
        asset: { version: "2.0" },
        scene: 0,
        scenes: [{ nodes: [0] }],
        nodes: [{ name: "Root", mesh: 0 }],
        buffers: [{ byteLength: 36 }],
        bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }],
        accessors: [
          { bufferView: 0, componentType: 5126, type: "VEC3", count: 3 },
        ],
        meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
      },
      createMeshAssets: true,
      resolveBufferBytes: () => bytes,
    });
    const json = gltfReportDrivenImportReportToJsonValue(report);
    const serialized = JSON.stringify(json);

    expect(json.valid).toBe(true);
    expect(json.meshConstruction?.meshes[0]?.mesh).toMatchObject({
      kind: "mesh",
      vertexStreams: [
        {
          data: { type: "Uint8Array", length: 36 },
        },
      ],
    });
    expect(serialized).not.toContain("Float32Array([");
    expect(serialized).not.toContain("[0,0,0,1,0,0,0,1,0]");
    expect(serialized).not.toContain("entitiesByKey");
    expect(serialized).not.toContain("RenderPacket");
    expect(serialized).not.toContain("GPU");
  });
});
