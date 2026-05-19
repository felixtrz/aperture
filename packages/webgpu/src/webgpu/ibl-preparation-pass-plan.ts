import type {
  IblTexturePreparationReport,
  IblTexturePreparationSlot,
} from "./ibl-texture-preparation.js";

export type IblPreparationPassStatus =
  | "ready"
  | "deferred"
  | "unsupported"
  | "missing"
  | "not-required";

export type IblPreparationPassMode = "ready" | "deferred" | "unsupported";

export type IblPreparationPassDiagnosticCode =
  | "iblPreparationPass.missingTexturePreparation"
  | "iblPreparationPass.unsupportedSlots"
  | "iblPreparationPass.submissionDeferred"
  | "iblPreparationPass.submissionUnsupported";

export interface IblPreparationPass {
  readonly passKey: string;
  readonly environmentMapResourceKey: string;
  readonly environmentIds: readonly number[];
  readonly kind: "diffuse" | "specular";
  readonly sourceResourceKey: string;
  readonly textureKey: string;
  readonly viewKey: string;
  readonly samplerKey: string;
  readonly operation: "irradiance-convolution" | "specular-prefilter";
  readonly submission: IblPreparationPassMode;
}

export interface IblPreparationPassDiagnostic {
  readonly code: IblPreparationPassDiagnosticCode;
  readonly severity: "warning" | "error";
  readonly message: string;
}

export interface IblPreparationPassPlanReport {
  readonly ready: boolean;
  readonly status: IblPreparationPassStatus;
  readonly slotCount: number;
  readonly passCount: number;
  readonly sections: {
    readonly texturePreparation: boolean;
    readonly passPlans: boolean;
    readonly passSubmission: boolean;
    readonly shaderSampling: false;
  };
  readonly passes: readonly IblPreparationPass[];
  readonly diagnostics: readonly IblPreparationPassDiagnostic[];
}

export type IblPreparationPassPlanReportJsonValue =
  IblPreparationPassPlanReport;

export interface IblPreparationPassPlanInput {
  readonly textures: IblTexturePreparationReport;
  readonly submission?: IblPreparationPassMode;
}

export function createIblPreparationPassPlanReport(
  input: IblPreparationPassPlanInput,
): IblPreparationPassPlanReport {
  const submission = input.submission ?? "deferred";

  if (input.textures.slotCount === 0) {
    return {
      ready: true,
      status: "not-required",
      slotCount: 0,
      passCount: 0,
      sections: {
        texturePreparation: true,
        passPlans: true,
        passSubmission: true,
        shaderSampling: false,
      },
      passes: [],
      diagnostics: [],
    };
  }

  const diagnostics: IblPreparationPassDiagnostic[] = [];

  if (input.textures.status === "missing") {
    diagnostics.push({
      code: "iblPreparationPass.missingTexturePreparation",
      severity: "warning",
      message:
        "IBL preparation pass planning requires valid IBL texture preparation descriptors.",
    });
  }

  if (
    input.textures.status === "unsupported" ||
    input.textures.slots.some((slot) => slot.preparation === "unsupported")
  ) {
    diagnostics.push({
      code: "iblPreparationPass.unsupportedSlots",
      severity: "warning",
      message:
        "IBL preparation pass planning cannot proceed while diffuse or specular texture slots are unsupported.",
    });
  }

  const passes = input.textures.slots
    .filter(isPreparedTextureSlot)
    .map((slot) => createPreparationPass(slot, submission));

  if (submission === "unsupported" && passes.length > 0) {
    diagnostics.push({
      code: "iblPreparationPass.submissionUnsupported",
      severity: "warning",
      message:
        "IBL texture preparation pass submission is unsupported for the planned resources.",
    });
  } else if (submission === "deferred" && passes.length > 0) {
    diagnostics.push({
      code: "iblPreparationPass.submissionDeferred",
      severity: "warning",
      message:
        "IBL texture preparation passes are planned, but GPU submission is not implemented yet.",
    });
  }

  const status = determineStatus({
    textureStatus: input.textures.status,
    submission,
    hasUnsupportedSlots: diagnostics.some(
      (diagnostic) => diagnostic.code === "iblPreparationPass.unsupportedSlots",
    ),
  });

  return {
    ready: status === "ready",
    status,
    slotCount: input.textures.slotCount,
    passCount: passes.length,
    sections: {
      texturePreparation:
        input.textures.status === "ready" ||
        input.textures.status === "deferred",
      passPlans: status === "ready" || status === "deferred",
      passSubmission: status === "ready",
      shaderSampling: false,
    },
    passes,
    diagnostics,
  };
}

export function iblPreparationPassPlanReportToJsonValue(
  report: IblPreparationPassPlanReport,
): IblPreparationPassPlanReportJsonValue {
  return {
    ready: report.ready,
    status: report.status,
    slotCount: report.slotCount,
    passCount: report.passCount,
    sections: { ...report.sections },
    passes: report.passes.map((pass) => ({
      ...pass,
      environmentIds: [...pass.environmentIds],
    })),
    diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function iblPreparationPassPlanReportToJson(
  report: IblPreparationPassPlanReport,
): string {
  return JSON.stringify(iblPreparationPassPlanReportToJsonValue(report));
}

function isPreparedTextureSlot(
  slot: IblTexturePreparationSlot,
): slot is IblTexturePreparationSlot & {
  readonly sourceResourceKey: string;
  readonly textureKey: string;
  readonly viewKey: string;
  readonly samplerKey: string;
} {
  return (
    slot.sourceResourceKey !== null &&
    slot.textureKey !== null &&
    slot.viewKey !== null &&
    slot.samplerKey !== null
  );
}

function createPreparationPass(
  slot: IblTexturePreparationSlot & {
    readonly sourceResourceKey: string;
    readonly textureKey: string;
    readonly viewKey: string;
    readonly samplerKey: string;
  },
  submission: IblPreparationPassMode,
): IblPreparationPass {
  return {
    passKey: `ibl-pass:${slot.environmentMapResourceKey}:${slot.kind}`,
    environmentMapResourceKey: slot.environmentMapResourceKey,
    environmentIds: [...slot.environmentIds],
    kind: slot.kind,
    sourceResourceKey: slot.sourceResourceKey,
    textureKey: slot.textureKey,
    viewKey: slot.viewKey,
    samplerKey: slot.samplerKey,
    operation:
      slot.kind === "diffuse" ? "irradiance-convolution" : "specular-prefilter",
    submission,
  };
}

function determineStatus(input: {
  readonly textureStatus: IblTexturePreparationReport["status"];
  readonly submission: IblPreparationPassMode;
  readonly hasUnsupportedSlots: boolean;
}): IblPreparationPassStatus {
  if (input.textureStatus === "not-required") {
    return "not-required";
  }

  if (input.textureStatus === "missing") {
    return "missing";
  }

  if (input.textureStatus === "unsupported" || input.hasUnsupportedSlots) {
    return "unsupported";
  }

  return input.submission;
}
