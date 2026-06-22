import type {
  IblPreparationPassPlanReport,
  IblPreparationPassStatus,
} from "./ibl-preparation-pass-plan.js";
import type { IblResourceDescriptorReport } from "./ibl-resource-descriptor.js";
import type {
  IblTexturePreparationReport,
  IblTexturePreparationStatus,
} from "./ibl-texture-preparation.js";

export type IblPreparationResourceSummaryStatus =
  | "ready"
  | "deferred"
  | "unsupported"
  | "missing"
  | "not-required";

export type IblPreparationResourceSummaryDiagnosticCode =
  | "iblPreparationResourceSummary.missingDescriptors"
  | "iblPreparationResourceSummary.missingTexturePreparation"
  | "iblPreparationResourceSummary.unsupportedTexturePreparation"
  | "iblPreparationResourceSummary.textureUploadDeferred"
  | "iblPreparationResourceSummary.missingPassPlan"
  | "iblPreparationResourceSummary.unsupportedPassPlan"
  | "iblPreparationResourceSummary.passSubmissionDeferred"
  | "iblPreparationResourceSummary.shaderSamplingDeferred";

export interface IblPreparationResourceSummaryDiagnostic {
  readonly code: IblPreparationResourceSummaryDiagnosticCode;
  readonly severity: "warning" | "error";
  readonly message: string;
}

export interface IblPreparationResourceSummaryReport {
  readonly ready: boolean;
  readonly status: IblPreparationResourceSummaryStatus;
  readonly counts: {
    readonly environmentMaps: number;
    readonly descriptors: number;
    readonly textureSlots: number;
    readonly plannedTextures: number;
    readonly plannedViews: number;
    readonly plannedSamplers: number;
    readonly preparationPasses: number;
  };
  readonly sections: {
    readonly iblDescriptors: boolean;
    readonly textureDescriptors: boolean;
    readonly textureUpload: boolean;
    readonly prefilterPassPlans: boolean;
    readonly passSubmission: boolean;
    readonly shaderSampling: false;
  };
  readonly resourceKeys: {
    readonly environmentMaps: readonly string[];
    readonly textures: readonly string[];
    readonly views: readonly string[];
    readonly samplers: readonly string[];
    readonly passes: readonly string[];
  };
  readonly diagnostics: readonly IblPreparationResourceSummaryDiagnostic[];
}

export type IblPreparationResourceSummaryReportJsonValue =
  IblPreparationResourceSummaryReport;

export interface IblPreparationResourceSummaryScratch {
  readonly environmentMapKeys: string[];
  readonly textureKeys: string[];
  readonly viewKeys: string[];
  readonly samplerKeys: string[];
  readonly passKeys: string[];
  readonly diagnostics: IblPreparationResourceSummaryDiagnostic[];
  readonly report: IblPreparationResourceSummaryReport;
}

export interface IblPreparationResourceSummaryInput {
  readonly descriptors: IblResourceDescriptorReport;
  readonly textures: IblTexturePreparationReport;
  readonly passPlan: IblPreparationPassPlanReport;
}

export function createIblPreparationResourceSummaryReport(
  input: IblPreparationResourceSummaryInput,
): IblPreparationResourceSummaryReport {
  return writeIblPreparationResourceSummaryReport(
    input,
    createIblPreparationResourceSummaryScratch(),
  );
}

export function createIblPreparationResourceSummaryScratch(): IblPreparationResourceSummaryScratch {
  const environmentMapKeys: string[] = [];
  const textureKeys: string[] = [];
  const viewKeys: string[] = [];
  const samplerKeys: string[] = [];
  const passKeys: string[] = [];
  const diagnostics: IblPreparationResourceSummaryDiagnostic[] = [];

  return {
    environmentMapKeys,
    textureKeys,
    viewKeys,
    samplerKeys,
    passKeys,
    diagnostics,
    report: {
      ready: true,
      status: "not-required",
      counts: {
        environmentMaps: 0,
        descriptors: 0,
        textureSlots: 0,
        plannedTextures: 0,
        plannedViews: 0,
        plannedSamplers: 0,
        preparationPasses: 0,
      },
      sections: {
        iblDescriptors: true,
        textureDescriptors: true,
        textureUpload: true,
        prefilterPassPlans: true,
        passSubmission: true,
        shaderSampling: false,
      },
      resourceKeys: {
        environmentMaps: environmentMapKeys,
        textures: textureKeys,
        views: viewKeys,
        samplers: samplerKeys,
        passes: passKeys,
      },
      diagnostics,
    },
  };
}

