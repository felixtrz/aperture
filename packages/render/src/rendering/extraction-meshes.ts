import {
  assetHandleKey,
  Enabled,
  type AssetRegistry,
  type EcsWorld,
  WorldTransform,
} from "@aperture-engine/simulation";
import {
  createMaterialPipelineKeyInput,
  type MaterialAsset,
} from "../materials/index.js";
import { type MeshAsset, validateMeshAsset } from "../mesh/index.js";
import {
  InstanceData,
  Material,
  Mesh,
  OcclusionQuery,
  RenderLayer,
  RenderOrder,
  ShadowCaster,
  ShadowReceiver,
  Skin,
  Visibility,
} from "./index.js";
import {
  createBatchCompatibilityKey,
  createRenderSortKey,
  createStableRenderId,
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
import {
  validateMaterialTextureDependencies,
  validateStandardMaterialTextureReadiness,
  validateStandardMaterialUvSetReadiness,
  validateStandardNormalMapReadiness,
} from "./extraction-asset-validation.js";
import { diagnostic, entityRef } from "./extraction-diagnostics.js";
import { sortedEntities } from "./extraction-entities.js";
import { parseMaterialHandle, parseMeshHandle } from "./extraction-inputs.js";
import {
  pushInstanceAttributePacket,
  pushInstanceTint,
} from "./extraction-mesh-instances.js";
import {
  createExtractedMaterialPipelineKeyInput,
  materialQueue,
  readMaterialSlots,
  selectFogModeForLayer,
} from "./extraction-mesh-materials.js";
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
import { meshLayoutStreamToken } from "./extraction-mesh-layout.js";
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

    for (
      let submeshIndex = 0;
      submeshIndex < meshEntry.asset.submeshes.length;
      submeshIndex += 1
    ) {
      const submesh = meshEntry.asset.submeshes[submeshIndex];

      if (submesh === undefined) {
        continue;
      }

      const materialHandle =
        materialSlots.get(submesh.materialSlot) ?? primaryMaterialHandle;
      const materialEntry =
        materialHandle === null
          ? undefined
          : assets.get<"material", MaterialAsset>(materialHandle);

      if (materialHandle === null || materialEntry === undefined) {
        diagnostics.push(diagnostic("render.missingMaterialHandle", entity));
        continue;
      }

      if (materialEntry.status !== "ready" || materialEntry.asset === null) {
        diagnostics.push(
          diagnostic(
            `render.material.${materialEntry.status}`,
            entity,
            materialHandle,
          ),
        );
        continue;
      }

      if (
        !validateMaterialTextureDependencies(
          materialEntry.asset,
          materialHandle,
          assets,
          entity,
          diagnostics,
        )
      ) {
        continue;
      }

      const materialKey = assetHandleKey(materialHandle);
      const meshKey = assetHandleKey(meshHandle);

      if (
        materialEntry.asset.kind === "standard" &&
        !validateStandardMaterialTextureReadiness({
          registry: assets,
          material: materialHandle,
          entity,
          diagnostics,
        })
      ) {
        continue;
      }

      if (
        materialEntry.asset.kind === "standard" &&
        !validateStandardMaterialUvSetReadiness({
          mesh: meshEntry.asset,
          material: materialEntry.asset,
          meshKey,
          materialKey,
          entity,
          diagnostics,
        })
      ) {
        continue;
      }

      const queue = materialQueue(materialEntry.asset);
      const baseMaterialPipeline = createMaterialPipelineKeyInput(
        materialEntry.asset,
      );
      const materialPipeline = createExtractedMaterialPipelineKeyInput({
        base: baseMaterialPipeline,
        material: materialEntry.asset,
        instanceTint: instanceTintOffset !== undefined,
        skinned: skinning !== undefined,
        morphed: morphWeights !== undefined,
        fogMode: selectFogModeForLayer(layerMask, fogs),
      });

      const stableId = createStableRenderId(entityRef(entity)) + submeshIndex;
      const normalMapReadiness = validateStandardNormalMapReadiness({
        mesh: meshEntry.asset,
        material: materialEntry.asset,
        meshKey,
        materialKey,
        entity,
        diagnostics,
      });

      if (!normalMapReadiness) {
        continue;
      }

      entityDraws.push({
        renderId: stableId,
        entity: entityRef(entity),
        mesh: meshHandle,
        material: materialHandle,
        submesh: submeshIndex,
        materialSlot: submesh.materialSlot,
        vertexStart: submesh.vertexStart,
        vertexCount: submesh.vertexCount,
        indexStart: submesh.indexStart,
        indexCount: submesh.indexCount,
        worldTransformOffset,
        ...(instanceTintOffset === undefined ? {} : { instanceTintOffset }),
        ...(instanceAttributePacketIndex === undefined
          ? {}
          : { instanceAttributePacketIndex }),
        ...(boneMatrixOffset === undefined || skinning === undefined
          ? {}
          : {
              boneMatrixOffset,
              boneMatrixCount: skinning.jointCount,
            }),
        boundsIndex,
        layerMask,
        castsShadow,
        receivesShadow,
        ...(occlusionQuery ? { occlusionQuery } : {}),
        sortKey: createRenderSortKey({
          queue,
          viewId: sortViewId,
          layer: layerMask,
          order: entity.hasComponent(RenderOrder)
            ? (entity.getValue(RenderOrder, "value") ?? 0)
            : 0,
          depth: sortDepth,
          materialKey,
          meshKey,
          stableId,
        }),
        batchKey: createBatchCompatibilityKey({
          materialPipeline,
          materialKey,
          meshLayoutKey: meshEntry.asset.vertexStreams
            .map(meshLayoutStreamToken)
            .join("|"),
          topology: submesh.topology,
          skinned:
            skinning !== undefined && materialEntry.asset.kind === "standard",
          morphed:
            morphWeights !== undefined &&
            materialEntry.asset.kind === "standard",
        }),
      });
    }

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
