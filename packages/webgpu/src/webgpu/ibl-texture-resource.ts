import type {
  IblTexturePreparationReport,
  IblTexturePreparationSlot,
} from "./ibl-texture-preparation.js";
import {
  createPmremComputeDispatchSize,
  createPmremComputePipeline,
  type PmremComputeDeviceLike,
  type PmremComputeStorageFormat,
} from "./pmrem-compute-pipeline.js";
import {
  createTextureGpuResource,
  WEBGPU_TEXTURE_USAGE_FLAGS,
  type CreateTextureGpuResourceResult,
  type TextureGpuDeviceLike,
  type TextureGpuResource,
  type TextureGpuResourceDiagnostic,
} from "./texture-resources.js";

export type IblTextureResourceStatus =
  | "available"
  | "missing"
  | "unsupported"
  | "not-required";

export type IblTextureResourceDiagnostic =
  | TextureGpuResourceDiagnostic
  | {
      readonly code:
        | "iblTextureResource.missingTexturePreparation"
        | "iblTextureResource.unsupportedTextureSlots"
        | "iblTextureResource.invalidDiffuseCubeSource"
        | "iblTextureResource.invalidSpecularPmremSource"
        | "iblTextureResource.specularPmremDeviceUnsupported"
        | "iblTextureResource.specularPmremDispatchFailed"
        | "iblTextureResource.specularProofUploadPlaceholder"
        | "iblTextureResource.specularPrefilteringDeferred";
      readonly severity: "warning" | "error";
      readonly message: string;
      readonly resourceKey?: string;
    };

export interface DiffuseIblCubeSource {
  readonly resourceKey?: string;
  readonly sourceResourceKey?: string;
  readonly environmentMapResourceKey?: string;
  readonly label?: string;
  readonly faceSize: number;
  readonly faces: readonly Uint8Array[];
  readonly format?: PmremComputeStorageFormat;
}

export interface SpecularIblPmremSource {
  readonly resourceKey?: string;
  readonly sourceResourceKey?: string;
  readonly environmentMapResourceKey?: string;
  readonly label?: string;
  readonly faceSize: number;
  readonly faces: readonly Uint8Array[];
  readonly format?: PmremComputeStorageFormat;
  readonly mipLevelCount?: number;
}

export interface CreateDiffuseIblTextureResourceOptions {
  readonly device: TextureGpuDeviceLike;
  readonly textures: IblTexturePreparationReport;
  readonly size?: number;
  readonly cache?: Map<string, TextureGpuResource>;
  readonly diffuseSources?: readonly DiffuseIblCubeSource[];
}

export interface CreateSpecularIblTextureResourceOptions {
  readonly device: TextureGpuDeviceLike;
  readonly textures: IblTexturePreparationReport;
  readonly size?: number;
  readonly cache?: Map<string, TextureGpuResource>;
  readonly pmremSources?: readonly SpecularIblPmremSource[];
}

export interface DiffuseIblTextureResourceReport {
  readonly ready: boolean;
  readonly status: IblTextureResourceStatus;
  readonly textureSlotCount: number;
  readonly diffuseSlotCount: number;
  readonly createdTextureCount: number;
  readonly reusedTextureCount: number;
  readonly sections: {
    readonly texturePreparation: boolean;
    readonly diffuseTextureResource: boolean;
    readonly gpuAllocation: boolean;
    readonly specularPrefiltering: false;
    readonly shaderSampling: false;
  };
  readonly resources: readonly CreateTextureGpuResourceResult[];
  readonly diagnostics: readonly IblTextureResourceDiagnostic[];
}

export interface SpecularIblTextureResourceReport {
  readonly ready: boolean;
  readonly status: IblTextureResourceStatus;
  readonly textureSlotCount: number;
  readonly specularSlotCount: number;
  readonly createdTextureCount: number;
  readonly reusedTextureCount: number;
  readonly sections: {
    readonly texturePreparation: boolean;
    readonly specularTextureResource: boolean;
    readonly gpuAllocation: boolean;
    readonly proofUpload: boolean;
    readonly prefiltering: boolean;
    readonly bindGroupResource: false;
    readonly shaderSampling: false;
  };
  readonly resources: readonly CreateTextureGpuResourceResult[];
  readonly diagnostics: readonly IblTextureResourceDiagnostic[];
}

export interface DiffuseIblTextureResourceReportJsonValue {
  readonly ready: boolean;
  readonly status: IblTextureResourceStatus;
  readonly textureSlotCount: number;
  readonly diffuseSlotCount: number;
  readonly createdTextureCount: number;
  readonly reusedTextureCount: number;
  readonly sections: DiffuseIblTextureResourceReport["sections"];
  readonly resources: readonly {
    readonly valid: boolean;
    readonly resourceKey: string;
    readonly descriptor: {
      readonly label?: string;
      readonly size: readonly [number, number, number];
      readonly format: string;
      readonly usage: number;
      readonly mipLevelCount?: number;
    } | null;
  }[];
  readonly diagnostics: readonly {
    readonly code: string;
    readonly severity: "warning" | "error";
    readonly message: string;
    readonly resourceKey?: string;
  }[];
}

