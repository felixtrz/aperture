import type { BatchCompatibilityKey, MeshTopology } from "@aperture-engine/render";
import { type WebGpuRenderPipelineCacheKeyInput, type WebGpuRenderPipelineCreateDescriptor } from "../../gpu/pipeline-cache.js";
import type { BuiltInShaderSourceModule } from "../unlit/unlit-shader.js";
export type DebugNormalPipelineDescriptorDiagnosticCode = "debugNormalPipeline.missingShaderMetadata" | "debugNormalPipeline.missingColorFormat" | "debugNormalPipeline.unsupportedTopology" | "debugNormalPipeline.missingBatchKeyField" | "debugNormalPipeline.unsupportedShaderFamily" | "debugNormalPipeline.unsupportedFeature" | "debugNormalPipeline.missingVertexAttribute";
export interface DebugNormalPipelineDescriptorDiagnostic {
    readonly code: DebugNormalPipelineDescriptorDiagnosticCode;
    readonly message: string;
    readonly field?: string;
}
export interface DebugNormalPipelineDescriptorInput {
    readonly shader?: BuiltInShaderSourceModule;
    readonly colorFormat: string;
    readonly motionVectorColorFormat?: string | null;
    readonly depthFormat?: string | null;
    readonly sampleCount?: number;
    readonly topology?: MeshTopology;
    readonly batchKey: BatchCompatibilityKey;
}
export interface DebugNormalPipelineDescriptorPlan {
    readonly descriptor: WebGpuRenderPipelineCreateDescriptor;
    readonly keyInput: WebGpuRenderPipelineCacheKeyInput;
    readonly cacheKey: string;
}
export interface DebugNormalPipelineDescriptorResult {
    readonly valid: boolean;
    readonly plan: DebugNormalPipelineDescriptorPlan | null;
    readonly diagnostics: readonly DebugNormalPipelineDescriptorDiagnostic[];
}
export declare function createDebugNormalPipelineDescriptorPlan(input: DebugNormalPipelineDescriptorInput): DebugNormalPipelineDescriptorResult;
//# sourceMappingURL=debug-normal-pipeline-descriptor.d.ts.map