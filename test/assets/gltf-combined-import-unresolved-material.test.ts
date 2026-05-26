import { describe, expect, it } from "vitest";
import { AssetRegistry, createWorld } from "@aperture-engine/simulation";
import {
  GLTF_SAMPLER_FILTER,
  GLTF_SAMPLER_WRAP,
  createGltfEcsAuthoringCommandPlan,
  createGltfLoaderOrchestrationReport,
  createGltfPrimitiveMaterialResolutionReport,
  createGltfReportDrivenImportReport,
  registerGltfSourceAssetsFromReports,
  replayGltfEcsAuthoringCommands,
} from "@aperture-engine/render";

const decodedImage = {
  width: 1,
  height: 1,
  sourceData: {
    bytes: new Uint8Array([255, 255, 255, 255]),
    bytesPerRow: 4,
  },
};

describe("combined glTF import unresolved material fixture", () => {
  it("blocks primitive authoring when material registration cannot resolve the primitive material", () => {
    const { root, bytes } = unresolvedMaterialFixture();
    const importReport = createGltfReportDrivenImportReport({
      root,
      createAssetMapping: true,
      resolveImageData: () => decodedImage,
      createMeshAssets: true,
      resolveBufferBytes: () => bytes,
    });
    const assetMapping = requireReport(importReport.assetMapping);
    const meshPrimitive = requireReport(importReport.meshPrimitive);
    const meshConstruction = requireReport(importReport.meshConstruction);
    const registration = registerGltfSourceAssetsFromReports({
      registry: new AssetRegistry(),
      assetMapping,
      meshConstruction,
    });
    const sourceRegistration = requireReport(registration.sourceRegistration);
    const meshRegistration = requireReport(registration.meshRegistration);
    const primitiveMaterials = createGltfPrimitiveMaterialResolutionReport({
      primitiveReport: meshPrimitive,
      registrationReport: sourceRegistration,
    });
    const commandPlan = createGltfEcsAuthoringCommandPlan({
      traversalReport: importReport.sceneTraversal,
      meshRegistrationReport: meshRegistration,
      primitiveMaterialReport: primitiveMaterials,
    });
    const replay = replayGltfEcsAuthoringCommands({
      world: createWorld(),
      plan: commandPlan,
    });
    const orchestration = createGltfLoaderOrchestrationReport({
      root: importReport.root,
      assetMapping,
      sourceRegistration,
      meshConstruction,
      meshRegistration,
      sceneTraversal: importReport.sceneTraversal,
      primitiveMaterialResolution: primitiveMaterials,
      ecsCommandPlan: commandPlan,
      ecsReplay: replay,
    });

    expect(importReport.valid).toBe(true);
    expect(registration.valid).toBe(true);
    expect(primitiveMaterials.valid).toBe(false);
    expect(primitiveMaterials.unresolved).toEqual([
      {
        meshHandleKey: "mesh:gltf:mesh:0:primitive:0",
        meshIndex: 0,
        primitiveIndex: 0,
        materialIndex: 1,
        materialHandleKey: "material:gltf:material:1",
        reason: "gltfPrimitiveMaterial.unregisteredMaterial",
        diagnostics: [
          {
            code: "gltfPrimitiveMaterial.unregisteredMaterial",
            severity: "error",
            message:
              "glTF mesh 0 primitive 0 references material 'material:gltf:material:1' but it was not registered or provided as available.",
            meshHandleKey: "mesh:gltf:mesh:0:primitive:0",
            meshIndex: 0,
            primitiveIndex: 0,
            materialIndex: 1,
            materialHandleKey: "material:gltf:material:1",
          },
        ],
      },
    ]);
    expect(commandPlan.valid).toBe(false);
    expect(
      commandPlan.commands.filter((command) => command.type === "createEntity"),
    ).toEqual([
      { type: "createEntity", entityKey: "gltf:scene:0", label: "Scene0" },
      { type: "createEntity", entityKey: "gltf:node:0", label: "MeshNode" },
    ]);
    expect(commandPlan.commands).not.toContainEqual(
      expect.objectContaining({
        type: "createEntity",
        entityKey: "gltf:node:0:mesh:0:primitive:0",
      }),
    );
    expect(commandPlan.skipped).toMatchObject([
      {
        entityKey: "gltf:node:0:mesh:0:primitive:0",
        reason: "gltfEcsAuthoring.unresolvedPrimitiveMaterial",
        diagnostics: [
          {
            code: "gltfEcsAuthoring.unresolvedPrimitiveMaterial",
            sourceReason: "gltfPrimitiveMaterial.unregisteredMaterial",
            materialHandleKey: "material:gltf:material:1",
          },
        ],
      },
    ]);
    expect(replay.valid).toBe(false);
    expect(replay.created).toEqual([]);
    expect(replay.diagnostics).toMatchObject([
      { code: "gltfEcsReplay.invalidPlan" },
    ]);
    expect(orchestration.valid).toBe(false);
    expect(orchestration.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "gltfLoader.failedStage",
          stage: "primitiveMaterialResolution",
        }),
        expect.objectContaining({
          code: "gltfLoader.failedStage",
          stage: "ecsCommandPlan",
        }),
        expect.objectContaining({
          code: "gltfLoader.failedStage",
          stage: "ecsReplay",
        }),
      ]),
    );
  });
});

function requireReport<T>(report: T | null): T {
  if (report === null) {
    throw new Error("Expected fixture report to be present.");
  }

  return report;
}

function unresolvedMaterialFixture() {
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
      nodes: [{ name: "MeshNode", mesh: 0 }],
      buffers: [{ byteLength: 36 }],
      bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }],
      accessors: [
        { bufferView: 0, componentType: 5126, type: "VEC3", count: 3 },
      ],
      meshes: [
        {
          primitives: [{ attributes: { POSITION: 0 }, material: 1 }],
        },
      ],
      materials: [
        {
          pbrMetallicRoughness: {
            baseColorTexture: { index: 0 },
          },
        },
      ],
      textures: [{ source: 0, sampler: 0 }],
      images: [{ bufferView: 1, mimeType: "image/png" }],
      samplers: [
        {
          wrapS: GLTF_SAMPLER_WRAP.REPEAT,
          wrapT: GLTF_SAMPLER_WRAP.CLAMP_TO_EDGE,
          magFilter: GLTF_SAMPLER_FILTER.LINEAR,
          minFilter: GLTF_SAMPLER_FILTER.LINEAR_MIPMAP_LINEAR,
        },
      ],
    },
  };
}
