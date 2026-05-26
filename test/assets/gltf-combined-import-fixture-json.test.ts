import { describe, expect, it } from "vitest";
import { AssetRegistry, createWorld } from "@aperture-engine/simulation";
import {
  GLTF_SAMPLER_FILTER,
  GLTF_SAMPLER_WRAP,
  createGltfEcsAuthoringCommandPlan,
  createGltfLoaderOrchestrationReport,
  createGltfPrimitiveMaterialResolutionReport,
  createGltfReportDrivenImportReport,
  gltfEcsAuthoringCommandPlanToJsonValue,
  gltfEcsCommandReplayReportToJsonValue,
  gltfLoaderOrchestrationReportToJsonValue,
  gltfPrimitiveMaterialResolutionReportToJsonValue,
  gltfReportDrivenImportReportToJsonValue,
  gltfSourceRegistrationOrchestrationReportToJson,
  gltfSourceRegistrationOrchestrationReportToJsonValue,
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

describe("combined glTF import fixture JSON", () => {
  it("serializes the composed reports without raw runtime payloads", () => {
    const reports = createCombinedReports();
    const json = {
      import: gltfReportDrivenImportReportToJsonValue(reports.importReport),
      sourceRegistration: gltfSourceRegistrationOrchestrationReportToJsonValue(
        reports.registration,
      ),
      primitiveMaterials: gltfPrimitiveMaterialResolutionReportToJsonValue(
        reports.primitiveMaterials,
      ),
      commandPlan: gltfEcsAuthoringCommandPlanToJsonValue(reports.commandPlan),
      replay: gltfEcsCommandReplayReportToJsonValue(reports.replay),
      orchestration: gltfLoaderOrchestrationReportToJsonValue(
        reports.orchestration,
      ),
    };

    expect(json).toMatchObject({
      import: {
        valid: true,
        assetMapping: {
          textures: [{ handleKey: "gltf:texture:0:baseColorTexture" }],
          materials: [{ handleKey: "material:gltf:material:0" }],
        },
        meshConstruction: {
          meshes: [
            {
              registeredHandleKey: "mesh:gltf:mesh:0:primitive:0",
              mesh: {
                vertexStreams: [
                  {
                    data: { type: "Uint8Array", length: 36 },
                  },
                ],
              },
            },
          ],
        },
      },
      sourceRegistration: {
        valid: true,
        sourceRegistration: {
          written: [
            { kind: "texture" },
            { kind: "sampler" },
            { kind: "material" },
          ],
        },
        meshRegistration: {
          written: [{ kind: "mesh" }],
        },
        stages: [
          {
            stage: "materialTextureSamplerRegistration",
            status: "provided",
            writtenCount: 3,
          },
          {
            stage: "meshRegistration",
            status: "provided",
            writtenCount: 1,
          },
        ],
      },
      primitiveMaterials: {
        valid: true,
        resolved: [
          {
            meshHandleKey: "mesh:gltf:mesh:0:primitive:0",
            materialHandleKey: "material:gltf:material:0",
          },
        ],
      },
      commandPlan: {
        valid: true,
        rootEntityKeys: ["gltf:scene:0"],
        dependencies: [
          "mesh:gltf:mesh:0:primitive:0",
          "material:gltf:material:0",
        ],
      },
      replay: {
        valid: true,
        entityKeys: [
          "gltf:scene:0",
          "gltf:node:0",
          "gltf:node:0:mesh:0:primitive:0",
        ],
      },
      orchestration: {
        valid: true,
        stages: expect.arrayContaining([
          expect.objectContaining({
            stage: "sourceRegistration",
            sideEffect: "asset-registry",
            writtenCount: 3,
          }),
          expect.objectContaining({
            stage: "meshRegistration",
            sideEffect: "asset-registry",
            writtenCount: 1,
          }),
          expect.objectContaining({
            stage: "ecsReplay",
            sideEffect: "ecs-world",
            createdCount: 3,
          }),
        ]),
      },
    });
    expect(
      JSON.parse(
        gltfSourceRegistrationOrchestrationReportToJson(reports.registration),
      ),
    ).toEqual(json.sourceRegistration);

    const serialized = JSON.stringify(json);
    expect(serialized).not.toContain('"bytes":');
    expect(serialized).not.toContain("[255,255,255,255]");
    expect(serialized).not.toContain("Float32Array([");
    expect(serialized).not.toContain("[0,0,0,1,0,0,0,1,0]");
    expect(serialized).not.toContain("entitiesByKey");
    expect(serialized).not.toContain("RenderPacket");
    expect(serialized).not.toContain("RenderSnapshot");
    expect(serialized).not.toContain("WebGPU");
    expect(serialized).not.toContain("GPU");
  });
});

function createCombinedReports() {
  const { root, bytes } = tinyGltfFixture();
  const registry = new AssetRegistry();
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
    registry,
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

  return {
    importReport,
    registration,
    primitiveMaterials,
    commandPlan,
    replay,
    orchestration,
  };
}

function requireReport<T>(report: T | null): T {
  if (report === null) {
    throw new Error("Expected fixture report to be present.");
  }

  return report;
}

function tinyGltfFixture() {
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
      nodes: [{ name: "MeshNode", mesh: 0, translation: [1, 2, 3] }],
      buffers: [{ byteLength: 36 }],
      bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }],
      accessors: [
        { bufferView: 0, componentType: 5126, type: "VEC3", count: 3 },
      ],
      meshes: [
        {
          primitives: [{ attributes: { POSITION: 0 }, material: 0 }],
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
