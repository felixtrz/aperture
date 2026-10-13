import { type MeshDrawPacket, type RenderEntityRef } from "@aperture-engine/render";
export declare const WEBGPU_ID_BUFFER_FORMAT = "r32uint";
export declare const WEBGPU_ID_BUFFER_EMPTY_ID = 4294967295;
export interface WebGpuIdBufferEntry {
    readonly renderId: number;
    readonly entity: RenderEntityRef;
    readonly id: number;
}
export declare function createWebGpuIdBufferIdForEntity(entity: RenderEntityRef): number;
export declare function createWebGpuIdBufferEntry(draw: Pick<MeshDrawPacket, "renderId" | "entity">): WebGpuIdBufferEntry;
export declare function createWebGpuIdBufferEntries(draws: readonly Pick<MeshDrawPacket, "renderId" | "entity">[]): readonly WebGpuIdBufferEntry[];
export declare function findWebGpuIdBufferEntry(entries: readonly WebGpuIdBufferEntry[], id: number): WebGpuIdBufferEntry | null;
//# sourceMappingURL=id-buffer.d.ts.map