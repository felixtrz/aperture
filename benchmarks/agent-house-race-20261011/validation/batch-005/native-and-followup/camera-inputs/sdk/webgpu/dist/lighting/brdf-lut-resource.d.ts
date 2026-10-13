import { type BrdfLutComputeDeviceLike, type BrdfLutComputeStorageFormat } from "./brdf-lut-compute-pipeline.js";
import { type TextureGpuDeviceLike, type TextureGpuResource } from "../resources/textures/texture-resources.js";
export type BrdfLutResourceDiagnosticCode = "brdfLutResource.deviceUnsupported" | "brdfLutResource.pipelineUnavailable" | "brdfLutResource.dispatchFailed";
export interface BrdfLutResourceDiagnostic {
    readonly code: BrdfLutResourceDiagnosticCode;
    readonly severity: "warning" | "error";
    readonly message: string;
}
export interface BrdfLutResourceReport {
    readonly ready: boolean;
    readonly size: number;
    readonly format: BrdfLutComputeStorageFormat;
    readonly resource: TextureGpuResource | null;
    readonly diagnostics: readonly BrdfLutResourceDiagnostic[];
}
export interface CreateBrdfIntegrationLutResourceOptions {
    readonly device: TextureGpuDeviceLike;
    readonly size?: number;
    readonly sampleCount?: number;
    readonly resourceKey?: string;
    readonly label?: string;
}
interface BrdfLutDeviceLike extends TextureGpuDeviceLike, BrdfLutComputeDeviceLike {
    readonly createTexture: NonNullable<TextureGpuDeviceLike["createTexture"]>;
    readonly createShaderModule: NonNullable<BrdfLutComputeDeviceLike["createShaderModule"]>;
    readonly createBindGroupLayout: NonNullable<BrdfLutComputeDeviceLike["createBindGroupLayout"]>;
    readonly createPipelineLayout: NonNullable<BrdfLutComputeDeviceLike["createPipelineLayout"]>;
    readonly createComputePipeline: NonNullable<BrdfLutComputeDeviceLike["createComputePipeline"]>;
    readonly createBuffer: (descriptor: unknown) => unknown;
    readonly createBindGroup: (descriptor: unknown) => unknown;
    readonly createCommandEncoder: (descriptor: unknown) => {
        readonly beginComputePass: (descriptor: unknown) => {
            readonly setPipeline: (pipeline: unknown) => void;
            readonly setBindGroup: (index: number, bindGroup: unknown) => void;
            readonly dispatchWorkgroups: (x: number, y: number, z?: number) => void;
            readonly end: () => void;
        };
        readonly finish: () => unknown;
    };
    readonly queue: NonNullable<TextureGpuDeviceLike["queue"]> & {
        readonly writeBuffer: (buffer: unknown, offset: number, data: Uint32Array) => void;
        readonly submit: (commandBuffers: readonly unknown[]) => void;
    };
}
export declare function hasBrdfLutDeviceSupport(device: TextureGpuDeviceLike): device is BrdfLutDeviceLike;
export declare function createBrdfIntegrationLutResource(options: CreateBrdfIntegrationLutResourceOptions): BrdfLutResourceReport;
export {};
//# sourceMappingURL=brdf-lut-resource.d.ts.map