import type { ShadowDepthTextureResourceReport } from "./shadow-depth-texture-resource.js";

export type ShadowDepthResourceSummaryStatus =
  | "deferred"
  | "missing"
  | "not-required";

export interface ShadowDepthResourceSummaryDiagnostic {
  readonly code:
    | "shadowDepthResourceSummary.depthTextureResourceMissing"
    | "shadowDepthResourceSummary.matrixUploadDeferred"
    | "shadowDepthResourceSummary.passSubmissionDeferred"
    | "shadowDepthResourceSummary.shaderSamplingDeferred";
  readonly severity: "warning" | "error";
  readonly message: string;
}

export interface CreateShadowDepthResourceSummaryOptions {
  readonly depthTextureResources: ShadowDepthTextureResourceReport;
}

export interface ShadowDepthResourceSummaryReport {
  readonly ready: false;
  readonly status: ShadowDepthResourceSummaryStatus;
  readonly counts: {
    readonly textureDescriptors: number;
    readonly depthTextureResources: number;
  };
  readonly sections: {
    readonly textureDescriptors: boolean;
    readonly depthTextureResource: boolean;
    readonly gpuAllocation: boolean;
    readonly matrixUpload: false;
    readonly passSubmission: false;
    readonly shaderSampling: false;
  };
  readonly resourceKeys: {
    readonly textures: readonly string[];
    readonly views: readonly string[];
  };
  readonly diagnostics: readonly ShadowDepthResourceSummaryDiagnostic[];
}

export type ShadowDepthResourceSummaryReportJsonValue =
  ShadowDepthResourceSummaryReport;

export function createShadowDepthResourceSummaryReport(
  options: CreateShadowDepthResourceSummaryOptions,
): ShadowDepthResourceSummaryReport {
  const status = determineStatus(options.depthTextureResources);
  const diagnostics = createDiagnostics(status);
  const validResources = options.depthTextureResources.resources.filter(
    (resource) => resource.allocation.valid,
  );

  return {
    ready: false,
    status,
    counts: {
      textureDescriptors: options.depthTextureResources.textureDescriptorCount,
      depthTextureResources: options.depthTextureResources.createdTextureCount,
    },
    sections: {
      textureDescriptors:
        options.depthTextureResources.sections.textureDescriptors,
      depthTextureResource:
        options.depthTextureResources.sections.depthTextureResource,
      gpuAllocation: options.depthTextureResources.sections.gpuAllocation,
      matrixUpload: false,
      passSubmission: false,
      shaderSampling: false,
    },
    resourceKeys: {
      textures: validResources.map((resource) => resource.textureKey).sort(),
      views: validResources.map((resource) => resource.viewKey).sort(),
    },
    diagnostics,
  };
}

export function shadowDepthResourceSummaryReportToJsonValue(
  report: ShadowDepthResourceSummaryReport,
): ShadowDepthResourceSummaryReportJsonValue {
  return {
    ready: report.ready,
    status: report.status,
    counts: { ...report.counts },
    sections: { ...report.sections },
    resourceKeys: {
      textures: [...report.resourceKeys.textures],
      views: [...report.resourceKeys.views],
    },
    diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function shadowDepthResourceSummaryReportToJson(
  report: ShadowDepthResourceSummaryReport,
): string {
  return JSON.stringify(shadowDepthResourceSummaryReportToJsonValue(report));
}

function determineStatus(
  depthTextureResources: ShadowDepthTextureResourceReport,
): ShadowDepthResourceSummaryStatus {
  if (depthTextureResources.status === "not-required") {
    return "not-required";
  }

  if (depthTextureResources.status !== "available") {
    return "missing";
  }

  return "deferred";
}

function createDiagnostics(
  status: ShadowDepthResourceSummaryStatus,
): ShadowDepthResourceSummaryDiagnostic[] {
  if (status === "not-required") {
    return [];
  }

  if (status === "missing") {
    return [
      {
        code: "shadowDepthResourceSummary.depthTextureResourceMissing",
        severity: "warning",
        message:
          "Shadow depth resource summary requires available shadow depth texture resources.",
      },
    ];
  }

  return [
    {
      code: "shadowDepthResourceSummary.matrixUploadDeferred",
      severity: "warning",
      message:
        "Shadow depth texture resources are available, but shadow matrix upload remains deferred.",
    },
    {
      code: "shadowDepthResourceSummary.passSubmissionDeferred",
      severity: "warning",
      message:
        "Shadow depth texture resources are available, but shadow pass submission remains deferred.",
    },
    {
      code: "shadowDepthResourceSummary.shaderSamplingDeferred",
      severity: "warning",
      message:
        "Shadow depth texture resources are available, but StandardMaterial shadow sampling remains deferred.",
    },
  ];
}