export interface SpecularIblTextureResourceReportJsonValue {
  readonly ready: boolean;
  readonly status: IblTextureResourceStatus;
  readonly textureSlotCount: number;
  readonly specularSlotCount: number;
  readonly createdTextureCount: number;
  readonly reusedTextureCount: number;
  readonly sections: SpecularIblTextureResourceReport["sections"];
  readonly resources: readonly {
    readonly valid: boolean;
    readonly resourceKey: string;
    readonly descriptor: {
      readonly label?: string;
      readonly size: readonly [number, number, number];
      readonly format: string;
      readonly usage: number;
      readonly mipLevelCount?: number;
    } | null;
  }[];
  readonly diagnostics: readonly {
    readonly code: string;
    readonly severity: "warning" | "error";
    readonly message: string;
    readonly resourceKey?: string;
  }[];
}

export function createDiffuseIblTextureResourceReport(
  options: CreateDiffuseIblTextureResourceOptions,
): DiffuseIblTextureResourceReport {
  const diagnostics: IblTextureResourceDiagnostic[] = [];

  if (options.textures.status === "not-required") {
    return emptyReport("not-required", options.textures.slotCount);
  }

  if (options.textures.status === "missing") {
    diagnostics.push({
      code: "iblTextureResource.missingTexturePreparation",
      severity: "warning",
      message:
        "Diffuse IBL texture resource allocation requires valid IBL texture preparation descriptors.",
    });

    return report({
      status: "missing",
      textureSlotCount: options.textures.slotCount,
      diffuseSlotCount: 0,
      resources: [],
      diagnostics,
    });
  }

  if (options.textures.status === "unsupported") {
    diagnostics.push({
      code: "iblTextureResource.unsupportedTextureSlots",
      severity: "warning",
      message:
        "Diffuse IBL texture resource allocation cannot proceed while IBL texture slots are unsupported.",
    });

    return report({
      status: "unsupported",
      textureSlotCount: options.textures.slotCount,
      diffuseSlotCount: 0,
      resources: [],
      diagnostics,
    });
  }

  const diffuseSlots = options.textures.slots.filter(
    (slot) =>
      slot.kind === "diffuse" &&
      slot.sourceResourceKey !== null &&
      slot.textureKey !== null,
  );
  let createdTextureCount = 0;
  let reusedTextureCount = 0;
  const resources = diffuseSlots.map((slot) => {
    const resourceKey = slot.textureKey ?? `${slot.sourceResourceKey}:texture`;
    const cached = options.cache?.get(resourceKey);

    if (cached !== undefined) {
      reusedTextureCount += 1;
      return {
        valid: true,
        resource: cached,
        diagnostics: [],
      };
    }

    const diffuseSource = findDiffuseCubeSource(
      options.diffuseSources,
      resourceKey,
      slot,
    );
    const sourceResult =
      diffuseSource === undefined
        ? null
        : createDiffuseIblCubeTextureResource({
            device: options.device,
            resourceKey,
            slot,
            source: diffuseSource,
          });

    if (sourceResult !== null) {
      diagnostics.push(...sourceResult.diagnostics);
    }

    const result =
      sourceResult?.result.valid === true
        ? sourceResult.result
        : createTextureGpuResource({
            device: options.device,
            resourceKey,
            descriptor: {
              label: `${slot.environmentMapResourceKey}:diffuse-ibl`,
              size: [options.size ?? 64, options.size ?? 64, 6],
              format: slot.format,
              usage:
                WEBGPU_TEXTURE_USAGE_FLAGS.TEXTURE_BINDING |
                WEBGPU_TEXTURE_USAGE_FLAGS.COPY_DST,
              mipLevelCount: 1,
            },
            ...(options.device.queue?.writeTexture === undefined
              ? {}
              : {
                  upload: createDefaultDiffuseIblUpload(
                    options.size ?? 64,
                    slot.format,
                  ),
                }),
            viewDescriptor: { dimension: "cube" },
          });

    if (result.valid && result.resource !== null) {
      options.cache?.set(resourceKey, result.resource);
      createdTextureCount += 1;
    }

    return result;
  });

  for (const resource of resources) {
    diagnostics.push(
      ...resource.diagnostics.map((diagnostic) => ({
        ...diagnostic,
        severity: "warning" as const,
      })),
    );
  }

  return report({
    status: resources.every((resource) => resource.valid)
      ? "available"
      : "missing",
    textureSlotCount: options.textures.slotCount,
    diffuseSlotCount: diffuseSlots.length,
    createdTextureCount,
    reusedTextureCount,
    resources,
    diagnostics,
  });
}

