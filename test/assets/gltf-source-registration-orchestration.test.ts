import { describe, expect, it } from "vitest";

import {
  AssetRegistry,
  createGltfAssetMappingReport,
  createMaterialHandle,
  createMeshHandle,
  createSamplerHandle,
  createTextureHandle,
  GLTF_SAMPLER_FILTER,
  GLTF_SAMPLER_WRAP,
  registerGltfSourceAssetsFromReports,
  type GltfMeshAssetConstructionReport,
  type MeshAsset,
} from "@aperture-engine/core";

const decodedImage = {
  width: 2,
  height: 2,
  sourceData: {
    bytes: new Uint8Array(16),
    bytesPerRow: 8,
  },
};

describe("glTF source registration orchestration", () => {
  it("registers material, texture, sampler, and mesh source reports together", () => {
    const registry = new AssetRegistry();
    const assetMapping = createValidMappingReport();
    const meshConstruction = constructionReport();
    const registration = registerGltfSourceAssetsFromReports({
      registry,
      assetMapping,
      meshConstruction,
    });

    expect(registration.valid).toBe(true);
    expect(registration.diagnostics).toEqual([]);
    expect(registration.sourceRegistration?.written).toHaveLength(3);
    expect(registration.meshRegistration?.written).toHaveLength(1);
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

    expect(
      registry.getStatus(
        createTextureHandle("gltf:texture:0:baseColorTexture"),
      ),
    ).toBe("ready");
    expect(
      registry.getStatus(
        createSamplerHandle("gltf:sampler:0:baseColorTexture"),
      ),
    ).toBe("ready");
    expect(registry.getStatus(createMaterialHandle("gltf:material:0"))).toBe(
      "ready",
    );
    expect(
      registry.getStatus(createMeshHandle("gltf:mesh:0:primitive:0")),
    ).toBe("ready");
  });

  it("allows partial orchestration when only mesh construction is provided", () => {
    const registry = new AssetRegistry();
    const registration = registerGltfSourceAssetsFromReports({
      registry,
      meshConstruction: constructionReport(),
    });

    expect(registration.valid).toBe(true);
    expect(registration.sourceRegistration).toBeNull();
    expect(registration.meshRegistration?.written).toHaveLength(1);
    expect(registration.stages).toEqual([
      {
        stage: "materialTextureSamplerRegistration",
        status: "missing",
        writtenCount: 0,
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
    expect(registry.list({ kind: "mesh", status: "ready" })).toHaveLength(1);
  });

  it("reports missing input without mutating the registry", () => {
    const registry = new AssetRegistry();
    const registration = registerGltfSourceAssetsFromReports({ registry });

    expect(registration.valid).toBe(false);
    expect(registration.sourceRegistration).toBeNull();
    expect(registration.meshRegistration).toBeNull();
    expect(registration.diagnostics).toEqual([
      {
        code: "gltfSourceRegistration.missingInput",
        severity: "error",
        message:
          "GLB source registration requires an asset mapping report or a mesh construction report.",
      },
    ]);
    expect(registry.list()).toEqual([]);
  });

  it("propagates failed nested registration stages", () => {
    const registry = new AssetRegistry();
    const duplicateTexture = createTextureHandle(
      "gltf:texture:0:baseColorTexture",
    );

    registry.register(duplicateTexture);
    registry.markReady(duplicateTexture, { preexisting: true });

    const registration = registerGltfSourceAssetsFromReports({
      registry,
      assetMapping: createValidMappingReport(),
      meshConstruction: constructionReport({
        mesh: null,
      }),
    });

    expect(registration.valid).toBe(false);
    expect(registration.stages).toEqual([
      {
        stage: "materialTextureSamplerRegistration",
        status: "failed",
        writtenCount: 2,
        skippedCount: 1,
        diagnosticCount: 1,
      },
      {
        stage: "meshRegistration",
        status: "failed",
        writtenCount: 0,
        skippedCount: 1,
        diagnosticCount: 1,
      },
    ]);
    expect(registration.diagnostics).toEqual([
      {
        code: "gltfSourceRegistration.failedStage",
        severity: "error",
        stage: "materialTextureSamplerRegistration",
        message:
          "GLB source registration stage 'materialTextureSamplerRegistration' failed.",
      },
      {
        code: "gltfSourceRegistration.failedStage",
        severity: "error",
        stage: "meshRegistration",
        message: "GLB source registration stage 'meshRegistration' failed.",
      },
    ]);
    expect(registry.get(duplicateTexture)?.asset).toEqual({
      preexisting: true,
    });
  });
});

function createValidMappingReport() {
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

function constructionReport(
  overrides: Partial<{
    readonly mesh: MeshAsset | null;
  }> = {},
): GltfMeshAssetConstructionReport {
  return {
    valid: overrides.mesh !== null,
    meshes: [
      {
        handleKey: "gltf:mesh:0:primitive:0",
        registeredHandleKey: "mesh:gltf:mesh:0:primitive:0",
        meshIndex: 0,
        primitiveIndex: 0,
        mesh:
          overrides.mesh === undefined
            ? meshAsset("mesh:gltf:mesh:0:primitive:0")
            : overrides.mesh,
      },
    ],
    diagnostics:
      overrides.mesh === null
        ? [
            {
              code: "gltfMeshAsset.missingPosition",
              severity: "error",
              message:
                "Primitive 'mesh:gltf:mesh:0:primitive:0' cannot construct a MeshAsset without decoded POSITION data.",
              meshHandleKey: "mesh:gltf:mesh:0:primitive:0",
              meshIndex: 0,
              primitiveIndex: 0,
            },
          ]
        : [],
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
