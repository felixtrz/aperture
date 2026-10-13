import { maxScaleOnAxis, transformAabb, transformPoint, } from "@aperture-engine/simulation";
import { entityRef } from "./extraction-diagnostics.js";
export function createBoundsPacket(boundsId, entity, mesh, worldMatrix) {
    const localAabb = mesh.localAabb;
    const localSphere = mesh.localSphere;
    const center = transformPoint(worldMatrix, localSphere.center);
    return {
        boundsId,
        entity: entityRef(entity),
        localAabb,
        worldAabb: transformAabb(localAabb, worldMatrix),
        localSphere,
        // The radius must follow the world transform's scale: raycast and BVH
        // candidate rejection use this sphere, so an unscaled radius would cull
        // hits near the edges of scaled-up meshes.
        worldSphere: {
            center,
            radius: localSphere.radius * maxScaleOnAxis(worldMatrix),
        },
    };
}
//# sourceMappingURL=extraction-mesh-bounds.js.map