function createDefaultDiffuseIblUpload(size: number, format: string) {
  const bytesPerPixel = format === "rgba16float" ? 8 : 4;
  const bytesPerRow = size * bytesPerPixel;
  const data = new Uint8Array(bytesPerRow * size * 6);

  if (bytesPerPixel === 8) {
    for (let index = 0; index < data.length; index += 8) {
      data[index] = 0x00;
      data[index + 1] = 0x38;
      data[index + 2] = 0x00;
      data[index + 3] = 0x38;
      data[index + 4] = 0x00;
      data[index + 5] = 0x38;
      data[index + 6] = 0x00;
      data[index + 7] = 0x3c;
    }
  } else {
    for (let index = 0; index < data.length; index += 4) {
      data[index] = 128;
      data[index + 1] = 144;
      data[index + 2] = 168;
      data[index + 3] = 255;
    }
  }

  return {
    data,
    bytesPerRow,
    rowsPerImage: size,
  };
}

interface DiffuseIblCubeTextureResourceResult {
  readonly result: CreateTextureGpuResourceResult;
  readonly diagnostics: readonly IblTextureResourceDiagnostic[];
}

function findDiffuseCubeSource(
  sources: readonly DiffuseIblCubeSource[] | undefined,
  resourceKey: string,
  slot: IblTexturePreparationSlot,
): DiffuseIblCubeSource | undefined {
  return sources?.find(
    (source) =>
      source.resourceKey === resourceKey ||
      (source.sourceResourceKey !== undefined &&
        source.sourceResourceKey === slot.sourceResourceKey) ||
      (source.environmentMapResourceKey !== undefined &&
        source.environmentMapResourceKey === slot.environmentMapResourceKey),
  );
}

function createDiffuseIblCubeTextureResource(input: {
  readonly device: TextureGpuDeviceLike;
  readonly resourceKey: string;
  readonly slot: IblTexturePreparationSlot;
  readonly source: DiffuseIblCubeSource;
}): DiffuseIblCubeTextureResourceResult {
  const sourceDiagnostic = validateDiffuseCubeSource(
    input.resourceKey,
    input.source,
  );

  if (sourceDiagnostic !== null) {
    return {
      result: missingTextureResult(),
      diagnostics: [sourceDiagnostic],
    };
  }

  const label = input.source.label ?? input.slot.environmentMapResourceKey;
  const faceSize = input.source.faceSize;
  const format = input.source.format ?? "rgba8unorm";

  return {
    result: createTextureGpuResource({
      device: input.device,
      resourceKey: input.resourceKey,
      descriptor: {
        label: `${label}:diffuse-ibl`,
        size: [faceSize, faceSize, 6],
        format,
        usage:
          WEBGPU_TEXTURE_USAGE_FLAGS.TEXTURE_BINDING |
          WEBGPU_TEXTURE_USAGE_FLAGS.COPY_DST,
        mipLevelCount: 1,
      },
      upload: createCubeFacesUpload(input.source.faces, faceSize, format),
      viewDescriptor: { dimension: "cube" },
    }),
    diagnostics: [],
  };
}

function validateDiffuseCubeSource(
  resourceKey: string,
  source: DiffuseIblCubeSource,
): IblTextureResourceDiagnostic | null {
  const format = source.format ?? "rgba8unorm";
  const bytesPerPixel = bytesPerPixelForPmremFormat(format);

  if (!Number.isInteger(source.faceSize) || source.faceSize <= 0) {
    return invalidDiffuseCubeSource(
      resourceKey,
      "Diffuse IBL cube source faceSize must be a positive integer.",
    );
  }

  if (bytesPerPixel === null) {
    return invalidDiffuseCubeSource(
      resourceKey,
      `Diffuse IBL cube source format '${format}' is unsupported.`,
    );
  }

  if (source.faces.length !== 6) {
    return invalidDiffuseCubeSource(
      resourceKey,
      "Diffuse IBL cube source must provide exactly six cube faces.",
    );
  }

  const minimumFaceByteLength =
    source.faceSize * source.faceSize * bytesPerPixel;

  for (let face = 0; face < source.faces.length; face += 1) {
    const faceData = source.faces[face];

    if (faceData === undefined || faceData.byteLength < minimumFaceByteLength) {
      return invalidDiffuseCubeSource(
        resourceKey,
        `Diffuse IBL cube source face ${face} must contain at least ${minimumFaceByteLength} bytes.`,
      );
    }
  }

  return null;
}

function invalidDiffuseCubeSource(
  resourceKey: string,
  message: string,
): IblTextureResourceDiagnostic {
  return {
    code: "iblTextureResource.invalidDiffuseCubeSource",
    severity: "warning",
    resourceKey,
    message,
  };
}

function createDefaultSpecularIblUpload(size: number, format: string) {
  const upload = createDefaultDiffuseIblUpload(size, format);

  if (format === "rgba16float") {
    for (let index = 0; index < upload.data.length; index += 8) {
      upload.data[index] = 0x00;
      upload.data[index + 1] = 0x34;
      upload.data[index + 2] = 0x00;
      upload.data[index + 3] = 0x34;
      upload.data[index + 4] = 0x00;
      upload.data[index + 5] = 0x34;
      upload.data[index + 6] = 0x00;
      upload.data[index + 7] = 0x3c;
    }
  }

  return upload;
}

