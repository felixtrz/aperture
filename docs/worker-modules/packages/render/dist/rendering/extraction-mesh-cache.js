import { maxScaleOnAxis, transformAabb, transformPoint, } from "/aperture/worker-modules/packages/simulation/dist/index.js";
import { pushMatrix } from "./extraction-matrices.js";
import { pushVec4 } from "./extraction-packing.js";
export function createRenderExtractionCache() {
    const meshDrawEntities = new Map();
    const shadowCasterDrawEntities = new Map();
    return {
        meshDrawEntities,
        shadowCasterDrawEntities,
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
            shadowCasterDrawEntities.clear();
        },
    };
}
export function meshDrawEntityCacheForScope(cache, scope) {
    return scope === "shadow-caster"
        ? cache.shadowCasterDrawEntities
        : cache.meshDrawEntities;
}
export function appendCachedMeshDrawEntity(cached, transforms, instanceTints, bounds, draws, sort) {
    const worldTransformOffset = pushMatrix(transforms, cached.worldMatrix);
    const instanceTintOffset = cached.instanceTint === null
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
            ...(sort === undefined
                ? {}
                : {
                    sortKey: {
                        ...draw.sortKey,
                        viewId: sort.viewId,
                        depth: sort.depth,
                    },
                }),
            worldTransformOffset,
            ...(instanceTintOffset === undefined ? {} : { instanceTintOffset }),
            boundsIndex,
        });
    }
}
export function createMeshDrawPacketTemplate(draw) {
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
export function refreshCachedMeshDrawEntityTransform(cached, worldMatrix, transformVersion) {
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
export function entityCacheKey(entity) {
    return `${entity.index}:${entity.generation}`;
}
//# sourceMappingURL=extraction-mesh-cache.js.map