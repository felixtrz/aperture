export interface GenerateTextureMipmapsDeviceLike {
    readonly createShaderModule?: DeviceCallback<[descriptor: unknown], unknown>;
    readonly createSampler?: DeviceCallback<[descriptor: unknown], unknown>;
    readonly createBindGroupLayout?: DeviceCallback<[
        descriptor: unknown
    ], unknown>;
    readonly createPipelineLayout?: DeviceCallback<[
        descriptor: unknown
    ], unknown>;
    readonly createRenderPipeline?: DeviceCallback<[
        descriptor: unknown
    ], unknown>;
    readonly createBindGroup?: DeviceCallback<[descriptor: unknown], unknown>;
    readonly createCommandEncoder?: DeviceCallback<[
        descriptor?: unknown
    ], unknown>;
    readonly queue?: {
        readonly submit?: (commandBuffers: readonly unknown[]) => void;
    };
}
type DeviceCallback<TArgs extends readonly unknown[], TResult> = {
    bivarianceHack(...args: TArgs): TResult;
}["bivarianceHack"];
export interface GenerateTextureMipmapsCommandEncoderLike {
    readonly beginRenderPass?: (descriptor: unknown) => GenerateTextureMipmapsRenderPassLike;
    readonly finish?: () => unknown;
}
export interface GenerateTextureMipmapsRenderPassLike {
    readonly setPipeline?: (pipeline: unknown) => void;
    readonly setBindGroup?: (index: number, bindGroup: unknown) => void;
    readonly draw?: (vertexCount: number) => void;
    readonly end?: () => void;
}
export interface GenerateTextureMipmapsOptions {
    readonly device: GenerateTextureMipmapsDeviceLike;
    readonly texture: {
        readonly createView?: (descriptor?: unknown) => unknown;
    };
    readonly resourceKey: string;
    readonly format: string;
    readonly width: number;
    readonly height: number;
    readonly mipLevelCount: number;
    readonly label?: string;
}
export interface GenerateTextureMipmapsReport {
    readonly resourceKey: string;
    readonly format: string;
    readonly baseSize: readonly [number, number];
    readonly requestedMipLevelCount: number;
    readonly generatedMipLevels: readonly number[];
    readonly passCount: number;
    readonly submitted: boolean;
}
export declare function canGenerateTextureMipmaps(format: string): boolean;
export declare function generateTextureMipmaps(options: GenerateTextureMipmapsOptions): GenerateTextureMipmapsReport;
export {};
//# sourceMappingURL=generate-mipmaps.d.ts.map