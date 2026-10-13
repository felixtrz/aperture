import type { CurrentTextureLike } from "../app/presentation/current-texture-view.js";
import type { RenderPassCommand } from "../render/passes/render-pass-commands.js";
export type WebGpuPostPassDiagnosticCode = "webGpuPostPass.createTextureUnavailable" | "webGpuPostPass.textureCreationFailed" | "webGpuPostPass.createShaderModuleUnavailable" | "webGpuPostPass.createRenderPipelineUnavailable" | "webGpuPostPass.createSamplerUnavailable" | "webGpuPostPass.createBufferUnavailable" | "webGpuPostPass.writeBufferUnavailable" | "webGpuPostPass.createBindGroupUnavailable" | "webGpuPostPass.inputTextureViewUnavailable" | "webGpuPostPass.pipelineLayoutUnavailable" | "webGpuPostPass.outputTextureUnavailable" | "webGpuPostPass.motionVectorTextureUnavailable" | "webGpuPostPass.depthTextureUnavailable" | "webGpuPostPass.depthTextureUnsupportedSampleCount";
export interface WebGpuPostPassDiagnostic {
    readonly code: WebGpuPostPassDiagnosticCode;
    readonly message: string;
    readonly effectId?: string;
}
export interface WebGpuPostPassDeviceLike {
    readonly createTexture?: (descriptor: unknown) => CurrentTextureLike;
    readonly createShaderModule?: (descriptor: unknown) => unknown;
    readonly createRenderPipeline?: (descriptor: unknown) => unknown;
    readonly createSampler?: (descriptor: unknown) => unknown;
    readonly createBindGroup?: (descriptor: unknown) => unknown;
}
export interface WebGpuPostPassTextureResource {
    readonly texture: CurrentTextureLike;
    readonly width: number;
    readonly height: number;
    readonly format: string;
    readonly label: string;
}
export interface WebGpuPostPassDepthTextureResource {
    readonly texture: CurrentTextureLike;
    readonly width: number;
    readonly height: number;
    readonly format: string;
    readonly sampleCount: number;
    readonly label: string;
}
export interface WebGpuPostPassTextureCacheSlot {
    current: WebGpuPostPassTextureResource | null;
}
export interface CreateWebGpuPostPassTextureResult {
    readonly valid: boolean;
    readonly resource: WebGpuPostPassTextureResource | null;
    readonly status: "created" | "reused" | "failed";
    readonly diagnostics: readonly WebGpuPostPassDiagnostic[];
}
export interface WebGpuPostEffectPrepareOptions {
    readonly device: WebGpuPostPassDeviceLike;
    readonly input: WebGpuPostPassTextureResource;
    readonly motionVector?: WebGpuPostPassTextureResource;
    readonly indirectColor?: WebGpuPostPassTextureResource;
    readonly depth?: WebGpuPostPassDepthTextureResource;
    readonly outputFormat: string;
    readonly width: number;
    readonly height: number;
    readonly frame: number;
    readonly passIndex: number;
    readonly isLast: boolean;
    readonly output?: WebGpuPostPassTextureResource;
    readonly history?: WebGpuPostPassTextureResource;
    readonly label: string;
}
export type WebGpuPreparedPostEffectGraphPassKind = "brightpass" | "downsample" | "upsample" | "blur-horizontal" | "blur-vertical" | "composite" | "custom";
export interface WebGpuPreparedPostEffectGraphPass {
    readonly label: string;
    readonly kind: WebGpuPreparedPostEffectGraphPassKind;
    readonly input: string;
    readonly output: "swapchain" | "offscreen";
    readonly outputResource?: WebGpuPostPassTextureResource;
    readonly width: number;
    readonly height: number;
    readonly commands: readonly RenderPassCommand[];
    readonly diagnostics: readonly WebGpuPostPassDiagnostic[];
}
export interface WebGpuPreparedPostEffectGraphReport {
    readonly topology: "single-pass" | "downsample-upsample" | "brightpass-downsample-upsample" | "unreal-bloom";
    readonly passCount: number;
    readonly resourceCount: number;
    readonly brightpassPasses?: number;
    readonly downsamplePasses: number;
    readonly upsamplePasses: number;
    readonly horizontalBlurPasses?: number;
    readonly verticalBlurPasses?: number;
    readonly compositePasses: number;
    readonly levels: readonly {
        readonly width: number;
        readonly height: number;
        readonly kernelSize?: number;
    }[];
}
export interface WebGpuPreparedPostEffectGraph {
    readonly passes: readonly WebGpuPreparedPostEffectGraphPass[];
    readonly report: WebGpuPreparedPostEffectGraphReport;
}
export interface WebGpuPreparedPostEffectPass {
    readonly effectId: string;
    readonly label: string;
    readonly commands: readonly RenderPassCommand[];
    readonly diagnostics: readonly WebGpuPostPassDiagnostic[];
    readonly graph?: WebGpuPreparedPostEffectGraph;
}
export interface WebGpuPostEffect {
    readonly id: string;
    readonly label?: string;
    readonly enabled?: boolean;
    readonly requiresMotionVectors?: boolean;
    readonly requiresColorHistory?: boolean;
    readonly requiresIndirectColor?: boolean;
    readonly requiresDepthTexture?: boolean;
    prepare(options: WebGpuPostEffectPrepareOptions): WebGpuPreparedPostEffectPass;
}
export interface CreateWebGpuCopyPostEffectOptions {
    readonly id?: string;
    readonly label?: string;
    readonly enabled?: boolean;
}
export declare function createWebGpuPostPassTextureCacheSlot(): WebGpuPostPassTextureCacheSlot;
export declare function createOrReuseWebGpuPostPassTexture(options: {
    readonly device: WebGpuPostPassDeviceLike;
    readonly slot: WebGpuPostPassTextureCacheSlot;
    readonly width: number;
    readonly height: number;
    readonly format: string;
    readonly label: string;
}): CreateWebGpuPostPassTextureResult;
export declare function createWebGpuCopyPostEffect(options?: CreateWebGpuCopyPostEffectOptions): WebGpuPostEffect;
//# sourceMappingURL=post-pass.d.ts.map