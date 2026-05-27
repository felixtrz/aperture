export type ShadowMatrixBufferDescriptorStatus =
  | "ready"
  | "deferred"
  | "missing"
  | "unsupported"
  | "not-required";

export type ShadowMatrixBufferUploadMode = "ready" | "deferred";

export type ShadowMatrixBufferDescriptorDiagnosticCode =
  | "shadowMatrixBuffer.missingViewProjectionPlan"
  | "shadowMatrixBuffer.unsupportedViewProjectionPlan"
  | "shadowMatrixBuffer.uploadDeferred";

export interface ShadowMatrixBufferEntry {
  readonly shadowId: number;
  readonly lightId: number;
  readonly planKey: string;
  readonly passKey: string;
  readonly matrixKey: string;
  readonly offsetBytes: number;
  readonly sizeBytes: number;
  readonly upload: ShadowMatrixBufferUploadMode;
}

export interface ShadowMatrixBufferDescriptor {
  readonly resourceKey: string;
  readonly label: string;
  readonly usage: "read-only-storage-buffer";
  readonly matrixCount: number;
  readonly strideBytes: number;
  readonly byteSize: number;
  readonly entries: readonly ShadowMatrixBufferEntry[];
}

export interface ShadowMatrixBufferDescriptorDiagnostic {
  readonly code: ShadowMatrixBufferDescriptorDiagnosticCode;
  readonly severity: "warning" | "error";
  readonly message: string;
}

export interface ShadowMatrixBufferDescriptorReport {
  readonly ready: boolean;
  readonly status: ShadowMatrixBufferDescriptorStatus;
  readonly planCount: number;
  readonly matrixCount: number;
  readonly byteSize: number;
  readonly sections: {
    readonly viewProjectionPlanning: boolean;
    readonly bufferDescriptor: boolean;
    readonly gpuAllocation: false;
    readonly upload: boolean;
  };
  readonly descriptor: ShadowMatrixBufferDescriptor | null;
  readonly diagnostics: readonly ShadowMatrixBufferDescriptorDiagnostic[];
}

export type ShadowMatrixBufferDescriptorReportJsonValue =
  ShadowMatrixBufferDescriptorReport;

export interface ShadowMatrixBufferDescriptorInput {
  readonly viewProjection: ShadowViewProjectionPlanReportLike;
  readonly upload?: ShadowMatrixBufferUploadMode;
  readonly resourceKey?: string;
  readonly label?: string;
}

export interface ShadowViewProjectionPlanLike {
  readonly shadowId: number;
  readonly lightId: number;
  readonly planKey: string;
  readonly passKey: string;
  readonly viewProjectionMatrixKey: string;
}

export interface ShadowViewProjectionPlanReportLike {
  readonly status:
    | "ready"
    | "deferred"
    | "unsupported"
    | "missing"
    | "not-required";
  readonly planCount: number;
  readonly plans: readonly ShadowViewProjectionPlanLike[];
}

export const SHADOW_MATRIX_BUFFER_STRIDE_BYTES = 16 * 4;

export function createShadowMatrixBufferDescriptorReport(
  input: ShadowMatrixBufferDescriptorInput,
): ShadowMatrixBufferDescriptorReport {
  const upload = input.upload ?? "deferred";
  const viewProjectionReady =
    input.viewProjection.status !== "missing" &&
    input.viewProjection.status !== "unsupported";

  if (input.viewProjection.status === "not-required") {
    return {
      ready: true,
      status: "not-required",
      planCount: 0,
      matrixCount: 0,
      byteSize: 0,
      sections: {
        viewProjectionPlanning: true,
        bufferDescriptor: true,
        gpuAllocation: false,
        upload: true,
      },
      descriptor: null,
      diagnostics: [],
    };
  }

  const diagnostics: ShadowMatrixBufferDescriptorDiagnostic[] = [];

  if (input.viewProjection.status === "missing") {
    diagnostics.push({
      code: "shadowMatrixBuffer.missingViewProjectionPlan",
      severity: "warning",
      message:
        "Shadow matrix buffer planning requires a shadow view/projection plan.",
    });
  }

  if (input.viewProjection.status === "unsupported") {
    diagnostics.push({
      code: "shadowMatrixBuffer.unsupportedViewProjectionPlan",
      severity: "warning",
      message:
        "Shadow matrix buffer planning does not support the current shadow view/projection plan.",
    });
  }

  const entries = input.viewProjection.plans.map((plan, index) => ({
    shadowId: plan.shadowId,
    lightId: plan.lightId,
    planKey: plan.planKey,
    passKey: plan.passKey,
    matrixKey: plan.viewProjectionMatrixKey,
    offsetBytes: index * SHADOW_MATRIX_BUFFER_STRIDE_BYTES,
    sizeBytes: SHADOW_MATRIX_BUFFER_STRIDE_BYTES,
    upload,
  }));
  const byteSize = entries.length * SHADOW_MATRIX_BUFFER_STRIDE_BYTES;
  const descriptor =
    entries.length === 0
      ? null
      : {
          resourceKey: input.resourceKey ?? "shadow-matrix-buffer:directional",
          label: input.label ?? "DirectionalShadowMatrices/storage",
          usage: "read-only-storage-buffer" as const,
          matrixCount: entries.length,
          strideBytes: SHADOW_MATRIX_BUFFER_STRIDE_BYTES,
          byteSize,
          entries,
        };

  if (descriptor !== null && upload === "deferred") {
    diagnostics.push({
      code: "shadowMatrixBuffer.uploadDeferred",
      severity: "warning",
      message:
        "Shadow matrix buffer descriptor is planned, but GPU buffer allocation and matrix upload are deferred.",
    });
  }

  const status = determineStatus({
    viewProjectionStatus: input.viewProjection.status,
    hasDescriptor: descriptor !== null,
    upload,
  });

  return {
    ready: status === "ready",
    status,
    planCount: input.viewProjection.planCount,
    matrixCount: entries.length,
    byteSize,
    sections: {
      viewProjectionPlanning: viewProjectionReady,
      bufferDescriptor: descriptor !== null,
      gpuAllocation: false,
      upload: status === "ready",
    },
    descriptor,
    diagnostics,
  };
}

export function shadowMatrixBufferDescriptorReportToJsonValue(
  report: ShadowMatrixBufferDescriptorReport,
): ShadowMatrixBufferDescriptorReportJsonValue {
  return {
    ready: report.ready,
    status: report.status,
    planCount: report.planCount,
    matrixCount: report.matrixCount,
    byteSize: report.byteSize,
    sections: { ...report.sections },
    descriptor:
      report.descriptor === null
        ? null
        : {
            ...report.descriptor,
            entries: report.descriptor.entries.map((entry) => ({ ...entry })),
          },
    diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function shadowMatrixBufferDescriptorReportToJson(
  report: ShadowMatrixBufferDescriptorReport,
): string {
  return JSON.stringify(shadowMatrixBufferDescriptorReportToJsonValue(report));
}

function determineStatus(input: {
  readonly viewProjectionStatus: ShadowViewProjectionPlanReportLike["status"];
  readonly hasDescriptor: boolean;
  readonly upload: ShadowMatrixBufferUploadMode;
}): ShadowMatrixBufferDescriptorStatus {
  if (input.viewProjectionStatus === "unsupported") {
    return "unsupported";
  }

  if (input.viewProjectionStatus === "missing" || !input.hasDescriptor) {
    return "missing";
  }

  if (input.upload === "deferred") {
    return "deferred";
  }

  return "ready";
}
