import { describe, expect, it } from "vitest";

import {
  AssetRegistry,
  createGltfSceneImportContractReport,
  gltfSceneImportContractReportToJsonValue,
  registerGltfSourceAssetsFromReports,
  type GltfMeshAssetConstructionReport,
  type MeshAsset,
} from "@aperture-engine/core";

describe("glTF scene import contract", () => {
  it("summarizes a multi-primitive multi-material scene contract", () => {
    const root = sceneRoot();
    const registration = registerGltfSourceAssetsFromReports({
      registry: new AssetRegistry(),
      assetMapping: createGltfSceneImportContractReport({
        root,
        resolveImageData: () => null,
        primitiveShapes: [],
      }).assetMapping,
      meshConstruction: meshConstructionReport(),
    });
    const report = createGltfSceneImportContractReport({
      root,
      resolveImageData: () => null,
      sourceRegistrationReport: registration.sourceRegistration!,
      meshRegistrationReport: registration.meshRegistration!,
      primitiveShapes: [
        { meshIndex: 0, primitiveIndex: 0, shape: "plane" },
        { meshIndex: 1, primitiveIndex: 0, shape: "box" },
        { meshIndex: 2, primitiveIndex: 0, shape: "pyramid" },
      ],
      cameras: [
        {
          key: "gltf:camera:0",
          nodeKey: "gltf:node:3",
          projection: "perspective",
          near: 0.1,
          far: 100,
          yfov: 0.9,
        },
      ],
      directLights: [
        {
          key: "gltf:light:directional:0",
          nodeKey: "gltf:node:4",
          kind: "directional",
          color: [1, 0.95, 0.85],
          intensity: 2,
          castsShadow: true,
        },
      ],
      environment: {
        key: "gltf:environment:studio",
        diffuseTextureHandleKey: "texture:gltf:environment:studio:diffuse",
        specularTextureHandleKey: "texture:gltf:environment:studio:specular",
        intensity: 0.6,
      },
      shadows: [
        {
          key: "gltf:shadow:directional:0",
          lightKey: "gltf:light:directional:0",
          mapSize: 1024,
          depthBias: 0.001,
          normalBias: 0.01,
        },
      ],
    });

    expect(report.valid).toBe(true);
    expect(report.diagnostics).toEqual([]);
    expect(report.summary).toMatchObject({
      sceneIndex: 0,
      sceneEntityKey: "gltf:scene:0",
      nodeCount: 3,
      rootNodeCount: 3,
      meshPrimitiveCount: 3,
      renderablePrimitiveCount: 3,
      primitiveShapeCount: 3,
      materialFamilyCount: 2,
      cameraCount: 1,
      directLightCount: 1,
      hasEnvironmentIntent: true,
      shadowIntentCount: 1,
    });
    expect(report.summary.primitiveShapes).toEqual(["box", "plane", "pyramid"]);
    expect(report.summary.materialFamilies).toEqual([
      { family: "standard", count: 2 },
      { family: "unlit", count: 1 },
    ]);
    expect(report.ecsCommandPlan?.dependencies).toEqual([
      "mesh:gltf:mesh:0:primitive:0",
      "material:gltf:material:0",
      "mesh:gltf:mesh:1:primitive:0",
      "material:gltf:material:1",
      "mesh:gltf:mesh:2:primitive:0",
    ]);

    const json = gltfSceneImportContractReportToJsonValue(report);
    expect(JSON.parse(JSON.stringify(json))).toEqual(json);
    expect(json.ecsCommandPlan?.commands).toEqual(
      report.ecsCommandPlan?.commands,
    );
  });

  it("reports scene-slice intent gaps without adding renderer state", () => {
    const root = sceneRoot({ materialForBox: 0, materialForPyramid: 0 });
    const registration = registerGltfSourceAssetsFromReports({
      registry: new AssetRegistry(),
      assetMapping: createGltfSceneImportContractReport({
        root,
        resolveImageData: () => null,
        primitiveShapes: [],
      }).assetMapping,
      meshConstruction: meshConstructionReport(),
    });
    const report = createGltfSceneImportContractReport({
      root,
      resolveImageData: () => null,
      sourceRegistrationReport: registration.sourceRegistration!,
      meshRegistrationReport: registration.meshRegistration!,
      primitiveShapes: [{ meshIndex: 0, primitiveIndex: 0, shape: "plane" }],
    });

    expect(report.valid).toBe(false);
    expect(report.summary.renderablePrimitiveCount).toBe(3);
    expect(report.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "gltfSceneImport.insufficientPrimitiveShapes",
      "gltfSceneImport.insufficientMaterialFamilies",
      "gltfSceneImport.missingCameraIntent",
      "gltfSceneImport.missingDirectLightIntent",
      "gltfSceneImport.missingEnvironmentIntent",
      "gltfSceneImport.missingShadowIntent",
    ]);
    expect(report.environment).toBeNull();
    expect(report.shadows).toEqual([]);
  });
});

