import type {
  SamplerAsset,
  TextureColorSpace,
  TextureSemantic,
} from "@aperture-engine/render";

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

export interface TextureGpuDeviceLike {
  readonly createTexture?: (descriptor: unknown) => TextureLike;
  readonly createSampler?: (descriptor: unknown) => unknown;
  readonly queue?: {
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

  try {
    texture = options.device.createTexture(
      textureDescriptorForWebGpu(options.descriptor),
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

    const uploadLayoutDiagnostic = validateTextureUploadLayout(
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
      options.device.queue.writeTexture(
        { texture },
        options.upload.data,
        {
          bytesPerRow: options.upload.bytesPerRow,
          ...(options.upload.rowsPerImage === undefined
            ? {}
            : { rowsPerImage: options.upload.rowsPerImage }),
        },
        options.descriptor.size,
      );
    } catch (error) {
      return failure(
        "textureResource.textureUploadFailed",
        options.resourceKey,
        error instanceof Error ? error.message : "Texture upload failed.",
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
): Omit<TextureDescriptorInput, "colorSpace" | "semantic"> {
  const {
    colorSpace: _colorSpace,
    semantic: _semantic,
    ...webGpuDescriptor
  } = descriptor;

  return webGpuDescriptor;
}

function validateTextureUploadLayout(
  resourceKey: string,
  descriptor: TextureDescriptorInput,
  upload: TextureUploadInput,
): TextureGpuResourceDiagnostic | null {
  const [width, height] = descriptor.size;
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
          ? `Texture upload bytesPerRow must be a positive integer for resource '${resourceKey}'.`
          : `Texture upload bytesPerRow for resource '${resourceKey}' must be at least ${minimumBytesPerRow} bytes for ${width} texel(s) of '${descriptor.format}'.`,
    };
  }

  if (
    upload.rowsPerImage !== undefined &&
    (!Number.isInteger(upload.rowsPerImage) || upload.rowsPerImage < blockRows)
  ) {
    return {
      code: "textureResource.invalidRowsPerImage",
      resourceKey,
      message: `Texture upload rowsPerImage for resource '${resourceKey}' must be an integer at least ${blockRows} row(s).`,
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
        message: `Texture upload data for resource '${resourceKey}' must contain at least ${minimumByteLength} byte(s); received ${upload.data.byteLength}.`,
      };
    }
  }

  return null;
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
