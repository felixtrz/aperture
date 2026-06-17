import { describe, expect, it } from "vitest";
import { createAssetBackedPhysicsColliderGeometryProvider } from "@aperture-engine/app";
import {
  type PhysicsColliderGeometryResult,
  type PhysicsHeightfieldGeometry,
  type PhysicsTriangleMeshGeometry,
} from "@aperture-engine/physics";
import { createPlaneMeshAsset, type MeshAsset } from "@aperture-engine/render";
import { AssetRegistry, createMeshHandle } from "@aperture-engine/simulation";

describe("asset-backed physics collider geometry provider", () => {
  it("adapts ready render mesh assets into packed physics triangle geometry", () => {
    const registry = new AssetRegistry();
    const mesh = createMeshHandle("terrain");

    registry.register(mesh);
    registry.markReady(mesh, createPlaneMeshAsset({ width: 2, height: 4 }));

    const provider = createAssetBackedPhysicsColliderGeometryProvider({
      assets: registry,
    });
    const first = unwrapTriangleMesh(provider.triangleMesh("mesh:terrain"));

    expect(first.key).toBe("mesh:terrain");
    expect(first.sourceVersion).toBe(1);
    expect(first.triangleCount).toBe(2);
    expect(first.vertexCount).toBe(6);
    expect(Array.from(first.indices)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(Math.max(...Array.from(first.positions))).toBeCloseTo(2);

    registry.markReady(mesh, createPlaneMeshAsset({ width: 6, height: 8 }));

    const second = unwrapTriangleMesh(provider.triangleMesh("terrain"));

    expect(second.sourceVersion).toBe(2);
    expect(Math.max(...Array.from(second.positions))).toBeCloseTo(4);
  });

  it("adapts byte-backed source vertex streams into numeric triangle geometry", () => {
    const registry = new AssetRegistry();
    const mesh = createMeshHandle("byte-backed");

    registry.register(mesh);
    registry.markReady(mesh, byteBackedTriangleMesh());

    const provider = createAssetBackedPhysicsColliderGeometryProvider({
      assets: registry,
    });
    const geometry = unwrapTriangleMesh(provider.triangleMesh("byte-backed"));

    expect(geometry.triangleCount).toBe(1);
    expect(Array.from(geometry.positions)).toEqual([0, 0, 0, 2, 0, 0, 0, 3, 0]);
  });

  it("reports missing, loading, and invalid mesh assets as structured diagnostics", () => {
    const registry = new AssetRegistry();
    const loading = createMeshHandle("loading");
    const invalid = createMeshHandle("invalid");

    registry.register(loading);
    registry.markLoading(loading);
    registry.register(invalid);
    registry.markReady(invalid, invalidTopologyMesh());

    const provider = createAssetBackedPhysicsColliderGeometryProvider({
      assets: registry,
    });
    const missing = provider.triangleMesh("mesh:missing");
    const notReady = provider.triangleMesh("mesh:loading");
    const badMesh = provider.triangleMesh("mesh:invalid");

    expect(missing).toMatchObject({
      ok: false,
      error: {
        code: "physics.collider.asset.missing",
        feature: "collider.triangleMesh",
        details: { assetId: "mesh:missing" },
      },
    });
    expect(notReady).toMatchObject({
      ok: false,
      error: {
        code: "physics.collider.asset.notReady",
        feature: "collider.triangleMesh",
        details: { assetId: "mesh:loading", status: "loading", version: 1 },
      },
    });
    expect(badMesh).toMatchObject({
      ok: false,
      error: {
        code: "physics.collider.asset.invalid",
        feature: "collider.triangleMesh",
        details: {
          assetId: "mesh:invalid",
          diagnostics: [
            {
              code: "spatial.mesh.unsupported-topology",
              severity: "error",
            },
          ],
        },
      },
    });
  });

  it("returns validated heightfield geometry from maps and records", () => {
    const registry = new AssetRegistry();
    const validHeightfield = flatHeightfield("terrain:flat");
    const invalidHeightfield: PhysicsHeightfieldGeometry = {
      ...validHeightfield,
      key: "terrain:bad",
      heights: new Float32Array([0, 0, 0]),
    };
    const mapProvider = createAssetBackedPhysicsColliderGeometryProvider({
      assets: registry,
      heightfields: new Map([["terrain:flat", validHeightfield]]),
    });
    const recordProvider = createAssetBackedPhysicsColliderGeometryProvider({
      assets: registry,
      heightfields: {
        "terrain:bad": invalidHeightfield,
      },
    });

    expect(mapProvider.heightfield("terrain:flat")).toMatchObject({
      ok: true,
      geometry: { key: "terrain:flat", rows: 2, columns: 2 },
    });
    expect(mapProvider.heightfield("terrain:missing")).toMatchObject({
      ok: false,
      error: {
        code: "physics.collider.asset.missing",
        feature: "collider.heightfield",
        details: { assetId: "terrain:missing" },
      },
    });
    expect(recordProvider.heightfield("terrain:bad")).toMatchObject({
      ok: false,
      error: {
        code: "physics.collider.asset.invalid",
        feature: "collider.heightfield",
        details: {
          key: "terrain:bad",
          rows: 2,
          columns: 2,
          heightCount: 3,
        },
      },
    });
  });
});

function unwrapTriangleMesh(
  result: PhysicsColliderGeometryResult<PhysicsTriangleMeshGeometry>,
): PhysicsTriangleMeshGeometry {
  if (!result.ok) {
    throw new Error(result.error.message);
  }

  return result.geometry;
}

function invalidTopologyMesh(): MeshAsset {
  const mesh = createPlaneMeshAsset({ label: "Invalid Physics Mesh" });

  return {
    ...mesh,
    submeshes: mesh.submeshes.map((submesh) => ({
      ...submesh,
      topology: "line-list",
    })),
  };
}

function byteBackedTriangleMesh(): MeshAsset {
  const source = new Float32Array([0, 0, 0, 2, 0, 0, 0, 3, 0]);

  return {
    kind: "mesh",
    label: "Byte-backed Triangle",
    vertexStreams: [
      {
        id: "source-buffer-view",
        arrayStride: 12,
        vertexCount: 3,
        attributes: [
          {
            semantic: "POSITION",
            format: "float32x3",
            offset: 0,
          },
        ],
        data: new Uint8Array(source.buffer),
      },
    ],
    indexBuffer: {
      format: "uint16",
      data: new Uint16Array([0, 1, 2]),
    },
    submeshes: [
      {
        label: "triangle",
        topology: "triangle-list",
        materialSlot: 0,
        vertexStart: 0,
        vertexCount: 3,
        indexStart: 0,
        indexCount: 3,
      },
    ],
    materialSlots: [{ index: 0, label: "default" }],
  };
}

function flatHeightfield(key: string): PhysicsHeightfieldGeometry {
  return {
    key,
    rows: 2,
    columns: 2,
    heights: new Float32Array([0, 0, 0, 0]),
    scale: [4, 1, 4],
  };
}
