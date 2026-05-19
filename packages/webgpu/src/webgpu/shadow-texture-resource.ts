import type { ShadowMapDescriptorReport } from "./shadow-map-descriptor.js";

export type ShadowTextureResourceDiagnosticCode =
  | "shadowTextureResource.missingDescriptors"
  | "shadowTextureResource.allocationDeferred";

export interface ShadowTextureResourceDescriptor {
  readonly shadowId: number;
  readonly lightId: number;
  readonly resourceKey: string;
  readonly textureKey: string;
  readonly viewKey: string;
  readonly width: number;
  readonly height: number;
  readonly depthFormat: "depth24plus";
  readonly usageIntent: "render-attachment";
  readonly allocation: "deferred";
}

export interface ShadowTextureResourceDiagnostic {
  readonly code: ShadowTextureResourceDiagnosticCode;
  readonly severity: "warning" | "error";
  readonly message: string;
}

export interface ShadowTextureResourceReport {
  readonly ready: boolean;
  readonly descriptorCount: number;
  readonly textureCount: number;
  readonly sections: {
    readonly shadowMapDescriptors: boolean;
    readonly textureDescriptors: boolean;
    readonly gpuAllocation: false;
  };
  readonly textures: readonly ShadowTextureResourceDescriptor[];
  readonly diagnostics: readonly ShadowTextureResourceDiagnostic[];
}

export type ShadowTextureResourceReportJsonValue = ShadowTextureResourceReport;

export interface ShadowTextureResourceInput {
  readonly descriptors: ShadowMapDescriptorReport;
}

export function createShadowTextureResourceReport(
  input: ShadowTextureResourceInput,
): ShadowTextureResourceReport {
  const diagnostics: ShadowTextureResourceDiagnostic[] = [];

  if (!input.descriptors.ready) {
    diagnostics.push({
      code: "shadowTextureResource.missingDescriptors",
      severity: "warning",
      message:
        "Shadow texture resource planning requires valid shadow-map descriptors.",
    });
  }

  const textures = input.descriptors.descriptors
    .filter((descriptor) => descriptor.ready)
    .map((descriptor) => ({
      shadowId: descriptor.shadowId,
      lightId: descriptor.lightId,
      resourceKey: descriptor.resourceKey,
      textureKey: `${descriptor.resourceKey}:texture`,
      viewKey: `${descriptor.resourceKey}:view`,
      width: descriptor.mapSize,
      height: descriptor.mapSize,
      depthFormat: descriptor.depthFormat,
      usageIntent: "render-attachment" as const,
      allocation: "deferred" as const,
    }));

  if (textures.length > 0) {
    diagnostics.push({
      code: "shadowTextureResource.allocationDeferred",
      severity: "warning",
      message:
        "Shadow texture descriptors are planned, but live GPU texture allocation is not implemented yet.",
    });
  }

  return {
    ready: input.descriptors.ready,
    descriptorCount: input.descriptors.descriptorCount,
    textureCount: textures.length,
    sections: {
      shadowMapDescriptors: input.descriptors.ready,
      textureDescriptors: input.descriptors.ready,
      gpuAllocation: false,
    },
    textures,
    diagnostics,
  };
}

export function shadowTextureResourceReportToJsonValue(
  report: ShadowTextureResourceReport,
): ShadowTextureResourceReportJsonValue {
  return {
    ready: report.ready,
    descriptorCount: report.descriptorCount,
    textureCount: report.textureCount,
    sections: { ...report.sections },
    textures: report.textures.map((texture) => ({ ...texture })),
    diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function shadowTextureResourceReportToJson(
  report: ShadowTextureResourceReport,
): string {
  return JSON.stringify(shadowTextureResourceReportToJsonValue(report));
}
