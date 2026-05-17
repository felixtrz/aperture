import { describe, expect, it } from "vitest";

import {
  AssetRegistry,
  GLTF_SAMPLER_FILTER,
  GLTF_SAMPLER_WRAP,
  Material,
  Mesh,
  Name,
  createGltfEcsAuthoringCommandPlan,
  createGltfLoaderOrchestrationReport,
  createGltfPrimitiveMaterialResolutionReport,
  createGltfReportDrivenImportReport,
  createWorld,
  gltfEcsCommandReplayReportToJsonValue,
  registerGltfSourceAssetsFromReports,
  replayGltfEcsAuthoringCommands,
} from "@aperture-engine/core";

const decodedImage = {
  width: 1,
  height: 1,
  sourceData: {
    bytes: new Uint8Array([255, 255, 255, 255]),
    bytesPerRow: 4,
  },
};

describe("combined glTF import fixture", () => {
  it("composes report import, source registration, material resolution, command planning, and replay", () => {
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
    const world = createWorld();
    const replay = replayGltfEcsAuthoringCommands({
      world,
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
    const primitive = replay.entitiesByKey.get(
      "gltf:node:0:mesh:0:primitive:0",
    );

    expect(importReport.valid).toBe(true);
    expect(registration.valid).toBe(true);
    expect(primitiveMaterials.valid).toBe(true);
    expect(commandPlan.valid).toBe(true);
    expect(replay.valid).toBe(true);
    expect(orchestration.valid).toBe(true);
    expect(registry.list({ status: "ready" })).toHaveLength(4);
    expect(registration.stages).toEqual([
      {
        stage: "materialTextureSamplerRegistration",
        status: "provided",
        writtenCount: 3,
        skippedCount: 0,
        diagnosticCount: 0,
      },
      {
        stage: "meshRegistration",
        status: "provided",
        writtenCount: 1,
        skippedCount: 0,
        diagnosticCount: 0,
      },
    ]);
    expect(primitive?.getValue(Name, "value")).toBe("MeshNode.Primitive0");
    expect(primitive?.getValue(Mesh, "meshId")).toBe("gltf:mesh:0:primitive:0");
    expect(primitive?.getValue(Material, "materialId")).toBe("gltf:material:0");
    expect(orchestration.stages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stage: "sourceRegistration",
          sideEffect: "asset-registry",
          status: "provided",
          writtenCount: 3,
        }),
        expect.objectContaining({
          stage: "meshRegistration",
          sideEffect: "asset-registry",
          status: "provided",
          writtenCount: 1,
        }),
        expect.objectContaining({
          stage: "ecsReplay",
          sideEffect: "ecs-world",
          status: "provided",
          createdCount: 3,
        }),
      ]),
    );

    const replayJson = JSON.stringify(
      gltfEcsCommandReplayReportToJsonValue(replay),
    );
    expect(replayJson).not.toContain("entitiesByKey");
    expect(replayJson).not.toContain("RenderPacket");
    expect(replayJson).not.toContain("RenderSnapshot");
    expect(replayJson).not.toContain("WebGPU");
    expect(replayJson).not.toContain("GPU");
  });

  it("keeps source registration partial when mesh construction is intentionally absent", () => {
    const { root } = tinyGltfFixture();
    const importReport = createGltfReportDrivenImportReport({
      root,
      createAssetMapping: true,
      resolveImageData: () => decodedImage,
    });
    const registration = registerGltfSourceAssetsFromReports({
      registry: new AssetRegistry(),
      assetMapping: requireReport(importReport.assetMapping),
    });

    expect(importReport.meshConstruction).toBeNull();
    expect(registration.valid).toBe(true);
    expect(registration.meshRegistration).toBeNull();
    expect(registration.stages).toEqual([
      {
        stage: "materialTextureSamplerRegistration",
        status: "provided",
        writtenCount: 3,
        skippedCount: 0,
        diagnosticCount: 0,
      },
      {
        stage: "meshRegistration",
        status: "missing",
        writtenCount: 0,
        skippedCount: 0,
        diagnosticCount: 0,
      },
    ]);
  });
});

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
