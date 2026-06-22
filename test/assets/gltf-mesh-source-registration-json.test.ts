import { describe, expect, it } from "vitest";
import { AssetRegistry, createMeshHandle } from "@aperture-engine/simulation";
import {
  gltfMeshSourceAssetRegistrationReportToJson,
  gltfMeshSourceAssetRegistrationReportToJsonValue,
  registerGltfMeshSourceAssetsFromConstructionReport,
  type GltfMeshAssetConstructionReport,
  type MeshAsset,
} from "@aperture-engine/render";

describe("glTF mesh source asset registration report JSON", () => {
  it("serializes written mesh handle keys without embedding mesh assets", () => {
    const registration = registerGltfMeshSourceAssetsFromConstructionReport({
      registry: new AssetRegistry(),
      report: constructionReport(),
    });
    const json = gltfMeshSourceAssetRegistrationReportToJsonValue(registration);

    expect(json).toMatchObject({
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
    });
    expect(JSON.stringify(json)).not.toContain("vertexStreams");
    expect(JSON.stringify(json)).not.toContain("Float32Array");
    expect(
      JSON.parse(gltfMeshSourceAssetRegistrationReportToJson(registration)),
    ).toEqual(json);
  });

  it("serializes skipped duplicate entries and diagnostics", () => {
    const registry = new AssetRegistry();
    const duplicate = createMeshHandle("gltf:mesh:0:primitive:0");

    registry.register(duplicate);
    registry.markReady(duplicate, meshAsset("preexisting mesh"));

    const registration = registerGltfMeshSourceAssetsFromConstructionReport({
      registry,
      report: constructionReport(),
    });
    const json = gltfMeshSourceAssetRegistrationReportToJsonValue(registration);

    expect(json).toMatchObject({
      valid: false,
      written: [],
      skipped: [
        {
          kind: "mesh",
          plannedHandleKey: "gltf:mesh:0:primitive:0",
          registeredHandleKey: "mesh:gltf:mesh:0:primitive:0",
          meshIndex: 0,
          primitiveIndex: 0,
          reason: "gltfMeshRegistration.duplicateAssetKey",
          diagnostics: [
            {
              code: "gltfMeshRegistration.duplicateAssetKey",
              registeredHandleKey: "mesh:gltf:mesh:0:primitive:0",
              meshIndex: 0,
              primitiveIndex: 0,
            },
          ],
        },
      ],
      diagnostics: [
        {
          code: "gltfMeshRegistration.duplicateAssetKey",
          registeredHandleKey: "mesh:gltf:mesh:0:primitive:0",
          meshIndex: 0,
          primitiveIndex: 0,
        },
      ],
    });
    expect(
      JSON.parse(gltfMeshSourceAssetRegistrationReportToJson(registration)),
    ).toEqual(json);
  });

  it("serializes invalid planned mesh entries without raw buffers", () => {
    const registration = registerGltfMeshSourceAssetsFromConstructionReport({
      registry: new AssetRegistry(),
      report: {
        valid: false,
        meshes: [
          {
            handleKey: "gltf:mesh:1:primitive:2",
            registeredHandleKey: "mesh:gltf:mesh:1:primitive:2",
            meshIndex: 1,
            primitiveIndex: 2,
            mesh: null,
          },
        ],
        diagnostics: [
          {
            code: "gltfMeshAsset.missingPosition",
            severity: "error",
            message: "Missing POSITION data.",
            meshIndex: 1,
            primitiveIndex: 2,
          },
        ],
      },
    });
    const json = gltfMeshSourceAssetRegistrationReportToJsonValue(registration);

    expect(json).toMatchObject({
      valid: false,
      written: [],
      skipped: [
        {
          kind: "mesh",
          plannedHandleKey: "gltf:mesh:1:primitive:2",
          registeredHandleKey: "mesh:gltf:mesh:1:primitive:2",
          meshIndex: 1,
          primitiveIndex: 2,
          reason: "gltfMeshRegistration.invalidPlannedAsset",
        },
      ],
      diagnostics: [
        {
          code: "gltfMeshRegistration.invalidPlannedAsset",
          meshIndex: 1,
          primitiveIndex: 2,
        },
      ],
    });
    expect(JSON.stringify(json)).not.toContain("vertexStreams");
    expect(JSON.stringify(json)).not.toContain("data");
  });
});

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
