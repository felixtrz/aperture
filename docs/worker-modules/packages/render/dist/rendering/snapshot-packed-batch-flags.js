export function batchFlags(packet) {
    return ((packet.batchKey.instanced ? 1 : 0) |
        (packet.batchKey.skinned ? 2 : 0) |
        (packet.batchKey.morphed ? 4 : 0) |
        (packet.occlusionQuery === true ? 8 : 0));
}
//# sourceMappingURL=snapshot-packed-batch-flags.js.map