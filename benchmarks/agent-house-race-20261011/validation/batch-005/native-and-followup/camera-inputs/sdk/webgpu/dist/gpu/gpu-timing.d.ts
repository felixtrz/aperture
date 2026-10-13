export declare const GPU_TIMESTAMP_QUERY_BYTES: number;
export declare const GPU_TIMESTAMP_MAP_READ = 1;
export type GpuTimestampQueryDiagnosticCode = "gpuTiming.timestampQueryUnavailable" | "gpuTiming.invalidQueryCount" | "gpuTiming.missingDeviceSupport" | "gpuTiming.resourceCreationFailed" | "gpuTiming.commandEncodingUnsupported" | "gpuTiming.readbackUnavailable";
export interface GpuTimestampQueryDiagnostic {
    readonly code: GpuTimestampQueryDiagnosticCode;
    readonly severity: "warning" | "error";
    readonly message: string;
}
export interface GpuTimestampFeatureSetLike {
    has?(feature: string): boolean;
}
export interface GpuTimestampQueryDeviceLike {
    readonly features?: GpuTimestampFeatureSetLike;
    readonly pushErrorScope?: (filter: "validation") => void;
    readonly popErrorScope?: () => Promise<{
        readonly message?: string;
    } | null>;
    readonly createQuerySet?: (descriptor: {
        readonly label?: string;
        readonly type: "timestamp";
        readonly count: number;
    }) => unknown;
    readonly createBuffer?: (descriptor: {
        readonly label?: string;
        readonly size: number;
        readonly usage: number;
    }) => GpuTimestampBufferLike;
}
export interface GpuTimestampCommandEncoderLike {
    readonly writeTimestamp?: (querySet: unknown, queryIndex: number) => void;
    readonly resolveQuerySet?: (querySet: unknown, firstQuery: number, queryCount: number, destination: unknown, destinationOffset: number) => void;
    readonly copyBufferToBuffer?: (source: unknown, sourceOffset: number, destination: unknown, destinationOffset: number, size: number) => void;
}
export interface GpuTimestampBufferLike {
    readonly mapAsync?: (mode: number, offset?: number, size?: number) => Promise<void>;
    readonly getMappedRange?: (offset?: number, size?: number) => ArrayBuffer;
    readonly unmap?: () => void;
}
export interface GpuTimestampQueryResources {
    readonly label: string;
    readonly queryCount: number;
    readonly byteLength: number;
    readonly querySet: unknown;
    readonly resolveBuffer: GpuTimestampBufferLike;
    readonly readbackBuffer: GpuTimestampBufferLike;
}
export interface CreateGpuTimestampQueryResourcesOptions {
    readonly device: GpuTimestampQueryDeviceLike;
    readonly label?: string;
    readonly queryCount?: number;
}
export interface CreateGpuTimestampQueryResourcesResult {
    readonly supported: boolean;
    readonly resources: GpuTimestampQueryResources | null;
    readonly diagnostics: readonly GpuTimestampQueryDiagnostic[];
}
export interface GpuTimestampCommandReport {
    readonly valid: boolean;
    readonly diagnostics: readonly GpuTimestampQueryDiagnostic[];
}
export interface GpuTimestampDuration {
    readonly startQuery: number;
    readonly endQuery: number;
    readonly nanoseconds: bigint;
}
export interface GpuTimestampReadbackResult {
    readonly valid: boolean;
    readonly timestamps: readonly bigint[];
    readonly durations: readonly GpuTimestampDuration[];
    readonly diagnostics: readonly GpuTimestampQueryDiagnostic[];
}
export interface GpuPassTiming {
    readonly pass: string;
    readonly startQuery: number;
    readonly endQuery: number;
    readonly microseconds: number;
}
export interface GpuPassTimingReport {
    readonly ready: boolean;
    readonly supported: boolean;
    readonly queryCount: number;
    readonly passes: readonly GpuPassTiming[];
    readonly diagnostics: readonly GpuTimestampQueryDiagnostic[];
}
export declare function createGpuTimestampQueryResources(options: CreateGpuTimestampQueryResourcesOptions): CreateGpuTimestampQueryResourcesResult;
export declare function createGpuTimestampQueryResourcesChecked(options: CreateGpuTimestampQueryResourcesOptions): Promise<CreateGpuTimestampQueryResourcesResult>;
export declare function writeGpuTimestampQuery(encoder: GpuTimestampCommandEncoderLike, resources: GpuTimestampQueryResources, queryIndex: number): GpuTimestampCommandReport;
export declare function resolveGpuTimestampQueries(encoder: GpuTimestampCommandEncoderLike, resources: GpuTimestampQueryResources, queryCount?: number): GpuTimestampCommandReport;
export declare function readGpuTimestampQueryResults(resources: GpuTimestampQueryResources, options?: {
    readonly queryCount?: number;
    readonly mapModeRead?: number;
}): Promise<GpuTimestampReadbackResult>;
/**
 * Creates one additional MAP_READ readback buffer compatible with
 * `resolveGpuTimestampQueries` copies for the given query resources. Frame
 * paths rotate these so a frame never submits a copy into a readback buffer
 * that an earlier in-flight frame still has mapped (or pending map).
 */
export declare function createGpuTimestampReadbackBuffer(options: {
    readonly device: GpuTimestampQueryDeviceLike;
    readonly label: string;
    readonly byteLength: number;
}): GpuTimestampBufferLike | null;
export declare function createGpuPassTimingReport(options: {
    readonly passNames: readonly string[];
    readonly readback: GpuTimestampReadbackResult;
    readonly diagnostics?: readonly GpuTimestampQueryDiagnostic[];
}): GpuPassTimingReport;
export declare function createUnsupportedGpuPassTimingReport(options: {
    readonly queryCount: number;
    readonly diagnostics: readonly GpuTimestampQueryDiagnostic[];
}): GpuPassTimingReport;
//# sourceMappingURL=gpu-timing.d.ts.map