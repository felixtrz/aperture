import { type AssetRegistry, type EcsWorld } from "@aperture-engine/simulation";
import { validateMeshAsset } from "../mesh/index.js";
import { InstanceData, Material, Mesh, OcclusionQuery, Skin } from "./index.js";
import {
  type BoundsPacket,
  type FogPacket,
  type InstanceAttributePacket,
  type MeshDrawPacket,
  type RenderDiagnostic,
} from "./snapshot.js";
import {
  computeViewDepth,
  firstMatchingSortView,
  isVisibleInAnyMatchingView,
  type ViewCullContext,
} from "./extraction-culling.js";
import { diagnostic } from "./extraction-diagnostics.js";
import { sortedEntities } from "./extraction-entities.js";
import { readMeshEntityExtractionState } from "./extraction-mesh-entity-state.js";
import {
  pushInstanceAttributePacket,
  pushInstanceTint,
} from "./extraction-mesh-instances.js";
import { readMaterialSlots } from "./extraction-mesh-materials.js";
import {
  appendCachedMeshDrawEntity,
  createMeshDrawPacketTemplate,
  entityCacheKey,
  type RenderExtractionCache,
} from "./extraction-mesh-cache.js";
import { createBoundsPacket } from "./extraction-mesh-bounds.js";
import {
  pushBoneMatrices,
  pushMorphTargetWeights,
  readMorphTargetWeights,
  readSkinning,
} from "./extraction-mesh-deformation.js";
import { createMeshSubmeshDraws } from "./extraction-mesh-submeshes.js";
import { pushMatrix } from "./extraction-matrices.js";

export {
  createRenderExtractionCache,
  type RenderExtractionCache,
} from "./extraction-mesh-cache.js";