interface SpecularIblPmremDeviceLike
  extends TextureGpuDeviceLike, PmremComputeDeviceLike {
  readonly createTexture: NonNullable<TextureGpuDeviceLike["createTexture"]>;
  readonly createSampler: NonNullable<TextureGpuDeviceLike["createSampler"]>;
  readonly createShaderModule: NonNullable<
    PmremComputeDeviceLike["createShaderModule"]
  >;
  readonly createBindGroupLayout: NonNullable<
    PmremComputeDeviceLike["createBindGroupLayout"]
  >;
  readonly createPipelineLayout: NonNullable<
    PmremComputeDeviceLike["createPipelineLayout"]
  >;
  readonly createComputePipeline: NonNullable<
    PmremComputeDeviceLike["createComputePipeline"]
  >;
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
    readonly writeTexture: NonNullable<
      NonNullable<TextureGpuDeviceLike["queue"]>["writeTexture"]
    >;
    readonly writeBuffer: (
      buffer: unknown,
      offset: number,
      data: Uint32Array,
    ) => void;
    readonly submit: (commandBuffers: readonly unknown[]) => void;
  };
}

interface SpecularIblPmremTextureResourceResult {
  readonly result: CreateTextureGpuResourceResult;
  readonly diagnostics: readonly IblTextureResourceDiagnostic[];
}

function findSpecularPmremSource(
  sources: readonly SpecularIblPmremSource[] | undefined,
  resourceKey: string,
  slot: IblTexturePreparationSlot,
): SpecularIblPmremSource | undefined {
  return sources?.find(
    (source) =>
      source.resourceKey === resourceKey ||
      (source.sourceResourceKey !== undefined &&
        source.sourceResourceKey === slot.sourceResourceKey) ||
      (source.environmentMapResourceKey !== undefined &&
        source.environmentMapResourceKey === slot.environmentMapResourceKey),
  );
}

