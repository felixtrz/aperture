import { describe, expect, it } from "vitest";

import {
  createGltfReportDrivenImportReport,
  type GltfMeshSourceAssetRegistrationReport,
} from "@aperture-engine/core";

describe("glTF report-driven import facade", () => {
  it("creates root, scene traversal, and orchestration reports from glTF JSON", () => {
    const report = createGltfReportDrivenImportReport({
      root: {
        asset: { version: "2.0" },
        scene: 0,
        scenes: [{ nodes: [0] }],
        nodes: [{ name: "Root" }],
      },
    });

    expect(report.valid).toBe(true);
    expect(report.root.valid).toBe(true);
    expect(report.sceneTraversal.sceneEntityKey).toBe("gltf:scene:0");
    expect(report.sceneTraversal.nodes).toMatchObject([
      { nodeIndex: 0, entityKey: "gltf:node:0", label: "Root" },
    ]);
    expect(report.orchestration.stages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ stage: "root", status: "provided" }),
        expect.objectContaining({
          stage: "sceneTraversal",
          status: "provided",
        }),
      ]),
    );
  });

  it("passes caller-provided reports into orchestration without side effects", () => {
    const report = createGltfReportDrivenImportReport({
      root: {
        asset: { version: "2.0" },
        scene: 0,
        scenes: [{ nodes: [0] }],
        nodes: [{ name: "Root" }],
      },
      provided: {
        meshRegistration: meshRegistrationReport(),
      },
    });

    expect(report.valid).toBe(false);
    expect(report.orchestration.stages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stage: "meshRegistration",
          status: "provided",
          sideEffect: "asset-registry",
          writtenCount: 1,
        }),
      ]),
    );
    expect(report.orchestration.diagnostics).toMatchObject([
      {
        code: "gltfLoader.sideEffectWithoutPrerequisite",
        stage: "meshRegistration",
        requiredStage: "meshConstruction",
      },
    ]);
  });

  it("can create a pure material/texture asset mapping report", () => {
    const report = createGltfReportDrivenImportReport({
      root: rootWithMaterialTexture(),
      createAssetMapping: true,
      resolveImageData: () => decodedImage,
    });

    expect(report.valid).toBe(true);
    expect(report.assetMapping?.valid).toBe(true);
    expect(report.assetMapping?.textures).toHaveLength(1);
    expect(report.assetMapping?.materials).toHaveLength(1);
    expect(report.orchestration.stages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stage: "assetMapping",
          status: "provided",
          sideEffect: "none",
        }),
      ]),
    );
  });

  it("reports missing image data through the mapping report", () => {
    const report = createGltfReportDrivenImportReport({
      root: rootWithMaterialTexture(),
      createAssetMapping: true,
    });

    expect(report.valid).toBe(false);
    expect(report.assetMapping?.valid).toBe(false);
    expect(report.orchestration.stages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stage: "assetMapping",
          status: "failed",
        }),
      ]),
    );
  });

  it("rejects provided asset mapping when mapping creation is enabled", () => {
    const report = createGltfReportDrivenImportReport({
      root: rootWithMaterialTexture(),
      createAssetMapping: true,
      resolveImageData: () => decodedImage,
      provided: {
        assetMapping: {
          valid: true,
          root: { valid: true, diagnostics: [] },
          textures: [],
          samplers: [],
          materials: [],
          diagnostics: [],
        },
      },
    });

    expect(report.valid).toBe(false);
    expect(report.diagnostics).toMatchObject([
      { code: "gltfImport.assetMappingConflict" },
    ]);
  });

  it("can create pure mesh primitive and construction reports", () => {
    const { root, bytes } = rootWithTriangleMesh();
    const report = createGltfReportDrivenImportReport({
      root,
      createMeshAssets: true,
      resolveBufferBytes: () => bytes,
    });

    expect(report.valid).toBe(true);
    expect(report.meshPrimitive?.valid).toBe(true);
    expect(report.accessorValidation?.valid).toBe(true);
    expect(report.accessorDecoding?.valid).toBe(true);
    expect(report.meshConstruction?.valid).toBe(true);
    expect(report.meshConstruction?.meshes[0]).toMatchObject({
      registeredHandleKey: "mesh:gltf:mesh:0:primitive:0",
      meshIndex: 0,
      primitiveIndex: 0,
    });
    expect(report.orchestration.stages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stage: "meshConstruction",
          status: "provided",
          sideEffect: "none",
        }),
      ]),
    );
  });

  it("reports missing buffer bytes through mesh decoding reports", () => {
    const { root } = rootWithTriangleMesh();
    const report = createGltfReportDrivenImportReport({
      root,
      createMeshAssets: true,
    });

    expect(report.valid).toBe(false);
    expect(report.accessorDecoding?.valid).toBe(false);
    expect(report.meshConstruction?.valid).toBe(true);
    expect(report.orchestration.stages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stage: "meshConstruction",
          status: "provided",
        }),
      ]),
    );
  });

  it("rejects provided mesh construction when mesh creation is enabled", () => {
    const { root, bytes } = rootWithTriangleMesh();
    const report = createGltfReportDrivenImportReport({
      root,
      createMeshAssets: true,
      resolveBufferBytes: () => bytes,
      provided: {
        meshConstruction: {
          valid: true,
          meshes: [],
          diagnostics: [],
        },
      },
    });

    expect(report.valid).toBe(false);
    expect(report.diagnostics).toMatchObject([
      { code: "gltfImport.meshConstructionConflict" },
    ]);
  });

  it("reports scene traversal failures without replaying or rendering", () => {
    const report = createGltfReportDrivenImportReport({
      root: {
        asset: { version: "2.0" },
        scenes: [{ nodes: [0] }, { nodes: [1] }],
        nodes: [{ name: "A" }, { name: "B" }],
      },
    });

    expect(report.valid).toBe(false);
    expect(report.sceneTraversal.valid).toBe(false);
    expect(report.sceneTraversal.diagnostics).toMatchObject([
      { code: "gltfScene.invalidSceneIndex" },
    ]);
    expect(JSON.stringify(report)).not.toContain("WebGPU");
    expect(JSON.stringify(report)).not.toContain("RenderPacket");
  });
});

function meshRegistrationReport(): GltfMeshSourceAssetRegistrationReport {
  return {
    valid: true,
    written: [
      {
        kind: "mesh",
        plannedHandleKey: "gltf:mesh:0:primitive:0",
        registeredHandleKey: "mesh:gltf:mesh:0:primitive:0",
        meshIndex: 0,
        primitiveIndex: 0,
        diagnostics: [],
      },
    ],
    skipped: [],
    diagnostics: [],
  };
}

const decodedImage = {
  width: 1,
  height: 1,
  sourceData: {
    bytes: new Uint8Array([255, 255, 255, 255]),
    bytesPerRow: 4,
  },
};

function rootWithMaterialTexture() {
  return {
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
  };
}

function rootWithTriangleMesh() {
  const bytes = new Uint8Array(36);
  const view = new DataView(bytes.buffer);
  [0, 0, 0, 1, 0, 0, 0, 1, 0].forEach((value, index) =>
    view.setFloat32(index * 4, value, true),
  );

  return {
    bytes,
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
  };
}
