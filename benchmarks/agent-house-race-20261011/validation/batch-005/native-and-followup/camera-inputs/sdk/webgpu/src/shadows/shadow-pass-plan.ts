import type { ShadowRequestPacket } from "@aperture-engine/render";

import type {
  ShadowTextureResourceDescriptor,
  ShadowTextureResourceReport,
} from "./shadow-texture-resource.js";

export type ShadowPassSubmissionStatus =
  | "ready"
  | "deferred"
  | "unsupported"
  | "missing"
  | "not-required";

export type ShadowPassSubmissionMode = "ready" | "deferred" | "unsupported";

export type ShadowPassPlanDiagnosticCode =
  | "shadowPassPlan.missingTextureResources"
  | "shadowPassPlan.missingShadowRequest"
  | "shadowPassPlan.submissionDeferred"
  | "shadowPassPlan.submissionUnsupported";

export interface ShadowPassPlan {
  readonly shadowId: number;
  readonly lightId: number;
  readonly lightKind: NonNullable<ShadowRequestPacket["lightKind"]>;
  readonly cascadeIndex?: number;
  readonly cascadeCount?: number;
  readonly faceIndex: number;
  readonly faceCount: 1 | 6;
  readonly passKey: string;
  readonly resourceKey: string;
  readonly textureKey: string;
  readonly viewKey: string;
  readonly width: number;
  readonly height: number;
  readonly depthFormat: "depth24plus";
  readonly casterLayerMask: number;
  readonly receiverLayerMask: number;
  readonly depthLoadOp: "clear" | "load";
  readonly depthStoreOp: "store";
  readonly depthClearValue: 0 | 1;
  readonly submission: Exclude<ShadowPassSubmissionMode, "ready"> | "ready";
}

export interface ShadowPassPlanDiagnostic {
  readonly code: ShadowPassPlanDiagnosticCode;
  readonly severity: "warning" | "error";
  readonly message: string;
}

export interface ShadowPassPlanReport {
  readonly ready: boolean;
  readonly status: ShadowPassSubmissionStatus;
  readonly requestCount: number;
  readonly textureCount: number;
  readonly passCount: number;
  readonly sections: {
    readonly shadowRequests: boolean;
    readonly textureResources: boolean;
    readonly passPlans: boolean;
    readonly passSubmission: boolean;
    readonly gpuCommands: boolean;
  };
  readonly passes: readonly ShadowPassPlan[];
  readonly diagnostics: readonly ShadowPassPlanDiagnostic[];
}

export type ShadowPassPlanReportJsonValue = ShadowPassPlanReport;

export interface ShadowPassPlanInput {
  readonly shadowRequests: readonly ShadowRequestPacket[];
  readonly textures: ShadowTextureResourceReport;
  readonly submission?: ShadowPassSubmissionMode;
}

export function createShadowPassPlanReport(
  input: ShadowPassPlanInput,
): ShadowPassPlanReport {
  const submission = input.submission ?? "deferred";

  if (input.shadowRequests.length === 0) {
    return {
      ready: true,
      status: "not-required",
      requestCount: 0,
      textureCount: input.textures.textureCount,
      passCount: 0,
      sections: {
        shadowRequests: true,
        textureResources: input.textures.ready,
        passPlans: true,
        passSubmission: true,
        gpuCommands: false,
      },
      passes: [],
      diagnostics: [],
    };
  }

  const diagnostics: ShadowPassPlanDiagnostic[] = [];

  if (!input.textures.ready) {
    diagnostics.push({
      code: "shadowPassPlan.missingTextureResources",
      severity: "warning",
      message:
        "Shadow pass planning requires valid renderer-owned shadow texture resource descriptors.",
    });
  }

  const requestsByKey = new Map(
    input.shadowRequests.map((request) => [
      shadowPassInputKey(request.shadowId, request.lightId),
      request,
    ]),
  );
  const usedDepthViews = new Set<string>();
  const passes: ShadowPassPlan[] = [];

  for (const texture of input.textures.textures) {
    const request = requestsByKey.get(
      shadowPassInputKey(texture.shadowId, texture.lightId),
    );

    if (request === undefined) {
      diagnostics.push({
        code: "shadowPassPlan.missingShadowRequest",
        severity: "error",
        message: `Shadow texture resource '${texture.resourceKey}' has no matching extracted shadow request.`,
      });
      continue;
    }

    for (const pass of createShadowPassPlans(texture, request, submission)) {
      const depthViewKey = `${pass.textureKey}:${pass.viewKey}`;
      const depthLoadOp = usedDepthViews.has(depthViewKey) ? "load" : "clear";

      usedDepthViews.add(depthViewKey);
      passes.push({ ...pass, depthLoadOp });
    }
  }

  if (submission === "unsupported") {
    diagnostics.push({
      code: "shadowPassPlan.submissionUnsupported",
      severity: "warning",
      message:
        "Shadow pass submission is not supported for the planned shadow resources.",
    });
  } else if (submission === "deferred" && passes.length > 0) {
    diagnostics.push({
      code: "shadowPassPlan.submissionDeferred",
      severity: "warning",
      message:
        "Shadow pass descriptors are planned, but GPU command submission is not implemented yet.",
    });
  }

  const hasMissingInput = diagnostics.some(
    (diagnostic) =>
      diagnostic.code === "shadowPassPlan.missingTextureResources" ||
      diagnostic.code === "shadowPassPlan.missingShadowRequest",
  );
  const status = determineStatus(submission, hasMissingInput);

  return {
    ready: status === "ready",
    status,
    requestCount: input.shadowRequests.length,
    textureCount: input.textures.textureCount,
    passCount: passes.length,
    sections: {
      shadowRequests: true,
      textureResources: input.textures.ready,
      passPlans: !hasMissingInput,
      passSubmission: status === "ready",
      gpuCommands: status === "ready",
    },
    passes,
    diagnostics,
  };
}

