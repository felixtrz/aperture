import {
  summarizeDiagnostics,
  type DiagnosticSummary,
} from "../diagnostics/index.js";
import type {
  RenderPackageInspectionReport,
  RenderSnapshotCloneabilityResult,
  RenderSnapshotInspectionReport,
} from "../rendering/index.js";
import type { FrameReport } from "./frame-report.js";
import type { RenderResourceSummaryReport } from "./resource-summary.js";

export type RendererAssemblySmokeSection =
  | "snapshot"
  | "cloneability"
  | "packages"
  | "resources"
  | "frame";

export type RendererAssemblySmokeDiagnosticCode =
  | "rendererAssembly.missingSnapshotInspection"
  | "rendererAssembly.missingSnapshotViews"
  | "rendererAssembly.missingSnapshotDraws"
  | "rendererAssembly.missingCloneability"
  | "rendererAssembly.snapshotNotCloneable"
  | "rendererAssembly.missingPackageInspection"
  | "rendererAssembly.missingPackages"
  | "rendererAssembly.missingResourceSummary"
  | "rendererAssembly.missingResources"
  | "rendererAssembly.resourceErrors"
  | "rendererAssembly.missingFrameReport"
  | "rendererAssembly.frameNotReady";

export type RendererAssemblySmokeSeverity = "info" | "warning" | "error";

export interface RendererAssemblySmokeDiagnostic {
  readonly code: RendererAssemblySmokeDiagnosticCode;
  readonly message: string;
  readonly severity: RendererAssemblySmokeSeverity;
  readonly section: RendererAssemblySmokeSection;
}

export interface RendererAssemblySmokeSectionStatus {
  readonly section: RendererAssemblySmokeSection;
  readonly present: boolean;
  readonly ready: boolean;
  readonly diagnosticCodes: readonly string[];
}

export interface RendererAssemblySmokeSections {
  readonly snapshot: RendererAssemblySmokeSectionStatus;
  readonly cloneability: RendererAssemblySmokeSectionStatus;
  readonly packages: RendererAssemblySmokeSectionStatus;
  readonly resources: RendererAssemblySmokeSectionStatus;
  readonly frame: RendererAssemblySmokeSectionStatus;
}

export interface RendererAssemblySmokeSummary {
  readonly snapshot: RenderSnapshotInspectionReport["counts"] | null;
  readonly cloneability: Pick<
    RenderSnapshotCloneabilityResult,
    "valid" | "diagnostics"
  > | null;
  readonly packages: Pick<
    RenderPackageInspectionReport,
    "packageCount" | "diagnostics"
  > | null;
  readonly resources: RenderResourceSummaryReport["counts"] | null;
  readonly frame: Pick<
    FrameReport,
    "frame" | "ready" | "draws" | "batches" | "diagnostics"
  > | null;
}

export interface RendererAssemblySmokeInput {
  readonly snapshot: RenderSnapshotInspectionReport | null;
  readonly cloneability: RenderSnapshotCloneabilityResult | null;
  readonly packages: RenderPackageInspectionReport | null;
  readonly resources: RenderResourceSummaryReport | null;
  readonly frame: FrameReport | null;
}

export interface RendererAssemblySmokeReport {
  readonly ready: boolean;
  readonly sections: RendererAssemblySmokeSections;
  readonly diagnostics: readonly RendererAssemblySmokeDiagnostic[];
  readonly summary: RendererAssemblySmokeSummary;
}

export interface RendererAssemblySmokeSectionJsonValue {
  readonly present: boolean;
  readonly ready: boolean;
  readonly diagnosticCodes: readonly string[];
}

export interface RendererAssemblySmokeSectionsJsonValue {
  readonly snapshot: RendererAssemblySmokeSectionJsonValue;
  readonly cloneability: RendererAssemblySmokeSectionJsonValue;
  readonly packages: RendererAssemblySmokeSectionJsonValue;
  readonly resources: RendererAssemblySmokeSectionJsonValue;
  readonly frame: RendererAssemblySmokeSectionJsonValue;
}