function createSpecularIblPmremTextureResource(input: {
  readonly device: TextureGpuDeviceLike;
  readonly resourceKey: string;
  readonly slot: IblTexturePreparationSlot;
  readonly source: SpecularIblPmremSource;
}): SpecularIblPmremTextureResourceResult {
  const diagnostics: IblTextureResourceDiagnostic[] = [];
  const sourceDiagnostic = validateSpecularPmremSource(
    input.resourceKey,
    input.source,
  );

  if (sourceDiagnostic !== null) {
    return {
      result: missingTextureResult(),
      diagnostics: [sourceDiagnostic],
    };
  }

  if (!hasSpecularPmremDeviceSupport(input.device)) {
    return {
      result: missingTextureResult(),
      diagnostics: [
        {
          code: "iblTextureResource.specularPmremDeviceUnsupported",
          severity: "warning",
          resourceKey: input.resourceKey,
          message:
            "Specular IBL PMREM execution requires texture, sampler, compute pipeline, bind group, command encoder, uniform buffer, and queue support.",
        },
      ],
    };
  }

  const device = input.device;
  const label = input.source.label ?? input.slot.environmentMapResourceKey;
  const faceSize = input.source.faceSize;
  const format = input.source.format ?? "rgba8unorm";
  const mipLevelCount =
    input.source.mipLevelCount ?? mipLevelCountForSize(faceSize);
  const pipeline = createPmremComputePipeline({
    device,
    storageFormat: format,
    label: `${label}:pmrem`,
  });

  if (!pipeline.valid || pipeline.resource === null) {
    return {
      result: missingTextureResult(),
      diagnostics: [
        ...pipeline.diagnostics.map((diagnostic) => ({
          code: "iblTextureResource.specularPmremDeviceUnsupported" as const,
          severity: "warning" as const,
          resourceKey: input.resourceKey,
          message: diagnostic.message,
        })),
      ],
    };
  }

  try {
    const sourceTexture = device.createTexture({
      label: `${label}:specular-ibl-source`,
      size: [faceSize, faceSize, 6],
      format,
      usage:
        WEBGPU_TEXTURE_USAGE_FLAGS.TEXTURE_BINDING |
        WEBGPU_TEXTURE_USAGE_FLAGS.COPY_DST,
    });
    const texture = device.createTexture({
      label: `${label}:specular-ibl-pmrem-mip-chain`,
      size: [faceSize, faceSize, 6],
      format,
      usage:
        WEBGPU_TEXTURE_USAGE_FLAGS.TEXTURE_BINDING |
        WEBGPU_TEXTURE_USAGE_FLAGS.STORAGE_BINDING |
        WEBGPU_TEXTURE_USAGE_FLAGS.RENDER_ATTACHMENT,
      mipLevelCount,
    });

    input.source.faces.forEach((face, layer) => {
      const upload = createPaddedCubeFaceUpload(face, faceSize, format);

      device.queue.writeTexture(
        { texture: sourceTexture, origin: [0, 0, layer] },
        upload.data,
        { bytesPerRow: upload.bytesPerRow, rowsPerImage: faceSize },
        [faceSize, faceSize, 1],
      );
    });

    const sampler = device.createSampler({
      label: `${label}:pmrem-source-sampler`,
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
      addressModeW: "clamp-to-edge",
      magFilter: "nearest",
      minFilter: "nearest",
    });
    const sourceView = sourceTexture.createView?.({
      label: `${label}:pmrem-source-view`,
      dimension: "cube",
    });

    if (sourceView === undefined) {
      throw new Error("PMREM source texture cannot create a cube view.");
    }

    const encoder = device.createCommandEncoder({
      label: `${label}:pmrem-dispatch`,
    });
    const pass = encoder.beginComputePass?.({
      label: `${label}:pmrem-mip-chain`,
    });

    if (
      pass?.setPipeline === undefined ||
      pass.setBindGroup === undefined ||
      pass.dispatchWorkgroups === undefined ||
      pass.end === undefined
    ) {
      throw new Error("PMREM compute pass is missing required methods.");
    }

    pass.setPipeline(pipeline.resource.pipeline);

    for (let mipLevel = 0; mipLevel < mipLevelCount; mipLevel += 1) {
      const mipSize = Math.max(1, faceSize >> mipLevel);
      const params = device.createBuffer({
        label: `${label}:pmrem-mip-${mipLevel}-params`,
        size: 16,
        usage: 0x40 | 0x08,
      });

      device.queue.writeBuffer(
        params,
        0,
        new Uint32Array([mipSize, mipSize, 6, mipLevel]),
      );

      const outputView = texture.createView?.({
        dimension: "2d-array",
        baseMipLevel: mipLevel,
        mipLevelCount: 1,
      });

      if (outputView === undefined) {
        throw new Error("PMREM output texture cannot create a mip view.");
      }

      const bindGroup = device.createBindGroup({
        label: `${label}:pmrem-mip-${mipLevel}`,
        layout: pipeline.resource.bindGroupLayout,
        entries: [
          { binding: 0, resource: sampler },
          { binding: 1, resource: sourceView },
          { binding: 2, resource: outputView },
          { binding: 3, resource: { buffer: params } },
        ],
      });
      const dispatch = createPmremComputeDispatchSize({
        width: mipSize,
        height: mipSize,
        layers: 6,
      });

      pass.setBindGroup(0, bindGroup);
      pass.dispatchWorkgroups(dispatch.x, dispatch.y, dispatch.z);
    }

    pass.end();

    if (encoder.finish === undefined) {
      throw new Error("PMREM command encoder cannot finish command buffers.");
    }

    device.queue.submit([encoder.finish()]);

    const view = texture.createView?.({
      label: `${label}:specular-ibl-pmrem-mip-chain-view`,
      dimension: "cube",
    });

    if (view === undefined) {
      throw new Error("PMREM output texture cannot create a cube view.");
    }

    return {
      result: {
        valid: true,
        resource: {
          resourceKey: input.resourceKey,
          texture,
          view,
          descriptor: {
            label: `${label}:specular-ibl-pmrem-mip-chain`,
            size: [faceSize, faceSize, 6],
            format,
            usage:
              WEBGPU_TEXTURE_USAGE_FLAGS.TEXTURE_BINDING |
              WEBGPU_TEXTURE_USAGE_FLAGS.STORAGE_BINDING |
              WEBGPU_TEXTURE_USAGE_FLAGS.RENDER_ATTACHMENT,
            mipLevelCount,
          },
          viewDescriptor: { dimension: "cube" },
          prefiltered: true,
        },
        diagnostics: [],
      },
      diagnostics,
    };
  } catch (error) {
    return {
      result: missingTextureResult(),
      diagnostics: [
        {
          code: "iblTextureResource.specularPmremDispatchFailed",
          severity: "warning",
          resourceKey: input.resourceKey,
          message:
            error instanceof Error
              ? error.message
              : "Specular IBL PMREM dispatch failed.",
        },
      ],
    };
  }
}