export function writeIblPreparationResourceSummaryReport(
  input: IblPreparationResourceSummaryInput,
  scratch: IblPreparationResourceSummaryScratch,
): IblPreparationResourceSummaryReport {
  clearScratch(scratch);
  const status = determineStatus({
    descriptorReady: input.descriptors.ready,
    requiredEnvironmentMapCount: input.descriptors.requiredEnvironmentMapCount,
    textureStatus: input.textures.status,
    passStatus: input.passPlan.status,
  });
  writeDiagnostics(input, status, scratch.diagnostics);

  for (const descriptor of input.descriptors.descriptors) {
    pushUniqueSorted(
      scratch.environmentMapKeys,
      descriptor.environmentMapResourceKey,
    );
  }

  for (const slot of input.textures.slots) {
    if (slot.textureKey !== null) {
      pushUniqueSorted(scratch.textureKeys, slot.textureKey);
    }

    if (slot.viewKey !== null) {
      pushUniqueSorted(scratch.viewKeys, slot.viewKey);
    }

    if (slot.samplerKey !== null) {
      pushUniqueSorted(scratch.samplerKeys, slot.samplerKey);
    }
  }

  for (const pass of input.passPlan.passes) {
    pushUniqueSorted(scratch.passKeys, pass.passKey);
  }

  writeReport(
    scratch,
    status,
    {
      environmentMaps: input.descriptors.requiredEnvironmentMapCount,
      descriptors: input.descriptors.descriptorCount,
      textureSlots: input.textures.slotCount,
      plannedTextures: scratch.textureKeys.length,
      plannedViews: scratch.viewKeys.length,
      plannedSamplers: scratch.samplerKeys.length,
      preparationPasses: input.passPlan.passCount,
    },
    {
      iblDescriptors: input.descriptors.ready,
      textureDescriptors:
        input.textures.status === "ready" ||
        input.textures.status === "deferred" ||
        input.textures.status === "not-required",
      textureUpload: input.textures.sections.textureUpload,
      prefilterPassPlans:
        input.passPlan.status === "ready" ||
        input.passPlan.status === "deferred" ||
        input.passPlan.status === "not-required",
      passSubmission: input.passPlan.sections.passSubmission,
      shaderSampling: false,
    },
  );

  return scratch.report;
}

