import type { ShadowDepthTextureResourceReport } from "./shadow-depth-texture-resource.js";
import type { ShadowMatrixBufferResourceReport } from "./shadow-matrix-buffer-resource.js";
import type { ShadowPassCommandBufferSubmissionReport } from "./shadow-pass-command-buffer-submission-report.js";
import type {
  ShadowSamplerResourceReport,
  StandardMaterialShadowBindGroupResourceReport,
} from "./standard-material-shadow-bind-group.js";

export type StandardMaterialShadowReceiverBindingStatus =
  | "ready"
  | "missing"
  | "not-required";

export type StandardMaterialShadowReceiverBindingDiagnosticCode =
  | "standardMaterialShadowReceiverBinding.missingMatrixBufferResource"
  | "standardMaterialShadowReceiverBinding.missingDepthTextureResource"
  | "standardMaterialShadowReceiverBinding.missingSamplerResource"
  | "standardMaterialShadowReceiverBinding.missingBindGroupResource"
  | "standardMaterialShadowReceiverBinding.commandBufferNotReady"
  | "standardMaterialShadowReceiverBinding.shaderSamplingDeferred";

export interface StandardMaterialShadowReceiverBindingDiagnostic {
  readonly code: StandardMaterialShadowReceiverBindingDiagnosticCode;
  readonly severity: "warning" | "error";
  readonly message: string;
}

export interface StandardMaterialShadowReceiverBindingRecord {
  readonly receiverKey: string;
  readonly group: 5;
  readonly matrixResourceKey: string;
  readonly depthTextureResourceKey: string;
  readonly depthViewKey: string;
  readonly samplerResourceKey: string;
  readonly bindGroupResourceKey: string;
  readonly commandBufferStatus: ShadowPassCommandBufferSubmissionReport["status"];
}

export interface StandardMaterialShadowReceiverBindingReadinessReport {
  readonly ready: boolean;
  readonly status: StandardMaterialShadowReceiverBindingStatus;
  readonly standardMaterialCount: number;
  readonly receiverCount: number;
  readonly sections: {
    readonly matrixBufferResource: boolean;
    readonly depthTextureResource: boolean;
    readonly samplerResource: boolean;
    readonly bindGroupResource: boolean;
    readonly commandBufferSubmission: boolean;
    readonly shaderSampling: false;
  };
  readonly records: readonly StandardMaterialShadowReceiverBindingRecord[];
  readonly diagnostics: readonly StandardMaterialShadowReceiverBindingDiagnostic[];
}

export type StandardMaterialShadowReceiverBindingReadinessReportJsonValue =
  StandardMaterialShadowReceiverBindingReadinessReport;

export interface CreateStandardMaterialShadowReceiverBindingReadinessReportOptions {
  readonly standardMaterialCount: number;
  readonly matrixBufferResource: ShadowMatrixBufferResourceReport;
  readonly depthTextureResources: ShadowDepthTextureResourceReport;
  readonly samplerResource: ShadowSamplerResourceReport;
  readonly bindGroupResource: StandardMaterialShadowBindGroupResourceReport;
  readonly commandBufferSubmission: ShadowPassCommandBufferSubmissionReport;
}

