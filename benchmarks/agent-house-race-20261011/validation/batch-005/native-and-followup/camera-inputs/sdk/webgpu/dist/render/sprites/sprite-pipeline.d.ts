import { type WebGpuShaderDeviceLike, type WebGpuShaderDiagnostic, type WebGpuShaderFailureReason } from "../../gpu/shader.js";
import type { WebGpuRenderPipelineCreateDescriptor, WebGpuRenderPipelineDeviceLike } from "../../gpu/pipeline-cache.js";
import { type TonemapOperator } from "../../output/output-stage-tonemap.js";
import { type OutputColorSpace } from "../../output/output-stage-color-space.js";
export declare const SPRITE_PIPELINE_KEY = "aperture/sprite-billboard";
export declare const SPRITE_WGSL: string;
export interface CreateSpriteRenderPipelineResourceOptions {
    readonly device: SpriteRenderPipelineDeviceLike;
    readonly colorFormat: string;
    readonly depthFormat?: string | null;
    readonly depthMode?: SpritePipelineDepthMode;
    readonly sampleCount?: number;
    readonly tonemap?: TonemapOperator;
    readonly outputColorSpace?: OutputColorSpace;
}
export type SpritePipelineDepthMode = "test" | "disabled";
export type SpriteRenderPipelineDiagnosticCode = "spriteRenderPipeline.shaderDiagnostic" | "spriteRenderPipeline.shaderCreationFailed" | "spriteRenderPipeline.createRenderPipelineUnavailable" | "spriteRenderPipeline.pipelineCreationFailed";
export interface SpriteRenderPipelineDiagnostic {
    readonly code: SpriteRenderPipelineDiagnosticCode;
    readonly message: string;
    readonly reason?: WebGpuShaderFailureReason;
    readonly severity?: WebGpuShaderDiagnostic["severity"];
}
export interface SpriteRenderPipelineResource {
    readonly cacheKey: string;
    readonly shaderModule: unknown;
    readonly pipeline: unknown;
    readonly descriptor: WebGpuRenderPipelineCreateDescriptor;
}
export interface CreateSpriteRenderPipelineResourceResult {
    readonly valid: boolean;
    readonly resource: SpriteRenderPipelineResource | null;
    readonly diagnostics: readonly SpriteRenderPipelineDiagnostic[];
}
export interface SpriteRenderPipelineDeviceLike extends WebGpuShaderDeviceLike, WebGpuRenderPipelineDeviceLike {
}
export declare function createSpriteRenderPipelineResource(options: CreateSpriteRenderPipelineResourceOptions): Promise<CreateSpriteRenderPipelineResourceResult>;
export declare function spritePipelineCacheKey(colorFormat: string, depthFormat: string | null, sampleCount?: number, tonemap?: TonemapOperator, outputColorSpace?: OutputColorSpace, depthMode?: SpritePipelineDepthMode): string;
//# sourceMappingURL=sprite-pipeline.d.ts.map