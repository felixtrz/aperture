import type { BatchCompatibilityKey } from "@aperture-engine/render";
import { type WebGpuShaderDeviceLike, type WebGpuShaderFailureReason, type WebGpuShaderDiagnostic } from "../../gpu/shader.js";
import { type BuiltInShaderSourceModule } from "./unlit-shader.js";
import { type TonemapOperator } from "../../output/output-stage-tonemap.js";
import type { OutputColorSpace } from "../../output/output-stage-color-space.js";
import type { WebGpuRenderPipelineCreateDescriptor, WebGpuRenderPipelineDeviceLike } from "../../gpu/pipeline-cache.js";
export declare const UNLIT_PRIMITIVE_VERTEX_BUFFER_LAYOUT: {
    readonly arrayStride: 32;
    readonly stepMode: "vertex";
    readonly attributes: readonly [{
        readonly shaderLocation: 0;
        readonly offset: 0;
        readonly format: "float32x3";
    }, {
        readonly shaderLocation: 1;
        readonly offset: 12;
        readonly format: "float32x3";
    }, {
        readonly shaderLocation: 2;
        readonly offset: 24;
        readonly format: "float32x2";
    }];
};
export declare const UNLIT_VERTEX_COLOR_VERTEX_BUFFER_LAYOUT: {
    readonly arrayStride: 48;
    readonly stepMode: "vertex";
    readonly attributes: readonly [{
        readonly shaderLocation: 0;
        readonly offset: 0;
        readonly format: "float32x3";
    }, {
        readonly shaderLocation: 1;
        readonly offset: 12;
        readonly format: "float32x3";
    }, {
        readonly shaderLocation: 2;
        readonly offset: 24;
        readonly format: "float32x2";
    }, {
        readonly shaderLocation: 5;
        readonly offset: 32;
        readonly format: "float32x4";
    }];
};
export declare const UNLIT_VERTEX_COLOR_FLOAT32X3_VERTEX_BUFFER_LAYOUT: {
    readonly arrayStride: 44;
    readonly stepMode: "vertex";
    readonly attributes: readonly [{
        readonly shaderLocation: 0;
        readonly offset: 0;
        readonly format: "float32x3";
    }, {
        readonly shaderLocation: 1;
        readonly offset: 12;
        readonly format: "float32x3";
    }, {
        readonly shaderLocation: 2;
        readonly offset: 24;
        readonly format: "float32x2";
    }, {
        readonly shaderLocation: 5;
        readonly offset: 32;
        readonly format: "float32x3";
    }];
};
export declare const UNLIT_VERTEX_COLOR_UNORM8_VERTEX_BUFFER_LAYOUT: {
    readonly arrayStride: 36;
    readonly stepMode: "vertex";
    readonly attributes: readonly [{
        readonly shaderLocation: 0;
        readonly offset: 0;
        readonly format: "float32x3";
    }, {
        readonly shaderLocation: 1;
        readonly offset: 12;
        readonly format: "float32x3";
    }, {
        readonly shaderLocation: 2;
        readonly offset: 24;
        readonly format: "float32x2";
    }, {
        readonly shaderLocation: 5;
        readonly offset: 32;
        readonly format: "unorm8x4";
    }];
};
export declare const UNLIT_VERTEX_COLOR_UNORM16_VERTEX_BUFFER_LAYOUT: {
    readonly arrayStride: 40;
    readonly stepMode: "vertex";
    readonly attributes: readonly [{
        readonly shaderLocation: 0;
        readonly offset: 0;
        readonly format: "float32x3";
    }, {
        readonly shaderLocation: 1;
        readonly offset: 12;
        readonly format: "float32x3";
    }, {
        readonly shaderLocation: 2;
        readonly offset: 24;
        readonly format: "float32x2";
    }, {
        readonly shaderLocation: 5;
        readonly offset: 32;
        readonly format: "unorm16x4";
    }];
};
export type WebGpuVertexColorAttributeFormat = "float32x3" | "float32x4" | "unorm8x4" | "unorm16x4";
interface UnlitVertexBufferAttributeLayout {
    readonly shaderLocation: number;
    readonly offset: number;
    readonly format: string;
}
export interface UnlitPrimitiveVertexBufferLayout {
    readonly arrayStride: number;
    readonly stepMode: "vertex";
    readonly attributes: readonly UnlitVertexBufferAttributeLayout[];
}
export type UnlitRenderPipelineDiagnosticCode = "unlitRenderPipeline.shaderDiagnostic" | "unlitRenderPipeline.shaderCreationFailed" | "unlitRenderPipeline.descriptorPlanFailed" | "unlitRenderPipeline.createRenderPipelineUnavailable" | "unlitRenderPipeline.pipelineCreationFailed";
export interface UnlitRenderPipelineDiagnostic {
    readonly code: UnlitRenderPipelineDiagnosticCode;
    readonly message: string;
    readonly reason?: WebGpuShaderFailureReason;
    readonly severity?: WebGpuShaderDiagnostic["severity"];
    readonly field?: string;
}
export interface BrowserUnlitRenderPipelineDescriptorInput {
    readonly shaderModule: unknown;
    readonly shader?: BuiltInShaderSourceModule;
    readonly colorFormat: string;
    readonly motionVectorColorFormat?: string | null;
    readonly depthFormat?: string | null;
    readonly sampleCount?: number;
    readonly batchKey?: BatchCompatibilityKey;
}
export interface CreateUnlitRenderPipelineResourceOptions {
    readonly device: UnlitRenderPipelineDeviceLike;
    readonly colorFormat: string;
    readonly motionVectorColorFormat?: string | null;
    readonly depthFormat?: string | null;
    readonly sampleCount?: number;
    readonly batchKey: BatchCompatibilityKey;
    readonly shader?: BuiltInShaderSourceModule;
    readonly tonemap?: TonemapOperator;
    readonly outputColorSpace?: OutputColorSpace;
}
export interface UnlitRenderPipelineResource {
    readonly cacheKey: string;
    readonly shaderModule: unknown;
    readonly pipeline: unknown;
    readonly descriptor: WebGpuRenderPipelineCreateDescriptor;
}
export interface CreateUnlitRenderPipelineResourceResult {
    readonly valid: boolean;
    readonly resource: UnlitRenderPipelineResource | null;
    readonly diagnostics: readonly UnlitRenderPipelineDiagnostic[];
}
export interface UnlitRenderPipelineDeviceLike extends WebGpuShaderDeviceLike, WebGpuRenderPipelineDeviceLike {
}
export declare function createUnlitRenderPipelineResource(options: CreateUnlitRenderPipelineResourceOptions): Promise<CreateUnlitRenderPipelineResourceResult>;
export declare function createBrowserUnlitRenderPipelineDescriptor(input: BrowserUnlitRenderPipelineDescriptorInput): WebGpuRenderPipelineCreateDescriptor;
export declare function resolveUnlitVertexBufferLayout(batchKey?: BatchCompatibilityKey): UnlitPrimitiveVertexBufferLayout;
export declare function resolveUnlitVertexBufferLayouts(batchKey?: BatchCompatibilityKey): readonly UnlitPrimitiveVertexBufferLayout[];
export declare function vertexColorAttributeFormatFromBatchKey(batchKey?: Partial<BatchCompatibilityKey>): WebGpuVertexColorAttributeFormat;
export {};
//# sourceMappingURL=unlit-pipeline.d.ts.map