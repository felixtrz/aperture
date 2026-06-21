import { InstanceData, Skin } from "./index.js";
import { createMeshDrawPacketTemplate, meshDrawEntityCacheForScope, } from "./extraction-mesh-cache.js";
export function writeMeshDrawEntityCache(input) {
    if (input.cache === undefined ||
        input.assetSignature === null ||
        input.entityDraws.length === 0 ||
        input.diagnosticsCount !== input.diagnosticsStart ||
        input.entity.hasComponent(InstanceData) ||
        input.entity.hasComponent(Skin) ||
        input.morph !== undefined) {
        return;
    }
    const sourceBounds = input.bounds[input.boundsIndex];
    if (sourceBounds === undefined) {
        return;
    }
    meshDrawEntityCacheForScope(input.cache, input.cacheScope ?? "mesh").set(input.cacheKey, {
        entityVersion: input.entityVersion,
        transformVersion: input.transformVersion,
        assetSignature: input.assetSignature,
        cameraLayerMask: input.cameraLayerMask,
        viewCullSignature: input.viewCullSignature,
        layerMask: input.layerMask,
        worldMatrix: Array.from(input.worldMatrix),
        instanceTint: input.instanceTintOffset === undefined
            ? null
            : input.instanceTints.slice(input.instanceTintOffset, input.instanceTintOffset + 4),
        bounds: {
            entity: sourceBounds.entity,
            localAabb: sourceBounds.localAabb,
            worldAabb: sourceBounds.worldAabb,
            localSphere: sourceBounds.localSphere,
            worldSphere: sourceBounds.worldSphere,
        },
        draws: input.entityDraws.map(createMeshDrawPacketTemplate),
    });
}
//# sourceMappingURL=extraction-mesh-cache-writeback.js.map