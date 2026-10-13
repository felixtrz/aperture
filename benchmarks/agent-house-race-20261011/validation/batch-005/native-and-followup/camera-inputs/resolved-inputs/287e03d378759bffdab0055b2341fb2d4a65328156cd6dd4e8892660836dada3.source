import { batchFlags, boolState, queueId, queueValue, readBoolState, readEntity, readFloat64, readOptionalUint32, readRequiredHandle, readSigned32, topologyId, topologyValue, writeEntity, writeFloat64, writeOptionalUint32, writeSigned32, } from "./snapshot-packed-codec-utils.js";
export function writeMeshDrawPacket(words, offset, packet, registry) {
    words[offset] = packet.renderId >>> 0;
    writeEntity(words, offset + 1, packet.entity);
    words[offset + 3] = registry.handleId(packet.mesh) >>> 0;
    words[offset + 4] = registry.handleId(packet.material) >>> 0;
    words[offset + 5] = packet.submesh >>> 0;
    words[offset + 6] = packet.materialSlot >>> 0;
    words[offset + 7] = packet.worldTransformOffset >>> 0;
    writeOptionalUint32(words, offset + 8, packet.instanceTintOffset);
    words[offset + 9] = packet.boundsIndex >>> 0;
    words[offset + 10] = packet.layerMask >>> 0;
    words[offset + 11] = boolState(packet.castsShadow);
    words[offset + 12] = boolState(packet.receivesShadow);
    words[offset + 13] = queueId(packet.sortKey.queue);
    words[offset + 14] = packet.sortKey.viewId >>> 0;
    writeSigned32(words, offset + 15, packet.sortKey.layer);
    writeSigned32(words, offset + 16, packet.sortKey.order);
    words[offset + 17] = registry.stringId(packet.sortKey.pipelineKey);
    words[offset + 18] = registry.stringId(packet.sortKey.materialKey);
    words[offset + 19] = registry.stringId(packet.sortKey.meshKey);
    writeFloat64(words, offset + 20, packet.sortKey.depth);
    words[offset + 22] = packet.sortKey.stableId >>> 0;
    words[offset + 23] = registry.stringId(packet.batchKey.pipelineKey);
    words[offset + 24] = registry.stringId(packet.batchKey.materialKey);
    words[offset + 25] = registry.stringId(packet.batchKey.meshLayoutKey);
    words[offset + 26] = topologyId(packet.batchKey.topology);
    words[offset + 27] = batchFlags(packet);
    writeOptionalUint32(words, offset + 28, packet.boneMatrixOffset);
    writeOptionalUint32(words, offset + 29, packet.boneMatrixCount);
    writeOptionalUint32(words, offset + 30, packet.vertexStart);
    writeOptionalUint32(words, offset + 31, packet.vertexCount);
    writeOptionalUint32(words, offset + 32, packet.indexStart);
    writeOptionalUint32(words, offset + 33, packet.indexCount);
}
export function readMeshDrawPacket(words, offset, registry) {
    const instanceTintOffset = readOptionalUint32(words, offset + 8);
    const castsShadow = readBoolState(words[offset + 11] ?? 0);
    const receivesShadow = readBoolState(words[offset + 12] ?? 0);
    const batchFlags = words[offset + 27] ?? 0;
    const boneMatrixOffset = readOptionalUint32(words, offset + 28);
    const boneMatrixCount = readOptionalUint32(words, offset + 29);
    const vertexStart = readOptionalUint32(words, offset + 30);
    const vertexCount = readOptionalUint32(words, offset + 31);
    const indexStart = readOptionalUint32(words, offset + 32);
    const indexCount = readOptionalUint32(words, offset + 33);
    const packet = {
        renderId: words[offset] ?? 0,
        entity: readEntity(words, offset + 1),
        mesh: readRequiredHandle(registry, words[offset + 3] ?? 0, "mesh"),
        material: readRequiredHandle(registry, words[offset + 4] ?? 0, "material"),
        submesh: words[offset + 5] ?? 0,
        materialSlot: words[offset + 6] ?? 0,
        worldTransformOffset: words[offset + 7] ?? 0,
        boundsIndex: words[offset + 9] ?? 0,
        layerMask: words[offset + 10] ?? 0,
        sortKey: {
            queue: queueValue(words[offset + 13] ?? 0),
            viewId: words[offset + 14] ?? 0,
            layer: readSigned32(words, offset + 15),
            order: readSigned32(words, offset + 16),
            pipelineKey: registry.stringValue(words[offset + 17] ?? 0),
            materialKey: registry.stringValue(words[offset + 18] ?? 0),
            meshKey: registry.stringValue(words[offset + 19] ?? 0),
            depth: readFloat64(words, offset + 20),
            stableId: words[offset + 22] ?? 0,
        },
        batchKey: {
            pipelineKey: registry.stringValue(words[offset + 23] ?? 0),
            materialKey: registry.stringValue(words[offset + 24] ?? 0),
            meshLayoutKey: registry.stringValue(words[offset + 25] ?? 0),
            topology: topologyValue(words[offset + 26] ?? 0),
            instanced: (batchFlags & 1) !== 0,
            skinned: (batchFlags & 2) !== 0,
            morphed: (batchFlags & 4) !== 0,
        },
    };
    return {
        ...packet,
        ...(instanceTintOffset === undefined ? {} : { instanceTintOffset }),
        ...(boneMatrixOffset === undefined ? {} : { boneMatrixOffset }),
        ...(boneMatrixCount === undefined ? {} : { boneMatrixCount }),
        ...(vertexStart === undefined ? {} : { vertexStart }),
        ...(vertexCount === undefined ? {} : { vertexCount }),
        ...(indexStart === undefined ? {} : { indexStart }),
        ...(indexCount === undefined ? {} : { indexCount }),
        ...(castsShadow === undefined ? {} : { castsShadow }),
        ...(receivesShadow === undefined ? {} : { receivesShadow }),
        ...((batchFlags & 8) === 0 ? {} : { occlusionQuery: true }),
    };
}
//# sourceMappingURL=snapshot-packed-mesh-codec.js.map