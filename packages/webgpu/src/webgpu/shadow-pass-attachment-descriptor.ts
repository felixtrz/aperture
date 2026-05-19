import type { ShadowDepthTextureResourceReport } from "./shadow-depth-texture-resource.js";
import type { ShadowPassPlanReport } from "./shadow-pass-plan.js";

export type ShadowPassAttachmentDescriptorStatus =
  | "ready"
  | "deferred"
  | "missing"
  | "not-required";

export type ShadowPassAttachmentDescriptorDiagnosticCode =
  | "shadowPassAttachmentDescriptor.missingPassPlan"
  | "shadowPassAttachmentDescriptor.missingDepthView"
  | "shadowPassAttachmentDescriptor.passSubmissionDeferred";

export interface ShadowPassAttachmentDescriptorDiagnostic {
  readonly code: ShadowPassAttachmentDescriptorDiagnosticCode;
  readonly severity: "warning" | "error";
  readonly message: string;
  readonly passKey?: string;
  readonly shadowId?: number;
  readonly lightId?: number;
  readonly resourceKey?: string;
}

export interface ShadowPassDepthAttachmentDescriptor {
  readonly passKey: string;
  readonly shadowId: number;
  readonly lightId: number;
  readonly textureKey: string;
  readonly viewKey: string;
  readonly width: number;
  readonly height: number;
  readonly depthFormat: "depth24plus";
  readonly depthLoadOp: "clear";
  readonly depthStoreOp: "store";
  readonly depthClearValue: 1;
}

export interface ShadowPassAttachmentDescriptorReport {
  readonly ready: boolean;
  readonly status: ShadowPassAttachmentDescriptorStatus;
  readonly passCount: number;
  readonly attachmentCount: number;
  readonly sections: {
    readonly passPlans: boolean;
    readonly depthTextureResources: boolean;
    readonly depthAttachments: boolean;
    readonly commandEncoder: false;
    readonly passSubmission: false;
    readonly shaderSampling: false;
  };
  readonly attachments: readonly ShadowPassDepthAttachmentDescriptor[];
  readonly diagnostics: readonly ShadowPassAttachmentDescriptorDiagnostic[];
}

export type ShadowPassAttachmentDescriptorReportJsonValue =
  ShadowPassAttachmentDescriptorReport;

export interface CreateShadowPassAttachmentDescriptorReportOptions {
  readonly shadowPassPlan: ShadowPassPlanReport;
  readonly depthTextureResources: ShadowDepthTextureResourceReport;
}

export function createShadowPassAttachmentDescriptorReport(
  options: CreateShadowPassAttachmentDescriptorReportOptions,
): ShadowPassAttachmentDescriptorReport {
  if (options.shadowPassPlan.requestCount === 0) {
    return report({
      status: "not-required",
      passCount: 0,
      attachments: [],
      diagnostics: [],
    });
  }

  const diagnostics: ShadowPassAttachmentDescriptorDiagnostic[] = [];
  const resourcesByPass = new Map(
    options.depthTextureResources.resources.map((resource) => [
      shadowInputKey(resource.shadowId, resource.lightId),
      resource,
    ]),
  );
  const attachments: ShadowPassDepthAttachmentDescriptor[] = [];

  if (options.shadowPassPlan.passCount === 0) {
    diagnostics.push({
      code: "shadowPassAttachmentDescriptor.missingPassPlan",
      severity: "warning",
      message:
        "Shadow pass attachment descriptor planning requires shadow pass plans.",
    });
  }

  for (const pass of options.shadowPassPlan.passes) {
    const resource = resourcesByPass.get(
      shadowInputKey(pass.shadowId, pass.lightId),
    );

    if (resource?.allocation.resource === null || resource === undefined) {
      diagnostics.push({
        code: "shadowPassAttachmentDescriptor.missingDepthView",
        severity: "warning",
        passKey: pass.passKey,
        shadowId: pass.shadowId,
        lightId: pass.lightId,
        resourceKey: pass.viewKey,
        message: `Shadow pass '${pass.passKey}' requires a live depth texture view for its attachment descriptor.`,
      });
      continue;
    }

    attachments.push({
      passKey: pass.passKey,
      shadowId: pass.shadowId,
      lightId: pass.lightId,
      textureKey: resource.textureKey,
      viewKey: resource.viewKey,
      width: pass.width,
      height: pass.height,
      depthFormat: pass.depthFormat,
      depthLoadOp: pass.depthLoadOp,
      depthStoreOp: pass.depthStoreOp,
      depthClearValue: pass.depthClearValue,
    });
  }

  if (attachments.length > 0 && options.shadowPassPlan.status === "deferred") {
    diagnostics.push({
      code: "shadowPassAttachmentDescriptor.passSubmissionDeferred",
      severity: "warning",
      message:
        "Shadow pass depth attachments are planned, but command encoder execution and pass submission are deferred.",
    });
  }

  const hasMissing = diagnostics.some(
    (diagnostic) =>
      diagnostic.code === "shadowPassAttachmentDescriptor.missingPassPlan" ||
      diagnostic.code === "shadowPassAttachmentDescriptor.missingDepthView",
  );

  return report({
    status: hasMissing
      ? "missing"
      : options.shadowPassPlan.status === "deferred"
        ? "deferred"
        : "ready",
    passCount: options.shadowPassPlan.passCount,
    attachments,
    diagnostics,
  });
}

export function shadowPassAttachmentDescriptorReportToJsonValue(
  report: ShadowPassAttachmentDescriptorReport,
): ShadowPassAttachmentDescriptorReportJsonValue {
  return {
    ready: report.ready,
    status: report.status,
    passCount: report.passCount,
    attachmentCount: report.attachmentCount,
    sections: { ...report.sections },
    attachments: report.attachments.map((attachment) => ({ ...attachment })),
    diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function shadowPassAttachmentDescriptorReportToJson(
  report: ShadowPassAttachmentDescriptorReport,
): string {
  return JSON.stringify(
    shadowPassAttachmentDescriptorReportToJsonValue(report),
  );
}

function report(input: {
  readonly status: ShadowPassAttachmentDescriptorStatus;
  readonly passCount: number;
  readonly attachments: readonly ShadowPassDepthAttachmentDescriptor[];
  readonly diagnostics: readonly ShadowPassAttachmentDescriptorDiagnostic[];
}): ShadowPassAttachmentDescriptorReport {
  return {
    ready: input.status === "ready" || input.status === "not-required",
    status: input.status,
    passCount: input.passCount,
    attachmentCount: input.attachments.length,
    sections: {
      passPlans: input.passCount > 0,
      depthTextureResources: input.attachments.length > 0,
      depthAttachments: input.attachments.length > 0,
      commandEncoder: false,
      passSubmission: false,
      shaderSampling: false,
    },
    attachments: input.attachments,
    diagnostics: input.diagnostics,
  };
}

function shadowInputKey(shadowId: number, lightId: number): string {
  return `${shadowId}:${lightId}`;
}
