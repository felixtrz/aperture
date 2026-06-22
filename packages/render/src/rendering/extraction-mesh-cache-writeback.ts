import type { Entity } from "@aperture-engine/simulation";
import { InstanceData, Skin } from "./index.js";
import type { MeshDrawMorphInputs } from "./extraction-mesh-draw-inputs.js";
import type { BoundsPacket, MeshDrawPacket } from "./snapshot.js";
import {
  createMeshDrawPacketTemplate,
  meshDrawEntityCacheForScope,
  type RenderExtractionCache,
  type MeshDrawEntityCacheScope,
} from "./extraction-mesh-cache.js";

export interface WriteMeshDrawEntityCacheInput {
  readonly cache: RenderExtractionCache | undefined;
  readonly cacheScope?: MeshDrawEntityCacheScope;
  readonly cacheKey: string;
  readonly entity: Entity;
  readonly entityVersion: number;
  readonly transformVersion: number;
  readonly assetSignature: string | null;
  readonly cameraLayerMask: number;
  readonly viewCullSignature: number;
  readonly layerMask: number;
  readonly worldMatrix: readonly number[];
  readonly entityDraws: readonly MeshDrawPacket[];
  readonly diagnosticsStart: number;
  readonly diagnosticsCount: number;
  readonly bounds: readonly BoundsPacket[];
  readonly boundsIndex: number;
  readonly instanceTints: readonly number[];
  readonly instanceTintOffset: number | undefined;
  readonly morph: MeshDrawMorphInputs | undefined;
}

export function writeMeshDrawEntityCache(
  input: WriteMeshDrawEntityCacheInput,
): void {
  if (
    input.cache === undefined ||
    input.assetSignature === null ||
    input.entityDraws.length === 0 ||
    input.diagnosticsCount !== input.diagnosticsStart ||
    input.entity.hasComponent(InstanceData) ||
    input.entity.hasComponent(Skin) ||
    input.morph !== undefined
  ) {
    return;
  }

  const sourceBounds = input.bounds[input.boundsIndex];

  if (sourceBounds === undefined) {
    return;
  }

  meshDrawEntityCacheForScope(input.cache, input.cacheScope ?? "mesh").set(
    input.cacheKey,
    {
      entityVersion: input.entityVersion,
      transformVersion: input.transformVersion,
      assetSignature: input.assetSignature,
      cameraLayerMask: input.cameraLayerMask,
      viewCullSignature: input.viewCullSignature,
      layerMask: input.layerMask,
      worldMatrix: Array.from(input.worldMatrix),
      instanceTint:
        input.instanceTintOffset === undefined
          ? null
          : input.instanceTints.slice(
              input.instanceTintOffset,
              input.instanceTintOffset + 4,
            ),
      bounds: {
        entity: sourceBounds.entity,
        localAabb: sourceBounds.localAabb,
        worldAabb: sourceBounds.worldAabb,
        localSphere: sourceBounds.localSphere,
        worldSphere: sourceBounds.worldSphere,
      },
      draws: input.entityDraws.map(createMeshDrawPacketTemplate),
    },
  );
}
