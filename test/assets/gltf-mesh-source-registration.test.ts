import { describe, expect, it } from "vitest";

import {
  AssetRegistry,
  createMeshHandle,
  gltfMeshSourceAssetRegistrationReportToJsonValue,
  registerGltfMeshSourceAssetsFromConstructionReport,
  type GltfMeshAssetConstructionReport,
  type MeshAsset,
} from "@aperture-engine/core";

describe("glTF mesh source asset registration", () => {
  it("registers successful constructed mesh source assets", () => {
    const registry = new AssetRegistry();
    const report = constructionReport();
    const registration = registerGltfMeshSourceAssetsFromConstructionReport({
      registry,
      report,
    });
    const handle = createMeshHandle("gltf:mesh:0:primitive:0");

    expect(registration.valid).toBe(true);
    expect(registration.skipped).toEqual([]);
    expect(registration.written).toMatchObject([
      {
        kind: "mesh",
        plannedHandleKey: "gltf:mesh:0:primitive:0",
        registeredHandleKey: "mesh:gltf:mesh:0:primitive:0",
        meshIndex: 0,
        primitiveIndex: 0,
      },
    ]);
    expect(registry.getStatus(handle)).toBe("ready");
    expect(registry.get(handle)?.asset).toBe(report.meshes[0]?.mesh);
    expect(registry.get(handle)?.label).toBe("mesh:gltf:mesh:0:primitive:0");
  });

  it("skips duplicate mesh keys without overwriting existing assets", () => {
    const registry = new AssetRegistry();
    const handle = createMeshHandle("gltf:mesh:0:primitive:0");
    const existingMesh = meshAsset("existing mesh");

    registry.register(handle);
    registry.markReady(handle, existingMesh);

    const registration = registerGltfMeshSourceAssetsFromConstructionReport({
      registry,
      report: constructionReport(),
    });

    expect(registration.valid).toBe(false);
    expect(registration.written).toEqual([]);
    expect(registration.skipped).toMatchObject([
      {
        kind: "mesh",
        reason: "gltfMeshRegistration.duplicateAssetKey",
        plannedHandleKey: "gltf:mesh:0:primitive:0",
        registeredHandleKey: "mesh:gltf:mesh:0:primitive:0",
        meshIndex: 0,
        primitiveIndex: 0,
      },
    ]);
    expect(registry.get(handle)?.asset).toBe(existingMesh);
  });

  it("skips null planned mesh entries without mutating the registry", () => {
    const registry = new AssetRegistry();
    const registration = registerGltfMeshSourceAssetsFromConstructionReport({
      registry,
      report: {
        valid: false,
        meshes: [
          {
            handleKey: "gltf:mesh:0:primitive:0",
            registeredHandleKey: "mesh:gltf:mesh:0:primitive:0",
            meshIndex: 0,
            primitiveIndex: 0,
            mesh: null,
          },
        ],
        diagnostics: [
          {
            code: "gltfMeshAsset.invalidIndexValue",
            severity: "error",
            message: "Index is outside the vertex range.",
            meshHandleKey: "mesh:gltf:mesh:0:primitive:0",
            meshIndex: 0,
            primitiveIndex: 0,
          },
        ],
      },
    });

    expect(registration.valid).toBe(false);
    expect(registration.written).toEqual([]);
    expect(registration.skipped).toMatchObject([
      {
        kind: "mesh",
        reason: "gltfMeshRegistration.invalidPlannedAsset",
        registeredHandleKey: "mesh:gltf:mesh:0:primitive:0",
      },
    ]);
    expect(registry.list()).toEqual([]);
  });

  it("normalizes prefixed planned mesh keys without double-prefixing", () => {
    const registry = new AssetRegistry();
    const registration = registerGltfMeshSourceAssetsFromConstructionReport({
      registry,
      report: constructionReport({
        handleKey: "mesh:gltf:mesh:0:primitive:0",
        registeredHandleKey: "mesh:gltf:mesh:0:primitive:0",
      }),
    });
    const handle = createMeshHandle("gltf:mesh:0:primitive:0");

    expect(registration.valid).toBe(true);
    expect(registration.written[0]).toMatchObject({
      plannedHandleKey: "mesh:gltf:mesh:0:primitive:0",
      registeredHandleKey: "mesh:gltf:mesh:0:primitive:0",
    });
    expect(registry.getStatus(handle)).toBe("ready");
    expect(JSON.stringify(registration)).not.toContain("mesh:mesh:");
  });

  it("serializes reports without embedding mesh buffer contents", () => {
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
        },
      ],
      skipped: [],
      diagnostics: [],
    });
    expect(JSON.stringify(json)).not.toContain("vertexStreams");
    expect(JSON.stringify(json)).not.toContain("Float32Array");
  });
});

function constructionReport(
  overrides: Partial<{
    readonly handleKey: string;
    readonly registeredHandleKey: string;
    readonly mesh: MeshAsset | null;
  }> = {},
): GltfMeshAssetConstructionReport {
  const registeredHandleKey =
    overrides.registeredHandleKey ?? "mesh:gltf:mesh:0:primitive:0";

  return {
    valid: true,
    meshes: [
      {
        handleKey: overrides.handleKey ?? "gltf:mesh:0:primitive:0",
        registeredHandleKey,
        meshIndex: 0,
        primitiveIndex: 0,
        mesh: overrides.mesh ?? meshAsset(registeredHandleKey),
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
