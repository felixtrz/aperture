import type { BatchCompatibilityKey } from "@aperture-engine/render";
import type { WebGpuRenderPipelineCreateDescriptor, WebGpuRenderPipelineDeviceLike } from "../../gpu/pipeline-cache.js";
import { type WebGpuShaderDeviceLike, type WebGpuShaderDiagnostic, type WebGpuShaderFailureReason } from "../../gpu/shader.js";
import { type TonemapOperator } from "../../output/output-stage-tonemap.js";
import type { OutputColorSpace } from "../../output/output-stage-color-space.js";
import type { BuiltInShaderSourceModule } from "../unlit/unlit-shader.js";
export type DebugNormalRenderPipelineDiagnosticCode = "debugNormalRenderPipeline.shaderDiagnostic" | "debugNormalRenderPipeline.shaderCreationFailed" | "debugNormalRenderPipeline.descriptorPlanFailed" | "debugNormalRenderPipeline.createRenderPipelineUnavailable" | "debugNormalRenderPipeline.pipelineCreationFailed";
export interface DebugNormalRenderPipelineDiagnostic {
    readonly code: DebugNormalRenderPipelineDiagnosticCode;
    readonly message: string;
    readonly reason?: WebGpuShaderFailureReason;
    readonly severity?: WebGpuShaderDiagnostic["severity"];
    readonly field?: string;
}
export interface BrowserDebugNormalRenderPipelineDescriptorInput {
    readonly shaderModule: unknown;
    readonly shader?: BuiltInShaderSourceModule;
    readonly colorFormat: string;
    readonly motionVectorColorFormat?: string | null;
    readonly depthFormat?: string | null;
    readonly sampleCount?: number;
    readonly batchKey?: BatchCompatibilityKey;
}
export interface CreateDebugNormalRenderPipelineResourceOptions {
    readonly device: DebugNormalRenderPipelineDeviceLike;
    readonly colorFormat: string;
    readonly motionVectorColorFormat?: string | null;
    readonly depthFormat?: string | null;
    readonly sampleCount?: number;
    readonly batchKey: BatchCompatibilityKey;
    readonly shader?: BuiltInShaderSourceModule;
    readonly tonemap?: TonemapOperator;
    readonly outputColorSpace?: OutputColorSpace;
}
export interface DebugNormalRenderPipelineResource {
    readonly cacheKey: string;
    readonly shaderModule: unknown;
    readonly pipeline: unknown;
    readonly descriptor: WebGpuRenderPipelineCreateDescriptor;
}
export interface CreateDebugNormalRenderPipelineResourceResult {
    readonly valid: boolean;
    readonly resource: DebugNormalRenderPipelineResource | null;
    readonly diagnostics: readonly DebugNormalRenderPipelineDiagnostic[];
}
export interface DebugNormalRenderPipelineDeviceLike extends WebGpuShaderDeviceLike, WebGpuRenderPipelineDeviceLike {
}
export declare function createDebugNormalRenderPipelineResource(options: CreateDebugNormalRenderPipelineResourceOptions): Promise<CreateDebugNormalRenderPipelineResourceResult>;
export declare function createBrowserDebugNormalRenderPipelineDescriptor(input: BrowserDebugNormalRenderPipelineDescriptorInput): WebGpuRenderPipelineCreateDescriptor;
//# sourceMappingURL=debug-normal-pipeline.d.ts.map