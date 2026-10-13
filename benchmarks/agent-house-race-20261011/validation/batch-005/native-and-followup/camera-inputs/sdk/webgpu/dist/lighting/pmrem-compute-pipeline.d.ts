export type PmremComputeStorageFormat = "rgba8unorm" | "rgba16float";
export interface PmremComputeDeviceLike {
    readonly createShaderModule?: (descriptor: unknown) => unknown;
    readonly createBindGroupLayout?: (descriptor: unknown) => unknown;
    readonly createPipelineLayout?: (descriptor: unknown) => unknown;
    readonly createComputePipeline?: (descriptor: unknown) => unknown;
}
export type PmremComputePipelineDiagnosticCode = "pmremComputePipeline.createShaderModuleUnavailable" | "pmremComputePipeline.createBindGroupLayoutUnavailable" | "pmremComputePipeline.createPipelineLayoutUnavailable" | "pmremComputePipeline.createComputePipelineUnavailable" | "pmremComputePipeline.shaderModuleCreationFailed" | "pmremComputePipeline.bindGroupLayoutCreationFailed" | "pmremComputePipeline.pipelineLayoutCreationFailed" | "pmremComputePipeline.pipelineCreationFailed";
export interface PmremComputePipelineDiagnostic {
    readonly code: PmremComputePipelineDiagnosticCode;
    readonly message: string;
}
export interface PmremComputePipelineResource {
    readonly shaderModule: unknown;
    readonly bindGroupLayout: unknown;
    readonly pipelineLayout: unknown;
    readonly pipeline: unknown;
    readonly storageFormat: PmremComputeStorageFormat;
    readonly workgroupSize: readonly [number, number, number];
}
export interface CreatePmremComputePipelineOptions {
    readonly device: PmremComputeDeviceLike;
    readonly storageFormat?: PmremComputeStorageFormat;
    readonly label?: string;
}
export interface CreatePmremComputePipelineResult {
    readonly valid: boolean;
    readonly resource: PmremComputePipelineResource | null;
    readonly diagnostics: readonly PmremComputePipelineDiagnostic[];
}
export interface PmremComputeDispatchSize {
    readonly x: number;
    readonly y: number;
    readonly z: number;
}
export declare function createPmremComputePipeline(options: CreatePmremComputePipelineOptions): CreatePmremComputePipelineResult;
export declare function createPmremComputeDispatchSize(input: {
    readonly width: number;
    readonly height: number;
    readonly layers?: number;
}): PmremComputeDispatchSize;
//# sourceMappingURL=pmrem-compute-pipeline.d.ts.map