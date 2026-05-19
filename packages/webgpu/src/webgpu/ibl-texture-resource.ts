import type { IblTexturePreparationReport } from "./ibl-texture-preparation.js";
import {
  createTextureGpuResource,
  WEBGPU_TEXTURE_USAGE_FLAGS,
  type CreateTextureGpuResourceResult,
  type TextureGpuDeviceLike,
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
        | "iblTextureResource.unsupportedTextureSlots";
      readonly severity: "warning" | "error";
      readonly message: string;
      readonly resourceKey?: string;
    };

export interface CreateDiffuseIblTextureResourceOptions {
  readonly device: TextureGpuDeviceLike;
  readonly textures: IblTexturePreparationReport;
  readonly size?: number;
}

export interface DiffuseIblTextureResourceReport {
  readonly ready: boolean;
  readonly status: IblTextureResourceStatus;
  readonly textureSlotCount: number;
  readonly diffuseSlotCount: number;
  readonly createdTextureCount: number;
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

export interface DiffuseIblTextureResourceReportJsonValue {
  readonly ready: boolean;
  readonly status: IblTextureResourceStatus;
  readonly textureSlotCount: number;
  readonly diffuseSlotCount: number;
  readonly createdTextureCount: number;
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
  const resources = diffuseSlots.map((slot) =>
    createTextureGpuResource({
      device: options.device,
      resourceKey: slot.textureKey ?? `${slot.sourceResourceKey}:texture`,
      descriptor: {
        label: `${slot.environmentMapResourceKey}:diffuse-ibl`,
        size: [options.size ?? 64, options.size ?? 64, 6],
        format: slot.format,
        usage:
          WEBGPU_TEXTURE_USAGE_FLAGS.TEXTURE_BINDING |
          WEBGPU_TEXTURE_USAGE_FLAGS.COPY_DST,
        mipLevelCount: 1,
      },
    }),
  );

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
  readonly resources: readonly CreateTextureGpuResourceResult[];
  readonly diagnostics: readonly IblTextureResourceDiagnostic[];
}): DiffuseIblTextureResourceReport {
  const createdTextureCount = input.resources.filter(
    (resource) => resource.valid,
  ).length;

  return {
    ready: input.status === "available" || input.status === "not-required",
    status: input.status,
    textureSlotCount: input.textureSlotCount,
    diffuseSlotCount: input.diffuseSlotCount,
    createdTextureCount,
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
