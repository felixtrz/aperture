import type { ShadowMapDescriptorReport } from "./shadow-map-descriptor.js";

export type ShadowResourceReadinessStatus =
  | "available"
  | "unsupported"
  | "missing"
  | "not-required";

export type ShadowResourceReadinessDiagnosticCode =
  | "shadowResourceReadiness.missingDescriptors"
  | "shadowResourceReadiness.passSubmissionDeferred";

export interface ShadowResourceReadinessDiagnostic {
  readonly code: ShadowResourceReadinessDiagnosticCode;
  readonly severity: "warning" | "error";
  readonly message: string;
}

export interface ShadowResourceReadinessReport {
  readonly ready: boolean;
  readonly status: ShadowResourceReadinessStatus;
  readonly requestCount: number;
  readonly descriptorCount: number;
  readonly resourceKeys: readonly string[];
  readonly sections: {
    readonly shadowMapDescriptors: boolean;
    readonly shadowMapResources: boolean;
    readonly shadowPassSubmission: false;
  };
  readonly diagnostics: readonly ShadowResourceReadinessDiagnostic[];
}

export type ShadowResourceReadinessReportJsonValue =
  ShadowResourceReadinessReport;

export interface ShadowResourceReadinessInput {
  readonly descriptors: ShadowMapDescriptorReport;
}

export function createShadowResourceReadinessReport(
  input: ShadowResourceReadinessInput,
): ShadowResourceReadinessReport {
  if (input.descriptors.requestCount === 0) {
    return {
      ready: true,
      status: "not-required",
      requestCount: 0,
      descriptorCount: 0,
      resourceKeys: [],
      sections: {
        shadowMapDescriptors: true,
        shadowMapResources: true,
        shadowPassSubmission: false,
      },
      diagnostics: [],
    };
  }

  const missingDescriptors = !input.descriptors.ready;
  const diagnostics: ShadowResourceReadinessDiagnostic[] = [];

  if (missingDescriptors) {
    diagnostics.push({
      code: "shadowResourceReadiness.missingDescriptors",
      severity: "warning",
      message:
        "Shadow resource readiness requires valid renderer-owned shadow-map descriptors.",
    });
  }

  diagnostics.push({
    code: "shadowResourceReadiness.passSubmissionDeferred",
    severity: "warning",
    message:
      "Shadow-map descriptors are available, but shadow texture allocation and pass submission are not implemented yet.",
  });

  return {
    ready: !missingDescriptors,
    status: missingDescriptors ? "missing" : "available",
    requestCount: input.descriptors.requestCount,
    descriptorCount: input.descriptors.descriptorCount,
    resourceKeys: input.descriptors.descriptors
      .filter((descriptor) => descriptor.ready)
      .map((descriptor) => descriptor.resourceKey)
      .sort(),
    sections: {
      shadowMapDescriptors: input.descriptors.ready,
      shadowMapResources: !missingDescriptors,
      shadowPassSubmission: false,
    },
    diagnostics,
  };
}

export function shadowResourceReadinessReportToJsonValue(
  report: ShadowResourceReadinessReport,
): ShadowResourceReadinessReportJsonValue {
  return {
    ready: report.ready,
    status: report.status,
    requestCount: report.requestCount,
    descriptorCount: report.descriptorCount,
    resourceKeys: [...report.resourceKeys],
    sections: { ...report.sections },
    diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function shadowResourceReadinessReportToJson(
  report: ShadowResourceReadinessReport,
): string {
  return JSON.stringify(shadowResourceReadinessReportToJsonValue(report));
}
