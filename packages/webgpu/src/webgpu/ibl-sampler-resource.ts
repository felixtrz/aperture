import { createSamplerAsset } from "@aperture-engine/render";

import type { IblSamplerDescriptorReadinessReport } from "./ibl-sampler-descriptor-readiness.js";
import {
  createSamplerGpuResource,
  type CreateSamplerGpuResourceResult,
  type SamplerGpuResource,
  type SamplerDescriptorInput,
  type TextureGpuDeviceLike,
  type TextureGpuResourceDiagnostic,
} from "./texture-resources.js";

export type IblSamplerResourceStatus =
  | "available"
  | "missing"
  | "unsupported"
  | "not-required";

export type IblSamplerResourceDiagnostic =
  | TextureGpuResourceDiagnostic
  | {
      readonly code:
        | "iblSamplerResource.missingSamplerDescriptors"
        | "iblSamplerResource.unsupportedSamplerDescriptors";
      readonly severity: "warning" | "error";
      readonly message: string;
      readonly resourceKey?: string;
    };

export interface CreateIblSamplerResourceOptions {
  readonly device: TextureGpuDeviceLike;
  readonly samplers: IblSamplerDescriptorReadinessReport;
  readonly cache?: Map<string, SamplerGpuResource>;
}

export interface IblSamplerResourceReport {
  readonly ready: boolean;
  readonly status: IblSamplerResourceStatus;
  readonly samplerDescriptorCount: number;
  readonly createdSamplerCount: number;
  readonly reusedSamplerCount: number;
  readonly sections: {
    readonly samplerDescriptors: boolean;
    readonly gpuAllocation: boolean;
    readonly bindGroupLayout: false;
    readonly shaderSampling: false;
  };
  readonly resources: readonly CreateSamplerGpuResourceResult[];
  readonly diagnostics: readonly IblSamplerResourceDiagnostic[];
}

export interface IblSamplerResourceReportJsonValue {
  readonly ready: boolean;
  readonly status: IblSamplerResourceStatus;
  readonly samplerDescriptorCount: number;
  readonly createdSamplerCount: number;
  readonly reusedSamplerCount: number;
  readonly sections: IblSamplerResourceReport["sections"];
  readonly resources: readonly {
    readonly valid: boolean;
    readonly resourceKey: string;
    readonly descriptor: SamplerDescriptorInput | null;
  }[];
  readonly diagnostics: readonly {
    readonly code: string;
    readonly severity: "warning" | "error";
    readonly message: string;
    readonly resourceKey?: string;
  }[];
}

export function createIblSamplerResourceReport(
  options: CreateIblSamplerResourceOptions,
): IblSamplerResourceReport {
  const diagnostics: IblSamplerResourceDiagnostic[] = [];

  if (options.samplers.status === "not-required") {
    return report({
      status: "not-required",
      samplerDescriptorCount: 0,
      resources: [],
      diagnostics,
    });
  }

  if (
    options.samplers.status === "missing" ||
    options.samplers.status === "deferred"
  ) {
    diagnostics.push({
      code: "iblSamplerResource.missingSamplerDescriptors",
      severity: "warning",
      message:
        "IBL sampler resource allocation requires ready IBL sampler descriptors.",
    });

    return report({
      status: "missing",
      samplerDescriptorCount: options.samplers.samplerCount,
      resources: [],
      diagnostics,
    });
  }

  if (options.samplers.status === "unsupported") {
    diagnostics.push({
      code: "iblSamplerResource.unsupportedSamplerDescriptors",
      severity: "warning",
      message:
        "IBL sampler resource allocation cannot proceed while IBL sampler descriptors are unsupported.",
    });

    return report({
      status: "unsupported",
      samplerDescriptorCount: options.samplers.samplerCount,
      resources: [],
      diagnostics,
    });
  }

  let createdSamplerCount = 0;
  let reusedSamplerCount = 0;
  const resources = options.samplers.samplers.map((sampler) => {
    const cached = options.cache?.get(sampler.samplerKey);

    if (cached !== undefined) {
      reusedSamplerCount += 1;
      return {
        valid: true,
        resource: cached,
        diagnostics: [],
      };
    }

    const result = createSamplerGpuResource({
      device: options.device,
      resourceKey: sampler.samplerKey,
      sampler: createSamplerAsset({
        label: `${sampler.environmentMapResourceKey}:${sampler.kind}:ibl-sampler`,
        addressModeU: sampler.addressModeU,
        addressModeV: sampler.addressModeV,
        addressModeW: sampler.addressModeW,
        magFilter: sampler.magFilter,
        minFilter: sampler.minFilter,
        mipmapFilter: sampler.mipmapFilter,
        maxAnisotropy: sampler.maxAnisotropy,
      }),
    });

    if (result.valid && result.resource !== null) {
      options.cache?.set(sampler.samplerKey, result.resource);
      createdSamplerCount += 1;
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
    samplerDescriptorCount: options.samplers.samplerCount,
    createdSamplerCount,
    reusedSamplerCount,
    resources,
    diagnostics,
  });
}

export function iblSamplerResourceReportToJsonValue(
  report: IblSamplerResourceReport,
): IblSamplerResourceReportJsonValue {
  return {
    ready: report.ready,
    status: report.status,
    samplerDescriptorCount: report.samplerDescriptorCount,
    createdSamplerCount: report.createdSamplerCount,
    reusedSamplerCount: report.reusedSamplerCount,
    sections: { ...report.sections },
    resources: report.resources.map((resource) => ({
      valid: resource.valid,
      resourceKey:
        resource.resource?.resourceKey ??
        resource.diagnostics[0]?.resourceKey ??
        "",
      descriptor:
        resource.resource === null ? null : { ...resource.resource.descriptor },
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

export function iblSamplerResourceReportToJson(
  report: IblSamplerResourceReport,
): string {
  return JSON.stringify(iblSamplerResourceReportToJsonValue(report));
}

function report(input: {
  readonly status: IblSamplerResourceStatus;
  readonly samplerDescriptorCount: number;
  readonly createdSamplerCount?: number;
  readonly reusedSamplerCount?: number;
  readonly resources: readonly CreateSamplerGpuResourceResult[];
  readonly diagnostics: readonly IblSamplerResourceDiagnostic[];
}): IblSamplerResourceReport {
  const createdSamplerCount =
    input.createdSamplerCount ??
    input.resources.filter((resource) => resource.valid).length;
  const reusedSamplerCount = input.reusedSamplerCount ?? 0;

  return {
    ready: input.status === "available" || input.status === "not-required",
    status: input.status,
    samplerDescriptorCount: input.samplerDescriptorCount,
    createdSamplerCount,
    reusedSamplerCount,
    sections: {
      samplerDescriptors:
        input.status !== "missing" && input.status !== "unsupported",
      gpuAllocation: input.status === "available",
      bindGroupLayout: false,
      shaderSampling: false,
    },
    resources: input.resources,
    diagnostics: input.diagnostics,
  };
}
