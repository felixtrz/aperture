import type {
  SamplerAsset,
  TextureColorSpace,
  TextureSemantic,
} from "@aperture-engine/render";
import {
  canGenerateTextureMipmaps,
  generateTextureMipmaps,
  type GenerateTextureMipmapsDeviceLike,
  type GenerateTextureMipmapsReport,
} from "./generate-mipmaps.js";

export const WEBGPU_TEXTURE_USAGE_FLAGS = {
  COPY_SRC: 0x1,
  COPY_DST: 0x2,
  TEXTURE_BINDING: 0x4,
  STORAGE_BINDING: 0x8,
  RENDER_ATTACHMENT: 0x10,
} as const;

export type TextureGpuResourceDiagnosticCode =
  | "textureResource.createTextureUnavailable"
  | "textureResource.createViewUnavailable"
  | "textureResource.writeTextureUnavailable"
  | "textureResource.invalidBytesPerRow"
  | "textureResource.invalidRowsPerImage"
  | "textureResource.uploadDataTooSmall"
  | "textureResource.invalidMipLevelCount"
  | "textureResource.generateMipmapsUnavailable"
  | "textureResource.mipmapGenerationFailed"
  | "textureResource.invalidColorSpaceFormat"
  | "textureResource.textureCreationFailed"
  | "textureResource.textureViewCreationFailed"
  | "textureResource.textureUploadFailed"
  | "samplerResource.createSamplerUnavailable"
  | "samplerResource.samplerCreationFailed";

export interface TextureGpuResourceDiagnostic {
  readonly code: TextureGpuResourceDiagnosticCode;
  readonly message: string;
  readonly resourceKey: string;
}

