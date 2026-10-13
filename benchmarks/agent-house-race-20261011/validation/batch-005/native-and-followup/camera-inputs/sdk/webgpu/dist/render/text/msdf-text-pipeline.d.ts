import { type WebGpuShaderDeviceLike, type WebGpuShaderDiagnostic, type WebGpuShaderFailureReason } from "../../gpu/shader.js";
import type { WebGpuRenderPipelineCreateDescriptor, WebGpuRenderPipelineDeviceLike } from "../../gpu/pipeline-cache.js";
import { type TonemapOperator } from "../../output/output-stage-tonemap.js";
import { type OutputColorSpace } from "../../output/output-stage-color-space.js";
export declare const MSDF_TEXT_PIPELINE_KEY = "aperture/msdf-text";
export declare const MSDF_TEXT_WGSL: string;
export interface CreateMsdfTextRenderPipelineResourceOptions {
    readonly device: MsdfTextRenderPipelineDeviceLike;
    readonly colorFormat: string;
    readonly depthFormat?: string | null;
    readonly sampleCount?: number;
    readonly tonemap?: TonemapOperator;
    readonly outputColorSpace?: OutputColorSpace;
}
export type MsdfTextRenderPipelineDiagnosticCode = "msdfTextRenderPipeline.shaderDiagnostic" | "msdfTextRenderPipeline.shaderCreationFailed" | "msdfTextRenderPipeline.createRenderPipelineUnavailable" | "msdfTextRenderPipeline.pipelineCreationFailed";
export interface MsdfTextRenderPipelineDiagnostic {
    readonly code: MsdfTextRenderPipelineDiagnosticCode;
    readonly message: string;
    readonly reason?: WebGpuShaderFailureReason;
    readonly severity?: WebGpuShaderDiagnostic["severity"];
}
export interface MsdfTextRenderPipelineResource {
    readonly cacheKey: string;
    readonly shaderModule: unknown;
    readonly pipeline: unknown;
    readonly descriptor: WebGpuRenderPipelineCreateDescriptor;
}
export interface CreateMsdfTextRenderPipelineResourceResult {
    readonly valid: boolean;
    readonly resource: MsdfTextRenderPipelineResource | null;
    readonly diagnostics: readonly MsdfTextRenderPipelineDiagnostic[];
}
export interface MsdfTextRenderPipelineDeviceLike extends WebGpuShaderDeviceLike, WebGpuRenderPipelineDeviceLike {
}
export declare function createMsdfTextRenderPipelineResource(options: CreateMsdfTextRenderPipelineResourceOptions): Promise<CreateMsdfTextRenderPipelineResourceResult>;
export declare function msdfTextPipelineCacheKey(colorFormat: string, depthFormat?: string | null, sampleCount?: number, tonemap?: TonemapOperator, outputColorSpace?: OutputColorSpace): string;
export declare function createBrowserMsdfTextRenderPipelineDescriptor(input: {
    readonly shaderModule: unknown;
    readonly colorFormat: string;
    readonly depthFormat?: string | null;
    readonly sampleCount?: number;
}): WebGpuRenderPipelineCreateDescriptor;
//# sourceMappingURL=msdf-text-pipeline.d.ts.map