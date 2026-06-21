import { AUDIO_EMITTER_PACKET_WORDS, AUDIO_LISTENER_PACKET_WORDS, BOUNDS_PACKET_WORDS, ENVIRONMENT_PACKET_WORDS, FOG_PACKET_WORDS, LIGHT_PACKET_WORDS, MESH_DRAW_PACKET_WORDS, PARTICLE_EMITTER_PACKET_WORDS, QUAD_BATCH_PACKET_WORDS, QUAD_INSTANCE_FLOAT_STRIDE, SHADOW_REQUEST_PACKET_WORDS, SNAPSHOT_PACKET_HEADER_WORDS, VIEW_PACKET_WORDS, createQuadSnapshotBuffers, createSnapshotPacketRegistry, decodeSnapshotPackets, } from "@aperture-engine/render";
import { SharedSnapshotTransportUnsupportedError, createSharedSnapshotTransport, } from "@aperture-engine/runtime";
const SHARED_SNAPSHOT_PACKET_DECODE_CACHES = new WeakMap();
export function createWebGpuAppSnapshotTransport(options) {
    const requested = options.mode ?? "auto";
    if (requested === "transferable") {
        return {
            mode: "transferable",
            diagnostics: {
                requested,
                active: "transferable",
                fallback: null,
                sharedArrayBuffer: null,
            },
        };
    }
    try {
        const shared = createSharedSnapshotTransport(createSharedSnapshotTransportOptions(options.sharedSnapshotTransport, requested));
        return {
            mode: "shared-array-buffer",
            shared,
            diagnostics: {
                requested,
                active: "shared-array-buffer",
                fallback: null,
                sharedArrayBuffer: {
                    supported: true,
                    layout: shared.layout,
                },
            },
        };
    }
    catch (error) {
        if (error instanceof SharedSnapshotTransportUnsupportedError) {
            return {
                mode: "transferable",
                diagnostics: {
                    requested,
                    active: "transferable",
                    fallback: "transferable",
                    sharedArrayBuffer: {
                        supported: false,
                        diagnostic: {
                            code: "webGpuApp.sharedSnapshotTransportUnsupported",
                            reason: error.reason,
                            message: error.message,
                        },
                    },
                },
            };
        }
        throw error;
    }
}
export function createWebGpuAppSnapshotTransportStartPayload(transport) {
    if (transport.mode !== "shared-array-buffer") {
        return null;
    }
    return {
        mode: "shared-array-buffer",
        layout: transport.shared.layout,
        headerBuffer: transport.shared.headerBuffer,
        transformBuffer: transport.shared.transformBuffer,
        instanceTintBuffer: transport.shared.instanceTintBuffer,
        viewMatrixBuffer: transport.shared.viewMatrixBuffer,
        quadInstanceFloatBuffer: transport.shared.quadInstanceFloatBuffer,
        quadInstanceWordBuffer: transport.shared.quadInstanceWordBuffer,
        packetBuffer: transport.shared.packetBuffer,
    };
}
export function readWebGpuAppSharedSnapshot(transport, message, options = {}) {
    if (transport.mode !== "shared-array-buffer") {
        return null;
    }
    const payload = readSharedSnapshotFramePayload(message);
    if (payload === null) {
        return null;
    }
    const frame = transport.shared.reader.readLatestFrame();
    if (frame === null) {
        return null;
    }
    const expectedFrame = readSharedSnapshotMessageFrame(message);
    const requireMessageFrame = options.requireMessageFrame ?? true;
    if (requireMessageFrame &&
        expectedFrame !== null &&
        frame.frame !== expectedFrame) {
        return null;
    }
    const packets = decodeSharedSnapshotPackets(transport.shared, frame.bufferIndex, frame.packetWords, payload.registry);
    const diagnostics = payload.diagnostics ?? [];
    return {
        frame: frame.frame,
        time: frame.time,
        views: packets.views,
        meshDraws: packets.meshDraws,
        ...(packets.shadowCasterDraws === undefined
            ? {}
            : { shadowCasterDraws: packets.shadowCasterDraws }),
        lights: packets.lights,
        environments: packets.environments,
        ...(packets.fogs === undefined ? {} : { fogs: packets.fogs }),
        ...(packets.particleEmitters === undefined
            ? {}
            : { particleEmitters: packets.particleEmitters }),
        ...(packets.audioEmitters === undefined
            ? {}
            : { audioEmitters: packets.audioEmitters }),
        ...(packets.audioListener === undefined
            ? {}
            : { audioListener: packets.audioListener }),
        shadowRequests: packets.shadowRequests,
        bounds: packets.bounds,
        ...(packets.quadBatches === undefined
            ? {}
            : { quadBatches: packets.quadBatches }),
        transforms: frame.transforms,
        ...(frame.quadInstanceFloats.length === 0
            ? {}
            : {
                quads: createQuadSnapshotBuffers({
                    instanceFloats: frame.quadInstanceFloats,
                    instanceWords: frame.quadInstanceWords,
                }),
            }),
        ...(frame.instanceTints.length === 0
            ? {}
            : { instanceTints: frame.instanceTints }),
        viewMatrices: frame.viewMatrices,
        diagnostics,
        report: {
            views: packets.views.length,
            meshDraws: packets.meshDraws.length,
            ...(packets.shadowCasterDraws === undefined
                ? {}
                : { shadowCasterDraws: packets.shadowCasterDraws.length }),
            lights: packets.lights.length,
            environments: packets.environments.length,
            fogs: packets.fogs?.length ?? 0,
            particleEmitters: packets.particleEmitters?.length ?? 0,
            audioEmitters: packets.audioEmitters?.length ?? 0,
            shadowRequests: packets.shadowRequests.length,
            bounds: packets.bounds.length,
            quadBatches: packets.quadBatches?.length ?? 0,
            quadInstances: frame.quadInstanceFloats.length / QUAD_INSTANCE_FLOAT_STRIDE,
            diagnostics: diagnostics.length,
        },
    };
}
function decodeSharedSnapshotPackets(shared, bufferIndex, words, registrySnapshot) {
    const cache = getSharedSnapshotPacketDecodeCache(shared);
    const cached = cache.entriesByBufferIndex.get(bufferIndex);
    if (cached !== undefined &&
        cached.registry === registrySnapshot &&
        uint32ArraysEqual(cached.words, words)) {
        return cached.packets;
    }
    const registry = createSnapshotPacketRegistry(registrySnapshot);
    const packets = decodeSnapshotPackets(words, registry);
    cache.entriesByBufferIndex.set(bufferIndex, {
        registry: registrySnapshot,
        words: new Uint32Array(words),
        packets,
    });
    return packets;
}
function getSharedSnapshotPacketDecodeCache(shared) {
    const cached = SHARED_SNAPSHOT_PACKET_DECODE_CACHES.get(shared);
    if (cached !== undefined) {
        return cached;
    }
    const cache = {
        entriesByBufferIndex: new Map(),
    };
    SHARED_SNAPSHOT_PACKET_DECODE_CACHES.set(shared, cache);
    return cache;
}
function uint32ArraysEqual(a, b) {
    if (a.length !== b.length) {
        return false;
    }
    for (let index = 0; index < a.length; index += 1) {
        if (a[index] !== b[index]) {
            return false;
        }
    }
    return true;
}
export function hasWebGpuAppSharedSnapshotPayload(message) {
    return readSharedSnapshotFramePayload(message) !== null;
}
export function readWebGpuAppSnapshotChangeSet(message) {
    if (!isRecord(message)) {
        return null;
    }
    const topLevel = message.changeSet;
    if (isRenderSnapshotChangeSet(topLevel)) {
        return topLevel;
    }
    const transport = message.transport;
    const transportChangeSet = isRecord(transport)
        ? transport.changeSet
        : undefined;
    return isRenderSnapshotChangeSet(transportChangeSet)
        ? transportChangeSet
        : null;
}
function createSharedSnapshotTransportOptions(options = {}, mode) {
    const maxEntities = options.maxEntities ?? 16_384;
    const maxViews = options.maxViews ?? 8;
    const maxInstanceTints = options.maxInstanceTints ?? maxEntities;
    const maxQuadInstances = options.maxQuadInstances ?? maxEntities;
    const maxPacketWords = options.maxPacketWords ??
        defaultSharedSnapshotPacketWords({
            maxEntities,
            maxViews,
        });
    return {
        maxEntities,
        maxViews,
        maxInstanceTints,
        maxQuadInstances,
        maxPacketWords,
        ...createCrossOriginIsolationOptions(options, mode),
        ...(options.sharedArrayBufferConstructor === undefined
            ? {}
            : {
                sharedArrayBufferConstructor: options.sharedArrayBufferConstructor ?? null,
            }),
    };
}
function createCrossOriginIsolationOptions(options, mode) {
    if (mode !== "auto") {
        return {
            ...(options.requireCrossOriginIsolated === undefined
                ? {}
                : { requireCrossOriginIsolated: options.requireCrossOriginIsolated }),
            ...(options.crossOriginIsolated === undefined
                ? {}
                : { crossOriginIsolated: options.crossOriginIsolated }),
        };
    }
    const requireCrossOriginIsolated = options.requireCrossOriginIsolated ?? true;
    const crossOriginIsolated = options.crossOriginIsolated ??
        (typeof globalThis.crossOriginIsolated === "boolean"
            ? globalThis.crossOriginIsolated
            : false);
    return {
        requireCrossOriginIsolated,
        crossOriginIsolated,
    };
}
function defaultSharedSnapshotPacketWords(input) {
    const maxLights = 64;
    const maxEnvironments = 16;
    const maxFogs = 16;
    const maxShadowRequests = 64;
    return (SNAPSHOT_PACKET_HEADER_WORDS +
        input.maxViews * VIEW_PACKET_WORDS +
        input.maxEntities * MESH_DRAW_PACKET_WORDS +
        input.maxEntities * MESH_DRAW_PACKET_WORDS +
        input.maxEntities * PARTICLE_EMITTER_PACKET_WORDS +
        input.maxEntities * AUDIO_EMITTER_PACKET_WORDS +
        AUDIO_LISTENER_PACKET_WORDS +
        input.maxEntities * QUAD_BATCH_PACKET_WORDS +
        maxLights * LIGHT_PACKET_WORDS +
        maxEnvironments * ENVIRONMENT_PACKET_WORDS +
        maxFogs * FOG_PACKET_WORDS +
        maxShadowRequests * SHADOW_REQUEST_PACKET_WORDS +
        input.maxEntities * BOUNDS_PACKET_WORDS);
}
function readSharedSnapshotFramePayload(message) {
    if (!isRecord(message)) {
        return null;
    }
    const transport = message.transport;
    if (!isRecord(transport) || transport.mode !== "shared-array-buffer") {
        return null;
    }
    if (!isRegistrySnapshot(transport.registry)) {
        throw new Error("SharedArrayBuffer snapshot event is missing a packet registry snapshot.");
    }
    return {
        mode: "shared-array-buffer",
        registry: transport.registry,
        ...(Array.isArray(transport.diagnostics)
            ? { diagnostics: transport.diagnostics }
            : {}),
    };
}
function readSharedSnapshotMessageFrame(message) {
    if (!isRecord(message)) {
        return null;
    }
    if (typeof message.frame === "number" && Number.isFinite(message.frame)) {
        return message.frame;
    }
    const snapshot = message.snapshot;
    if (isRecord(snapshot) &&
        typeof snapshot.frame === "number" &&
        Number.isFinite(snapshot.frame)) {
        return snapshot.frame;
    }
    return null;
}
function isRegistrySnapshot(value) {
    if (!isRecord(value)) {
        return false;
    }
    return Array.isArray(value.strings) && Array.isArray(value.handles);
}
function isRecord(value) {
    return typeof value === "object" && value !== null;
}
function isRenderSnapshotChangeSet(value) {
    if (!isRecord(value)) {
        return false;
    }
    return ((value.previousFrame === null || Number.isInteger(value.previousFrame)) &&
        Number.isInteger(value.frame) &&
        isFamilyCounts(value.views) &&
        isFamilyCounts(value.meshDraws) &&
        isFamilyCounts(value.shadowCasterDraws) &&
        isFamilyCounts(value.lights) &&
        isFamilyCounts(value.environments) &&
        isFamilyCounts(value.shadowRequests) &&
        isFamilyCounts(value.bounds) &&
        isFamilyCounts(value.total));
}
function isFamilyCounts(value) {
    return (isRecord(value) &&
        Number.isInteger(value.changed) &&
        Number.isInteger(value.unchanged) &&
        Number.isInteger(value.removed));
}
//# sourceMappingURL=app-snapshot-transport.js.map