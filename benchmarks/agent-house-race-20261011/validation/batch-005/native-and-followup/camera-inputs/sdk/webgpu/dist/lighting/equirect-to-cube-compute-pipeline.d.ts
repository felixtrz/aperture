export type EquirectToCubeStorageFormat = "rgba8unorm" | "rgba16float";
export interface EquirectToCubeDeviceLike {
    readonly createShaderModule?: (descriptor: unknown) => unknown;
    readonly createBindGroupLayout?: (descriptor: unknown) => unknown;
    readonly createPipelineLayout?: (descriptor: unknown) => unknown;
    readonly createComputePipeline?: (descriptor: unknown) => unknown;
}
export type EquirectToCubePipelineDiagnosticCode = "equirectToCubePipeline.createShaderModuleUnavailable" | "equirectToCubePipeline.createBindGroupLayoutUnavailable" | "equirectToCubePipeline.createPipelineLayoutUnavailable" | "equirectToCubePipeline.createComputePipelineUnavailable" | "equirectToCubePipeline.shaderModuleCreationFailed" | "equirectToCubePipeline.bindGroupLayoutCreationFailed" | "equirectToCubePipeline.pipelineLayoutCreationFailed" | "equirectToCubePipeline.pipelineCreationFailed";
export interface EquirectToCubePipelineDiagnostic {
    readonly code: EquirectToCubePipelineDiagnosticCode;
    readonly message: string;
}
export interface EquirectToCubePipelineResource {
    readonly shaderModule: unknown;
    readonly bindGroupLayout: unknown;
    readonly pipelineLayout: unknown;
    readonly pipeline: unknown;
    readonly storageFormat: EquirectToCubeStorageFormat;
    readonly workgroupSize: readonly [number, number, number];
}
export interface CreateEquirectToCubeComputePipelineOptions {
    readonly device: EquirectToCubeDeviceLike;
    readonly storageFormat?: EquirectToCubeStorageFormat;
    readonly label?: string;
}
export interface CreateEquirectToCubeComputePipelineResult {
    readonly valid: boolean;
    readonly resource: EquirectToCubePipelineResource | null;
    readonly diagnostics: readonly EquirectToCubePipelineDiagnostic[];
}
export interface EquirectToCubeDispatchSize {
    readonly x: number;
    readonly y: number;
    readonly z: number;
}
export declare function createEquirectToCubeComputePipeline(options: CreateEquirectToCubeComputePipelineOptions): CreateEquirectToCubeComputePipelineResult;
export declare function createEquirectToCubeDispatchSize(input: {
    readonly faceSize: number;
}): EquirectToCubeDispatchSize;
/** The +Z-centered equirect UV for a (not necessarily unit) direction. */
export declare function equirectToCubeUv(direction: readonly [number, number, number]): [number, number];
/** Cube-face direction at face center (uv 0.5,0.5), matching cubeDirection(). */
export declare function cubeFaceCenterDirection(face: number): [number, number, number];
//# sourceMappingURL=equirect-to-cube-compute-pipeline.d.ts.map