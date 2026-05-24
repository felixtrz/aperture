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
    }
  | {
      readonly code: "shadowDepthTextureResource.faceViewCreationFailed";
      readonly severity: "warning" | "error";
      readonly message: string;
      readonly resourceKey: string;
      readonly faceIndex: number;
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
  readonly layerCount?: number;
  readonly layerBaseIndex?: number;
  readonly attachmentLayerCount?: number;
  readonly filterRadiusTexels?: number;
  readonly faceCount: 1 | 6;
  readonly viewDimension: "2d" | "2d-array" | "cube";
  readonly attachmentViews: readonly ShadowDepthTextureAttachmentView[];
  readonly allocation: CreateTextureGpuResourceResult;
}

export interface ShadowDepthTextureAttachmentView {
  readonly faceIndex: number;
  readonly viewKey: string;
  readonly view: unknown;
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
    readonly layerCount?: number;
    readonly layerBaseIndex?: number;
    readonly filterRadiusTexels: number;
    readonly faceCount: 1 | 6;
    readonly viewDimension: "2d" | "2d-array" | "cube";
    readonly attachmentViewKeys: readonly string[];
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

  const allocationsByTextureKey = new Map<
    string,
    CreateTextureGpuResourceResult
  >();
  const resources = options.textures.textures.map((texture) => {
    const allocation =
      allocationsByTextureKey.get(texture.textureKey) ??
      createShadowDepthTextureAllocation(options.device, texture);

    allocationsByTextureKey.set(texture.textureKey, allocation);

    return createShadowDepthTextureResource(texture, allocation);
  });

  for (const resource of resources) {
    diagnostics.push(
      ...resource.allocation.diagnostics.map((diagnostic) => ({
        ...diagnostic,
        severity: "warning" as const,
      })),
    );

    if (
      resource.allocation.valid &&
      resource.attachmentViews.length !== shadowAttachmentLayerCount(resource)
    ) {
      diagnostics.push({
        code: "shadowDepthTextureResource.faceViewCreationFailed",
        severity: "warning",
        resourceKey: resource.resourceKey,
        faceIndex: resource.attachmentViews.length,
        message: `Shadow depth texture '${resource.resourceKey}' could not create all ${shadowAttachmentLayerCount(resource)} render attachment view(s).`,
      });
    }
  }

