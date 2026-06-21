import { assetHandleKey, } from "/aperture/worker-modules/packages/simulation/dist/index.js";
import { createMaterialPipelineKeyInput, isCustomWgslMaterialAsset, } from "../materials/index.js";
import { RenderOrder } from "./index.js";
import { createBatchCompatibilityKey, createRenderSortKey, createStableRenderId, } from "./snapshot.js";
import { validateMaterialTextureDependencies, validateStandardMaterialTextureReadiness, validateStandardMaterialUvSetReadiness, validateStandardNormalMapReadiness, } from "./extraction-asset-validation.js";
import { diagnostic, entityRef } from "./extraction-diagnostics.js";
import { meshLayoutStreamToken } from "./extraction-mesh-layout.js";
import { createExtractedMaterialPipelineKeyInput, materialQueue, selectFogModeForLayer, } from "./extraction-mesh-materials.js";
export function createMeshSubmeshDraws(input) {
    const draws = [];
    for (let submeshIndex = 0; submeshIndex < input.mesh.submeshes.length; submeshIndex += 1) {
        const submesh = input.mesh.submeshes[submeshIndex];
        if (submesh === undefined) {
            continue;
        }
        const materialHandle = input.materialSlots.get(submesh.materialSlot) ??
            input.primaryMaterialHandle;
        const materialEntry = materialHandle === null
            ? undefined
            : input.assets.get(materialHandle);
        if (materialHandle === null || materialEntry === undefined) {
            input.diagnostics.push(diagnostic("render.missingMaterialHandle", input.entity));
            continue;
        }
        if (materialEntry.status !== "ready" || materialEntry.asset === null) {
            input.diagnostics.push(diagnostic(`render.material.${materialEntry.status}`, input.entity, materialHandle));
            continue;
        }
        if (!validateMaterialTextureDependencies(materialEntry.asset, materialHandle, input.assets, input.entity, input.diagnostics)) {
            continue;
        }
        const materialKey = assetHandleKey(materialHandle);
        const meshKey = assetHandleKey(input.meshHandle);
        if (!isCustomWgslMaterialAsset(materialEntry.asset) &&
            materialEntry.asset.kind === "standard" &&
            !validateStandardMaterialTextureReadiness({
                registry: input.assets,
                material: materialHandle,
                entity: input.entity,
                diagnostics: input.diagnostics,
            })) {
            continue;
        }
        if (!isCustomWgslMaterialAsset(materialEntry.asset) &&
            materialEntry.asset.kind === "standard" &&
            !validateStandardMaterialUvSetReadiness({
                mesh: input.mesh,
                material: materialEntry.asset,
                meshKey,
                materialKey,
                entity: input.entity,
                diagnostics: input.diagnostics,
            })) {
            continue;
        }
        const queue = materialQueue(materialEntry.asset);
        const baseMaterialPipeline = createMaterialPipelineKeyInput(materialEntry.asset);
        const materialPipeline = createExtractedMaterialPipelineKeyInput({
            base: baseMaterialPipeline,
            material: materialEntry.asset,
            instanceTint: input.instanceTintOffset !== undefined,
            skinned: input.skinning !== undefined,
            morphed: input.morph !== undefined,
            fogMode: selectFogModeForLayer(input.layerMask, input.fogs),
        });
        const stableId = createStableRenderId(entityRef(input.entity)) + submeshIndex;
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
            ...(input.morph === undefined
                ? {}
                : {
                    morphDeltaOffset: input.morph.deltaOffset,
                    morphTargetCount: input.morph.targetCount,
                    morphWeightOffset: input.morph.weightOffset,
                    morphVertexCount: input.morph.vertexCount,
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
                skinned: input.skinning !== undefined &&
                    !isCustomWgslMaterialAsset(materialEntry.asset) &&
                    materialEntry.asset.kind === "standard",
                morphed: input.morph !== undefined &&
                    !isCustomWgslMaterialAsset(materialEntry.asset) &&
                    materialEntry.asset.kind === "standard",
            }),
        });
    }
    return draws;
}
//# sourceMappingURL=extraction-mesh-submeshes.js.map