export function iblPreparationResourceSummaryReportToJsonValue(
  report: IblPreparationResourceSummaryReport,
): IblPreparationResourceSummaryReportJsonValue {
  return {
    ready: report.ready,
    status: report.status,
    counts: { ...report.counts },
    sections: { ...report.sections },
    resourceKeys: {
      environmentMaps: [...report.resourceKeys.environmentMaps],
      textures: [...report.resourceKeys.textures],
      views: [...report.resourceKeys.views],
      samplers: [...report.resourceKeys.samplers],
      passes: [...report.resourceKeys.passes],
    },
    diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function iblPreparationResourceSummaryReportToJson(
  report: IblPreparationResourceSummaryReport,
): string {
  return JSON.stringify(iblPreparationResourceSummaryReportToJsonValue(report));
}

function determineStatus(input: {
  readonly descriptorReady: boolean;
  readonly requiredEnvironmentMapCount: number;
  readonly textureStatus: IblTexturePreparationStatus;
  readonly passStatus: IblPreparationPassStatus;
}): IblPreparationResourceSummaryStatus {
  if (input.requiredEnvironmentMapCount === 0) {
    return "not-required";
  }

  if (
    !input.descriptorReady ||
    input.textureStatus === "missing" ||
    input.passStatus === "missing"
  ) {
    return "missing";
  }

  if (
    input.textureStatus === "unsupported" ||
    input.passStatus === "unsupported"
  ) {
    return "unsupported";
  }

  if (input.textureStatus === "deferred" || input.passStatus === "deferred") {
    return "deferred";
  }

  return "ready";
}

type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

function clearScratch(scratch: IblPreparationResourceSummaryScratch): void {
  scratch.environmentMapKeys.length = 0;
  scratch.textureKeys.length = 0;
  scratch.viewKeys.length = 0;
  scratch.samplerKeys.length = 0;
  scratch.passKeys.length = 0;
  scratch.diagnostics.length = 0;
}

function writeDiagnostics(
  input: IblPreparationResourceSummaryInput,
  status: IblPreparationResourceSummaryStatus,
  diagnostics: IblPreparationResourceSummaryDiagnostic[],
): void {
  if (status === "not-required") {
    return;
  }

  if (!input.descriptors.ready) {
    diagnostics.push({
      code: "iblPreparationResourceSummary.missingDescriptors",
      severity: "warning",
      message:
        "IBL preparation resource summary requires renderer-owned IBL descriptors.",
    });
  }

  addTextureDiagnostic(diagnostics, input.textures.status);
  addPassDiagnostic(diagnostics, input.passPlan.status);

  diagnostics.push({
    code: "iblPreparationResourceSummary.shaderSamplingDeferred",
    severity: "warning",
    message:
      "IBL preparation resource status is data-only; StandardMaterial shader sampling remains deferred.",
  });
}

function addTextureDiagnostic(
  diagnostics: IblPreparationResourceSummaryDiagnostic[],
  status: IblTexturePreparationStatus,
): void {
  if (status === "missing") {
    diagnostics.push({
      code: "iblPreparationResourceSummary.missingTexturePreparation",
      severity: "warning",
      message:
        "IBL preparation resource summary requires valid texture preparation descriptors.",
    });
  } else if (status === "unsupported") {
    diagnostics.push({
      code: "iblPreparationResourceSummary.unsupportedTexturePreparation",
      severity: "warning",
      message:
        "IBL texture preparation has unsupported slots and cannot be summarized as ready resources.",
    });
  } else if (status === "deferred") {
    diagnostics.push({
      code: "iblPreparationResourceSummary.textureUploadDeferred",
      severity: "warning",
      message:
        "IBL texture descriptors are planned, but GPU texture upload is deferred.",
    });
  }
}

function addPassDiagnostic(
  diagnostics: IblPreparationResourceSummaryDiagnostic[],
  status: IblPreparationPassStatus,
): void {
  if (status === "missing") {
    diagnostics.push({
      code: "iblPreparationResourceSummary.missingPassPlan",
      severity: "warning",
      message:
        "IBL preparation resource summary requires valid preparation pass plans.",
    });
  } else if (status === "unsupported") {
    diagnostics.push({
      code: "iblPreparationResourceSummary.unsupportedPassPlan",
      severity: "warning",
      message:
        "IBL preparation pass planning is unsupported for the current texture resources.",
    });
  } else if (status === "deferred") {
    diagnostics.push({
      code: "iblPreparationResourceSummary.passSubmissionDeferred",
      severity: "warning",
      message:
        "IBL preparation passes are planned, but GPU pass submission is deferred.",
    });
  }
}

function writeReport(
  scratch: IblPreparationResourceSummaryScratch,
  status: IblPreparationResourceSummaryStatus,
  counts: IblPreparationResourceSummaryReport["counts"],
  sections: IblPreparationResourceSummaryReport["sections"],
): void {
  const report = scratch.report as Mutable<IblPreparationResourceSummaryReport>;
  const mutableCounts = report.counts as Mutable<
    IblPreparationResourceSummaryReport["counts"]
  >;
  const mutableSections = report.sections as Mutable<
    IblPreparationResourceSummaryReport["sections"]
  >;

  report.ready = status === "ready" || status === "not-required";
  report.status = status;
  mutableCounts.environmentMaps = counts.environmentMaps;
  mutableCounts.descriptors = counts.descriptors;
  mutableCounts.textureSlots = counts.textureSlots;
  mutableCounts.plannedTextures = counts.plannedTextures;
  mutableCounts.plannedViews = counts.plannedViews;
  mutableCounts.plannedSamplers = counts.plannedSamplers;
  mutableCounts.preparationPasses = counts.preparationPasses;
  mutableSections.iblDescriptors = sections.iblDescriptors;
  mutableSections.textureDescriptors = sections.textureDescriptors;
  mutableSections.textureUpload = sections.textureUpload;
  mutableSections.prefilterPassPlans = sections.prefilterPassPlans;
  mutableSections.passSubmission = sections.passSubmission;
  mutableSections.shaderSampling = sections.shaderSampling;
}

function pushUniqueSorted(values: string[], value: string): void {
  if (values.includes(value)) {
    return;
  }

  values.push(value);
  values.sort();
}
