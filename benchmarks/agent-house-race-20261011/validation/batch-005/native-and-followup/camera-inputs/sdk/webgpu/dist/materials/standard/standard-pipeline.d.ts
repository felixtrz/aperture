import type { BatchCompatibilityKey } from "@aperture-engine/render";
import type { WebGpuRenderPipelineCreateDescriptor, WebGpuRenderPipelineDeviceLike } from "../../gpu/pipeline-cache.js";
import { type TonemapOperator } from "../../output/output-stage-tonemap.js";
import { type OutputColorSpace } from "../../output/output-stage-color-space.js";
import { type WebGpuShaderDeviceLike, type WebGpuShaderDiagnostic, type WebGpuShaderFailureReason } from "../../gpu/shader.js";
import type { BuiltInShaderSourceModule } from "../unlit/unlit-shader.js";
export { STANDARD_SKINNED_PRIMITIVE_VERTEX_BUFFER_LAYOUT, STANDARD_TANGENT_PRIMITIVE_VERTEX_BUFFER_LAYOUT, STANDARD_TANGENT_TEXCOORD1_PRIMITIVE_VERTEX_BUFFER_LAYOUT, STANDARD_TEXCOORD1_PRIMITIVE_VERTEX_BUFFER_LAYOUT, STANDARD_VERTEX_COLOR_FLOAT32X3_PRIMITIVE_VERTEX_BUFFER_LAYOUT, STANDARD_VERTEX_COLOR_PRIMITIVE_VERTEX_BUFFER_LAYOUT, STANDARD_VERTEX_COLOR_UNORM16_PRIMITIVE_VERTEX_BUFFER_LAYOUT, STANDARD_VERTEX_COLOR_UNORM8_PRIMITIVE_VERTEX_BUFFER_LAYOUT, vertexSkinningAttributeFormatsFromBatchKey, type StandardPrimitiveVertexBufferLayout, type WebGpuSkinningAttributeFormats, type WebGpuSkinningJointAttributeFormat, type WebGpuSkinningWeightAttributeFormat, } from "./standard-vertex-layout.js";
export type StandardRenderPipelineDiagnosticCode = "standardRenderPipeline.shaderDiagnostic" | "standardRenderPipeline.shaderCreationFailed" | "standardRenderPipeline.descriptorPlanFailed" | "standardRenderPipeline.createRenderPipelineUnavailable" | "standardRenderPipeline.pipelineCreationFailed";
export interface StandardRenderPipelineDiagnostic {
    readonly code: StandardRenderPipelineDiagnosticCode;
    readonly message: string;
    readonly reason?: WebGpuShaderFailureReason;
    readonly severity?: WebGpuShaderDiagnostic["severity"];
    readonly field?: string;
}
export interface BrowserStandardRenderPipelineDescriptorInput {
    readonly shaderModule: unknown;
    readonly shader?: BuiltInShaderSourceModule;
    readonly colorFormat: string;
    readonly motionVectorColorFormat?: string | null;
    readonly indirectColorFormat?: string | null;
    readonly depthFormat?: string | null;
    readonly sampleCount?: number;
    readonly batchKey?: BatchCompatibilityKey;
}
export interface CreateStandardRenderPipelineResourceOptions {
    readonly device: StandardRenderPipelineDeviceLike;
    readonly colorFormat: string;
    readonly motionVectorColorFormat?: string | null;
    readonly indirectColorFormat?: string | null;
    readonly depthFormat?: string | null;
    readonly sampleCount?: number;
    readonly batchKey: BatchCompatibilityKey;
    readonly shader?: BuiltInShaderSourceModule;
    readonly tonemap?: TonemapOperator;
    readonly outputColorSpace?: OutputColorSpace;
}
export interface StandardRenderPipelineResource {
    readonly cacheKey: string;
    readonly shaderModule: unknown;
    readonly pipeline: unknown;
    readonly descriptor: WebGpuRenderPipelineCreateDescriptor;
}
export interface CreateStandardRenderPipelineResourceResult {
    readonly valid: boolean;
    readonly resource: StandardRenderPipelineResource | null;
    readonly diagnostics: readonly StandardRenderPipelineDiagnostic[];
}
export interface StandardRenderPipelineDeviceLike extends WebGpuShaderDeviceLike, WebGpuRenderPipelineDeviceLike {
}
export declare function createStandardRenderPipelineResource(options: CreateStandardRenderPipelineResourceOptions): Promise<CreateStandardRenderPipelineResourceResult>;
export declare function createBrowserStandardRenderPipelineDescriptor(input: BrowserStandardRenderPipelineDescriptorInput): WebGpuRenderPipelineCreateDescriptor;
//# sourceMappingURL=standard-pipeline.d.ts.map