import type { SamplerAsset, TextureColorSpace, TextureSemantic } from "@aperture-engine/render";
import { type GenerateTextureMipmapsDeviceLike, type GenerateTextureMipmapsReport } from "./generate-mipmaps.js";
export declare const WEBGPU_TEXTURE_USAGE_FLAGS: {
    readonly COPY_SRC: 1;
    readonly COPY_DST: 2;
    readonly TEXTURE_BINDING: 4;
    readonly STORAGE_BINDING: 8;
    readonly RENDER_ATTACHMENT: 16;
};
export type TextureGpuResourceDiagnosticCode = "textureResource.createTextureUnavailable" | "textureResource.createViewUnavailable" | "textureResource.writeTextureUnavailable" | "textureResource.invalidBytesPerRow" | "textureResource.invalidRowsPerImage" | "textureResource.uploadDataTooSmall" | "textureResource.invalidMipLevelCount" | "textureResource.generateMipmapsUnavailable" | "textureResource.mipmapGenerationFailed" | "textureResource.invalidColorSpaceFormat" | "textureResource.textureCreationFailed" | "textureResource.textureViewCreationFailed" | "textureResource.textureUploadFailed" | "samplerResource.createSamplerUnavailable" | "samplerResource.samplerCreationFailed";
export interface TextureGpuResourceDiagnostic {
    readonly code: TextureGpuResourceDiagnosticCode;
    readonly message: string;
    readonly resourceKey: string;
}
export interface TextureGpuDeviceLike extends GenerateTextureMipmapsDeviceLike {
    readonly createTexture?: (descriptor: unknown) => TextureLike;
    readonly createSampler?: (descriptor: unknown) => unknown;
    readonly queue?: GenerateTextureMipmapsDeviceLike["queue"] & {
        readonly writeTexture?: (destination: unknown, data: Uint8Array, layout: unknown, size: unknown) => void;
    };
}
export interface TextureLike {
    readonly createView?: (descriptor?: unknown) => unknown;
}
export interface TextureGpuResource {
    readonly resourceKey: string;
    readonly texture: unknown;
    readonly view: unknown;
    readonly descriptor: TextureDescriptorInput;
    readonly viewDescriptor?: unknown;
    readonly mipGeneration?: GenerateTextureMipmapsReport;
    readonly prefiltered?: boolean;
}
export interface SamplerGpuResource {
    readonly resourceKey: string;
    readonly sampler: unknown;
    readonly descriptor: SamplerDescriptorInput;
}
export interface TextureDescriptorInput {
    readonly size: readonly [number, number, number];
    readonly format: string;
    readonly usage: number;
    readonly colorSpace?: TextureColorSpace;
    readonly semantic?: TextureSemantic;
    readonly mipLevelCount?: number;
    readonly label?: string;
}
export interface TextureUploadInput {
    readonly data: Uint8Array;
    readonly bytesPerRow: number;
    readonly rowsPerImage?: number;
    readonly mipLevels?: readonly TextureMipLevelUploadInput[];
}
export interface TextureMipLevelUploadInput {
    readonly data: Uint8Array;
    readonly bytesPerRow: number;
    readonly rowsPerImage?: number;
    readonly width: number;
    readonly height: number;
}
export interface CreateTextureGpuResourceOptions {
    readonly device: TextureGpuDeviceLike;
    readonly resourceKey: string;
    readonly descriptor: TextureDescriptorInput;
    readonly upload?: TextureUploadInput;
    readonly viewDescriptor?: unknown;
}
export interface CreateTextureGpuResourceResult {
    readonly valid: boolean;
    readonly resource: TextureGpuResource | null;
    readonly diagnostics: readonly TextureGpuResourceDiagnostic[];
}
export interface SamplerDescriptorInput {
    readonly addressModeU: SamplerAsset["addressModeU"];
    readonly addressModeV: SamplerAsset["addressModeV"];
    readonly addressModeW: SamplerAsset["addressModeW"];
    readonly magFilter: SamplerAsset["magFilter"];
    readonly minFilter: SamplerAsset["minFilter"];
    readonly mipmapFilter: SamplerAsset["mipmapFilter"];
    readonly lodMinClamp: number;
    readonly lodMaxClamp: number;
    readonly maxAnisotropy: number;
    readonly label?: string;
}
export interface CreateSamplerGpuResourceOptions {
    readonly device: TextureGpuDeviceLike;
    readonly resourceKey: string;
    readonly sampler: SamplerAsset;
}
export interface CreateSamplerGpuResourceResult {
    readonly valid: boolean;
    readonly resource: SamplerGpuResource | null;
    readonly diagnostics: readonly TextureGpuResourceDiagnostic[];
}
export declare function createTextureGpuResource(options: CreateTextureGpuResourceOptions): CreateTextureGpuResourceResult;
export declare function createSamplerGpuResource(options: CreateSamplerGpuResourceOptions): CreateSamplerGpuResourceResult;
//# sourceMappingURL=texture-resources.d.ts.map