import {
  Enabled,
  type AssetRegistry,
  type EcsWorld,
  WorldTransform,
} from "@aperture-engine/simulation";
import { type MeshAsset, validateMeshAsset } from "../mesh/index.js";
import {
  InstanceData,
  Material,
  Mesh,
  OcclusionQuery,
  RenderLayer,
  ShadowCaster,
  ShadowReceiver,
  Skin,
  Visibility,
} from "./index.js";
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
import { parseMaterialHandle, parseMeshHandle } from "./extraction-inputs.js";
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
import { pushMatrix, readWorldMatrix } from "./extraction-matrices.js";

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

    if (
      entity.hasComponent(Enabled) &&
      entity.getValue(Enabled, "value") === false
    ) {
      diagnostics.push(diagnostic("render.disabled", entity));
      continue;
    }

    if (
      entity.hasComponent(Visibility) &&
      entity.getValue(Visibility, "visible") === false
    ) {
      diagnostics.push(diagnostic("render.invisible", entity));
      continue;
    }

    if (!entity.hasComponent(WorldTransform)) {
      diagnostics.push(diagnostic("render.missingWorldTransform", entity));
      continue;
    }

    const layerMask = entity.hasComponent(RenderLayer)
      ? (entity.getValue(RenderLayer, "mask") ?? 1)
      : 1;
    const castsShadow = entity.hasComponent(ShadowCaster)
      ? (entity.getValue(ShadowCaster, "enabled") ?? true)
      : true;
    const receivesShadow = entity.hasComponent(ShadowReceiver)
      ? (entity.getValue(ShadowReceiver, "enabled") ?? true)
      : true;

    if (layerMask === 0) {
      diagnostics.push(diagnostic("render.zeroLayerMask", entity));
      continue;
    }

    if (cameraLayerMask !== 0 && (layerMask & cameraLayerMask) === 0) {
      diagnostics.push(diagnostic("render.layerMismatch", entity));
      continue;
    }

    const meshHandle = parseMeshHandle(entity.getValue(Mesh, "meshId") ?? "");
    const meshEntry =
      meshHandle === null
        ? undefined
        : assets.get<"mesh", MeshAsset>(meshHandle);

    if (meshHandle === null || meshEntry === undefined) {
      diagnostics.push(diagnostic("render.missingMeshHandle", entity));
      continue;
    }

    if (meshEntry.status !== "ready" || meshEntry.asset === null) {
      diagnostics.push(
        diagnostic(`render.mesh.${meshEntry.status}`, entity, meshHandle),
      );
      continue;
    }

    const worldMatrix = readWorldMatrix(entity);
    const boundsPacket = createBoundsPacket(
      bounds.length,
      entity,
      meshEntry.asset,
      worldMatrix,
    );

    if (
      !isVisibleInAnyMatchingView(
        boundsPacket.worldAabb,
        layerMask,
        viewCullContexts,
      )
    ) {
      continue;
    }

    const meshValidation = validateMeshAsset(meshEntry.asset);

    if (!meshValidation.valid) {
      for (const meshDiagnostic of meshValidation.diagnostics) {
        diagnostics.push(
          diagnostic(`render.${meshDiagnostic.code}`, entity, meshHandle),
        );
      }
      continue;
    }

    const worldTransformOffset = pushMatrix(transforms, worldMatrix);
    const instanceTintOffset = pushInstanceTint(instanceTints, entity);
    const instanceAttributePacketIndex = pushInstanceAttributePacket(
      instanceAttributes,
      instanceAttributePackets,
      diagnostics,
      entity,
    );
    const skinning = readSkinning(entity, meshEntry.asset, diagnostics);

    if (skinning === null) {
      continue;
    }

    const morphWeights = readMorphTargetWeights(
      entity,
      meshEntry.asset,
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
    const sortView = firstMatchingSortView(layerMask, viewCullContexts);
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

    const primaryMaterialHandle = parseMaterialHandle(
      entity.getValue(Material, "materialId") ?? "",
    );
    const materialSlots = readMaterialSlots(entity, diagnostics);
    entityDraws.push(
      ...createMeshSubmeshDraws({
        assets,
        entity,
        mesh: meshEntry.asset,
        meshHandle,
        primaryMaterialHandle,
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
        layerMask,
        castsShadow,
        receivesShadow,
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
          layerMask,
          worldMatrix: Array.from(worldMatrix),
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
