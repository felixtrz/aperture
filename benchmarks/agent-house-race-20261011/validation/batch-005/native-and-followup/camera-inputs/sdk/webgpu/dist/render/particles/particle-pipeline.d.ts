import { type WebGpuShaderDeviceLike, type WebGpuShaderDiagnostic, type WebGpuShaderFailureReason } from "../../gpu/shader.js";
import type { WebGpuRenderPipelineCreateDescriptor, WebGpuRenderPipelineDeviceLike } from "../../gpu/pipeline-cache.js";
import { type TonemapOperator } from "../../output/output-stage-tonemap.js";
import { type OutputColorSpace } from "../../output/output-stage-color-space.js";
import { type ParticleRenderMode, type SpriteBlendMode as SpriteBlendModeValue } from "@aperture-engine/render";
export declare const PARTICLE_COMPUTE_PIPELINE_KEY = "aperture/gpu-particles-compute";
export declare const PARTICLE_RENDER_PIPELINE_KEY = "aperture/gpu-particles-render";
export declare const PARTICLE_BURST_RENDER_PIPELINE_KEY = "aperture/gpu-particles-burst-render";
export declare const PARTICLE_COMPUTE_WGSL: string;
export declare const PARTICLE_RENDER_WGSL: string;
export declare const PARTICLE_BURST_RENDER_WGSL: string;
export interface ParticleComputePipelineResource {
    readonly cacheKey: string;
    readonly shaderModule: unknown;
    readonly pipeline: unknown;
    readonly descriptor: unknown;
}
export interface ParticleRenderPipelineResource {
    readonly cacheKey: string;
    readonly shaderModule: unknown;
    readonly pipeline: unknown;
    readonly descriptor: WebGpuRenderPipelineCreateDescriptor;
}
export interface CreateParticleComputePipelineResourceResult {
    readonly valid: boolean;
    readonly resource: ParticleComputePipelineResource | null;
    readonly diagnostics: readonly ParticlePipelineDiagnostic[];
}
export interface CreateParticleRenderPipelineResourceResult {
    readonly valid: boolean;
    readonly resource: ParticleRenderPipelineResource | null;
    readonly diagnostics: readonly ParticlePipelineDiagnostic[];
}
export type ParticlePipelineDiagnosticCode = "particlePipeline.shaderDiagnostic" | "particlePipeline.shaderCreationFailed" | "particlePipeline.createComputePipelineUnavailable" | "particlePipeline.createRenderPipelineUnavailable" | "particlePipeline.pipelineCreationFailed";
export interface ParticlePipelineDiagnostic {
    readonly code: ParticlePipelineDiagnosticCode;
    readonly message: string;
    readonly reason?: WebGpuShaderFailureReason;
    readonly severity?: WebGpuShaderDiagnostic["severity"];
}
export interface ParticlePipelineDeviceLike extends WebGpuShaderDeviceLike, WebGpuRenderPipelineDeviceLike {
    createComputePipeline?: (descriptor: unknown) => unknown;
}
export declare function particleComputePipelineCacheKey(): string;
export declare function particleRenderPipelineCacheKey(colorFormat: string, depthFormat?: string | null, sampleCount?: number, blendMode?: SpriteBlendModeValue, tonemap?: TonemapOperator, outputColorSpace?: OutputColorSpace, renderMode?: ParticleRenderMode, softParticles?: boolean): string;
export declare function particleBurstRenderPipelineCacheKey(colorFormat: string, depthFormat?: string | null, sampleCount?: number, blendMode?: SpriteBlendModeValue, tonemap?: TonemapOperator, outputColorSpace?: OutputColorSpace, renderMode?: ParticleRenderMode, softParticles?: boolean): string;
export declare function createParticleRenderShaderSource(options?: {
    readonly variant?: "computed" | "burst";
    readonly renderMode?: ParticleRenderMode;
    readonly softParticles?: boolean;
}): string;
export declare function createParticleComputePipelineResource(options: {
    readonly device: ParticlePipelineDeviceLike;
}): Promise<CreateParticleComputePipelineResourceResult>;
export declare function createParticleRenderPipelineResource(options: {
    readonly device: ParticlePipelineDeviceLike;
    readonly colorFormat: string;
    readonly depthFormat?: string | null;
    readonly sampleCount?: number;
    readonly blendMode?: SpriteBlendModeValue;
    readonly tonemap?: TonemapOperator;
    readonly outputColorSpace?: OutputColorSpace;
    readonly variant?: "computed" | "burst";
    readonly renderMode?: ParticleRenderMode;
    readonly softParticles?: boolean;
}): Promise<CreateParticleRenderPipelineResourceResult>;
//# sourceMappingURL=particle-pipeline.d.ts.map