import { type WebGpuShaderDeviceLike, type WebGpuShaderDiagnostic, type WebGpuShaderFailureReason } from "../../gpu/shader.js";
import type { WebGpuRenderPipelineCreateDescriptor, WebGpuRenderPipelineDeviceLike } from "../../gpu/pipeline-cache.js";
import { type TonemapOperator } from "../../output/output-stage-tonemap.js";
import { type OutputColorSpace } from "../../output/output-stage-color-space.js";
export declare const UI_PANEL_PIPELINE_KEY = "aperture/ui-panel";
export declare const UI_IMAGE_PIPELINE_KEY = "aperture/ui-image";
export declare const UI_PANEL_WGSL: string;
export declare const UI_IMAGE_WGSL: string;
export interface UiQuadRenderPipelineResource {
    readonly cacheKey: string;
    readonly shaderModule: unknown;
    readonly pipeline: unknown;
    readonly descriptor: WebGpuRenderPipelineCreateDescriptor;
}
export interface CreateUiQuadRenderPipelineResourceResult {
    readonly valid: boolean;
    readonly resource: UiQuadRenderPipelineResource | null;
    readonly diagnostics: readonly UiQuadRenderPipelineDiagnostic[];
}
export type UiQuadRenderPipelineDiagnosticCode = "uiQuadRenderPipeline.shaderDiagnostic" | "uiQuadRenderPipeline.shaderCreationFailed" | "uiQuadRenderPipeline.createRenderPipelineUnavailable" | "uiQuadRenderPipeline.pipelineCreationFailed";
export interface UiQuadRenderPipelineDiagnostic {
    readonly code: UiQuadRenderPipelineDiagnosticCode;
    readonly message: string;
    readonly reason?: WebGpuShaderFailureReason;
    readonly severity?: WebGpuShaderDiagnostic["severity"];
}
export interface UiQuadRenderPipelineDeviceLike extends WebGpuShaderDeviceLike, WebGpuRenderPipelineDeviceLike {
}
export declare function uiPanelPipelineCacheKey(colorFormat: string, depthFormat?: string | null, sampleCount?: number, tonemap?: TonemapOperator, outputColorSpace?: OutputColorSpace): string;
export declare function uiImagePipelineCacheKey(colorFormat: string, depthFormat?: string | null, sampleCount?: number, tonemap?: TonemapOperator, outputColorSpace?: OutputColorSpace): string;
export declare function createUiPanelRenderPipelineResource(options: {
    readonly device: UiQuadRenderPipelineDeviceLike;
    readonly colorFormat: string;
    readonly depthFormat?: string | null;
    readonly sampleCount?: number;
    readonly tonemap?: TonemapOperator;
    readonly outputColorSpace?: OutputColorSpace;
}): Promise<CreateUiQuadRenderPipelineResourceResult>;
export declare function createUiImageRenderPipelineResource(options: {
    readonly device: UiQuadRenderPipelineDeviceLike;
    readonly colorFormat: string;
    readonly depthFormat?: string | null;
    readonly sampleCount?: number;
    readonly tonemap?: TonemapOperator;
    readonly outputColorSpace?: OutputColorSpace;
}): Promise<CreateUiQuadRenderPipelineResourceResult>;
//# sourceMappingURL=ui-quad-pipeline.d.ts.map