function validateSpecularPmremSource(
  resourceKey: string,
  source: SpecularIblPmremSource,
): IblTextureResourceDiagnostic | null {
  const format = source.format ?? "rgba8unorm";
  const bytesPerPixel = bytesPerPixelForPmremFormat(format);

  if (!Number.isInteger(source.faceSize) || source.faceSize <= 0) {
    return invalidSpecularPmremSource(
      resourceKey,
      "Specular IBL PMREM source faceSize must be a positive integer.",
    );
  }

  if (bytesPerPixel === null) {
    return invalidSpecularPmremSource(
      resourceKey,
      `Specular IBL PMREM source format '${format}' is unsupported.`,
    );
  }

  if (source.faces.length !== 6) {
    return invalidSpecularPmremSource(
      resourceKey,
      "Specular IBL PMREM source must provide exactly six cube faces.",
    );
  }

  const minimumFaceByteLength =
    source.faceSize * source.faceSize * bytesPerPixel;

  for (let face = 0; face < source.faces.length; face += 1) {
    const faceData = source.faces[face];

    if (faceData === undefined || faceData.byteLength < minimumFaceByteLength) {
      return invalidSpecularPmremSource(
        resourceKey,
        `Specular IBL PMREM source face ${face} must contain at least ${minimumFaceByteLength} bytes.`,
      );
    }
  }

  return null;
}

function invalidSpecularPmremSource(
  resourceKey: string,
  message: string,
): IblTextureResourceDiagnostic {
  return {
    code: "iblTextureResource.invalidSpecularPmremSource",
    severity: "warning",
    resourceKey,
    message,
  };
}

function hasSpecularPmremDeviceSupport(
  device: TextureGpuDeviceLike,
): device is SpecularIblPmremDeviceLike {
  const maybeDevice = device as SpecularIblPmremDeviceLike;

  return (
    maybeDevice.createTexture !== undefined &&
    maybeDevice.createSampler !== undefined &&
    maybeDevice.createShaderModule !== undefined &&
    maybeDevice.createBindGroupLayout !== undefined &&
    maybeDevice.createPipelineLayout !== undefined &&
    maybeDevice.createComputePipeline !== undefined &&
    maybeDevice.createBuffer !== undefined &&
    maybeDevice.createBindGroup !== undefined &&
    maybeDevice.createCommandEncoder !== undefined &&
    maybeDevice.queue?.writeTexture !== undefined &&
    maybeDevice.queue.writeBuffer !== undefined &&
    maybeDevice.queue.submit !== undefined
  );
}

function createPaddedCubeFaceUpload(
  face: Uint8Array,
  faceSize: number,
  format: PmremComputeStorageFormat,
): { readonly data: Uint8Array; readonly bytesPerRow: number } {
  const bytesPerPixel = bytesPerPixelForPmremFormat(format) ?? 4;
  const sourceBytesPerRow = faceSize * bytesPerPixel;
  const bytesPerRow = alignTo(sourceBytesPerRow, 256);
  const data = new Uint8Array(bytesPerRow * faceSize);

  for (let y = 0; y < faceSize; y += 1) {
    data.set(
      face.subarray(y * sourceBytesPerRow, (y + 1) * sourceBytesPerRow),
      y * bytesPerRow,
    );
  }

  return { data, bytesPerRow };
}

function createCubeFacesUpload(
  faces: readonly Uint8Array[],
  faceSize: number,
  format: PmremComputeStorageFormat,
): {
  readonly data: Uint8Array;
  readonly bytesPerRow: number;
  readonly rowsPerImage: number;
} {
  const bytesPerPixel = bytesPerPixelForPmremFormat(format) ?? 4;
  const sourceBytesPerRow = faceSize * bytesPerPixel;
  const bytesPerRow = alignTo(sourceBytesPerRow, 256);
  const data = new Uint8Array(bytesPerRow * faceSize * faces.length);

  for (let layer = 0; layer < faces.length; layer += 1) {
    const face = faces[layer];

    if (face === undefined) {
      continue;
    }

    for (let y = 0; y < faceSize; y += 1) {
      data.set(
        face.subarray(y * sourceBytesPerRow, (y + 1) * sourceBytesPerRow),
        layer * bytesPerRow * faceSize + y * bytesPerRow,
      );
    }
  }

  return { data, bytesPerRow, rowsPerImage: faceSize };
}

function bytesPerPixelForPmremFormat(
  format: PmremComputeStorageFormat,
): number | null {
  switch (format) {
    case "rgba8unorm":
      return 4;
    case "rgba16float":
      return 8;
    default:
      return null;
  }
}

function alignTo(value: number, alignment: number): number {
  return Math.ceil(value / alignment) * alignment;
}

function missingTextureResult(): CreateTextureGpuResourceResult {
  return {
    valid: false,
    resource: null,
    diagnostics: [],
  };
}

