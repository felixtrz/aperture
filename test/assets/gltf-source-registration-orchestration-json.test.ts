import { describe, expect, it } from "vitest";
import { AssetRegistry, createMeshHandle } from "@aperture-engine/simulation";
import {
  createGltfAssetMappingReport,
  GLTF_SAMPLER_FILTER,
  GLTF_SAMPLER_WRAP,
  gltfSourceRegistrationOrchestrationReportToJson,
  gltfSourceRegistrationOrchestrationReportToJsonValue,
  registerGltfSourceAssetsFromReports,
  type GltfMeshAssetConstructionReport,
  type MeshAsset,
} from "@aperture-engine/render";

const decodedImage = {
  width: 1,
  height: 1,
  sourceData: {
    bytes: new Uint8Array([1, 2, 3, 4]),
    bytesPerRow: 4,
  },
};

describe("glTF source registration orchestration report JSON", () => {
  it("serializes nested registration summaries without source payloads", () => {
    const registration = registerGltfSourceAssetsFromReports({
      registry: new AssetRegistry(),
      assetMapping: createMappingReport(),
      meshConstruction: constructionReport(),
    });
    const json =
      gltfSourceRegistrationOrchestrationReportToJsonValue(registration);

    expect(json).toMatchObject({
      valid: true,
      sourceRegistration: {
        valid: true,
        written: [
          {
            kind: "texture",
            registeredHandleKey: "texture:gltf:texture:0:baseColorTexture",
          },
          {
            kind: "sampler",
            registeredHandleKey: "sampler:gltf:sampler:0:baseColorTexture",
          },
          {
            kind: "material",
            registeredHandleKey: "material:gltf:material:0",
          },
        ],
        skipped: [],
        diagnostics: [],
      },
      meshRegistration: {
        valid: true,
        written: [
          {
            kind: "mesh",
            registeredHandleKey: "mesh:gltf:mesh:0:primitive:0",
          },
        ],
        skipped: [],
        diagnostics: [],
      },
      stages: [
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
      ],
      diagnostics: [],
    });

    const serialized = JSON.stringify(json);
    expect(serialized).not.toContain("bytes");
    expect(serialized).not.toContain("sourceData");
    expect(serialized).not.toContain("vertexStreams");
    expect(serialized).not.toContain("Float32Array");
    expect(serialized).not.toContain("createEntity");
    expect(serialized).not.toContain("renderPackets");
    expect(serialized).not.toContain("GPU");
    expect(
      JSON.parse(gltfSourceRegistrationOrchestrationReportToJson(registration)),
    ).toEqual(json);
  });

  it("serializes missing stages and nested skipped mesh diagnostics", () => {
    const registry = new AssetRegistry();
    const duplicateMesh = createMeshHandle("gltf:mesh:0:primitive:0");
    const existingMesh = meshAsset("existing mesh");

    registry.register(duplicateMesh);
    registry.markReady(duplicateMesh, existingMesh);

    const registration = registerGltfSourceAssetsFromReports({
      registry,
      meshConstruction: constructionReport(),
    });
    const json =
      gltfSourceRegistrationOrchestrationReportToJsonValue(registration);

    expect(json).toMatchObject({
      valid: false,
      sourceRegistration: null,
      meshRegistration: {
        valid: false,
        written: [],
        skipped: [
          {
            kind: "mesh",
            reason: "gltfMeshRegistration.duplicateAssetKey",
            registeredHandleKey: "mesh:gltf:mesh:0:primitive:0",
          },
        ],
        diagnostics: [
          {
            code: "gltfMeshRegistration.duplicateAssetKey",
            registeredHandleKey: "mesh:gltf:mesh:0:primitive:0",
          },
        ],
      },
      stages: [
        {
          stage: "materialTextureSamplerRegistration",
          status: "missing",
          writtenCount: 0,
          skippedCount: 0,
          diagnosticCount: 0,
        },
        {
          stage: "meshRegistration",
          status: "failed",
          writtenCount: 0,
          skippedCount: 1,
          diagnosticCount: 1,
        },
      ],
      diagnostics: [
        {
          code: "gltfSourceRegistration.failedStage",
          stage: "meshRegistration",
        },
      ],
    });
    expect(registry.get(duplicateMesh)?.asset).toBe(existingMesh);
    expect(JSON.stringify(json)).not.toContain("vertexStreams");
  });
});

function createMappingReport() {
  return createGltfAssetMappingReport({
    root: {
      asset: { version: "2.0" },
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
    resolveImageData: () => decodedImage,
  });
}

function constructionReport(): GltfMeshAssetConstructionReport {
  return {
    valid: true,
    meshes: [
      {
        handleKey: "gltf:mesh:0:primitive:0",
        registeredHandleKey: "mesh:gltf:mesh:0:primitive:0",
        meshIndex: 0,
        primitiveIndex: 0,
        mesh: meshAsset("mesh:gltf:mesh:0:primitive:0"),
      },
    ],
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
