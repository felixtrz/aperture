import {
  assetHandleKey,
  type AssetRegistry,
  type Entity,
  type MaterialHandle,
  type MeshHandle,
} from "@aperture-engine/simulation";
import {
  createMaterialPipelineKeyInput,
  isCustomWgslMaterialAsset,
  type SourceMaterialAsset,
} from "../materials/index.js";
import type { MeshAsset } from "../mesh/index.js";
import { RenderOrder } from "./index.js";
import {
  createBatchCompatibilityKey,
  createRenderSortKey,
  createStableRenderId,
  type FogPacket,
  type MeshDrawPacket,
  type RenderDiagnostic,
} from "./snapshot.js";
import {
  validateMaterialTextureDependencies,
  validateStandardMaterialTextureReadiness,
  validateStandardMaterialUvSetReadiness,
  validateStandardNormalMapReadiness,
} from "./extraction-asset-validation.js";
import { diagnostic, entityRef } from "./extraction-diagnostics.js";
import type { SkinExtraction } from "./extraction-mesh-deformation.js";
import { meshLayoutStreamToken } from "./extraction-mesh-layout.js";
import {
  createExtractedMaterialPipelineKeyInput,
  materialQueue,
  selectFogModeForLayer,
} from "./extraction-mesh-materials.js";

export interface MeshSubmeshDrawExtractionInput {
  readonly assets: AssetRegistry;
  readonly entity: Entity;
  readonly mesh: MeshAsset;
  readonly meshHandle: MeshHandle;
  readonly primaryMaterialHandle: MaterialHandle | null;
  readonly materialSlots: ReadonlyMap<number, MaterialHandle>;
  readonly diagnostics: RenderDiagnostic[];
  readonly worldTransformOffset: number;
  readonly instanceTintOffset?: number;
  readonly instanceAttributePacketIndex?: number;
  readonly boneMatrixOffset?: number;
  readonly skinning?: SkinExtraction;
  readonly morphWeights?: readonly [number, number, number, number];
  readonly boundsIndex: number;
  readonly layerMask: number;
  readonly castsShadow: boolean;
  readonly receivesShadow: boolean;
  readonly occlusionQuery: boolean;
  readonly sortViewId: number;
  readonly sortDepth: number;
  readonly fogs: readonly FogPacket[];
}

export function createMeshSubmeshDraws(
  input: MeshSubmeshDrawExtractionInput,
): MeshDrawPacket[] {
  const draws: MeshDrawPacket[] = [];

  for (
    let submeshIndex = 0;
    submeshIndex < input.mesh.submeshes.length;
    submeshIndex += 1
  ) {
    const submesh = input.mesh.submeshes[submeshIndex];

    if (submesh === undefined) {
      continue;
    }

    const materialHandle =
      input.materialSlots.get(submesh.materialSlot) ??
      input.primaryMaterialHandle;
    const materialEntry =
      materialHandle === null
        ? undefined
        : input.assets.get<"material", SourceMaterialAsset>(materialHandle);

    if (materialHandle === null || materialEntry === undefined) {
      input.diagnostics.push(
        diagnostic("render.missingMaterialHandle", input.entity),
      );
      continue;
    }

    if (materialEntry.status !== "ready" || materialEntry.asset === null) {
      input.diagnostics.push(
        diagnostic(
          `render.material.${materialEntry.status}`,
          input.entity,
          materialHandle,
        ),
      );
      continue;
    }

    if (
      !validateMaterialTextureDependencies(
        materialEntry.asset,
        materialHandle,
        input.assets,
        input.entity,
        input.diagnostics,
      )
    ) {
      continue;
    }

    const materialKey = assetHandleKey(materialHandle);
    const meshKey = assetHandleKey(input.meshHandle);

    if (
      !isCustomWgslMaterialAsset(materialEntry.asset) &&
      materialEntry.asset.kind === "standard" &&
      !validateStandardMaterialTextureReadiness({
        registry: input.assets,
        material: materialHandle,
        entity: input.entity,
        diagnostics: input.diagnostics,
      })
    ) {
      continue;
    }

    if (
      !isCustomWgslMaterialAsset(materialEntry.asset) &&
      materialEntry.asset.kind === "standard" &&
      !validateStandardMaterialUvSetReadiness({
        mesh: input.mesh,
        material: materialEntry.asset,
        meshKey,
        materialKey,
        entity: input.entity,
        diagnostics: input.diagnostics,
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
      instanceTint: input.instanceTintOffset !== undefined,
      skinned: input.skinning !== undefined,
      morphed: input.morphWeights !== undefined,
      fogMode: selectFogModeForLayer(input.layerMask, input.fogs),
    });

    const stableId =
      createStableRenderId(entityRef(input.entity)) + submeshIndex;
    const normalMapReadiness = isCustomWgslMaterialAsset(materialEntry.asset)
      ? true
      : validateStandardNormalMapReadiness({
          mesh: input.mesh,
          material: materialEntry.asset,
          meshKey,
          materialKey,
          entity: input.entity,
          diagnostics: input.diagnostics,
        });

    if (!normalMapReadiness) {
      continue;
    }

    draws.push({
      renderId: stableId,
      entity: entityRef(input.entity),
      mesh: input.meshHandle,
      material: materialHandle,
      submesh: submeshIndex,
      materialSlot: submesh.materialSlot,
      vertexStart: submesh.vertexStart,
      vertexCount: submesh.vertexCount,
      indexStart: submesh.indexStart,
      indexCount: submesh.indexCount,
      worldTransformOffset: input.worldTransformOffset,
      ...(input.instanceTintOffset === undefined
        ? {}
        : { instanceTintOffset: input.instanceTintOffset }),
      ...(input.instanceAttributePacketIndex === undefined
        ? {}
        : { instanceAttributePacketIndex: input.instanceAttributePacketIndex }),
      ...(input.boneMatrixOffset === undefined || input.skinning === undefined
        ? {}
        : {
            boneMatrixOffset: input.boneMatrixOffset,
            boneMatrixCount: input.skinning.jointCount,
          }),
      boundsIndex: input.boundsIndex,
      layerMask: input.layerMask,
      castsShadow: input.castsShadow,
      receivesShadow: input.receivesShadow,
      ...(input.occlusionQuery ? { occlusionQuery: input.occlusionQuery } : {}),
      sortKey: createRenderSortKey({
        queue,
        viewId: input.sortViewId,
        layer: input.layerMask,
        order: input.entity.hasComponent(RenderOrder)
          ? (input.entity.getValue(RenderOrder, "value") ?? 0)
          : 0,
        depth: input.sortDepth,
        materialKey,
        meshKey,
        stableId,
      }),
      batchKey: createBatchCompatibilityKey({
        materialPipeline,
        materialKey,
        meshLayoutKey: input.mesh.vertexStreams
          .map(meshLayoutStreamToken)
          .join("|"),
        topology: submesh.topology,
        skinned:
          input.skinning !== undefined &&
          !isCustomWgslMaterialAsset(materialEntry.asset) &&
          materialEntry.asset.kind === "standard",
        morphed:
          input.morphWeights !== undefined &&
          !isCustomWgslMaterialAsset(materialEntry.asset) &&
          materialEntry.asset.kind === "standard",
      }),
    });
  }

  return draws;
}