export interface RendererAssemblySmokeSummaryJsonValue {
  readonly snapshot: RendererAssemblySmokeSummary["snapshot"];
  readonly cloneability: {
    readonly valid: boolean;
    readonly diagnostics: DiagnosticSummary;
  } | null;
  readonly packages: {
    readonly packageCount: number;
    readonly diagnostics: DiagnosticSummary;
  } | null;
  readonly resources: RendererAssemblySmokeSummary["resources"];
  readonly frame: RendererAssemblySmokeSummary["frame"];
}

export interface RendererAssemblySmokeReportJsonValue {
  readonly ready: boolean;
  readonly sections: RendererAssemblySmokeSectionsJsonValue;
  readonly summary: RendererAssemblySmokeSummaryJsonValue;
  readonly diagnostics: DiagnosticSummary;
}

export interface RendererAssemblySectionDiagnosticSummary {
  readonly section: RendererAssemblySmokeSection;
  readonly diagnostics: DiagnosticSummary;
}

export interface RendererAssemblyDiagnosticGroups {
  readonly snapshot: RendererAssemblySectionDiagnosticSummary;
  readonly cloneability: RendererAssemblySectionDiagnosticSummary;
  readonly packages: RendererAssemblySectionDiagnosticSummary;
  readonly resources: RendererAssemblySectionDiagnosticSummary;
  readonly frame: RendererAssemblySectionDiagnosticSummary;
}

export interface RendererAssemblyDiagnosticGroupReport {
  readonly ready: boolean;
  readonly sections: RendererAssemblyDiagnosticGroups;
  readonly diagnostics: DiagnosticSummary;
}

export function createRendererAssemblySmokeReport(
  input: RendererAssemblySmokeInput,
): RendererAssemblySmokeReport {
  const snapshot = evaluateSnapshot(input.snapshot);
  const cloneability = evaluateCloneability(input.cloneability);
  const packages = evaluatePackages(input.packages);
  const resources = evaluateResources(input.resources);
  const frame = evaluateFrame(input.frame);
  const sections: RendererAssemblySmokeSections = {
    snapshot: snapshot.status,
    cloneability: cloneability.status,
    packages: packages.status,
    resources: resources.status,
    frame: frame.status,
  };
  const diagnostics = [
    ...snapshot.diagnostics,
    ...cloneability.diagnostics,
    ...packages.diagnostics,
    ...resources.diagnostics,
    ...frame.diagnostics,
  ];

  return {
    ready: Object.values(sections).every((section) => section.ready),
    sections,
    diagnostics,
    summary: {
      snapshot: input.snapshot?.counts ?? null,
      cloneability:
        input.cloneability === null
          ? null
          : {
              valid: input.cloneability.valid,
              diagnostics: input.cloneability.diagnostics,
            },
      packages:
        input.packages === null
          ? null
          : {
              packageCount: input.packages.packageCount,
              diagnostics: input.packages.diagnostics,
            },
      resources: input.resources?.counts ?? null,
      frame:
        input.frame === null
          ? null
          : {
              frame: input.frame.frame,
              ready: input.frame.ready,
              draws: input.frame.draws,
              batches: input.frame.batches,
              diagnostics: input.frame.diagnostics,
            },
    },
  };
}