export function createStandardMaterialShadowReceiverBindingReadinessReport(
  options: CreateStandardMaterialShadowReceiverBindingReadinessReportOptions,
): StandardMaterialShadowReceiverBindingReadinessReport {
  if (options.standardMaterialCount === 0) {
    return report({
      status: "not-required",
      standardMaterialCount: 0,
      records: [],
      diagnostics: [],
      sections: sections(options),
    });
  }

  const diagnostics: StandardMaterialShadowReceiverBindingDiagnostic[] = [];
  const matrixResource = options.matrixBufferResource.resource;
  const depthResource = options.depthTextureResources.resources[0] ?? null;
  const samplerResource = options.samplerResource.resource;
  const bindGroupResource = options.bindGroupResource.resource;

  if (matrixResource === null) {
    diagnostics.push({
      code: "standardMaterialShadowReceiverBinding.missingMatrixBufferResource",
      severity: "warning",
      message:
        "StandardMaterial shadow receiver binding requires a live shadow matrix buffer resource.",
    });
  }

  if (depthResource === null || !depthResource.allocation.valid) {
    diagnostics.push({
      code: "standardMaterialShadowReceiverBinding.missingDepthTextureResource",
      severity: "warning",
      message:
        "StandardMaterial shadow receiver binding requires a live shadow depth texture view.",
    });
  }

  if (samplerResource === null) {
    diagnostics.push({
      code: "standardMaterialShadowReceiverBinding.missingSamplerResource",
      severity: "warning",
      message:
        "StandardMaterial shadow receiver binding requires a live shadow sampler resource.",
    });
  }

  if (bindGroupResource === null) {
    diagnostics.push({
      code: "standardMaterialShadowReceiverBinding.missingBindGroupResource",
      severity: "warning",
      message:
        "StandardMaterial shadow receiver binding requires a live group 5 bind group resource.",
    });
  }

  if (!options.commandBufferSubmission.ready) {
    diagnostics.push({
      code: "standardMaterialShadowReceiverBinding.commandBufferNotReady",
      severity: "warning",
      message:
        "StandardMaterial shadow receiver binding requires a finished or submitted shadow command buffer.",
    });
  }

  const records: StandardMaterialShadowReceiverBindingRecord[] =
    diagnostics.length > 0 ||
    matrixResource === null ||
    depthResource === null ||
    !depthResource.allocation.valid ||
    samplerResource === null ||
    bindGroupResource === null
      ? []
      : Array.from({ length: options.standardMaterialCount }, (_, index) => ({
          receiverKey: `standard-material-shadow-receiver:${index}`,
          group: 5,
          matrixResourceKey: matrixResource.resourceKey,
          depthTextureResourceKey: depthResource.resourceKey,
          depthViewKey: depthResource.viewKey,
          samplerResourceKey: samplerResource.resourceKey,
          bindGroupResourceKey: bindGroupResource.resourceKey,
          commandBufferStatus: options.commandBufferSubmission.status,
        }));

  if (records.length > 0) {
    diagnostics.push({
      code: "standardMaterialShadowReceiverBinding.shaderSamplingDeferred",
      severity: "warning",
      message:
        "StandardMaterial shadow receiver resources are bound, but WGSL shadow sampling remains deferred.",
    });
  }

  return report({
    status: records.length > 0 ? "ready" : "missing",
    standardMaterialCount: options.standardMaterialCount,
    records,
    diagnostics,
    sections: sections(options),
  });
}

export function standardMaterialShadowReceiverBindingReadinessReportToJsonValue(
  report: StandardMaterialShadowReceiverBindingReadinessReport,
): StandardMaterialShadowReceiverBindingReadinessReportJsonValue {
  return {
    ready: report.ready,
    status: report.status,
    standardMaterialCount: report.standardMaterialCount,
    receiverCount: report.receiverCount,
    sections: { ...report.sections },
    records: report.records.map((record) => ({ ...record })),
    diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function standardMaterialShadowReceiverBindingReadinessReportToJson(
  report: StandardMaterialShadowReceiverBindingReadinessReport,
): string {
  return JSON.stringify(
    standardMaterialShadowReceiverBindingReadinessReportToJsonValue(report),
  );
}

function sections(
  options: CreateStandardMaterialShadowReceiverBindingReadinessReportOptions,
): StandardMaterialShadowReceiverBindingReadinessReport["sections"] {
  return {
    matrixBufferResource: options.matrixBufferResource.resource !== null,
    depthTextureResource: options.depthTextureResources.resources.some(
      (resource) => resource.allocation.valid,
    ),
    samplerResource: options.samplerResource.resource !== null,
    bindGroupResource: options.bindGroupResource.resource !== null,
    commandBufferSubmission: options.commandBufferSubmission.ready,
    shaderSampling: false,
  };
}

function report(input: {
  readonly status: StandardMaterialShadowReceiverBindingStatus;
  readonly standardMaterialCount: number;
  readonly records: readonly StandardMaterialShadowReceiverBindingRecord[];
  readonly diagnostics: readonly StandardMaterialShadowReceiverBindingDiagnostic[];
  readonly sections: StandardMaterialShadowReceiverBindingReadinessReport["sections"];
}): StandardMaterialShadowReceiverBindingReadinessReport {
  return {
    ready: input.status === "ready" || input.status === "not-required",
    status: input.status,
    standardMaterialCount: input.standardMaterialCount,
    receiverCount: input.records.length,
    sections: input.sections,
    records: input.records,
    diagnostics: input.diagnostics,
  };
}
