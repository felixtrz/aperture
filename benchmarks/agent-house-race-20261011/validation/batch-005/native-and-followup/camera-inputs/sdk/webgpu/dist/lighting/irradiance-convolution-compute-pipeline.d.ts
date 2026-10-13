export type IrradianceConvolutionStorageFormat = "rgba8unorm" | "rgba16float";
export interface IrradianceConvolutionDeviceLike {
    readonly createShaderModule?: (descriptor: unknown) => unknown;
    readonly createBindGroupLayout?: (descriptor: unknown) => unknown;
    readonly createPipelineLayout?: (descriptor: unknown) => unknown;
    readonly createComputePipeline?: (descriptor: unknown) => unknown;
}
export type IrradianceConvolutionPipelineDiagnosticCode = "irradianceConvolutionPipeline.createShaderModuleUnavailable" | "irradianceConvolutionPipeline.createBindGroupLayoutUnavailable" | "irradianceConvolutionPipeline.createPipelineLayoutUnavailable" | "irradianceConvolutionPipeline.createComputePipelineUnavailable" | "irradianceConvolutionPipeline.shaderModuleCreationFailed" | "irradianceConvolutionPipeline.bindGroupLayoutCreationFailed" | "irradianceConvolutionPipeline.pipelineLayoutCreationFailed" | "irradianceConvolutionPipeline.pipelineCreationFailed";
export interface IrradianceConvolutionPipelineDiagnostic {
    readonly code: IrradianceConvolutionPipelineDiagnosticCode;
    readonly message: string;
}
export interface IrradianceConvolutionPipelineResource {
    readonly shaderModule: unknown;
    readonly bindGroupLayout: unknown;
    readonly pipelineLayout: unknown;
    readonly pipeline: unknown;
    readonly storageFormat: IrradianceConvolutionStorageFormat;
    readonly workgroupSize: readonly [number, number, number];
}
export interface CreateIrradianceConvolutionComputePipelineOptions {
    readonly device: IrradianceConvolutionDeviceLike;
    readonly storageFormat?: IrradianceConvolutionStorageFormat;
    readonly label?: string;
}
export interface CreateIrradianceConvolutionComputePipelineResult {
    readonly valid: boolean;
    readonly resource: IrradianceConvolutionPipelineResource | null;
    readonly diagnostics: readonly IrradianceConvolutionPipelineDiagnostic[];
}
export interface IrradianceConvolutionDispatchSize {
    readonly x: number;
    readonly y: number;
    readonly z: number;
}
/** Default cosine-weighted samples per output texel. */
export declare const IRRADIANCE_CONVOLUTION_DEFAULT_SAMPLE_COUNT = 512;
export declare function createIrradianceConvolutionComputePipeline(options: CreateIrradianceConvolutionComputePipelineOptions): CreateIrradianceConvolutionComputePipelineResult;
export declare function createIrradianceConvolutionDispatchSize(input: {
    readonly width: number;
    readonly height: number;
    readonly layers?: number;
}): IrradianceConvolutionDispatchSize;
/**
 * Convolve a radiance sampler over the cosine-weighted hemisphere around
 * `normal`, returning the mean sampled radiance (irradiance / PI). With
 * cosine-importance sampling the cos/PI weighting cancels into the sample mean.
 */
export declare function convolveIrradianceDirection(sample: (direction: [number, number, number]) => number, normal: readonly [number, number, number], sampleCount?: number): number;
//# sourceMappingURL=irradiance-convolution-compute-pipeline.d.ts.map