export function rendererAssemblySmokeReportToJsonValue(
  report: RendererAssemblySmokeReport,
): RendererAssemblySmokeReportJsonValue {
  const diagnostics = summarizeDiagnostics(report.diagnostics);

  return {
    ready: report.ready,
    sections: {
      snapshot: sectionToJsonValue(report.sections.snapshot),
      cloneability: sectionToJsonValue(report.sections.cloneability),
      packages: sectionToJsonValue(report.sections.packages),
      resources: sectionToJsonValue(report.sections.resources),
      frame: sectionToJsonValue(report.sections.frame),
    },
    summary: {
      snapshot: report.summary.snapshot,
      cloneability:
        report.summary.cloneability === null
          ? null
          : {
              valid: report.summary.cloneability.valid,
              diagnostics: summarizeDiagnostics(
                report.summary.cloneability.diagnostics,
              ),
            },
      packages:
        report.summary.packages === null
          ? null
          : {
              packageCount: report.summary.packages.packageCount,
              diagnostics: summarizeDiagnostics(
                report.summary.packages.diagnostics,
              ),
            },
      resources: report.summary.resources,
      frame:
        report.summary.frame === null
          ? null
          : {
              frame: report.summary.frame.frame,
              ready: report.summary.frame.ready,
              draws: report.summary.frame.draws,
              batches: report.summary.frame.batches,
              diagnostics: {
                total: report.summary.frame.diagnostics.total,
                bySeverity: {
                  info: report.summary.frame.diagnostics.bySeverity.info,
                  warning: report.summary.frame.diagnostics.bySeverity.warning,
                  error: report.summary.frame.diagnostics.bySeverity.error,
                },
                byCode: { ...report.summary.frame.diagnostics.byCode },
              },
            },
    },
    diagnostics: {
      total: diagnostics.total,
      bySeverity: {
        info: diagnostics.bySeverity.info,
        warning: diagnostics.bySeverity.warning,
        error: diagnostics.bySeverity.error,
      },
      byCode: { ...diagnostics.byCode },
    },
  };
}

export function rendererAssemblySmokeReportToJson(
  report: RendererAssemblySmokeReport,
): string {
  return JSON.stringify(rendererAssemblySmokeReportToJsonValue(report));
}

export function summarizeRendererAssemblyDiagnosticsBySection(
  report: RendererAssemblySmokeReport,
): RendererAssemblyDiagnosticGroupReport {
  const diagnostics = summarizeDiagnostics(report.diagnostics);

  return {
    ready: diagnostics.total === 0,
    sections: {
      snapshot: summarizeSectionDiagnostics("snapshot", report),
      cloneability: summarizeSectionDiagnostics("cloneability", report),
      packages: summarizeSectionDiagnostics("packages", report),
      resources: summarizeSectionDiagnostics("resources", report),
      frame: summarizeSectionDiagnostics("frame", report),
    },
    diagnostics,
  };
}

function summarizeSectionDiagnostics(
  section: RendererAssemblySmokeSection,
  report: RendererAssemblySmokeReport,
): RendererAssemblySectionDiagnosticSummary {
  return {
    section,
    diagnostics: summarizeDiagnostics(
      report.diagnostics.filter((diagnostic) => diagnostic.section === section),
    ),
  };
}

function sectionToJsonValue(
  section: RendererAssemblySmokeSectionStatus,
): RendererAssemblySmokeSectionJsonValue {
  return {
    present: section.present,
    ready: section.ready,
    diagnosticCodes: [...section.diagnosticCodes],
  };
}

interface Evaluation {
  readonly status: RendererAssemblySmokeSectionStatus;
  readonly diagnostics: readonly RendererAssemblySmokeDiagnostic[];
}

function evaluateSnapshot(
  report: RenderSnapshotInspectionReport | null,
): Evaluation {
  if (report === null) {
    return missing(
      "snapshot",
      "rendererAssembly.missingSnapshotInspection",
      "Renderer assembly smoke report is missing render snapshot inspection output.",
    );
  }

  const diagnostics: RendererAssemblySmokeDiagnostic[] = [];

  if (report.counts.views === 0) {
    diagnostics.push({
      code: "rendererAssembly.missingSnapshotViews",
      message: "Render snapshot inspection has no extracted views.",
      severity: "warning",
      section: "snapshot",
    });
  }

  if (report.counts.meshDraws === 0) {
    diagnostics.push({
      code: "rendererAssembly.missingSnapshotDraws",
      message: "Render snapshot inspection has no extracted mesh draws.",
      severity: "warning",
      section: "snapshot",
    });
  }

  return present("snapshot", diagnostics);
}

