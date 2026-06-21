import { maxScaleOnAxis, transformAabb, transformPoint, } from "@aperture-engine/simulation";
export function rewriteInterpolatedPacketBounds(options) {
    if (options.writtenBounds.has(options.boundsIndex) ||
        options.boundsIndex < 0 ||
        options.boundsIndex >= options.snapshot.bounds.length) {
        return 0;
    }
    const bounds = options.snapshot.bounds[options.boundsIndex];
    if (bounds === undefined) {
        return 0;
    }
    const rewritten = {
        ...bounds,
        worldAabb: transformAabb(bounds.localAabb, options.worldMatrix),
        worldSphere: {
            center: transformPoint(options.worldMatrix, bounds.localSphere.center),
            radius: bounds.localSphere.radius * maxScaleOnAxis(options.worldMatrix),
        },
    };
    options.snapshot.bounds[options.boundsIndex] = rewritten;
    options.writtenBounds.add(options.boundsIndex);
    return 1;
}
//# sourceMappingURL=snapshot-interpolation-bounds.js.map