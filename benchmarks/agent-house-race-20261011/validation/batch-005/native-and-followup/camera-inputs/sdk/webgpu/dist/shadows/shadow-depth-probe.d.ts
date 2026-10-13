import type { ShadowDepthTextureResourceReport } from "./shadow-depth-texture-resource.js";
import type { ShadowPassCommandBufferSubmissionReport } from "./shadow-pass-command-buffer-submission-report.js";
import type { ShadowSamplerResourceReport } from "../materials/standard/standard-material-shadow-bind-group.js";
export type ShadowDepthProbeStatus = "ready" | "missing" | "not-required";
export type ShadowDepthProbeDiagnosticCode = "shadowDepthProbe.missingProjectionSamples" | "shadowDepthProbe.missingDepthTextureResource" | "shadowDepthProbe.missingSamplerResource" | "shadowDepthProbe.shadowPassNotSubmitted" | "shadowDepthProbe.missingDeviceSupport" | "shadowDepthProbe.pipelineCreationFailed" | "shadowDepthProbe.bindGroupCreationFailed" | "shadowDepthProbe.commandSubmissionFailed" | "shadowDepthProbe.readbackFailed" | "shadowDepthProbe.noStrictPair";
export interface ShadowDepthProbeDiagnostic {
    readonly code: ShadowDepthProbeDiagnosticCode;
    readonly severity: "warning" | "error";
    readonly message: string;
    readonly sampleKey?: string;
}
export interface ShadowDepthProbeProjectionSample {
    readonly key: string;
    readonly role: string;
    readonly shape: string;
    readonly uv: readonly [number, number];
    readonly depth: number;
    readonly insideProjection: boolean;
    readonly projectionDistance: number;
}
export interface ShadowDepthProbeRecord {
    readonly key: string;
    readonly role: string;
    readonly shape: string;
    readonly uv: readonly [number, number];
    readonly texel: readonly [number, number];
    readonly projectionDepth: number;
    readonly receiverCompareDepth: number;
    readonly sampledDepth: number;
    readonly compareResult: number;
    readonly expected: "lit" | "shadowed";
    readonly insideProjection: boolean;
    readonly projectionDistance: number;
}
export interface ShadowDepthProbeStrictPair {
    readonly receiverKey: string;
    readonly casterKey: string;
    readonly receiverCompareDepth: number;
    readonly receiverSampledDepth: number;
    readonly receiverCompareResult: number;
    readonly casterProjectionDepth: number;
    readonly uvDistance: number;
    readonly expectedReceiver: "shadowed";
}
export interface ShadowDepthProbeReport {
    readonly ready: boolean;
    readonly status: ShadowDepthProbeStatus;
    readonly sampleCount: number;
    readonly probedSampleCount: number;
    readonly sections: {
        readonly projectionCoverage: boolean;
        readonly depthTextureResource: boolean;
        readonly samplerResource: boolean;
        readonly commandBufferSubmission: boolean;
        readonly probeShader: boolean;
        readonly readback: boolean;
    };
    readonly records: readonly ShadowDepthProbeRecord[];
    readonly strictPair: ShadowDepthProbeStrictPair | null;
    readonly diagnostics: readonly ShadowDepthProbeDiagnostic[];
}
export type ShadowDepthProbeReportJsonValue = ShadowDepthProbeReport;
export interface ShadowDepthProbeDeviceLike {
    readonly createShaderModule?: (descriptor: unknown) => unknown;
    readonly createComputePipeline?: (descriptor: unknown) => {
        getBindGroupLayout?: (index: number) => unknown;
    };
    readonly createBindGroup?: (descriptor: unknown) => unknown;
    readonly createBuffer?: (descriptor: unknown) => ShadowDepthProbeBufferLike;
    readonly createCommandEncoder?: () => ShadowDepthProbeCommandEncoderLike;
    readonly queue?: {
        readonly writeBuffer?: (buffer: unknown, bufferOffset: number, data: ArrayBufferLike | ArrayBufferView, dataOffset?: number, size?: number) => void;
        readonly submit?: (commandBuffers: Iterable<unknown>) => void;
        readonly onSubmittedWorkDone?: () => Promise<void>;
    };
}
export interface ShadowDepthProbeBufferLike {
    readonly mapAsync?: (mode: number) => Promise<void>;
    readonly getMappedRange?: () => ArrayBuffer;
    readonly unmap?: () => void;
}
export interface ShadowDepthProbeCommandEncoderLike {
    readonly beginComputePass?: (descriptor?: unknown) => {
        setPipeline?: (pipeline: unknown) => void;
        setBindGroup?: (index: number, bindGroup: unknown) => void;
        dispatchWorkgroups?: (x: number, y?: number, z?: number) => void;
        end?: () => void;
    };
    readonly copyBufferToBuffer?: (source: unknown, sourceOffset: number, destination: unknown, destinationOffset: number, size: number) => void;
    readonly finish?: () => unknown;
}
export interface CreateShadowDepthProbeReportOptions {
    readonly device: ShadowDepthProbeDeviceLike;
    readonly samples: readonly ShadowDepthProbeProjectionSample[];
    readonly depthTextureResources: ShadowDepthTextureResourceReport;
    readonly samplerResource: ShadowSamplerResourceReport;
    readonly commandBufferSubmission: ShadowPassCommandBufferSubmissionReport;
    readonly depthBias?: number;
    readonly mapModeRead?: number;
}
export declare function createShadowDepthProbeReport(options: CreateShadowDepthProbeReportOptions): Promise<ShadowDepthProbeReport>;
export declare function shadowDepthProbeReportToJsonValue(report: ShadowDepthProbeReport): ShadowDepthProbeReportJsonValue;
export declare function shadowDepthProbeReportToJson(report: ShadowDepthProbeReport): string;
//# sourceMappingURL=shadow-depth-probe.d.ts.map