function sceneRoot(
  options: {
    readonly materialForBox?: number;
    readonly materialForPyramid?: number;
  } = {},
): Record<string, unknown> {
  return {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0, 1, 2] }],
    nodes: [
      { name: "Plane", mesh: 0, translation: [-1.5, 0, 0] },
      {
        name: "Box",
        mesh: 1,
        translation: [1.5, 0, 0],
        rotation: [0, 0.382683, 0, 0.92388],
      },
      { name: "Pyramid", mesh: 2, scale: [0.75, 1.5, 0.75] },
    ],
    accessors: [{}, {}, {}],
    meshes: [
      {
        name: "PlaneMesh",
        primitives: [{ attributes: { POSITION: 0 }, material: 0 }],
      },
      {
        name: "BoxMesh",
        primitives: [
          {
            attributes: { POSITION: 1 },
            material: options.materialForBox ?? 1,
          },
        ],
      },
      {
        name: "PyramidMesh",
        primitives: [
          {
            attributes: { POSITION: 2 },
            material: options.materialForPyramid ?? 0,
          },
        ],
      },
    ],
    materials: [
      {
        name: "StandardBlue",
        pbrMetallicRoughness: {
          baseColorFactor: [0.2, 0.4, 1, 1],
          metallicFactor: 0.2,
          roughnessFactor: 0.8,
        },
      },
      {
        name: "UnlitGreen",
        pbrMetallicRoughness: {
          baseColorFactor: [0.1, 0.9, 0.2, 1],
        },
        extensions: { KHR_materials_unlit: {} },
      },
    ],
  };
}

function meshConstructionReport(): GltfMeshAssetConstructionReport {
  return {
    valid: true,
    meshes: [0, 1, 2].map((meshIndex) => ({
      handleKey: `gltf:mesh:${meshIndex}:primitive:0`,
      registeredHandleKey: `mesh:gltf:mesh:${meshIndex}:primitive:0`,
      meshIndex,
      primitiveIndex: 0,
      mesh: meshAsset(`mesh:gltf:mesh:${meshIndex}:primitive:0`),
    })),
    diagnostics: [],
  };
}

function meshAsset(label: string): MeshAsset {
  return {
    kind: "mesh",
    label,
    vertexStreams: [
      {
        id: "positions",
        arrayStride: 12,
        vertexCount: 3,
        attributes: [{ semantic: "POSITION", format: "float32x3", offset: 0 }],
        data: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
      },
    ],
    submeshes: [
      {
        label: "default",
        topology: "triangle-list",
        materialSlot: 0,
        vertexStart: 0,
        vertexCount: 3,
        indexStart: 0,
        indexCount: 0,
      },
    ],
    materialSlots: [{ index: 0, label: "default" }],
    localAabb: { min: [0, 0, 0], max: [1, 1, 0] },
    localSphere: { center: [0.5, 0.5, 0], radius: Math.SQRT1_2 },
  };
}
