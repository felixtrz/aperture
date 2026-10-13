import { type WebGpuShaderDeviceLike, type WebGpuShaderDiagnostic, type WebGpuShaderFailureReason } from "../../gpu/shader.js";
import type { WebGpuRenderPipelineCreateDescriptor, WebGpuRenderPipelineDeviceLike } from "../../gpu/pipeline-cache.js";
export declare const PROCEDURAL_SKY_PIPELINE_KEY = "aperture/procedural-sky";
export declare const PROCEDURAL_SKY_UNIFORM_FLOAT_COUNT = 44;
export declare const PROCEDURAL_SKY_WGSL: string;
export interface CreateProceduralSkyRenderPipelineResourceOptions {
    readonly device: ProceduralSkyRenderPipelineDeviceLike;
    readonly colorFormat: string;
    readonly depthFormat?: string | null;
    readonly sampleCount?: number;
}
export type ProceduralSkyRenderPipelineDiagnosticCode = "proceduralSkyRenderPipeline.shaderDiagnostic" | "proceduralSkyRenderPipeline.shaderCreationFailed" | "proceduralSkyRenderPipeline.createRenderPipelineUnavailable" | "proceduralSkyRenderPipeline.pipelineCreationFailed";
export interface ProceduralSkyRenderPipelineDiagnostic {
    readonly code: ProceduralSkyRenderPipelineDiagnosticCode;
    readonly message: string;
    readonly reason?: WebGpuShaderFailureReason;
    readonly severity?: WebGpuShaderDiagnostic["severity"];
}
export interface ProceduralSkyRenderPipelineResource {
    readonly cacheKey: string;
    readonly shaderModule: unknown;
    readonly pipeline: unknown;
    readonly descriptor: WebGpuRenderPipelineCreateDescriptor;
}
export interface CreateProceduralSkyRenderPipelineResourceResult {
    readonly valid: boolean;
    readonly resource: ProceduralSkyRenderPipelineResource | null;
    readonly diagnostics: readonly ProceduralSkyRenderPipelineDiagnostic[];
}
export interface ProceduralSkyRenderPipelineDeviceLike extends WebGpuShaderDeviceLike, WebGpuRenderPipelineDeviceLike {
}
export declare function createProceduralSkyRenderPipelineResource(options: CreateProceduralSkyRenderPipelineResourceOptions): Promise<CreateProceduralSkyRenderPipelineResourceResult>;
export declare function proceduralSkyPipelineCacheKey(colorFormat: string, depthFormat: string | null, sampleCount?: number): string;
//# sourceMappingURL=procedural-sky-pipeline.d.ts.map