import { createStableRenderId, } from "@aperture-engine/render";
export const WEBGPU_ID_BUFFER_FORMAT = "r32uint";
export const WEBGPU_ID_BUFFER_EMPTY_ID = 0xffff_ffff;
export function createWebGpuIdBufferIdForEntity(entity) {
    return createStableRenderId(entity) >>> 0;
}
export function createWebGpuIdBufferEntry(draw) {
    return {
        renderId: draw.renderId,
        entity: draw.entity,
        id: createWebGpuIdBufferIdForEntity(draw.entity),
    };
}
export function createWebGpuIdBufferEntries(draws) {
    return draws.map((draw) => createWebGpuIdBufferEntry(draw));
}
export function findWebGpuIdBufferEntry(entries, id) {
    for (const entry of entries) {
        if (entry.id === id) {
            return entry;
        }
    }
    return null;
}
//# sourceMappingURL=id-buffer.js.map