function evaluateCloneability(
  result: RenderSnapshotCloneabilityResult | null,
): Evaluation {
  if (result === null) {
    return missing(
      "cloneability",
      "rendererAssembly.missingCloneability",
      "Renderer assembly smoke report is missing render snapshot cloneability output.",
    );
  }

  if (!result.valid) {
    return present("cloneability", [
      {
        code: "rendererAssembly.snapshotNotCloneable",
        message: "Render snapshot cloneability validation failed.",
        severity: "error",
        section: "cloneability",
      },
    ]);
  }

  return present("cloneability", []);
}

function evaluatePackages(
  report: RenderPackageInspectionReport | null,
): Evaluation {
  if (report === null) {
    return missing(
      "packages",
      "rendererAssembly.missingPackageInspection",
      "Renderer assembly smoke report is missing draw package inspection output.",
    );
  }

  if (report.packageCount === 0) {
    return present("packages", [
      {
        code: "rendererAssembly.missingPackages",
        message:
          "Draw package inspection has no packages ready for submission.",
        severity: "warning",
        section: "packages",
      },
    ]);
  }

  return present("packages", []);
}

function evaluateResources(
  report: RenderResourceSummaryReport | null,
): Evaluation {
  if (report === null) {
    return missing(
      "resources",
      "rendererAssembly.missingResourceSummary",
      "Renderer assembly smoke report is missing renderer resource summary output.",
    );
  }

  const diagnostics: RendererAssemblySmokeDiagnostic[] = [];
  const missingGroups = missingResourceGroups(report.counts);

  if (missingGroups.length > 0) {
    diagnostics.push({
      code: "rendererAssembly.missingResources",
      message: `Renderer resource summary is missing resource groups: ${missingGroups.join(", ")}.`,
      severity: "warning",
      section: "resources",
    });
  }

  if (report.counts.errors > 0) {
    diagnostics.push({
      code: "rendererAssembly.resourceErrors",
      message: `Renderer resource summary has ${report.counts.errors} error diagnostics.`,
      severity: "error",
      section: "resources",
    });
  }

  return present("resources", diagnostics);
}

function evaluateFrame(report: FrameReport | null): Evaluation {
  if (report === null) {
    return missing(
      "frame",
      "rendererAssembly.missingFrameReport",
      "Renderer assembly smoke report is missing frame report output.",
    );
  }

  if (!report.ready) {
    return present("frame", [
      {
        code: "rendererAssembly.frameNotReady",
        message: `Frame report ${report.frame} is not ready for rendering.`,
        severity: "warning",
        section: "frame",
      },
    ]);
  }

  return present("frame", []);
}

function missing(
  section: RendererAssemblySmokeSection,
  code: RendererAssemblySmokeDiagnosticCode,
  message: string,
): Evaluation {
  const diagnostic: RendererAssemblySmokeDiagnostic = {
    code,
    message,
    severity: "error",
    section,
  };

  return {
    status: {
      section,
      present: false,
      ready: false,
      diagnosticCodes: [code],
    },
    diagnostics: [diagnostic],
  };
}

function present(
  section: RendererAssemblySmokeSection,
  diagnostics: readonly RendererAssemblySmokeDiagnostic[],
): Evaluation {
  return {
    status: {
      section,
      present: true,
      ready: diagnostics.length === 0,
      diagnosticCodes: diagnostics.map((diagnostic) => diagnostic.code),
    },
    diagnostics,
  };
}

function missingResourceGroups(
  counts: RenderResourceSummaryReport["counts"],
): readonly string[] {
  const missing: string[] = [];

  if (counts.meshResources === 0) {
    missing.push("mesh");
  }

  if (counts.materialBuffers === 0) {
    missing.push("material");
  }

  if (counts.viewUniformBuffers === 0) {
    missing.push("view");
  }

  if (counts.shaderModules === 0) {
    missing.push("shader");
  }

  if (counts.pipelineHits + counts.pipelineMisses === 0) {
    missing.push("pipeline");
  }

  return missing;
}
