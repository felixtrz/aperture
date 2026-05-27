import type { Entity } from "@aperture-engine/simulation";
import type { BoundsPacket, MeshDrawPacket } from "./snapshot.js";
import { pushMatrix } from "./extraction-matrices.js";
import { pushVec4 } from "./extraction-packing.js";

export interface RenderExtractionCache {
  readonly meshDrawEntities: Map<string, CachedMeshDrawEntity>;
  clear(): void;
}

type MeshDrawPacketTemplate = Omit<
  MeshDrawPacket,
  "worldTransformOffset" | "boundsIndex" | "instanceAttributePacketIndex"
>;

interface CachedMeshDrawEntity {
  readonly entityVersion: number;
  readonly cameraLayerMask: number;
  readonly viewCullSignature: number;
  readonly layerMask: number;
  readonly worldMatrix: readonly number[];
  readonly instanceTint: readonly number[] | null;
  readonly bounds: Omit<BoundsPacket, "boundsId">;
  readonly draws: readonly MeshDrawPacketTemplate[];
}

export function createRenderExtractionCache(): RenderExtractionCache {
  const meshDrawEntities = new Map<string, CachedMeshDrawEntity>();

  return {
    meshDrawEntities,
    clear() {
      meshDrawEntities.clear();
    },
  };
}

export function appendCachedMeshDrawEntity(
  cached: CachedMeshDrawEntity,
  transforms: number[],
  instanceTints: number[],
  bounds: BoundsPacket[],
  draws: MeshDrawPacket[],
): void {
  const worldTransformOffset = pushMatrix(transforms, cached.worldMatrix);
  const instanceTintOffset =
    cached.instanceTint === null
      ? undefined
      : pushVec4(instanceTints, cached.instanceTint);
  const boundsIndex = bounds.length;

  bounds.push({
    boundsId: boundsIndex,
    ...cached.bounds,
  });

  for (const draw of cached.draws) {
    draws.push({
      ...draw,
      worldTransformOffset,
      ...(instanceTintOffset === undefined ? {} : { instanceTintOffset }),
      boundsIndex,
    });
  }
}

export function createMeshDrawPacketTemplate(
  draw: MeshDrawPacket,
): MeshDrawPacketTemplate {
  return {
    renderId: draw.renderId,
    entity: draw.entity,
    mesh: draw.mesh,
    material: draw.material,
    submesh: draw.submesh,
    materialSlot: draw.materialSlot,
    ...(draw.vertexStart === undefined
      ? {}
      : { vertexStart: draw.vertexStart }),
    ...(draw.vertexCount === undefined
      ? {}
      : { vertexCount: draw.vertexCount }),
    ...(draw.indexStart === undefined ? {} : { indexStart: draw.indexStart }),
    ...(draw.indexCount === undefined ? {} : { indexCount: draw.indexCount }),
    layerMask: draw.layerMask,
    ...(draw.instanceTintOffset === undefined
      ? {}
      : { instanceTintOffset: draw.instanceTintOffset }),
    ...(draw.castsShadow === undefined
      ? {}
      : { castsShadow: draw.castsShadow }),
    ...(draw.receivesShadow === undefined
      ? {}
      : { receivesShadow: draw.receivesShadow }),
    ...(draw.occlusionQuery === undefined
      ? {}
      : { occlusionQuery: draw.occlusionQuery }),
    sortKey: draw.sortKey,
    batchKey: draw.batchKey,
  };
}

export function entityCacheKey(entity: Entity): string {
  return `${entity.index}:${entity.generation}`;
}
