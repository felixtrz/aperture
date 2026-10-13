import { type AssetRegistry, type MaybePromise } from "@aperture-engine/simulation";
import { type PackedSnapshotViewUniforms, type ParticleEmitterEffectAsset, type RenderSnapshot } from "@aperture-engine/render";
import type { WebGpuCanvasLike } from "../gpu/initialize-webgpu.js";
import type { TonemapOperator } from "../output/output-stage-tonemap.js";
import type { OutputColorSpace } from "../output/output-stage-color-space.js";
import { type CreateParticleComputePipelineResourceResult, type CreateParticleRenderPipelineResourceResult } from "../render/particles/particle-pipeline.js";
import type { RenderPassCommand } from "../render/passes/render-pass-commands.js";
import { type AppTextureSamplerResourceReuseReport } from "./app-texture-sampler-resources.js";
import type { WebGpuAppResourceCache } from "./resource-cache.js";
interface WebGpuAppParticleContext {
    readonly canvas?: WebGpuCanvasLike;
    readonly initialization: {
        readonly device: unknown;
        readonly format: string;
    };
    readonly msaa: {
        readonly sampleCount: number;
    };
    readonly tonemap?: TonemapOperator;
    readonly outputColorSpace?: OutputColorSpace;
    readonly sceneRenderFormat?: string;
}
export interface ParticleFrameResources {
    readonly valid: boolean;
    readonly commands: readonly RenderPassCommand[];
    readonly overlayCommands: readonly RenderPassCommand[];
    readonly diagnostics: readonly unknown[];
    readonly report: ParticleFrameReport;
}
export interface ParticleFrameReport {
    readonly emitters: number;
    readonly liveParticles: number;
    readonly texturedEmitters: number;
    readonly statesCreated: number;
    readonly statesReused: number;
    readonly staleStatesRemoved: number;
    readonly dispatches: number;
    readonly textureResourcesCreated: number;
    readonly textureResourcesReused: number;
    readonly samplerResourcesCreated: number;
    readonly samplerResourcesReused: number;
}
export declare function prepareParticleFrameResourcesForSnapshot(options: {
    readonly app: WebGpuAppParticleContext;
    readonly assets: AssetRegistry;
    readonly cache: WebGpuAppResourceCache;
    readonly snapshot: RenderSnapshot;
    readonly viewUniforms: PackedSnapshotViewUniforms;
    readonly reuse?: AppTextureSamplerResourceReuseReport;
    readonly time?: number;
}): Promise<ParticleFrameResources>;
export declare function getOrCreateWebGpuAppParticleComputePipeline(app: WebGpuAppParticleContext, cache: WebGpuAppResourceCache): MaybePromise<CreateParticleComputePipelineResourceResult>;
export declare function getOrCreateWebGpuAppParticleRenderPipeline(app: WebGpuAppParticleContext, cache: WebGpuAppResourceCache, blendMode: ParticleEmitterEffectAsset["runtime"]["blendMode"], renderMode: ParticleEmitterEffectAsset["runtime"]["renderMode"], softParticles?: boolean): MaybePromise<CreateParticleRenderPipelineResourceResult>;
export declare function getOrCreateWebGpuAppParticleBurstRenderPipeline(app: WebGpuAppParticleContext, cache: WebGpuAppResourceCache, blendMode: ParticleEmitterEffectAsset["runtime"]["blendMode"], renderMode: ParticleEmitterEffectAsset["runtime"]["renderMode"], softParticles?: boolean): MaybePromise<CreateParticleRenderPipelineResourceResult>;
export declare function emptyParticleFrameReport(emitters?: number): ParticleFrameReport;
export {};
//# sourceMappingURL=particles.d.ts.map