  return report({
    status: resources.every(
      (resource) =>
        resource.allocation.valid &&
        resource.attachmentViews.length ===
          shadowAttachmentLayerCount(resource),
    )
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
      layerCount: shadowLayerCount(resource),
      ...(resource.layerBaseIndex === undefined || resource.layerBaseIndex === 0
        ? {}
        : { layerBaseIndex: resource.layerBaseIndex }),
      filterRadiusTexels: shadowFilterRadiusTexels(resource),
      faceCount: resource.faceCount,
      viewDimension: resource.viewDimension,
      attachmentViewKeys: resource.attachmentViews.map((view) => view.viewKey),
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

export function resolveShadowDepthTextureAttachmentView(
  report: ShadowDepthTextureResourceReport,
  attachment: {
    readonly shadowId: number;
    readonly lightId: number;
    readonly viewKey: string;
  },
): unknown | null {
  const resource = report.resources.find(
    (candidate) =>
      candidate.shadowId === attachment.shadowId &&
      candidate.lightId === attachment.lightId,
  );
  const attachmentView = resource?.attachmentViews.find(
    (view) => view.viewKey === attachment.viewKey,
  );

  return attachmentView?.view ?? null;
}

function createShadowDepthTextureAllocation(
  device: TextureGpuDeviceLike,
  texture: ShadowTextureResourceDescriptor,
): CreateTextureGpuResourceResult {
  return createTextureGpuResource({
    device,
    resourceKey: texture.textureKey,
    descriptor: {
      label: `${texture.resourceKey}:depth`,
      size: [texture.width, texture.height, shadowTextureLayerCount(texture)],
      format: texture.depthFormat,
      usage:
        WEBGPU_TEXTURE_USAGE_FLAGS.RENDER_ATTACHMENT |
        WEBGPU_TEXTURE_USAGE_FLAGS.TEXTURE_BINDING,
      mipLevelCount: 1,
    },
    viewDescriptor:
      texture.viewDimension === "cube"
        ? { dimension: "cube" }
        : texture.viewDimension === "2d-array"
          ? {
              dimension: "2d-array",
              arrayLayerCount: shadowTextureLayerCount(texture),
            }
          : undefined,
  });
}

function createShadowDepthTextureResource(
  texture: ShadowTextureResourceDescriptor,
  allocation: CreateTextureGpuResourceResult,
): ShadowDepthTextureResource {
  return {
    shadowId: texture.shadowId,
    lightId: texture.lightId,
    resourceKey: texture.resourceKey,
    textureKey: texture.textureKey,
    viewKey: texture.viewKey,
    layerCount: shadowTextureLayerCount(texture),
    layerBaseIndex: texture.layerBaseIndex ?? 0,
    attachmentLayerCount: texture.attachmentViewKeys.length,
    filterRadiusTexels:
      texture.filterRadiusTexels ?? shadowTextureDefaultFilterRadius(texture),
    faceCount: texture.faceCount,
    viewDimension: texture.viewDimension,
    attachmentViews: createAttachmentViews(texture, allocation),
    allocation,
  };
}

function createAttachmentViews(
  texture: ShadowTextureResourceDescriptor,
  allocation: CreateTextureGpuResourceResult,
): readonly ShadowDepthTextureAttachmentView[] {
  const resource = allocation.resource;

  if (resource === null) {
    return [];
  }

  if (shadowTextureLayerCount(texture) === 1) {
    return [{ faceIndex: 0, viewKey: texture.viewKey, view: resource.view }];
  }

  const textureLike = resource.texture as {
    readonly createView?: (descriptor?: unknown) => unknown;
  };

  const createView = textureLike.createView;

  if (createView === undefined) {
    return [];
  }

  return texture.attachmentViewKeys.flatMap((viewKey, faceIndex) => {
    const baseArrayLayer = (texture.layerBaseIndex ?? 0) + faceIndex;

    try {
      return [
        {
          faceIndex,
          viewKey,
          view: createView.call(textureLike, {
            dimension: "2d",
            baseArrayLayer,
            arrayLayerCount: 1,
            mipLevelCount: 1,
          }),
        },
      ];
    } catch {
      return [];
    }
  });
}

function shadowFilterRadiusTexels(
  resource: Pick<
    ShadowDepthTextureResource,
    "filterRadiusTexels" | "viewDimension"
  >,
): number {
  return (
    resource.filterRadiusTexels ??
    (resource.viewDimension === "cube" ? 0 : 1)
  );
}

function shadowTextureDefaultFilterRadius(
  texture: Pick<ShadowTextureResourceDescriptor, "viewDimension">,
): number {
  return texture.viewDimension === "cube" ? 0 : 1;
}

function shadowTextureLayerCount(
  texture: ShadowTextureResourceDescriptor,
): number {
  return texture.layerCount ?? texture.faceCount;
}

function shadowLayerCount(resource: ShadowDepthTextureResource): number {
  return resource.layerCount ?? resource.faceCount;
}

function shadowAttachmentLayerCount(
  resource: ShadowDepthTextureResource,
): number {
  return resource.attachmentLayerCount ?? shadowLayerCount(resource);
}

function report(input: {
  readonly status: ShadowDepthTextureResourceStatus;
  readonly textureDescriptorCount: number;
  readonly textureDescriptorsAvailable: boolean;
  readonly resources: readonly ShadowDepthTextureResource[];
  readonly diagnostics: readonly ShadowDepthTextureResourceDiagnostic[];
}): ShadowDepthTextureResourceReport {
  const createdTextureCount = new Set(
    input.resources
      .filter((resource) => resource.allocation.valid)
      .map((resource) => resource.textureKey),
  ).size;

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
