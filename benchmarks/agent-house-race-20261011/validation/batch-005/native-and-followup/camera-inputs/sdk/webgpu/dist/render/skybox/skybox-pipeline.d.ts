import { type WebGpuShaderDeviceLike, type WebGpuShaderDiagnostic, type WebGpuShaderFailureReason } from "../../gpu/shader.js";
import type { WebGpuRenderPipelineCreateDescriptor, WebGpuRenderPipelineDeviceLike } from "../../gpu/pipeline-cache.js";
export declare const SKYBOX_PIPELINE_KEY = "aperture/skybox";
export declare const SKYBOX_WGSL: string;
export interface CreateSkyboxRenderPipelineResourceOptions {
    readonly device: SkyboxRenderPipelineDeviceLike;
    readonly colorFormat: string;
    readonly depthFormat?: string | null;
    readonly sampleCount?: number;
}
export type SkyboxRenderPipelineDiagnosticCode = "skyboxRenderPipeline.shaderDiagnostic" | "skyboxRenderPipeline.shaderCreationFailed" | "skyboxRenderPipeline.createRenderPipelineUnavailable" | "skyboxRenderPipeline.pipelineCreationFailed";
export interface SkyboxRenderPipelineDiagnostic {
    readonly code: SkyboxRenderPipelineDiagnosticCode;
    readonly message: string;
    readonly reason?: WebGpuShaderFailureReason;
    readonly severity?: WebGpuShaderDiagnostic["severity"];
}
export interface SkyboxRenderPipelineResource {
    readonly cacheKey: string;
    readonly shaderModule: unknown;
    readonly pipeline: unknown;
    readonly descriptor: WebGpuRenderPipelineCreateDescriptor;
}
export interface CreateSkyboxRenderPipelineResourceResult {
    readonly valid: boolean;
    readonly resource: SkyboxRenderPipelineResource | null;
    readonly diagnostics: readonly SkyboxRenderPipelineDiagnostic[];
}
export interface SkyboxRenderPipelineDeviceLike extends WebGpuShaderDeviceLike, WebGpuRenderPipelineDeviceLike {
}
export declare function createSkyboxRenderPipelineResource(options: CreateSkyboxRenderPipelineResourceOptions): Promise<CreateSkyboxRenderPipelineResourceResult>;
export declare function skyboxPipelineCacheKey(colorFormat: string, depthFormat: string | null, sampleCount?: number): string;
//# sourceMappingURL=skybox-pipeline.d.ts.map