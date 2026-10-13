import type { GltfReportDrivenGlbSourceStatusJsonValue } from "./gltf-report-driven-import.js";
export type GlbSourceLoaderStatusKind = "pending" | "loaded" | "failed" | "blocked";
export type GlbSourceLoaderSourceKind = "glb" | "gltf" | "unknown";
export interface GlbSourceLoaderDiagnostic {
    readonly code: string;
    readonly severity: "error" | "warning" | "info";
    readonly message: string;
    readonly uri?: string;
}
export interface GlbSourceLoaderExternalBufferStatus {
    readonly uri: string;
    readonly status: GlbSourceLoaderStatusKind;
    readonly byteLength: number | null;
    readonly diagnosticCode?: string;
}
export interface GlbSourceLoaderStatusJsonValue {
    readonly status: GlbSourceLoaderStatusKind;
    readonly sourceKind: GlbSourceLoaderSourceKind;
    readonly byteLength: number | null;
    readonly externalBuffers: readonly GlbSourceLoaderExternalBufferStatus[];
    readonly diagnostics: readonly GlbSourceLoaderDiagnostic[];
    readonly glbSourceStatus: GltfReportDrivenGlbSourceStatusJsonValue | null;
}
export interface CreateGlbSourceLoaderStatusOptions {
    readonly status: GlbSourceLoaderStatusKind;
    readonly sourceKind?: GlbSourceLoaderSourceKind;
    readonly byteLength?: number | null;
    readonly externalBuffers?: readonly GlbSourceLoaderExternalBufferStatus[];
    readonly diagnostics?: readonly GlbSourceLoaderDiagnostic[];
    readonly glbSourceStatus?: GltfReportDrivenGlbSourceStatusJsonValue | null;
}
export declare function createGlbSourceLoaderStatusJsonValue(options: CreateGlbSourceLoaderStatusOptions): GlbSourceLoaderStatusJsonValue;
//# sourceMappingURL=glb-source-loader-status.d.ts.map