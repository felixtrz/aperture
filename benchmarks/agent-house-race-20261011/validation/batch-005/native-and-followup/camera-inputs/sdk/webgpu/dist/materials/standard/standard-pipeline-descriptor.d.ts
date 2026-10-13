import type { BatchCompatibilityKey, MeshTopology } from "@aperture-engine/render";
import { type WebGpuRenderPipelineCacheKeyInput, type WebGpuRenderPipelineCreateDescriptor } from "../../gpu/pipeline-cache.js";
import { type StandardTextureShaderFeatures } from "./standard-shader.js";
import type { BuiltInShaderSourceModule } from "../unlit/unlit-shader.js";
export declare const STANDARD_DEFERRED_PIPELINE_FEATURES: readonly [];
export type StandardDeferredPipelineFeature = (typeof STANDARD_DEFERRED_PIPELINE_FEATURES)[number];
export type StandardPipelineDescriptorDiagnosticCode = "standardPipeline.missingShaderMetadata" | "standardPipeline.missingColorFormat" | "standardPipeline.unsupportedTopology" | "standardPipeline.missingBatchKeyField" | "standardPipeline.unsupportedShaderFamily" | "standardPipeline.deferredFeature";
export interface StandardPipelineDescriptorDiagnostic {
    readonly code: StandardPipelineDescriptorDiagnosticCode;
    readonly message: string;
    readonly field?: string;
}
export interface StandardPipelineDescriptorInput {
    readonly shader?: BuiltInShaderSourceModule;
    readonly colorFormat: string;
    readonly motionVectorColorFormat?: string | null;
    readonly indirectColorFormat?: string | null;
    readonly depthFormat?: string | null;
    readonly sampleCount?: number;
    readonly topology?: MeshTopology;
    readonly batchKey: BatchCompatibilityKey;
}
export interface StandardPipelineDescriptorPlan {
    readonly descriptor: WebGpuRenderPipelineCreateDescriptor;
    readonly keyInput: WebGpuRenderPipelineCacheKeyInput;
    readonly cacheKey: string;
}
export interface StandardPipelineDescriptorResult {
    readonly valid: boolean;
    readonly plan: StandardPipelineDescriptorPlan | null;
    readonly diagnostics: readonly StandardPipelineDescriptorDiagnostic[];
}
export interface StandardPipelineShaderFeaturePlan {
    readonly shader: BuiltInShaderSourceModule;
    readonly variantKey: string;
    readonly features: StandardTextureShaderFeatures;
    readonly normalMap: {
        readonly authored: boolean;
        readonly requiresTangents: boolean;
        readonly output: "tangent-space-normal-mapping" | "unchanged";
    };
    readonly skinning: {
        readonly enabled: boolean;
        readonly jointAttributeSemantic: "JOINTS_0" | null;
        readonly weightAttributeSemantic: "WEIGHTS_0" | null;
    };
    readonly morphedEnabled: boolean;
    readonly morphTargets: {
        readonly enabled: boolean;
        /** Storage-buffer render: deltas + per-instance descriptors, no attributes. */
        readonly render: "storage-buffer" | null;
        readonly deltaBufferBinding: number | null;
        readonly descriptorBufferBinding: number | null;
    };
}
export declare function createStandardPipelineDescriptorPlan(input: StandardPipelineDescriptorInput): StandardPipelineDescriptorResult;
export declare function createStandardPipelineShaderFeaturePlan(batchKey: Partial<BatchCompatibilityKey> | null, shader?: BuiltInShaderSourceModule): StandardPipelineShaderFeaturePlan;
export declare function resolveStandardShaderForBatchKey(batchKey: Partial<BatchCompatibilityKey> | null, shader?: BuiltInShaderSourceModule): BuiltInShaderSourceModule;
//# sourceMappingURL=standard-pipeline-descriptor.d.ts.map