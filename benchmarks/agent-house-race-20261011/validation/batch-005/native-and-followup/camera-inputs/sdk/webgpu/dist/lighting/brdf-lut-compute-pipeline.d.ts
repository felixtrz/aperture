export type BrdfLutComputeStorageFormat = "rg16float" | "rgba16float";
export interface BrdfLutComputeDeviceLike {
    readonly createShaderModule?: (descriptor: unknown) => unknown;
    readonly createBindGroupLayout?: (descriptor: unknown) => unknown;
    readonly createPipelineLayout?: (descriptor: unknown) => unknown;
    readonly createComputePipeline?: (descriptor: unknown) => unknown;
}
export type BrdfLutComputePipelineDiagnosticCode = "brdfLutComputePipeline.createShaderModuleUnavailable" | "brdfLutComputePipeline.createBindGroupLayoutUnavailable" | "brdfLutComputePipeline.createPipelineLayoutUnavailable" | "brdfLutComputePipeline.createComputePipelineUnavailable" | "brdfLutComputePipeline.shaderModuleCreationFailed" | "brdfLutComputePipeline.bindGroupLayoutCreationFailed" | "brdfLutComputePipeline.pipelineLayoutCreationFailed" | "brdfLutComputePipeline.pipelineCreationFailed";
export interface BrdfLutComputePipelineDiagnostic {
    readonly code: BrdfLutComputePipelineDiagnosticCode;
    readonly message: string;
}
export interface BrdfLutComputePipelineResource {
    readonly shaderModule: unknown;
    readonly bindGroupLayout: unknown;
    readonly pipelineLayout: unknown;
    readonly pipeline: unknown;
    readonly storageFormat: BrdfLutComputeStorageFormat;
    readonly workgroupSize: readonly [number, number, number];
}
export interface CreateBrdfLutComputePipelineOptions {
    readonly device: BrdfLutComputeDeviceLike;
    readonly storageFormat?: BrdfLutComputeStorageFormat;
    readonly label?: string;
}
export interface CreateBrdfLutComputePipelineResult {
    readonly valid: boolean;
    readonly resource: BrdfLutComputePipelineResource | null;
    readonly diagnostics: readonly BrdfLutComputePipelineDiagnostic[];
}
export interface BrdfLutComputeDispatchSize {
    readonly x: number;
    readonly y: number;
    readonly z: number;
}
/** Default LUT samples per texel; 1024 matches SOTA reference generators. */
export declare const BRDF_LUT_DEFAULT_SAMPLE_COUNT = 1024;
export declare function createBrdfLutComputePipeline(options: CreateBrdfLutComputePipelineOptions): CreateBrdfLutComputePipelineResult;
export declare function createBrdfLutComputeDispatchSize(input: {
    readonly size: number;
}): BrdfLutComputeDispatchSize;
/**
 * Integrate the GGX environment BRDF at a single (NdotV, roughness) LUT texel,
 * returning the split-sum `(scale, bias)` pair: specularIbl =
 * prefilteredColor * (F0 * scale + F90 * bias).
 */
export declare function integrateEnvironmentBrdf(nDotV: number, roughness: number, sampleCount?: number): {
    readonly scale: number;
    readonly bias: number;
};
//# sourceMappingURL=brdf-lut-compute-pipeline.d.ts.map