export function createSpecularIblTextureResourceReport(
  options: CreateSpecularIblTextureResourceOptions,
): SpecularIblTextureResourceReport {
  const diagnostics: IblTextureResourceDiagnostic[] = [];

  if (options.textures.status === "not-required") {
    return specularReport({
      status: "not-required",
      textureSlotCount: options.textures.slotCount,
      specularSlotCount: 0,
      resources: [],
      diagnostics,
    });
  }

  if (options.textures.status === "missing") {
    diagnostics.push({
      code: "iblTextureResource.missingTexturePreparation",
      severity: "warning",
      message:
        "Specular IBL texture resource allocation requires valid IBL texture preparation descriptors.",
    });

    return specularReport({
      status: "missing",
      textureSlotCount: options.textures.slotCount,
      specularSlotCount: 0,
      resources: [],
      diagnostics,
    });
  }

  if (options.textures.status === "unsupported") {
    diagnostics.push({
      code: "iblTextureResource.unsupportedTextureSlots",
      severity: "warning",
      message:
        "Specular IBL texture resource allocation cannot proceed while IBL texture slots are unsupported.",
    });

    return specularReport({
      status: "unsupported",
      textureSlotCount: options.textures.slotCount,
      specularSlotCount: 0,
      resources: [],
      diagnostics,
    });
  }

  const size = options.size ?? 128;
  const specularSlots = options.textures.slots.filter(
    (slot) =>
      slot.kind === "specular" &&
      slot.sourceResourceKey !== null &&
      slot.textureKey !== null,
  );
  let createdTextureCount = 0;
  let reusedTextureCount = 0;
  const resources = specularSlots.map((slot) => {
    const resourceKey = slot.textureKey ?? `${slot.sourceResourceKey}:texture`;
    const cached = options.cache?.get(resourceKey);

    if (cached !== undefined) {
      reusedTextureCount += 1;
      return {
        valid: true,
        resource: cached,
        diagnostics: [],
      };
    }

    const pmremSource = findSpecularPmremSource(
      options.pmremSources,
      resourceKey,
      slot,
    );
    const pmremResult =
      pmremSource === undefined
        ? null
        : createSpecularIblPmremTextureResource({
            device: options.device,
            resourceKey,
            slot,
            source: pmremSource,
          });

    if (pmremResult !== null) {
      diagnostics.push(...pmremResult.diagnostics);
    }

    const result =
      pmremResult?.result.valid === true
        ? pmremResult.result
        : createTextureGpuResource({
            device: options.device,
            resourceKey,
            descriptor: {
              label: `${slot.environmentMapResourceKey}:specular-ibl`,
              size: [size, size, 6],
              format: slot.format,
              usage:
                WEBGPU_TEXTURE_USAGE_FLAGS.TEXTURE_BINDING |
                WEBGPU_TEXTURE_USAGE_FLAGS.COPY_DST |
                WEBGPU_TEXTURE_USAGE_FLAGS.RENDER_ATTACHMENT,
              mipLevelCount: mipLevelCountForSize(size),
            },
            ...(options.device.queue?.writeTexture === undefined
              ? {}
              : { upload: createDefaultSpecularIblUpload(size, slot.format) }),
            viewDescriptor: { dimension: "cube" },
          });

    if (result.valid && result.resource !== null) {
      options.cache?.set(resourceKey, result.resource);
      createdTextureCount += 1;
    }

    return result;
  });

  for (const resource of resources) {
    diagnostics.push(
      ...resource.diagnostics.map((diagnostic) => ({
        ...diagnostic,
        severity: "warning" as const,
      })),
    );
  }

  if (resources.some((resource) => resource.valid)) {
    const prefiltered = resources.some(
      (resource) => resource.resource?.prefiltered === true,
    );

    if (!prefiltered && options.device.queue?.writeTexture !== undefined) {
      diagnostics.push({
        code: "iblTextureResource.specularProofUploadPlaceholder",
        severity: "warning",
        message:
          "Specular IBL texture resource uses a deterministic proof-upload placeholder; full PMREM/GGX prefiltering remains deferred.",
      });
    }

    if (!prefiltered) {
      diagnostics.push({
        code: "iblTextureResource.specularPrefilteringDeferred",
        severity: "warning",
        message:
          "Specular IBL texture resources are allocated, but prefilter pass execution remains deferred.",
      });
    }
  }

  return specularReport({
    status: resources.every((resource) => resource.valid)
      ? "available"
      : "missing",
    textureSlotCount: options.textures.slotCount,
    specularSlotCount: specularSlots.length,
    createdTextureCount,
    reusedTextureCount,
    resources,
    diagnostics,
  });
}

export function diffuseIblTextureResourceReportToJsonValue(
  report: DiffuseIblTextureResourceReport,
): DiffuseIblTextureResourceReportJsonValue {
  return {
    ready: report.ready,
    status: report.status,
    textureSlotCount: report.textureSlotCount,
    diffuseSlotCount: report.diffuseSlotCount,
    createdTextureCount: report.createdTextureCount,
    reusedTextureCount: report.reusedTextureCount,
    sections: { ...report.sections },
    resources: report.resources.map((resource) => ({
      valid: resource.valid,
      resourceKey:
        resource.resource?.resourceKey ??
        resource.diagnostics[0]?.resourceKey ??
        "",
      descriptor:
        resource.resource === null
          ? null
          : {
              ...resource.resource.descriptor,
              size: [...resource.resource.descriptor.size] as [
                number,
                number,
                number,
              ],
            },
    })),
    diagnostics: report.diagnostics.map((diagnostic) => ({
      code: diagnostic.code,
      severity: "severity" in diagnostic ? diagnostic.severity : "warning",
      message: diagnostic.message,
      ...("resourceKey" in diagnostic && diagnostic.resourceKey !== undefined
        ? { resourceKey: diagnostic.resourceKey }
        : {}),
    })),
  };
}

