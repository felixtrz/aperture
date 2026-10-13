export interface BuiltInMaterialQueuePhaseEntityRef {
    readonly index: number;
    readonly generation: number;
}
export interface BuiltInMaterialQueuePhaseItem {
    readonly renderId: number;
    readonly drawIndex: number;
    readonly renderPhase: string;
    readonly materialFamily: string;
    readonly pipelineKey: string;
    readonly entity?: BuiltInMaterialQueuePhaseEntityRef;
}
export type BuiltInMaterialQueuePhaseDiagnosticCode = "webGpuApp.unsupportedMaterialQueuePhase" | "webGpuApp.unsupportedMaterialQueueAlphaTestFamily" | "webGpuApp.unsupportedMaterialQueueTransparentFamily" | "webGpuApp.unsupportedMaterialQueueBlendPreset";
export interface BuiltInMaterialQueuePhaseDiagnostic {
    readonly code: BuiltInMaterialQueuePhaseDiagnosticCode;
    readonly message: string;
    readonly renderId: number;
    readonly drawIndex: number;
    readonly materialFamily: string;
    readonly renderPhase?: string;
    readonly blendPreset?: string | null;
    readonly entity?: BuiltInMaterialQueuePhaseEntityRef;
}
export declare function createUnsupportedBuiltInMaterialQueuePhaseDiagnostic(queueItem: BuiltInMaterialQueuePhaseItem): BuiltInMaterialQueuePhaseDiagnostic | null;
//# sourceMappingURL=built-in-material-queue-phase.d.ts.map