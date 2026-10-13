import type { MeshTopology } from "@aperture-engine/render";
import type { BatchCompatibilityKey } from "@aperture-engine/render";
import { type BuiltInShaderSourceModule } from "./unlit-shader.js";
import { type WebGpuRenderPipelineCreateDescriptor, type WebGpuRenderPipelineCacheKeyInput } from "../../gpu/pipeline-cache.js";
export declare const UNLIT_BASE_COLOR_TEXTURE_FEATURE = "baseColorTexture";
export declare const UNLIT_VERTEX_COLOR_FEATURE = "vertexColor";
export declare const UNLIT_TEXTURED_VERTEX_COLOR_FEATURE = "baseColorTexture+vertexColor";
export type UnlitPipelineDescriptorDiagnosticCode = "unlitPipeline.missingShaderMetadata" | "unlitPipeline.missingColorFormat" | "unlitPipeline.unsupportedTopology" | "unlitPipeline.missingBatchKeyField";
export interface UnlitPipelineDescriptorDiagnostic {
    readonly code: UnlitPipelineDescriptorDiagnosticCode;
    readonly message: string;
    readonly field?: string;
}
export interface UnlitPipelineDescriptorInput {
    readonly shader?: BuiltInShaderSourceModule;
    readonly colorFormat: string;
    readonly motionVectorColorFormat?: string | null;
    readonly depthFormat?: string | null;
    readonly sampleCount?: number;
    readonly topology?: MeshTopology;
    readonly batchKey: BatchCompatibilityKey;
}
export interface UnlitPipelineDescriptorPlan {
    readonly descriptor: WebGpuRenderPipelineCreateDescriptor;
    readonly keyInput: WebGpuRenderPipelineCacheKeyInput;
    readonly cacheKey: string;
}
export interface UnlitPipelineDescriptorResult {
    readonly valid: boolean;
    readonly plan: UnlitPipelineDescriptorPlan | null;
    readonly diagnostics: readonly UnlitPipelineDescriptorDiagnostic[];
}
export declare function createUnlitPipelineDescriptorPlan(input: UnlitPipelineDescriptorInput): UnlitPipelineDescriptorResult;
export declare function resolveUnlitShaderForBatchKey(batchKey: Partial<BatchCompatibilityKey> | null, shader?: BuiltInShaderSourceModule): BuiltInShaderSourceModule;
export declare function hasUnlitVertexColorFeature(batchKey: Partial<BatchCompatibilityKey> | null): boolean;
export declare function isColor0LayoutToken(token: string): boolean;
//# sourceMappingURL=unlit-pipeline-descriptor.d.ts.map