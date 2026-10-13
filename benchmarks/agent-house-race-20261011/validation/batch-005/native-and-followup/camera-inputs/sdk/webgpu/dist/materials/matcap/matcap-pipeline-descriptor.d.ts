import type { BatchCompatibilityKey, MeshTopology } from "@aperture-engine/render";
import { type WebGpuRenderPipelineCacheKeyInput, type WebGpuRenderPipelineCreateDescriptor } from "../../gpu/pipeline-cache.js";
import type { BuiltInShaderSourceModule } from "../unlit/unlit-shader.js";
export type MatcapPipelineDescriptorDiagnosticCode = "matcapPipeline.missingShaderMetadata" | "matcapPipeline.missingColorFormat" | "matcapPipeline.unsupportedTopology" | "matcapPipeline.missingBatchKeyField" | "matcapPipeline.unsupportedShaderFamily";
export interface MatcapPipelineDescriptorDiagnostic {
    readonly code: MatcapPipelineDescriptorDiagnosticCode;
    readonly message: string;
    readonly field?: string;
}
export interface MatcapPipelineDescriptorInput {
    readonly shader?: BuiltInShaderSourceModule;
    readonly colorFormat: string;
    readonly motionVectorColorFormat?: string | null;
    readonly depthFormat?: string | null;
    readonly sampleCount?: number;
    readonly topology?: MeshTopology;
    readonly batchKey: BatchCompatibilityKey;
}
export interface MatcapPipelineDescriptorPlan {
    readonly descriptor: WebGpuRenderPipelineCreateDescriptor;
    readonly keyInput: WebGpuRenderPipelineCacheKeyInput;
    readonly cacheKey: string;
}
export interface MatcapPipelineDescriptorResult {
    readonly valid: boolean;
    readonly plan: MatcapPipelineDescriptorPlan | null;
    readonly diagnostics: readonly MatcapPipelineDescriptorDiagnostic[];
}
export declare function createMatcapPipelineDescriptorPlan(input: MatcapPipelineDescriptorInput): MatcapPipelineDescriptorResult;
//# sourceMappingURL=matcap-pipeline-descriptor.d.ts.map