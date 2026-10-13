import type { MaterialQueueItem, MeshDrawPacket } from "@aperture-engine/render";
export interface WebGpuAppUnsupportedMaterialQueueDiagnostic {
    readonly code: "webGpuApp.unsupportedMaterialQueueFamily" | "webGpuApp.unsupportedMaterialQueuePhase" | "webGpuApp.unsupportedMaterialQueueAlphaTestFamily" | "webGpuApp.unsupportedMaterialQueueTransparentFamily" | "webGpuApp.unsupportedMaterialQueueBlendPreset" | "webGpuApp.materialQueueAssetMismatch";
    readonly message: string;
    readonly renderId: number;
    readonly drawIndex: number;
    readonly materialFamily?: string;
    readonly materialKind?: string;
    readonly renderPhase?: string;
    readonly blendPreset?: string | null;
    readonly entity?: MeshDrawPacket["entity"];
}
export declare function queuedPrepareRouteDiagnosticToWebGpuAppDiagnostic(diagnostic: unknown, queueItem: MaterialQueueItem): unknown;
//# sourceMappingURL=queued-material-prepare-route-diagnostics.d.ts.map