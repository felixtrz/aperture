import { assetHandleKey, } from "/aperture/worker-modules/packages/simulation/dist/index.js";
import { validateMeshAsset } from "../mesh/index.js";
import { Material, MaterialSlots, Mesh, OcclusionQuery } from "./index.js";
import { computeViewDepth, firstMatchingSortView, isVisibleInAnyMatchingView, } from "./extraction-culling.js";
import { diagnostic } from "./extraction-diagnostics.js";
import { sortedEntities } from "./extraction-entities.js";
import { readMeshDrawExtractionInputs } from "./extraction-mesh-draw-inputs.js";
import { readMeshEntityExtractionState } from "./extraction-mesh-entity-state.js";
import { readWorldMatrix } from "./extraction-matrices.js";
import { readMaterialSlots } from "./extraction-mesh-materials.js";
import { parseMaterialHandle, parseMeshHandle } from "./extraction-inputs.js";
import { appendCachedMeshDrawEntity, entityCacheKey, meshDrawEntityCacheForScope, refreshCachedMeshDrawEntityTransform, } from "./extraction-mesh-cache.js";
import { writeMeshDrawEntityCache } from "./extraction-mesh-cache-writeback.js";
import { createBoundsPacket } from "./extraction-mesh-bounds.js";
import { createMeshSubmeshDraws } from "./extraction-mesh-submeshes.js";
export { createRenderExtractionCache, } from "./extraction-mesh-cache.js";
export function extractMeshDraws(world, assets, transforms, bones, morphTargetWeights, morphTargetDeltas, morphInstanceDescriptors, instanceTints, instanceAttributes, instanceAttributePackets, bounds, diagnostics, cameraLayerMask, fogs, viewCullContexts, _viewCullSignature, cache, options = {}) {
    const query = world.queryManager.registerQuery({
        required: [Mesh, Material],
    });
    const draws = [];
    const frustumCull = options.frustumCull !== false;
    const extractingShadowCasters = options.requireShadowCaster === true;
    const cacheScope = extractingShadowCasters ? "shadow-caster" : "mesh";
    // Frustum planes affect per-frame visibility and sort depth, not the
    // structural draw packet template cached for a static entity.
    const cacheViewCullSignature = 0;
    const activeCache = frustumCull || extractingShadowCasters ? cache : undefined;
    const activeCacheEntries = activeCache === undefined
        ? undefined
        : meshDrawEntityCacheForScope(activeCache, cacheScope);
    for (const entity of sortedEntities(query.entities)) {
        const cacheKey = entityCacheKey(entity);
        const entityVersion = world.entityVersion(entity);
        const transformVersion = world.entityTransformVersion(entity);
        const cached = activeCacheEntries?.get(cacheKey);
        const assetSignature = activeCacheEntries === undefined
            ? null
            : readMeshDrawEntityAssetSignature(entity, assets);
        if (cached !== undefined &&
            cached.entityVersion === entityVersion &&
            assetSignature !== null &&
            cached.assetSignature === assetSignature &&
            cached.cameraLayerMask === cameraLayerMask &&
            cached.viewCullSignature === cacheViewCullSignature) {
            // Structural state unchanged. A transform-version drift takes the
            // matrix-only fast path (AI-67): keep the packet templates, refresh the
            // world matrix and derived bounds from the entity's current transform.
            let entry = cached;
            if (cached.transformVersion !== transformVersion) {
                entry = refreshCachedMeshDrawEntityTransform(cached, readWorldMatrix(entity), transformVersion);
                activeCacheEntries?.set(cacheKey, entry);
            }
            if (frustumCull &&
                !isVisibleInAnyMatchingView(entry.bounds.worldAabb, entry.layerMask, viewCullContexts)) {
                continue;
            }
            const sortView = extractingShadowCasters
                ? undefined
                : firstMatchingSortView(entry.layerMask, viewCullContexts);
            const sortViewId = sortView?.viewId ?? 0;
            const sortDepth = sortView === undefined
                ? 0
                : computeViewDepth(sortView.viewMatrix, entry.bounds.worldSphere.center);
            appendCachedMeshDrawEntity(entry, transforms, instanceTints, bounds, draws, extractingShadowCasters
                ? undefined
                : { viewId: sortViewId, depth: sortDepth });
            continue;
        }
        activeCacheEntries?.delete(cacheKey);
        const entityState = readMeshEntityExtractionState({
            entity,
            assets,
            diagnostics,
            cameraLayerMask,
            ...(options.diagnoseLayerMismatch === undefined
                ? {}
                : { diagnoseLayerMismatch: options.diagnoseLayerMismatch }),
        });
        if (entityState === null) {
            continue;
        }
        if (options.requireShadowCaster === true && !entityState.castsShadow) {
            continue;
        }
        const boundsPacket = createBoundsPacket(bounds.length, entity, entityState.mesh, entityState.worldMatrix);
        if (frustumCull &&
            !isVisibleInAnyMatchingView(boundsPacket.worldAabb, entityState.layerMask, viewCullContexts)) {
            continue;
        }
        const meshValidation = validateMeshAsset(entityState.mesh);
        if (!meshValidation.valid) {
            for (const meshDiagnostic of meshValidation.diagnostics) {
                diagnostics.push(diagnostic(`render.${meshDiagnostic.code}`, entity, entityState.meshHandle));
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
        const occlusionQuery = entity.hasComponent(OcclusionQuery) &&
            entity.getValue(OcclusionQuery, "enabled") !== false;
        const boundsIndex = bounds.length;
        const sortView = extractingShadowCasters
            ? undefined
            : firstMatchingSortView(entityState.layerMask, viewCullContexts);
        const sortViewId = sortView?.viewId ?? 0;
        const sortDepth = sortView === undefined
            ? 0
            : computeViewDepth(sortView.viewMatrix, boundsPacket.worldSphere.center);
        bounds.push(boundsPacket);
        const entityDiagnosticsStart = diagnostics.length;
        const entityDraws = [];
        const materialSlots = readMaterialSlots(entity, diagnostics);
        entityDraws.push(...createMeshSubmeshDraws({
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
                    instanceAttributePacketIndex: drawInputs.instanceAttributePacketIndex,
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
        }));
        draws.push(...entityDraws);
        writeMeshDrawEntityCache({
            cache: activeCache,
            cacheScope,
            cacheKey,
            entity,
            entityVersion,
            transformVersion,
            assetSignature,
            cameraLayerMask,
            viewCullSignature: cacheViewCullSignature,
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
function readMeshDrawEntityAssetSignature(entity, assets) {
    const meshHandle = parseMeshHandle(entity.getValue(Mesh, "meshId") ?? "");
    if (meshHandle === null) {
        return null;
    }
    const meshEntry = assets.get(meshHandle);
    if (meshEntry === undefined) {
        return null;
    }
    const materialHandles = new Map();
    const primaryMaterialHandle = parseMaterialHandle(entity.getValue(Material, "materialId") ?? "");
    if (primaryMaterialHandle !== null) {
        materialHandles.set(assetHandleKey(primaryMaterialHandle), primaryMaterialHandle);
    }
    const materialSlots = readMaterialSlotHandlesForCache(entity);
    if (materialSlots === null) {
        return null;
    }
    for (const materialHandle of materialSlots.handles) {
        materialHandles.set(assetHandleKey(materialHandle), materialHandle);
    }
    const materialSegments = [...materialHandles]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, materialHandle]) => {
        const entry = assets.get(materialHandle);
        return [
            "material",
            key,
            `status:${entry?.status ?? "missing"}`,
            `version:${entry?.version ?? -1}`,
        ].join(":");
    });
    return [
        "mesh-draw-assets",
        "mesh",
        assetHandleKey(meshHandle),
        `status:${meshEntry.status}`,
        `version:${meshEntry.version}`,
        `primary:${primaryMaterialHandle === null ? "none" : assetHandleKey(primaryMaterialHandle)}`,
        `slots:${materialSlots.slotsJson}`,
        ...materialSegments,
    ].join("|");
}
function readMaterialSlotHandlesForCache(entity) {
    if (!entity.hasComponent(MaterialSlots)) {
        return { slotsJson: "[]", handles: [] };
    }
    const slotsJson = entity.getValue(MaterialSlots, "slotsJson") ?? "[]";
    let parsed;
    try {
        parsed = JSON.parse(slotsJson);
    }
    catch {
        return null;
    }
    if (!Array.isArray(parsed)) {
        return null;
    }
    const handles = [];
    for (const entry of parsed) {
        if (typeof entry !== "object" ||
            entry === null ||
            !Number.isInteger(entry.slot) ||
            (entry.slot ?? -1) < 0 ||
            typeof entry.materialId !== "string") {
            return null;
        }
        const material = parseMaterialHandle(entry.materialId);
        if (material === null) {
            return null;
        }
        handles.push(material);
    }
    return { slotsJson, handles };
}
//# sourceMappingURL=extraction-meshes.js.map