export function shadowPassPlanReportToJsonValue(
  report: ShadowPassPlanReport,
): ShadowPassPlanReportJsonValue {
  return {
    ready: report.ready,
    status: report.status,
    requestCount: report.requestCount,
    textureCount: report.textureCount,
    passCount: report.passCount,
    sections: { ...report.sections },
    passes: report.passes.map((pass) => ({ ...pass })),
    diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function shadowPassPlanReportToJson(
  report: ShadowPassPlanReport,
): string {
  return JSON.stringify(shadowPassPlanReportToJsonValue(report));
}

function createShadowPassPlans(
  texture: ShadowTextureResourceDescriptor,
  request: ShadowRequestPacket,
  submission: ShadowPassSubmissionMode,
): readonly ShadowPassPlan[] {
  const passCount =
    texture.lightKind === "directional"
      ? Math.max(1, texture.cascadeCount ?? 1)
      : texture.faceCount;

  return Array.from({ length: passCount }, (_, passIndex) => ({
    shadowId: request.shadowId,
    lightId: request.lightId,
    lightKind: request.lightKind ?? "directional",
    cascadeIndex: texture.lightKind === "directional" ? passIndex : 0,
    cascadeCount: texture.lightKind === "directional" ? passCount : 1,
    faceIndex: texture.lightKind === "point" ? passIndex : 0,
    faceCount: texture.faceCount,
    passKey:
      texture.lightKind === "directional" && passCount > 1
        ? `shadow-pass:${request.shadowId}:light:${request.lightId}:cascade:${passIndex}`
        : texture.faceCount === 1
          ? `shadow-pass:${request.shadowId}:light:${request.lightId}`
          : `shadow-pass:${request.shadowId}:light:${request.lightId}:face:${passIndex}`,
    resourceKey: texture.resourceKey,
    textureKey: texture.textureKey,
    viewKey: texture.attachmentViewKeys[passIndex] ?? texture.viewKey,
    width: texture.width,
    height: texture.height,
    depthFormat: texture.depthFormat,
    casterLayerMask: request.casterLayerMask,
    receiverLayerMask: request.receiverLayerMask,
    depthLoadOp: "clear",
    depthStoreOp: "store",
    // Standard [0,1] depth with a less-equal caster test: clear to the far value
    // (1) so the nearest caster wins on every pass. This applies to cube point
    // shadows too (6 perspective faces) — clearing those to 0 left the depth
    // test rejecting every fragment, so the cube recorded no occluders.
    depthClearValue: 1,
    submission,
  }));
}

function determineStatus(
  submission: ShadowPassSubmissionMode,
  hasMissingInput: boolean,
): ShadowPassSubmissionStatus {
  if (hasMissingInput) {
    return "missing";
  }

  return submission;
}

function shadowPassInputKey(shadowId: number, lightId: number): string {
  return `${shadowId}:${lightId}`;
}
