export interface LocalLightAtlasSlotRequest {
    readonly allocationKey: string;
    readonly lightId: number;
    readonly shadowId: number;
    readonly width: number;
    readonly height: number;
    readonly priority?: number;
}
export interface LocalLightAtlasSlotRegion {
    readonly originX: number;
    readonly originY: number;
    readonly width: number;
    readonly height: number;
}
export interface LocalLightAtlasSlotTile extends LocalLightAtlasSlotRegion {
    readonly allocationKey: string;
    readonly lightId: number;
    readonly shadowId: number;
    readonly slotIndex: number;
    readonly reused: boolean;
}
export interface LocalLightAtlasStoredSlot extends LocalLightAtlasSlotRegion {
    readonly allocationKey: string;
    readonly lightId: number;
    readonly shadowId: number;
    readonly lastUsedGeneration: number;
}
export interface LocalLightAtlasSlotAllocatorState {
    atlasWidth: number;
    atlasHeight: number;
    generation: number;
    maxStaleGenerations: number;
    slots: LocalLightAtlasStoredSlot[];
}
export interface LocalLightAtlasSlotAllocatorOptions {
    readonly atlasWidth: number;
    readonly atlasHeight: number;
    readonly maxStaleGenerations?: number;
}
export interface LocalLightAtlasSlotAllocationDiagnostic {
    readonly code: "localLightAtlasSlot.invalidRequest" | "localLightAtlasSlot.slotUnavailable";
    readonly allocationKey: string;
    readonly message: string;
}
export interface LocalLightAtlasSlotAllocationReport {
    readonly ready: boolean;
    readonly atlasWidth: number;
    readonly atlasHeight: number;
    readonly generation: number;
    readonly requestedSlotCount: number;
    readonly assignedSlotCount: number;
    readonly storedSlotCount: number;
    readonly reusedSlotCount: number;
    readonly reassignedSlotCount: number;
    readonly staleSlotCount: number;
    readonly evictedSlotCount: number;
    readonly tiles: readonly LocalLightAtlasSlotTile[];
    readonly diagnostics: readonly LocalLightAtlasSlotAllocationDiagnostic[];
}
export declare function createLocalLightAtlasSlotAllocatorState(options: LocalLightAtlasSlotAllocatorOptions): LocalLightAtlasSlotAllocatorState;
export declare function allocateLocalLightAtlasSlots(options: {
    readonly state: LocalLightAtlasSlotAllocatorState;
    readonly requests: readonly LocalLightAtlasSlotRequest[];
}): LocalLightAtlasSlotAllocationReport;
//# sourceMappingURL=local-light-atlas-slot-allocator.d.ts.map