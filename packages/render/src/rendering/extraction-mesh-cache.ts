import {
  maxScaleOnAxis,
  transformAabb,
  transformPoint,
  type Entity,
  type Mat4,
} from "@aperture-engine/simulation";
import type { BoundsPacket, MeshDrawPacket } from "./snapshot.js";
import { pushMatrix } from "./extraction-matrices.js";
import { pushVec4 } from "./extraction-packing.js";

export interface RenderExtractionCache {
  readonly meshDrawEntities: Map<string, CachedMeshDrawEntity>;
  /**
   * Persistent numeric accumulators reused across frames (AI-30): reset to
   * length 0 at the start of each extraction and copied into fresh per-frame
   * typed arrays before the snapshot is returned, so reuse can never alias a
   * previously returned snapshot.
   */
  readonly scratch: RenderExtractionScratch;
  clear(): void;
}

export interface RenderExtractionScratch {
  readonly transforms: number[];
  readonly bones: number[];
  readonly morphTargetWeights: number[];
  readonly morphTargetDeltas: number[];
  readonly morphInstanceDescriptors: number[];
  readonly instanceTints: number[];
  readonly instanceAttributes: number[];
  readonly quadInstanceFloats: number[];
  readonly quadInstanceWords: number[];
  readonly viewMatrices: number[];
}

type MeshDrawPacketTemplate = Omit<
  MeshDrawPacket,
  "worldTransformOffset" | "boundsIndex" | "instanceAttributePacketIndex"
>;

interface CachedMeshDrawEntity {
  readonly entityVersion: number;
  readonly transformVersion: number;
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
    scratch: {
      transforms: [],
      bones: [],
      morphTargetWeights: [],
      morphTargetDeltas: [],
      morphInstanceDescriptors: [],
      instanceTints: [],
      instanceAttributes: [],
      quadInstanceFloats: [],
      quadInstanceWords: [],
      viewMatrices: [],
    },
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

/**
 * Transform-only fast path (AI-67): rebuild a cached entry's world matrix and
 * derived bounds from the entity's current transform without touching the
 * packet templates. Yields bounds byte-identical to a cold createBoundsPacket
 * run (same transformAabb/transformPoint/maxScaleOnAxis math), so the fast
 * path cannot perturb deterministic snapshots.
 */
export function refreshCachedMeshDrawEntityTransform(
  cached: CachedMeshDrawEntity,
  worldMatrix: Mat4,
  transformVersion: number,
): CachedMeshDrawEntity {
  const center = transformPoint(worldMatrix, cached.bounds.localSphere.center);

  return {
    ...cached,
    transformVersion,
    worldMatrix: Array.from(worldMatrix),
    bounds: {
      ...cached.bounds,
      worldAabb: transformAabb(cached.bounds.localAabb, worldMatrix),
      worldSphere: {
        center,
        radius: cached.bounds.localSphere.radius * maxScaleOnAxis(worldMatrix),
      },
    },
  };
}

export function entityCacheKey(entity: Entity): string {
  return `${entity.index}:${entity.generation}`;
}
