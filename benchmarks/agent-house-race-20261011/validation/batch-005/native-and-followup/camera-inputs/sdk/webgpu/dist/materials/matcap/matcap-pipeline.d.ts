import type { BatchCompatibilityKey } from "@aperture-engine/render";
import type { WebGpuRenderPipelineCreateDescriptor, WebGpuRenderPipelineDeviceLike } from "../../gpu/pipeline-cache.js";
import { type WebGpuShaderDeviceLike, type WebGpuShaderDiagnostic, type WebGpuShaderFailureReason } from "../../gpu/shader.js";
import { type TonemapOperator } from "../../output/output-stage-tonemap.js";
import type { OutputColorSpace } from "../../output/output-stage-color-space.js";
import type { BuiltInShaderSourceModule } from "../unlit/unlit-shader.js";
export type MatcapRenderPipelineDiagnosticCode = "matcapRenderPipeline.shaderDiagnostic" | "matcapRenderPipeline.shaderCreationFailed" | "matcapRenderPipeline.descriptorPlanFailed" | "matcapRenderPipeline.createRenderPipelineUnavailable" | "matcapRenderPipeline.pipelineCreationFailed";
export interface MatcapRenderPipelineDiagnostic {
    readonly code: MatcapRenderPipelineDiagnosticCode;
    readonly message: string;
    readonly reason?: WebGpuShaderFailureReason;
    readonly severity?: WebGpuShaderDiagnostic["severity"];
    readonly field?: string;
}
export interface BrowserMatcapRenderPipelineDescriptorInput {
    readonly shaderModule: unknown;
    readonly shader?: BuiltInShaderSourceModule;
    readonly colorFormat: string;
    readonly motionVectorColorFormat?: string | null;
    readonly depthFormat?: string | null;
    readonly sampleCount?: number;
    readonly batchKey?: BatchCompatibilityKey;
}
export interface CreateMatcapRenderPipelineResourceOptions {
    readonly device: MatcapRenderPipelineDeviceLike;
    readonly colorFormat: string;
    readonly motionVectorColorFormat?: string | null;
    readonly depthFormat?: string | null;
    readonly sampleCount?: number;
    readonly batchKey: BatchCompatibilityKey;
    readonly shader?: BuiltInShaderSourceModule;
    readonly tonemap?: TonemapOperator;
    readonly outputColorSpace?: OutputColorSpace;
}
export interface MatcapRenderPipelineResource {
    readonly cacheKey: string;
    readonly shaderModule: unknown;
    readonly pipeline: unknown;
    readonly descriptor: WebGpuRenderPipelineCreateDescriptor;
}
export interface CreateMatcapRenderPipelineResourceResult {
    readonly valid: boolean;
    readonly resource: MatcapRenderPipelineResource | null;
    readonly diagnostics: readonly MatcapRenderPipelineDiagnostic[];
}
export interface MatcapRenderPipelineDeviceLike extends WebGpuShaderDeviceLike, WebGpuRenderPipelineDeviceLike {
}
export declare function createMatcapRenderPipelineResource(options: CreateMatcapRenderPipelineResourceOptions): Promise<CreateMatcapRenderPipelineResourceResult>;
export declare function createBrowserMatcapRenderPipelineDescriptor(input: BrowserMatcapRenderPipelineDescriptorInput): WebGpuRenderPipelineCreateDescriptor;
//# sourceMappingURL=matcap-pipeline.d.ts.map