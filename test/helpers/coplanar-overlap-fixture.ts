import {
  AssetRegistry,
  createMaterialHandle,
  createMeshHandle,
} from "@aperture-engine/simulation";
import {
  createBatchCompatibilityKey,
  createMaterialPipelineKeyInput,
  createRenderSortKey,
  createUnlitMaterialAsset,
  type MeshAsset,
  type MeshDrawPacket,
  type RenderSnapshot,
  type CoplanarOverlapInput,
} from "@aperture-engine/render";

export type Position = readonly [number, number, number];
export const identityMatrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
export function rectangle(
  x0 = 0,
  y0 = 0,
  x1 = 2,
  y1 = 2,
  alternate = false,
): Position[] {
  const a: Position = [x0, y0, 0],
    b: Position = [x1, y0, 0],
    c: Position = [x1, y1, 0],
    d: Position = [x0, y1, 0];
  return alternate ? [a, b, d, b, c, d] : [a, b, c, a, c, d];
}
export function inspectionMesh(
  positions: readonly Position[],
  indices?: readonly number[],
): MeshAsset {
  return {
    kind: "mesh",
    label: "synthetic",
    vertexStreams: [
      {
        id: "positions",
        arrayStride: 12,
        vertexCount: positions.length,
        attributes: [{ semantic: "POSITION", format: "float32x3", offset: 0 }],
        data: new Float32Array(positions.flat()),
      },
    ],
    ...(indices
      ? {
          indexBuffer: {
            format: "uint16" as const,
            data: new Uint16Array(indices),
          },
        }
      : {}),
    submeshes: [
      {
        label: "surface",
        topology: "triangle-list",
        materialSlot: 0,
        vertexStart: 0,
        vertexCount: positions.length,
        indexStart: 0,
        indexCount: indices?.length ?? 0,
      },
    ],
    materialSlots: [{ index: 0, label: "plain" }],
    localAabb: { min: [-10, -10, -10], max: [10, 10, 10] },
    localSphere: { center: [0, 0, 0], radius: 20 },
  };
}
export function coplanarFixture(
  meshes: readonly MeshAsset[] = [
    inspectionMesh(rectangle()),
    inspectionMesh(rectangle(1, 0.5, 3, 1.5, true)),
  ],
  matrices: readonly (readonly number[])[] = meshes.map(() => identityMatrix),
): { input: CoplanarOverlapInput; registry: AssetRegistry } {
  const registry = new AssetRegistry(),
    material = createUnlitMaterialAsset(),
    materialHandle = createMaterialHandle("plain");
  registry.register(materialHandle);
  registry.markReady(materialHandle, material);
  const draws = meshes.map((mesh, index): MeshDrawPacket => {
    const handle = createMeshHandle(`mesh.${index}`);
    registry.register(handle);
    registry.markReady(handle, mesh);
    return {
      renderId: index,
      entity: { index, generation: 0 },
      mesh: handle,
      material: materialHandle,
      submesh: 0,
      materialSlot: 0,
      worldTransformOffset: index * 16,
      boundsIndex: index,
      layerMask: 1,
      sortKey: createRenderSortKey({ stableId: index }),
      batchKey: createBatchCompatibilityKey({
        materialPipeline: createMaterialPipelineKeyInput(material),
        materialKey: "plain",
        meshLayoutKey: "POSITION",
        topology: "triangle-list",
      }),
    };
  });
  const snapshot: RenderSnapshot = {
    frame: 7,
    views: [],
    meshDraws: draws,
    transforms: new Float32Array(matrices.flat()),
    viewMatrices: new Float32Array(),
    lights: [],
    environments: [],
    shadowRequests: [],
    bounds: [],
    diagnostics: [],
    report: {
      views: 0,
      meshDraws: draws.length,
      lights: 0,
      environments: 0,
      shadowRequests: 0,
      bounds: 0,
      diagnostics: 0,
    },
  };
  return {
    registry,
    input: {
      snapshot,
      scope: { meshIds: draws.map((d) => d.mesh.id) },
      resolveMesh: (handle) =>
        registry.get<"mesh", MeshAsset>(handle)?.asset ?? undefined,
      resolveMaterial: () => material,
    },
  };
}
