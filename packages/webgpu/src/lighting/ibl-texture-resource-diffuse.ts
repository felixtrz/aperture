import type { IblTexturePreparationSlot } from "./ibl-texture-preparation.js";
import {
  createCubeFacesUpload,
  createDefaultDiffuseIblUpload,
  createPaddedCubeFaceUpload,
  bytesPerPixelForPmremFormat,
  missingTextureResult,
} from "./ibl-texture-resource-utils.js";
import {
  createIrradianceConvolutionComputePipeline,
  createIrradianceConvolutionDispatchSize,
  IRRADIANCE_CONVOLUTION_DEFAULT_SAMPLE_COUNT,
  type IrradianceConvolutionDeviceLike,
} from "./irradiance-convolution-compute-pipeline.js";
import type {
  CreateDiffuseIblTextureResourceOptions,
  DiffuseIblCubeSource,
  DiffuseIblTextureResourceReport,
  IblTextureResourceDiagnostic,
  IblTextureResourceStatus,
} from "./ibl-texture-resource-types.js";
import {
  createTextureGpuResource,
  WEBGPU_TEXTURE_USAGE_FLAGS,
  type CreateTextureGpuResourceResult,
  type TextureGpuDeviceLike,
  type TextureGpuResource,
} from "../resources/textures/texture-resources.js";

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
  const convolveIrradiance = options.convolveIrradiance !== false;
  const irradianceFaceSize =
    options.irradianceFaceSize ?? DEFAULT_IRRADIANCE_FACE_SIZE;
  let createdTextureCount = 0;
  let reusedTextureCount = 0;
  let convolvedCount = 0;
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
            convolveIrradiance,
            irradianceFaceSize,
          });

    if (sourceResult !== null) {
      diagnostics.push(...sourceResult.diagnostics);

      if (sourceResult.convolved) {
        convolvedCount += 1;
      }
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
    ...(convolvedCount > 0 ? { convolved: true, irradianceFaceSize } : {}),
  });
}

interface DiffuseIblCubeTextureResourceResult {
  readonly result: CreateTextureGpuResourceResult;
  readonly diagnostics: readonly IblTextureResourceDiagnostic[];
  readonly convolved: boolean;
}

const DEFAULT_IRRADIANCE_FACE_SIZE = 32;

