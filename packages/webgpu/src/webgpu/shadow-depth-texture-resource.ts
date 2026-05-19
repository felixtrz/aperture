import type {
  ShadowTextureResourceDescriptor,
  ShadowTextureResourceReport,
} from "./shadow-texture-resource.js";
import {
  createTextureGpuResource,
  WEBGPU_TEXTURE_USAGE_FLAGS,
  type CreateTextureGpuResourceResult,
  type TextureGpuDeviceLike,
  type TextureGpuResourceDiagnostic,
} from "./texture-resources.js";

export type ShadowDepthTextureResourceStatus =
  | "available"
  | "missing"
  | "not-required";

export type ShadowDepthTextureResourceDiagnostic =
  | TextureGpuResourceDiagnostic
  | {
      readonly code: "shadowDepthTextureResource.missingTextureDescriptors";
      readonly severity: "warning" | "error";
      readonly message: string;
    };

export interface CreateShadowDepthTextureResourceOptions {
  readonly device: TextureGpuDeviceLike;
  readonly textures: ShadowTextureResourceReport;
}

export interface ShadowDepthTextureResource {
  readonly shadowId: number;
  readonly lightId: number;
  readonly resourceKey: string;
  readonly textureKey: string;
  readonly viewKey: string;
  readonly allocation: CreateTextureGpuResourceResult;
}

export interface ShadowDepthTextureResourceReport {
  readonly ready: boolean;
  readonly status: ShadowDepthTextureResourceStatus;
  readonly textureDescriptorCount: number;
  readonly createdTextureCount: number;
  readonly sections: {
    readonly textureDescriptors: boolean;
    readonly depthTextureResource: boolean;
    readonly gpuAllocation: boolean;
    readonly matrixUpload: false;
    readonly passSubmission: false;
    readonly shaderSampling: false;
  };
  readonly resources: readonly ShadowDepthTextureResource[];
  readonly diagnostics: readonly ShadowDepthTextureResourceDiagnostic[];
}

export interface ShadowDepthTextureResourceReportJsonValue {
  readonly ready: boolean;
  readonly status: ShadowDepthTextureResourceStatus;
  readonly textureDescriptorCount: number;
  readonly createdTextureCount: number;
  readonly sections: ShadowDepthTextureResourceReport["sections"];
  readonly resources: readonly {
    readonly valid: boolean;
    readonly shadowId: number;
    readonly lightId: number;
    readonly resourceKey: string;
    readonly textureKey: string;
    readonly viewKey: string;
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

export function createShadowDepthTextureResourceReport(
  options: CreateShadowDepthTextureResourceOptions,
): ShadowDepthTextureResourceReport {
  const diagnostics: ShadowDepthTextureResourceDiagnostic[] = [];

  if (!options.textures.ready) {
    diagnostics.push({
      code: "shadowDepthTextureResource.missingTextureDescriptors",
      severity: "warning",
      message:
        "Shadow depth texture allocation requires valid shadow texture descriptors.",
    });

    return report({
      status: "missing",
      textureDescriptorCount: options.textures.textureCount,
      textureDescriptorsAvailable: false,
      resources: [],
      diagnostics,
    });
  }

  if (options.textures.textureCount === 0) {
    return report({
      status: "not-required",
      textureDescriptorCount: 0,
      textureDescriptorsAvailable: true,
      resources: [],
      diagnostics,
    });
  }

  const resources = options.textures.textures.map((texture) =>
    createShadowDepthTextureResource(options.device, texture),
  );

  for (const resource of resources) {
    diagnostics.push(
      ...resource.allocation.diagnostics.map((diagnostic) => ({
        ...diagnostic,
        severity: "warning" as const,
      })),
    );
  }

  return report({
    status: resources.every((resource) => resource.allocation.valid)
      ? "available"
      : "missing",
    textureDescriptorCount: options.textures.textureCount,
    textureDescriptorsAvailable: true,
    resources,
    diagnostics,
  });
}

export function shadowDepthTextureResourceReportToJsonValue(
  report: ShadowDepthTextureResourceReport,
): ShadowDepthTextureResourceReportJsonValue {
  return {
    ready: report.ready,
    status: report.status,
    textureDescriptorCount: report.textureDescriptorCount,
    createdTextureCount: report.createdTextureCount,
    sections: { ...report.sections },
    resources: report.resources.map((resource) => ({
      valid: resource.allocation.valid,
      shadowId: resource.shadowId,
      lightId: resource.lightId,
      resourceKey: resource.resourceKey,
      textureKey: resource.textureKey,
      viewKey: resource.viewKey,
      descriptor:
        resource.allocation.resource === null
          ? null
          : {
              ...resource.allocation.resource.descriptor,
              size: [...resource.allocation.resource.descriptor.size] as [
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

export function shadowDepthTextureResourceReportToJson(
  report: ShadowDepthTextureResourceReport,
): string {
  return JSON.stringify(shadowDepthTextureResourceReportToJsonValue(report));
}

function createShadowDepthTextureResource(
  device: TextureGpuDeviceLike,
  texture: ShadowTextureResourceDescriptor,
): ShadowDepthTextureResource {
  return {
    shadowId: texture.shadowId,
    lightId: texture.lightId,
    resourceKey: texture.resourceKey,
    textureKey: texture.textureKey,
    viewKey: texture.viewKey,
    allocation: createTextureGpuResource({
      device,
      resourceKey: texture.textureKey,
      descriptor: {
        label: `${texture.resourceKey}:depth`,
        size: [texture.width, texture.height, 1],
        format: texture.depthFormat,
        usage: WEBGPU_TEXTURE_USAGE_FLAGS.RENDER_ATTACHMENT,
        mipLevelCount: 1,
      },
    }),
  };
}

function report(input: {
  readonly status: ShadowDepthTextureResourceStatus;
  readonly textureDescriptorCount: number;
  readonly textureDescriptorsAvailable: boolean;
  readonly resources: readonly ShadowDepthTextureResource[];
  readonly diagnostics: readonly ShadowDepthTextureResourceDiagnostic[];
}): ShadowDepthTextureResourceReport {
  const createdTextureCount = input.resources.filter(
    (resource) => resource.allocation.valid,
  ).length;

  return {
    ready: input.status === "available" || input.status === "not-required",
    status: input.status,
    textureDescriptorCount: input.textureDescriptorCount,
    createdTextureCount,
    sections: {
      textureDescriptors: input.textureDescriptorsAvailable,
      depthTextureResource: input.status === "available",
      gpuAllocation: input.status === "available",
      matrixUpload: false,
      passSubmission: false,
      shaderSampling: false,
    },
    resources: input.resources,
    diagnostics: input.diagnostics,
  };
}