export function diffuseIblTextureResourceReportToJson(
  report: DiffuseIblTextureResourceReport,
): string {
  return JSON.stringify(diffuseIblTextureResourceReportToJsonValue(report));
}

export function specularIblTextureResourceReportToJsonValue(
  report: SpecularIblTextureResourceReport,
): SpecularIblTextureResourceReportJsonValue {
  return {
    ready: report.ready,
    status: report.status,
    textureSlotCount: report.textureSlotCount,
    specularSlotCount: report.specularSlotCount,
    createdTextureCount: report.createdTextureCount,
    reusedTextureCount: report.reusedTextureCount,
    sections: { ...report.sections },
    resources: report.resources.map((resource) => ({
      valid: resource.valid,
      resourceKey:
        resource.resource?.resourceKey ??
        resource.diagnostics[0]?.resourceKey ??
        "",
      descriptor:
        resource.resource === null
          ? null
          : {
              ...resource.resource.descriptor,
              size: [...resource.resource.descriptor.size] as [
                number,
                number,
                number,
              ],
            },
    })),
    diagnostics: report.diagnostics.map((diagnostic) => ({
      code: diagnostic.code,
      severity: "severity" in diagnostic ? diagnostic.severity : "warning",
      message: diagnostic.message,
      ...("resourceKey" in diagnostic && diagnostic.resourceKey !== undefined
        ? { resourceKey: diagnostic.resourceKey }
        : {}),
    })),
  };
}

export function specularIblTextureResourceReportToJson(
  report: SpecularIblTextureResourceReport,
): string {
  return JSON.stringify(specularIblTextureResourceReportToJsonValue(report));
}

function emptyReport(
  status: IblTextureResourceStatus,
  textureSlotCount: number,
): DiffuseIblTextureResourceReport {
  return report({
    status,
    textureSlotCount,
    diffuseSlotCount: 0,
    resources: [],
    diagnostics: [],
  });
}

function report(input: {
  readonly status: IblTextureResourceStatus;
  readonly textureSlotCount: number;
  readonly diffuseSlotCount: number;
  readonly createdTextureCount?: number;
  readonly reusedTextureCount?: number;
  readonly resources: readonly CreateTextureGpuResourceResult[];
  readonly diagnostics: readonly IblTextureResourceDiagnostic[];
}): DiffuseIblTextureResourceReport {
  const createdTextureCount =
    input.createdTextureCount ??
    input.resources.filter((resource) => resource.valid).length;
  const reusedTextureCount = input.reusedTextureCount ?? 0;

  return {
    ready: input.status === "available" || input.status === "not-required",
    status: input.status,
    textureSlotCount: input.textureSlotCount,
    diffuseSlotCount: input.diffuseSlotCount,
    createdTextureCount,
    reusedTextureCount,
    sections: {
      texturePreparation:
        input.status !== "missing" && input.status !== "unsupported",
      diffuseTextureResource: input.status === "available",
      gpuAllocation: input.status === "available",
      specularPrefiltering: false,
      shaderSampling: false,
    },
    resources: input.resources,
    diagnostics: input.diagnostics,
  };
}

function specularReport(input: {
  readonly status: IblTextureResourceStatus;
  readonly textureSlotCount: number;
  readonly specularSlotCount: number;
  readonly createdTextureCount?: number;
  readonly reusedTextureCount?: number;
  readonly resources: readonly CreateTextureGpuResourceResult[];
  readonly diagnostics: readonly IblTextureResourceDiagnostic[];
}): SpecularIblTextureResourceReport {
  const createdTextureCount =
    input.createdTextureCount ??
    input.resources.filter((resource) => resource.valid).length;
  const reusedTextureCount = input.reusedTextureCount ?? 0;

  return {
    ready: input.status === "available" || input.status === "not-required",
    status: input.status,
    textureSlotCount: input.textureSlotCount,
    specularSlotCount: input.specularSlotCount,
    createdTextureCount,
    reusedTextureCount,
    sections: {
      texturePreparation:
        input.status !== "missing" && input.status !== "unsupported",
      specularTextureResource: input.status === "available",
      gpuAllocation: input.status === "available",
      proofUpload: input.diagnostics.some(
        (diagnostic) =>
          diagnostic.code ===
          "iblTextureResource.specularProofUploadPlaceholder",
      ),
      prefiltering: input.resources.some(
        (resource) => resource.resource?.prefiltered === true,
      ),
      bindGroupResource: false,
      shaderSampling: false,
    },
    resources: input.resources,
    diagnostics: input.diagnostics,
  };
}

function mipLevelCountForSize(size: number): number {
  return Math.max(1, 1 + Math.floor(Math.log2(Math.max(1, size))));
}
