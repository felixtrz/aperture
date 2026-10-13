import { type RenderDiagnostic, type RenderSnapshot, type RenderSnapshotChangeSet, type SnapshotPacketRegistrySnapshot } from "@aperture-engine/render";
import { type CreateSharedSnapshotTransportOptions, type SharedSnapshotTransport, type SharedSnapshotTransportLayout, type SharedSnapshotTransportUnsupportedReason } from "@aperture-engine/runtime";
export type WebGpuAppSnapshotTransportMode = "auto" | "transferable" | "shared-array-buffer";
export interface WebGpuAppSharedSnapshotTransportOptions extends Partial<CreateSharedSnapshotTransportOptions> {
    readonly maxEntities?: number;
    readonly maxViews?: number;
}
export interface WebGpuAppSnapshotTransportUnsupportedDiagnostic {
    readonly code: "webGpuApp.sharedSnapshotTransportUnsupported";
    readonly reason: SharedSnapshotTransportUnsupportedReason;
    readonly message: string;
}
export interface WebGpuAppSnapshotTransportDiagnostics {
    readonly requested: WebGpuAppSnapshotTransportMode;
    readonly active: WebGpuAppSnapshotTransportMode;
    readonly fallback: "transferable" | null;
    readonly sharedArrayBuffer: {
        readonly supported: true;
        readonly layout: SharedSnapshotTransportLayout;
    } | {
        readonly supported: false;
        readonly diagnostic: WebGpuAppSnapshotTransportUnsupportedDiagnostic;
    } | null;
}
export type WebGpuAppSnapshotTransport = {
    readonly mode: "transferable";
    readonly diagnostics: WebGpuAppSnapshotTransportDiagnostics;
} | {
    readonly mode: "shared-array-buffer";
    readonly shared: SharedSnapshotTransport;
    readonly diagnostics: WebGpuAppSnapshotTransportDiagnostics;
};
export interface WebGpuAppSnapshotTransportStartPayload {
    readonly mode: "shared-array-buffer";
    readonly layout: SharedSnapshotTransportLayout;
    readonly headerBuffer: SharedArrayBuffer;
    readonly transformBuffer: SharedArrayBuffer;
    readonly instanceTintBuffer: SharedArrayBuffer;
    readonly viewMatrixBuffer: SharedArrayBuffer;
    readonly quadInstanceFloatBuffer: SharedArrayBuffer;
    readonly quadInstanceWordBuffer: SharedArrayBuffer;
    readonly packetBuffer: SharedArrayBuffer;
}
export interface WebGpuAppSharedSnapshotFramePayload {
    readonly mode: "shared-array-buffer";
    readonly sequence?: number;
    readonly registry: SnapshotPacketRegistrySnapshot;
    readonly diagnostics?: readonly RenderDiagnostic[];
}
export interface ReadWebGpuAppSharedSnapshotOptions {
    /**
     * Strict message-frame reads are useful for protocol tests and event-driven
     * fallback. RAF presentation should sample the latest complete shared frame.
     */
    readonly requireMessageFrame?: boolean;
    /** Verify the exact publication, including refreshes at the same frame number. */
    readonly requireMessageSequence?: boolean;
}
export declare function createWebGpuAppSnapshotTransport(options: {
    readonly mode?: WebGpuAppSnapshotTransportMode;
    readonly sharedSnapshotTransport?: WebGpuAppSharedSnapshotTransportOptions;
}): WebGpuAppSnapshotTransport;
export declare function createWebGpuAppSnapshotTransportStartPayload(transport: WebGpuAppSnapshotTransport): WebGpuAppSnapshotTransportStartPayload | null;
export declare function readWebGpuAppSharedSnapshot(transport: WebGpuAppSnapshotTransport, message: unknown, options?: ReadWebGpuAppSharedSnapshotOptions): RenderSnapshot | null;
export declare function hasWebGpuAppSharedSnapshotPayload(message: unknown): boolean;
export declare function readWebGpuAppSnapshotChangeSet(message: unknown): RenderSnapshotChangeSet | null;
//# sourceMappingURL=app-snapshot-transport.d.ts.map