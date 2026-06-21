import { comparePacketFamily, totalCounts, } from "./snapshot-change-set-compare.js";
import { boundsPackets, environmentPackets, lightPackets, meshDrawPackets, proceduralSkyPackets, runtimeUniformPackets, shadowCasterDrawPackets, shadowRequestPackets, viewPackets, } from "./snapshot-change-set-packets.js";
export { RENDER_SNAPSHOT_CHANGE_SET_FAMILIES } from "./snapshot-change-set-types.js";
export function createRenderSnapshotChangeSet(previous, next, options = {}) {
    const uniqueKeyOptions = withAssumedUniqueKeys(options);
    const duplicateKeyOptions = withoutAssumedUniqueKeys(options);
    const views = comparePacketFamily(viewPackets(previous), viewPackets(next), uniqueKeyOptions);
    const meshDrawOptions = options.includeUnchangedMeshDrawRenderIds === true
        ? { ...uniqueKeyOptions, includeRawUnchangedKeys: true }
        : uniqueKeyOptions;
    const meshDraws = comparePacketFamily(meshDrawPackets(previous), meshDrawPackets(next), meshDrawOptions);
    const shadowCasterDraws = comparePacketFamily(shadowCasterDrawPackets(previous), shadowCasterDrawPackets(next), uniqueKeyOptions);
    const lights = comparePacketFamily(lightPackets(previous), lightPackets(next), uniqueKeyOptions);
    const environments = comparePacketFamily(environmentPackets(previous), environmentPackets(next), uniqueKeyOptions);
    const proceduralSkies = comparePacketFamily(proceduralSkyPackets(previous), proceduralSkyPackets(next), uniqueKeyOptions);
    const runtimeUniforms = comparePacketFamily(runtimeUniformPackets(previous), runtimeUniformPackets(next), uniqueKeyOptions);
    const shadowRequests = comparePacketFamily(shadowRequestPackets(previous), shadowRequestPackets(next), uniqueKeyOptions);
    const bounds = comparePacketFamily(boundsPackets(previous), boundsPackets(next), duplicateKeyOptions);
    const keys = views.keys === undefined ||
        meshDraws.keys === undefined ||
        shadowCasterDraws.keys === undefined ||
        lights.keys === undefined ||
        environments.keys === undefined ||
        proceduralSkies.keys === undefined ||
        runtimeUniforms.keys === undefined ||
        shadowRequests.keys === undefined ||
        bounds.keys === undefined
        ? undefined
        : {
            views: views.keys,
            meshDraws: meshDraws.keys,
            shadowCasterDraws: shadowCasterDraws.keys,
            lights: lights.keys,
            environments: environments.keys,
            proceduralSkies: proceduralSkies.keys,
            runtimeUniforms: runtimeUniforms.keys,
            shadowRequests: shadowRequests.keys,
            bounds: bounds.keys,
        };
    return {
        previousFrame: previous?.frame ?? null,
        frame: next.frame,
        views: views.counts,
        meshDraws: meshDraws.counts,
        shadowCasterDraws: shadowCasterDraws.counts,
        lights: lights.counts,
        environments: environments.counts,
        proceduralSkies: proceduralSkies.counts,
        runtimeUniforms: runtimeUniforms.counts,
        shadowRequests: shadowRequests.counts,
        bounds: bounds.counts,
        total: totalCounts([
            views.counts,
            meshDraws.counts,
            shadowCasterDraws.counts,
            lights.counts,
            environments.counts,
            proceduralSkies.counts,
            runtimeUniforms.counts,
            shadowRequests.counts,
            bounds.counts,
        ]),
        ...(options.includeUnchangedMeshDrawRenderIds !== true
            ? {}
            : {
                unchangedMeshDrawRenderIds: rawNumberKeys(meshDraws.rawUnchangedKeys),
            }),
        ...(keys === undefined ? {} : { keys }),
    };
}
function withAssumedUniqueKeys(options) {
    return options.assumeUniqueKeys === true
        ? options
        : { ...options, assumeUniqueKeys: true };
}
function withoutAssumedUniqueKeys(options) {
    return options.assumeUniqueKeys === true
        ? { ...options, assumeUniqueKeys: false }
        : options;
}
function rawNumberKeys(keys) {
    if (keys === undefined || keys.length === 0) {
        return [];
    }
    return keys.filter((key) => typeof key === "number");
}
//# sourceMappingURL=snapshot-change-set.js.map