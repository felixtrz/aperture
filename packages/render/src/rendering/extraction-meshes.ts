import { type AssetRegistry, type EcsWorld } from "@aperture-engine/simulation";
import { validateMeshAsset } from "../mesh/index.js";
import { Material, Mesh, OcclusionQuery } from "./index.js";
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
import { readMeshDrawExtractionInputs } from "./extraction-mesh-draw-inputs.js";
import { readMeshEntityExtractionState } from "./extraction-mesh-entity-state.js";
import { readWorldMatrix } from "./extraction-matrices.js";
import { readMaterialSlots } from "./extraction-mesh-materials.js";
import {
  appendCachedMeshDrawEntity,
  entityCacheKey,
  refreshCachedMeshDrawEntityTransform,
  type RenderExtractionCache,
} from "./extraction-mesh-cache.js";
import { writeMeshDrawEntityCache } from "./extraction-mesh-cache-writeback.js";
import { createBoundsPacket } from "./extraction-mesh-bounds.js";
import { createMeshSubmeshDraws } from "./extraction-mesh-submeshes.js";

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
  morphTargetDeltas: number[],
  morphInstanceDescriptors: number[],
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
    const transformVersion = world.entityTransformVersion(entity);
    const cached = cache?.meshDrawEntities.get(cacheKey);

    if (
      cached !== undefined &&
      cached.entityVersion === entityVersion &&
      cached.cameraLayerMask === cameraLayerMask &&
      cached.viewCullSignature === viewCullSignature
    ) {
      // Structural state unchanged. A transform-version drift takes the
      // matrix-only fast path (AI-67): keep the packet templates, refresh the
      // world matrix and derived bounds from the entity's current transform.
      let entry = cached;

      if (cached.transformVersion !== transformVersion) {
        entry = refreshCachedMeshDrawEntityTransform(
          cached,
          readWorldMatrix(entity),
          transformVersion,
        );
        cache?.meshDrawEntities.set(cacheKey, entry);
      }

      if (
        !isVisibleInAnyMatchingView(
          entry.bounds.worldAabb,
          entry.layerMask,
          viewCullContexts,
        )
      ) {
        continue;
      }

      appendCachedMeshDrawEntity(
        entry,
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

    const drawInputs = readMeshDrawExtractionInputs({
      entity,
      mesh: entityState.mesh,
      worldMatrix: entityState.worldMatrix,
      transforms,
      bones,
      morphTargetWeights,
      morphTargetDeltas,
      morphInstanceDescriptors,
      instanceTints,
      instanceAttributes,
      instanceAttributePackets,
      diagnostics,
    });

    if (drawInputs === null) {
      continue;
    }

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
        worldTransformOffset: drawInputs.worldTransformOffset,
        ...(drawInputs.instanceTintOffset === undefined
          ? {}
          : { instanceTintOffset: drawInputs.instanceTintOffset }),
        ...(drawInputs.instanceAttributePacketIndex === undefined
          ? {}
          : {
              instanceAttributePacketIndex:
                drawInputs.instanceAttributePacketIndex,
            }),
        ...(drawInputs.boneMatrixOffset === undefined
          ? {}
          : { boneMatrixOffset: drawInputs.boneMatrixOffset }),
        ...(drawInputs.skinning === undefined
          ? {}
          : { skinning: drawInputs.skinning }),
        ...(drawInputs.morph === undefined ? {} : { morph: drawInputs.morph }),
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

    writeMeshDrawEntityCache({
      cache,
      cacheKey,
      entity,
      entityVersion,
      transformVersion,
      cameraLayerMask,
      viewCullSignature,
      layerMask: entityState.layerMask,
      worldMatrix: entityState.worldMatrix,
      entityDraws,
      diagnosticsStart: entityDiagnosticsStart,
      diagnosticsCount: diagnostics.length,
      bounds,
      boundsIndex,
      instanceTints,
      instanceTintOffset: drawInputs.instanceTintOffset,
      morph: drawInputs.morph,
    });
  }

  return draws;
}
