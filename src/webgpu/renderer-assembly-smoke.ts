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