export interface TextureGpuDeviceLike extends GenerateTextureMipmapsDeviceLike {
  readonly createTexture?: (descriptor: unknown) => TextureLike;
  readonly createSampler?: (descriptor: unknown) => unknown;
  readonly queue?: GenerateTextureMipmapsDeviceLike["queue"] & {
    readonly writeTexture?: (
      destination: unknown,
      data: Uint8Array,
      layout: unknown,
      size: unknown,
    ) => void;
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

export function createTextureGpuResource(
  options: CreateTextureGpuResourceOptions,
): CreateTextureGpuResourceResult {
  const colorSpaceDiagnostic = validateTextureDescriptorColorSpace(
    options.resourceKey,
    options.descriptor,
  );

  if (colorSpaceDiagnostic !== null) {
    return {
      valid: false,
      resource: null,
      diagnostics: [colorSpaceDiagnostic],
    };
  }

  if (options.device.createTexture === undefined) {
    return failure(
      "textureResource.createTextureUnavailable",
      options.resourceKey,
      "WebGPU device cannot create textures.",
    );
  }

  let texture: TextureLike;
  const mipGenerationRequested = shouldGenerateMipmaps(
    options.descriptor,
    options.upload,
  );

  try {
    texture = options.device.createTexture(
      textureDescriptorForWebGpu(options.descriptor, {
        generateMipmaps: mipGenerationRequested,
        upload: options.upload !== undefined,
      }),
    );
  } catch (error) {
    return failure(
      "textureResource.textureCreationFailed",
      options.resourceKey,
      error instanceof Error ? error.message : "Texture creation failed.",
    );
  }

  if (texture.createView === undefined) {
    return failure(
      "textureResource.createViewUnavailable",
      options.resourceKey,
      "Created texture cannot create texture views.",
    );
  }

  if (options.upload !== undefined) {
    if (options.device.queue?.writeTexture === undefined) {
      return failure(
        "textureResource.writeTextureUnavailable",
        options.resourceKey,
        "WebGPU queue cannot upload texture data.",
      );
    }

    const uploadLayoutDiagnostic = validateTextureUploadInput(
      options.resourceKey,
      options.descriptor,
      options.upload,
    );

    if (uploadLayoutDiagnostic !== null) {
      return {
        valid: false,
        resource: null,
        diagnostics: [uploadLayoutDiagnostic],
      };
    }

    try {
      for (const level of textureUploadLevels(
        options.descriptor,
        options.upload,
      )) {
        const copySize = textureUploadCopySize(
          options.descriptor,
          level.width,
          level.height,
        );
        options.device.queue.writeTexture(
          { texture, mipLevel: level.mipLevel },
          level.data,
          {
            bytesPerRow: level.bytesPerRow,
            ...(level.rowsPerImage === undefined
              ? {}
              : { rowsPerImage: level.rowsPerImage }),
          },
          copySize,
        );
      }
    } catch (error) {
      return failure(
        "textureResource.textureUploadFailed",
        options.resourceKey,
        error instanceof Error ? error.message : "Texture upload failed.",
      );
    }
  }

  let mipGeneration: GenerateTextureMipmapsReport | undefined;

  if (mipGenerationRequested) {
    try {
      mipGeneration = generateTextureMipmaps({
        device: options.device,
        texture,
        resourceKey: options.resourceKey,
        format: options.descriptor.format,
        width: options.descriptor.size[0],
        height: options.descriptor.size[1],
        mipLevelCount: options.descriptor.mipLevelCount ?? 1,
        ...(options.descriptor.label === undefined
          ? {}
          : { label: options.descriptor.label }),
      });
    } catch (error) {
      return failure(
        "textureResource.mipmapGenerationFailed",
        options.resourceKey,
        error instanceof Error
          ? error.message
          : "Texture mipmap generation failed.",
      );
    }
  }

  let view: unknown;

  try {
    view = texture.createView(options.viewDescriptor);
  } catch (error) {
    return failure(
      "textureResource.textureViewCreationFailed",
      options.resourceKey,
      error instanceof Error ? error.message : "Texture view creation failed.",
    );
  }

  return {
    valid: true,
    resource: {
      resourceKey: options.resourceKey,
      texture,
      view,
      descriptor: options.descriptor,
      ...(options.viewDescriptor === undefined
        ? {}
        : { viewDescriptor: options.viewDescriptor }),
      ...(mipGeneration === undefined ? {} : { mipGeneration }),
    },
    diagnostics: [],
  };
}

function validateTextureDescriptorColorSpace(
  resourceKey: string,
  descriptor: TextureDescriptorInput,
): TextureGpuResourceDiagnostic | null {
  if (descriptor.colorSpace === undefined) {
    return null;
  }

  if (
    isSrgbTextureFormat(descriptor.format) !==
    (descriptor.colorSpace === "srgb")
  ) {
    return {
      code: "textureResource.invalidColorSpaceFormat",
      resourceKey,
      message: `Texture resource '${resourceKey}' declares color space '${descriptor.colorSpace}' but uses texture format '${descriptor.format}'.`,
    };
  }

  return null;
}

function textureDescriptorForWebGpu(
  descriptor: TextureDescriptorInput,
  options: {
    readonly generateMipmaps?: boolean;
    readonly upload?: boolean;
  } = {},
): Omit<TextureDescriptorInput, "colorSpace" | "semantic"> {
  const {
    colorSpace: _colorSpace,
    semantic: _semantic,
    ...webGpuDescriptor
  } = descriptor;
  let usage = webGpuDescriptor.usage;

  if (options.upload === true) {
    usage |= WEBGPU_TEXTURE_USAGE_FLAGS.COPY_DST;
  }

  if (options.generateMipmaps === true) {
    usage |=
      WEBGPU_TEXTURE_USAGE_FLAGS.TEXTURE_BINDING |
      WEBGPU_TEXTURE_USAGE_FLAGS.RENDER_ATTACHMENT;
  }

  return {
    ...webGpuDescriptor,
    usage,
  };
}

function validateTextureUploadInput(
  resourceKey: string,
  descriptor: TextureDescriptorInput,
  upload: TextureUploadInput,
): TextureGpuResourceDiagnostic | null {
  const levels = textureUploadLevels(descriptor, upload);
  const expectedMipLevelCount = descriptor.mipLevelCount ?? 1;

  if (
    upload.mipLevels !== undefined &&
    upload.mipLevels.length !== expectedMipLevelCount
  ) {
    return {
      code: "textureResource.invalidMipLevelCount",
      resourceKey,
      message: `Texture upload for resource '${resourceKey}' provides ${upload.mipLevels.length} mip level(s), but the descriptor expects ${expectedMipLevelCount}.`,
    };
  }

  for (const level of levels) {
    const diagnostic = validateTextureUploadLevelLayout(
      resourceKey,
      descriptor,
      level,
    );

    if (diagnostic !== null) {
      return diagnostic;
    }
  }

  if (
    shouldGenerateMipmaps(descriptor, upload) &&
    !canGenerateTextureMipmaps(descriptor.format)
  ) {
    return {
      code: "textureResource.generateMipmapsUnavailable",
      resourceKey,
      message: `Texture resource '${resourceKey}' requests generated mipmaps for unsupported format '${descriptor.format}'.`,
    };
  }

  return null;
}

interface TextureUploadLevel extends TextureMipLevelUploadInput {
  readonly mipLevel: number;
}

function textureUploadLevels(
  descriptor: TextureDescriptorInput,
  upload: TextureUploadInput,
): readonly TextureUploadLevel[] {
  if (upload.mipLevels !== undefined) {
    return upload.mipLevels.map((level, mipLevel) => ({
      ...level,
      mipLevel,
    }));
  }

  return [
    {
      data: upload.data,
      bytesPerRow: upload.bytesPerRow,
      ...(upload.rowsPerImage === undefined
        ? {}
        : { rowsPerImage: upload.rowsPerImage }),
      width: descriptor.size[0],
      height: descriptor.size[1],
      mipLevel: 0,
    },
  ];
}

function textureUploadCopySize(
  descriptor: TextureDescriptorInput,
  width: number,
  height: number,
): readonly [number, number, number] {
  const layout = textureFormatUploadLayout(descriptor.format);

  if (layout === null || layout.blockWidth === 1 || layout.blockHeight === 1) {
    return [width, height, descriptor.size[2]];
  }

  return [
    Math.ceil(width / layout.blockWidth) * layout.blockWidth,
    Math.ceil(height / layout.blockHeight) * layout.blockHeight,
    descriptor.size[2],
  ];
}

function validateTextureUploadLevelLayout(
  resourceKey: string,
  descriptor: TextureDescriptorInput,
  upload: TextureUploadLevel,
): TextureGpuResourceDiagnostic | null {
  const width = upload.width;
  const height = upload.height;
  const layout = textureFormatUploadLayout(descriptor.format);
  const blockRows =
    layout === null ? height : Math.ceil(height / layout.blockHeight);
  const minimumBytesPerRow =
    layout === null
      ? null
      : Math.ceil(width / layout.blockWidth) * layout.blockByteLength;

  if (
    !Number.isInteger(upload.bytesPerRow) ||
    upload.bytesPerRow <= 0 ||
    (minimumBytesPerRow !== null && upload.bytesPerRow < minimumBytesPerRow)
  ) {
    return {
      code: "textureResource.invalidBytesPerRow",
      resourceKey,
      message:
        minimumBytesPerRow === null
          ? `Texture upload bytesPerRow must be a positive integer for resource '${resourceKey}' mip level ${upload.mipLevel}.`
          : `Texture upload bytesPerRow for resource '${resourceKey}' mip level ${upload.mipLevel} must be at least ${minimumBytesPerRow} bytes for ${width} texel(s) of '${descriptor.format}'.`,
    };
  }

  if (
    upload.rowsPerImage !== undefined &&
    (!Number.isInteger(upload.rowsPerImage) || upload.rowsPerImage < blockRows)
  ) {
    return {
      code: "textureResource.invalidRowsPerImage",
      resourceKey,
      message: `Texture upload rowsPerImage for resource '${resourceKey}' mip level ${upload.mipLevel} must be an integer at least ${blockRows} row(s).`,
    };
  }

  if (minimumBytesPerRow !== null) {
    const rowsPerImage = upload.rowsPerImage ?? blockRows;
    const depthOrArrayLayers = descriptor.size[2];
    const minimumByteLength =
      ((depthOrArrayLayers - 1) * rowsPerImage + (blockRows - 1)) *
        upload.bytesPerRow +
      minimumBytesPerRow;

    if (upload.data.byteLength < minimumByteLength) {
      return {
        code: "textureResource.uploadDataTooSmall",
        resourceKey,
        message: `Texture upload data for resource '${resourceKey}' mip level ${upload.mipLevel} must contain at least ${minimumByteLength} byte(s); received ${upload.data.byteLength}.`,
      };
    }
  }

  return null;
}

function shouldGenerateMipmaps(
  descriptor: TextureDescriptorInput,
  upload: TextureUploadInput | undefined,
): boolean {
  return (
    upload !== undefined &&
    upload.mipLevels === undefined &&
    descriptor.size[2] === 1 &&
    (descriptor.mipLevelCount ?? 1) > 1
  );
}

interface TextureFormatUploadLayout {
  readonly blockWidth: number;
  readonly blockHeight: number;
  readonly blockByteLength: number;
}

function textureFormatUploadLayout(
  format: string,
): TextureFormatUploadLayout | null {
  switch (format) {
    case "r8unorm":
      return texelLayout(1);
    case "rg8unorm":
      return texelLayout(2);
    case "rgba8unorm":
    case "rgba8unorm-srgb":
    case "bgra8unorm":
    case "bgra8unorm-srgb":
      return texelLayout(4);
    case "rgba16float":
      return texelLayout(8);
    case "bc1-rgba-unorm":
    case "bc1-rgba-unorm-srgb":
    case "etc2-rgb8unorm":
    case "etc2-rgb8unorm-srgb":
      return blockLayout(8);
    case "bc3-rgba-unorm":
    case "bc3-rgba-unorm-srgb":
    case "bc7-rgba-unorm":
    case "bc7-rgba-unorm-srgb":
    case "etc2-rgba8unorm":
    case "etc2-rgba8unorm-srgb":
    case "astc-4x4-unorm":
    case "astc-4x4-unorm-srgb":
      return blockLayout(16);
    default:
      return null;
  }
}

function texelLayout(byteLength: number): TextureFormatUploadLayout {
  return { blockWidth: 1, blockHeight: 1, blockByteLength: byteLength };
}

function blockLayout(blockByteLength: number): TextureFormatUploadLayout {
  return { blockWidth: 4, blockHeight: 4, blockByteLength };
}

function isSrgbTextureFormat(format: string): boolean {
  return format.endsWith("-srgb");
}

export function createSamplerGpuResource(
  options: CreateSamplerGpuResourceOptions,
): CreateSamplerGpuResourceResult {
  if (options.device.createSampler === undefined) {
    return failure(
      "samplerResource.createSamplerUnavailable",
      options.resourceKey,
      "WebGPU device cannot create samplers.",
    );
  }

  const descriptor = samplerDescriptor(options.sampler);

  try {
    return {
      valid: true,
      resource: {
        resourceKey: options.resourceKey,
        sampler: options.device.createSampler(descriptor),
        descriptor,
      },
      diagnostics: [],
    };
  } catch (error) {
    return failure(
      "samplerResource.samplerCreationFailed",
      options.resourceKey,
      error instanceof Error ? error.message : "Sampler creation failed.",
    );
  }
}

function samplerDescriptor(sampler: SamplerAsset): SamplerDescriptorInput {
  return {
    label: sampler.label,
    addressModeU: sampler.addressModeU,
    addressModeV: sampler.addressModeV,
    addressModeW: sampler.addressModeW,
    magFilter: sampler.magFilter,
    minFilter: sampler.minFilter,
    mipmapFilter: sampler.mipmapFilter,
    lodMinClamp: sampler.lodMinClamp,
    lodMaxClamp: sampler.lodMaxClamp,
    maxAnisotropy: sampler.maxAnisotropy,
  };
}

interface TextureGpuResourceFailure {
  readonly valid: false;
  readonly resource: null;
  readonly diagnostics: readonly TextureGpuResourceDiagnostic[];
}

function failure(
  code: TextureGpuResourceDiagnosticCode,
  resourceKey: string,
  message: string,
): TextureGpuResourceFailure {
  return {
    valid: false,
    resource: null,
    diagnostics: [{ code, resourceKey, message }],
  };
}
