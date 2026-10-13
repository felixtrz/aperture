import { type EquirectToCubeDeviceLike, type EquirectToCubeStorageFormat } from "./equirect-to-cube-compute-pipeline.js";
import { type TextureGpuDeviceLike, type TextureGpuResource } from "../resources/textures/texture-resources.js";
export type EquirectToCubeResourceDiagnosticCode = "equirectToCubeResource.deviceUnsupported" | "equirectToCubeResource.pipelineUnavailable" | "equirectToCubeResource.invalidSource" | "equirectToCubeResource.dispatchFailed";
export interface EquirectToCubeResourceDiagnostic {
    readonly code: EquirectToCubeResourceDiagnosticCode;
    readonly severity: "warning" | "error";
    readonly message: string;
}
export interface EquirectSource {
    readonly width: number;
    readonly height: number;
    /** Tightly-packed rgba8unorm bytes (width * height * 4). */
    readonly data: Uint8Array;
}
export interface EquirectToCubeResourceReport {
    readonly ready: boolean;
    readonly faceSize: number;
    readonly faceCount: 6;
    readonly format: EquirectToCubeStorageFormat;
    readonly projection: "equirect-to-cube";
    readonly resource: TextureGpuResource | null;
    readonly diagnostics: readonly EquirectToCubeResourceDiagnostic[];
}
export interface CreateEquirectToCubeResourceOptions {
    readonly device: TextureGpuDeviceLike;
    readonly equirect: EquirectSource;
    readonly faceSize?: number;
    readonly format?: EquirectToCubeStorageFormat;
    readonly resourceKey?: string;
    readonly label?: string;
}
interface EquirectToCubeFullDeviceLike extends TextureGpuDeviceLike, EquirectToCubeDeviceLike {
    readonly createTexture: NonNullable<TextureGpuDeviceLike["createTexture"]>;
    readonly createSampler: NonNullable<TextureGpuDeviceLike["createSampler"]>;
    readonly createShaderModule: NonNullable<EquirectToCubeDeviceLike["createShaderModule"]>;
    readonly createBindGroupLayout: NonNullable<EquirectToCubeDeviceLike["createBindGroupLayout"]>;
    readonly createPipelineLayout: NonNullable<EquirectToCubeDeviceLike["createPipelineLayout"]>;
    readonly createComputePipeline: NonNullable<EquirectToCubeDeviceLike["createComputePipeline"]>;
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
        readonly writeTexture: NonNullable<NonNullable<TextureGpuDeviceLike["queue"]>["writeTexture"]>;
        readonly writeBuffer: (buffer: unknown, offset: number, data: Uint32Array) => void;
        readonly submit: (commandBuffers: readonly unknown[]) => void;
    };
}
export declare function hasEquirectToCubeDeviceSupport(device: TextureGpuDeviceLike): device is EquirectToCubeFullDeviceLike;
export declare function createEquirectToCubeResource(options: CreateEquirectToCubeResourceOptions): EquirectToCubeResourceReport;
export {};
//# sourceMappingURL=equirect-to-cube-resource.d.ts.map