export function extractMeshDraws(
  world: EcsWorld,
  assets: AssetRegistry,
  transforms: number[],
  bones: number[],
  morphTargetWeights: number[],
  instanceTints: number[],
  instanceAttributes: number[],
  instanceAttributePackets: InstanceAttributePacket[],
  bounds: BoundsPacket[],
  diagnostics: RenderDiagnostic[],
  cameraLayerMask: number,
  fogs: readonly FogPacket[],
  viewCullContexts: readonly ViewCullContext[],
  viewCullSignature: number,
  cache: RenderExtractionCache | undefined,
): MeshDrawPacket[] {
  const query = world.queryManager.registerQuery({
    required: [Mesh, Material],
  });
  const draws: MeshDrawPacket[] = [];

  for (const entity of sortedEntities(query.entities)) {
    const cacheKey = entityCacheKey(entity);
    const entityVersion = world.entityVersion(entity);
    const cached = cache?.meshDrawEntities.get(cacheKey);

    if (
      cached !== undefined &&
      cached.entityVersion === entityVersion &&
      cached.cameraLayerMask === cameraLayerMask &&
      cached.viewCullSignature === viewCullSignature
    ) {
      if (
        !isVisibleInAnyMatchingView(
          cached.bounds.worldAabb,
          cached.layerMask,
          viewCullContexts,
        )
      ) {
        continue;
      }

      appendCachedMeshDrawEntity(
        cached,
        transforms,
        instanceTints,
        bounds,
        draws,
      );
      continue;
    }

    cache?.meshDrawEntities.delete(cacheKey);

    const entityState = readMeshEntityExtractionState({
      entity,
      assets,
      diagnostics,
      cameraLayerMask,
    });

    if (entityState === null) {
      continue;
    }

    const boundsPacket = createBoundsPacket(
      bounds.length,
      entity,
      entityState.mesh,
      entityState.worldMatrix,
    );

    if (
      !isVisibleInAnyMatchingView(
        boundsPacket.worldAabb,
        entityState.layerMask,
        viewCullContexts,
      )
    ) {
      continue;
    }

    const meshValidation = validateMeshAsset(entityState.mesh);

    if (!meshValidation.valid) {
      for (const meshDiagnostic of meshValidation.diagnostics) {
        diagnostics.push(
          diagnostic(
            `render.${meshDiagnostic.code}`,
            entity,
            entityState.meshHandle,
          ),
        );
      }
      continue;
    }

    const worldTransformOffset = pushMatrix(
      transforms,
      entityState.worldMatrix,
    );
    const instanceTintOffset = pushInstanceTint(instanceTints, entity);
    const instanceAttributePacketIndex = pushInstanceAttributePacket(
      instanceAttributes,
      instanceAttributePackets,
      diagnostics,
      entity,
    );
    const skinning = readSkinning(entity, entityState.mesh, diagnostics);

    if (skinning === null) {
      continue;
    }

    const morphWeights = readMorphTargetWeights(
      entity,
      entityState.mesh,
      diagnostics,
    );

    if (morphWeights === null) {
      continue;
    }

    if (morphWeights !== undefined) {
      pushMorphTargetWeights(
        morphTargetWeights,
        worldTransformOffset,
        morphWeights,
      );
    }

    const boneMatrixOffset =
      skinning === undefined ? undefined : pushBoneMatrices(bones, skinning);
    const occlusionQuery =
      entity.hasComponent(OcclusionQuery) &&
      entity.getValue(OcclusionQuery, "enabled") !== false;
    const boundsIndex = bounds.length;
    const sortView = firstMatchingSortView(
      entityState.layerMask,
      viewCullContexts,
    );
    const sortViewId = sortView?.viewId ?? 0;
    const sortDepth =
      sortView === undefined
        ? 0
        : computeViewDepth(
            sortView.viewMatrix,
            boundsPacket.worldSphere.center,
          );

    bounds.push(boundsPacket);

    const entityDiagnosticsStart = diagnostics.length;
    const entityDraws: MeshDrawPacket[] = [];

    const materialSlots = readMaterialSlots(entity, diagnostics);
    entityDraws.push(
      ...createMeshSubmeshDraws({
        assets,
        entity,
        mesh: entityState.mesh,
        meshHandle: entityState.meshHandle,
        primaryMaterialHandle: entityState.primaryMaterialHandle,
        materialSlots,
        diagnostics,
        worldTransformOffset,
        ...(instanceTintOffset === undefined ? {} : { instanceTintOffset }),
        ...(instanceAttributePacketIndex === undefined
          ? {}
          : { instanceAttributePacketIndex }),
        ...(boneMatrixOffset === undefined ? {} : { boneMatrixOffset }),
        ...(skinning === undefined ? {} : { skinning }),
        ...(morphWeights === undefined ? {} : { morphWeights }),
        boundsIndex,
        layerMask: entityState.layerMask,
        castsShadow: entityState.castsShadow,
        receivesShadow: entityState.receivesShadow,
        occlusionQuery,
        sortViewId,
        sortDepth,
        fogs,
      }),
    );

    draws.push(...entityDraws);

    if (
      cache !== undefined &&
      entityDraws.length > 0 &&
      diagnostics.length === entityDiagnosticsStart &&
      !entity.hasComponent(InstanceData) &&
      !entity.hasComponent(Skin) &&
      morphWeights === undefined
    ) {
      const sourceBounds = bounds[boundsIndex];

      if (sourceBounds !== undefined) {
        cache.meshDrawEntities.set(cacheKey, {
          entityVersion,
          cameraLayerMask,
          viewCullSignature,
          layerMask: entityState.layerMask,
          worldMatrix: Array.from(entityState.worldMatrix),
          instanceTint:
            instanceTintOffset === undefined
              ? null
              : instanceTints.slice(instanceTintOffset, instanceTintOffset + 4),
          bounds: {
            entity: sourceBounds.entity,
            localAabb: sourceBounds.localAabb,
            worldAabb: sourceBounds.worldAabb,
            localSphere: sourceBounds.localSphere,
            worldSphere: sourceBounds.worldSphere,
          },
          draws: entityDraws.map(createMeshDrawPacketTemplate),
        });
      }
    }
  }

  return draws;
}