interface DiffuseConvolutionDeviceLike
  extends TextureGpuDeviceLike, IrradianceConvolutionDeviceLike {
  readonly createTexture: NonNullable<TextureGpuDeviceLike["createTexture"]>;
  readonly createSampler: NonNullable<TextureGpuDeviceLike["createSampler"]>;
  readonly createShaderModule: NonNullable<
    IrradianceConvolutionDeviceLike["createShaderModule"]
  >;
  readonly createBindGroupLayout: NonNullable<
    IrradianceConvolutionDeviceLike["createBindGroupLayout"]
  >;
  readonly createPipelineLayout: NonNullable<
    IrradianceConvolutionDeviceLike["createPipelineLayout"]
  >;
  readonly createComputePipeline: NonNullable<
    IrradianceConvolutionDeviceLike["createComputePipeline"]
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

function hasIrradianceConvolutionDeviceSupport(
  device: TextureGpuDeviceLike,
): device is DiffuseConvolutionDeviceLike {
  const maybeDevice = device as DiffuseConvolutionDeviceLike;

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

function convolveDiffuseIrradiance(input: {
  readonly device: DiffuseConvolutionDeviceLike;
  readonly resourceKey: string;
  readonly label: string;
  readonly sourceFaceSize: number;
  readonly faces?: readonly Uint8Array[];
  readonly sourceTexture?: TextureGpuResource;
  readonly format: "rgba8unorm" | "rgba16float";
  readonly targetFaceSize: number;
}): CreateTextureGpuResourceResult {
  const device = input.device;
  const { label, format, sourceFaceSize, targetFaceSize } = input;
  const pipeline = createIrradianceConvolutionComputePipeline({
    device,
    storageFormat: format,
    label: `${label}:irradiance`,
  });

  if (!pipeline.valid || pipeline.resource === null) {
    throw new Error(
      pipeline.diagnostics[0]?.message ??
        "Irradiance-convolution pipeline unavailable.",
    );
  }

  let sourceView = input.sourceTexture?.view;

  if (sourceView === undefined) {
    if (input.faces === undefined) {
      throw new Error(
        "Irradiance source requires cube faces or a projected source texture.",
      );
    }

    const sourceTexture = device.createTexture({
      label: `${label}:diffuse-ibl-source`,
      size: [sourceFaceSize, sourceFaceSize, 6],
      format,
      usage:
        WEBGPU_TEXTURE_USAGE_FLAGS.TEXTURE_BINDING |
        WEBGPU_TEXTURE_USAGE_FLAGS.COPY_DST,
    });

    input.faces.forEach((face, layer) => {
      const upload = createPaddedCubeFaceUpload(face, sourceFaceSize, format);

      device.queue.writeTexture(
        { texture: sourceTexture, origin: [0, 0, layer] },
        upload.data,
        { bytesPerRow: upload.bytesPerRow, rowsPerImage: sourceFaceSize },
        [sourceFaceSize, sourceFaceSize, 1],
      );
    });

    sourceView = sourceTexture.createView?.({
      label: `${label}:irradiance-source-view`,
      dimension: "cube",
    });
  }

  const texture = device.createTexture({
    label: `${label}:diffuse-ibl-irradiance`,
    size: [targetFaceSize, targetFaceSize, 6],
    format,
    usage:
      WEBGPU_TEXTURE_USAGE_FLAGS.TEXTURE_BINDING |
      WEBGPU_TEXTURE_USAGE_FLAGS.STORAGE_BINDING,
    mipLevelCount: 1,
  });

  const sampler = device.createSampler({
    label: `${label}:irradiance-source-sampler`,
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge",
    addressModeW: "clamp-to-edge",
    magFilter: "linear",
    minFilter: "linear",
  });
  if (sourceView === undefined) {
    throw new Error("Irradiance source texture cannot create a cube view.");
  }

  const params = device.createBuffer({
    label: `${label}:irradiance-params`,
    size: 16,
    usage: 0x40 | 0x08,
  });

  device.queue.writeBuffer(
    params,
    0,
    new Uint32Array([
      targetFaceSize,
      targetFaceSize,
      6,
      IRRADIANCE_CONVOLUTION_DEFAULT_SAMPLE_COUNT,
    ]),
  );

  const outputView = texture.createView?.({
    label: `${label}:irradiance-output-view`,
    dimension: "2d-array",
  });

  if (outputView === undefined) {
    throw new Error("Irradiance output texture cannot create a 2d-array view.");
  }

  const bindGroup = device.createBindGroup({
    label: `${label}:irradiance-bind-group`,
    layout: pipeline.resource.bindGroupLayout,
    entries: [
      { binding: 0, resource: sampler },
      { binding: 1, resource: sourceView },
      { binding: 2, resource: outputView },
      { binding: 3, resource: { buffer: params } },
    ],
  });

  const encoder = device.createCommandEncoder({
    label: `${label}:irradiance-dispatch`,
  });
  const pass = encoder.beginComputePass?.({ label: `${label}:irradiance` });

  if (
    pass?.setPipeline === undefined ||
    pass.setBindGroup === undefined ||
    pass.dispatchWorkgroups === undefined ||
    pass.end === undefined
  ) {
    throw new Error("Irradiance compute pass is missing required methods.");
  }

  const dispatch = createIrradianceConvolutionDispatchSize({
    width: targetFaceSize,
    height: targetFaceSize,
    layers: 6,
  });

  pass.setPipeline(pipeline.resource.pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(dispatch.x, dispatch.y, dispatch.z);
  pass.end();

  if (encoder.finish === undefined) {
    throw new Error(
      "Irradiance command encoder cannot finish command buffers.",
    );
  }

  device.queue.submit([encoder.finish()]);

  const view = texture.createView?.({
    label: `${label}:diffuse-ibl-irradiance-view`,
    dimension: "cube",
  });

  if (view === undefined) {
    throw new Error("Irradiance output texture cannot create a cube view.");
  }

  return {
    valid: true,
    resource: {
      resourceKey: input.resourceKey,
      texture,
      view,
      descriptor: {
        label: `${label}:diffuse-ibl-irradiance`,
        size: [targetFaceSize, targetFaceSize, 6],
        format,
        usage:
          WEBGPU_TEXTURE_USAGE_FLAGS.TEXTURE_BINDING |
          WEBGPU_TEXTURE_USAGE_FLAGS.STORAGE_BINDING,
        mipLevelCount: 1,
      },
      viewDescriptor: { dimension: "cube" },
    },
    diagnostics: [],
  };
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
  readonly convolveIrradiance: boolean;
  readonly irradianceFaceSize: number;
}): DiffuseIblCubeTextureResourceResult {
  const sourceDiagnostic = validateDiffuseCubeSource(
    input.resourceKey,
    input.source,
  );

  if (sourceDiagnostic !== null) {
    return {
      result: missingTextureResult(),
      diagnostics: [sourceDiagnostic],
      convolved: false,
    };
  }

  const label = input.source.label ?? input.slot.environmentMapResourceKey;
  const faceSize = input.source.faceSize;
  const format = input.source.format ?? "rgba8unorm";

  if (
    input.convolveIrradiance &&
    hasIrradianceConvolutionDeviceSupport(input.device)
  ) {
    try {
      return {
        result: convolveDiffuseIrradiance({
          device: input.device,
          resourceKey: input.resourceKey,
          label,
          sourceFaceSize: faceSize,
          ...(input.source.faces === undefined
            ? {}
            : { faces: input.source.faces }),
          ...(input.source.sourceTexture === undefined
            ? {}
            : { sourceTexture: input.source.sourceTexture }),
          format,
          targetFaceSize: input.irradianceFaceSize,
        }),
        diagnostics: [],
        convolved: true,
      };
    } catch (error) {
      // Fall through to verbatim upload, but record why convolution did not run.
      if (input.source.faces === undefined) {
        return {
          result: missingTextureResult(),
          diagnostics: [
            {
              code: "iblTextureResource.diffuseIrradianceConvolutionDispatchFailed",
              severity: "warning",
              resourceKey: input.resourceKey,
              message:
                error instanceof Error
                  ? error.message
                  : "Diffuse IBL irradiance convolution dispatch failed.",
            },
          ],
          convolved: false,
        };
      }

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
        diagnostics: [
          {
            code: "iblTextureResource.diffuseIrradianceConvolutionDispatchFailed",
            severity: "warning",
            resourceKey: input.resourceKey,
            message:
              error instanceof Error
                ? error.message
                : "Diffuse IBL irradiance convolution dispatch failed.",
          },
        ],
        convolved: false,
      };
    }
  }

  if (input.source.faces === undefined) {
    return {
      result: missingTextureResult(),
      diagnostics: [
        {
          code: "iblTextureResource.diffuseIrradianceConvolutionDeferred",
          severity: "warning",
          resourceKey: input.resourceKey,
          message:
            "Diffuse IBL source texture requires compute irradiance convolution; no cube faces were provided for verbatim upload.",
        },
      ],
      convolved: false,
    };
  }

  // No compute support (or explicitly disabled): upload the source faces
  // verbatim and flag that the irradiance convolution was deferred.
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
    diagnostics: input.convolveIrradiance
      ? [
          {
            code: "iblTextureResource.diffuseIrradianceConvolutionDeferred",
            severity: "warning",
            resourceKey: input.resourceKey,
            message:
              "Diffuse IBL irradiance convolution requires compute support; uploaded the source faces verbatim.",
          },
        ]
      : [],
    convolved: false,
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

  if (source.sourceTexture !== undefined && source.faces === undefined) {
    return null;
  }

  if (source.faces === undefined) {
    return invalidDiffuseCubeSource(
      resourceKey,
      "Diffuse IBL cube source must provide cube faces or a sourceTexture.",
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
  readonly convolved?: boolean;
  readonly irradianceFaceSize?: number;
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
    ...(input.convolved === undefined ? {} : { convolved: input.convolved }),
    ...(input.irradianceFaceSize === undefined
      ? {}
      : { irradianceFaceSize: input.irradianceFaceSize }),
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
