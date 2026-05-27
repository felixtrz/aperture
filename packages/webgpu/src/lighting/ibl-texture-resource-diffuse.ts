import type { IblTexturePreparationSlot } from "./ibl-texture-preparation.js";
import {
  createCubeFacesUpload,
  createDefaultDiffuseIblUpload,
  bytesPerPixelForPmremFormat,
  missingTextureResult,
} from "./ibl-texture-resource-utils.js";
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
