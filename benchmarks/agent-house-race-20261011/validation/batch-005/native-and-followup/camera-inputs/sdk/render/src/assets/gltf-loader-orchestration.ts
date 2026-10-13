import type {
  GltfLoaderOrchestrationDiagnostic,
  GltfLoaderOrchestrationReport,
  GltfLoaderOrchestrationReportJsonValue,
  GltfLoaderOrchestrationReportOptions,
  GltfLoaderStage,
  GltfLoaderStageSideEffect,
  GltfLoaderStageSummary,
} from "./gltf-loader-orchestration-types.js";

export type {
  GltfLoaderOrchestrationDiagnostic,
  GltfLoaderOrchestrationDiagnosticCode,
  GltfLoaderOrchestrationReport,
  GltfLoaderOrchestrationReportJsonValue,
  GltfLoaderOrchestrationReportOptions,
  GltfLoaderStage,
  GltfLoaderStageSideEffect,
  GltfLoaderStageStatus,
  GltfLoaderStageSummary,
} from "./gltf-loader-orchestration-types.js";

export function createGltfLoaderOrchestrationReport(
  options: GltfLoaderOrchestrationReportOptions,
): GltfLoaderOrchestrationReport {
  const stages: GltfLoaderStageSummary[] = [
    stageSummary("root", "none", options.root),
    stageSummary("assetMapping", "none", options.assetMapping),
    stageSummary(
      "sourceRegistration",
      "asset-registry",
      options.sourceRegistration,
      { writtenCount: options.sourceRegistration?.written.length },
    ),
    stageSummary("meshConstruction", "none", options.meshConstruction),
    stageSummary(
      "meshRegistration",
      "asset-registry",
      options.meshRegistration,
      { writtenCount: options.meshRegistration?.written.length },
    ),
    stageSummary("sceneTraversal", "none", options.sceneTraversal),
    stageSummary(
      "primitiveMaterialResolution",
      "none",
      options.primitiveMaterialResolution,
    ),
    stageSummary("ecsCommandPlan", "none", options.ecsCommandPlan, {
      createdCount: options.ecsCommandPlan?.commands.filter(
        (command) => command.type === "createEntity",
      ).length,
    }),
    stageSummary("ecsReplay", "ecs-world", options.ecsReplay, {
      createdCount: options.ecsReplay?.created.length,
    }),
  ];
  const diagnostics = orchestrationDiagnostics(options, stages);

  return {
    valid:
      diagnostics.length === 0 &&
      stages.every((stage) => stage.status !== "failed"),
    stages,
    diagnostics,
  };
}

export function gltfLoaderOrchestrationReportToJsonValue(
  report: GltfLoaderOrchestrationReport,
): GltfLoaderOrchestrationReportJsonValue {
  return {
    valid: report.valid,
    stages: report.stages.map((stage) => ({ ...stage })),
    diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function gltfLoaderOrchestrationReportToJson(
  report: GltfLoaderOrchestrationReport,
): string {
  return JSON.stringify(gltfLoaderOrchestrationReportToJsonValue(report));
}

function stageSummary(
  stage: GltfLoaderStage,
  sideEffect: GltfLoaderStageSideEffect,
  report:
    | { readonly valid: boolean; readonly diagnostics?: readonly unknown[] }
    | undefined,
  counts: {
    readonly writtenCount?: number | undefined;
    readonly createdCount?: number | undefined;
  } = {},
): GltfLoaderStageSummary {
  if (report === undefined) {
    return {
      stage,
      status: "missing",
      sideEffect,
    };
  }

  return {
    stage,
    status: report.valid ? "provided" : "failed",
    sideEffect,
    valid: report.valid,
    ...(counts.writtenCount === undefined
      ? {}
      : { writtenCount: counts.writtenCount }),
    ...(counts.createdCount === undefined
      ? {}
      : { createdCount: counts.createdCount }),
    diagnosticCount: report.diagnostics?.length ?? 0,
  };
}

function orchestrationDiagnostics(
  options: GltfLoaderOrchestrationReportOptions,
  stages: readonly GltfLoaderStageSummary[],
): GltfLoaderOrchestrationDiagnostic[] {
  const diagnostics: GltfLoaderOrchestrationDiagnostic[] = [];

  for (const stage of stages) {
    if (stage.status === "failed") {
      diagnostics.push({
        code: "gltfLoader.failedStage",
        severity: "error",
        stage: stage.stage,
        message: `GLB loader orchestration includes failed stage '${stage.stage}'.`,
      });
    }
  }

  for (let index = 0; index < stages.length; index += 1) {
    const stage = stages[index];
    if (
      stage === undefined ||
      stage.sideEffect === "none" ||
      stage.status === "missing"
    ) {
      continue;
    }

    const failedPurePrerequisite = stages
      .slice(0, index)
      .find(
        (candidate) =>
          candidate.sideEffect === "none" && candidate.status === "failed",
      );
    if (failedPurePrerequisite === undefined) {
      continue;
    }

    diagnostics.push({
      code: "gltfLoader.invalidStageOrder",
      severity: "error",
      stage: stage.stage,
      requiredStage: failedPurePrerequisite.stage,
      message: `GLB loader orchestration includes side-effect stage '${stage.stage}' after failed pure stage '${failedPurePrerequisite.stage}'.`,
    });
  }

  requireStage(diagnostics, options.sourceRegistration, "sourceRegistration", {
    root: options.root,
    assetMapping: options.assetMapping,
  });
  requireStage(diagnostics, options.meshRegistration, "meshRegistration", {
    meshConstruction: options.meshConstruction,
  });
  requireStage(diagnostics, options.ecsCommandPlan, "ecsCommandPlan", {
    sceneTraversal: options.sceneTraversal,
    meshRegistration: options.meshRegistration,
    primitiveMaterialResolution: options.primitiveMaterialResolution,
  });
  requireStage(diagnostics, options.ecsReplay, "ecsReplay", {
    ecsCommandPlan: options.ecsCommandPlan,
  });

  return diagnostics;
}

function requireStage(
  diagnostics: GltfLoaderOrchestrationDiagnostic[],
  stageReport: unknown,
  stage: GltfLoaderStage,
  required: Partial<Record<GltfLoaderStage, unknown>>,
): void {
  if (stageReport === undefined) {
    return;
  }

  for (const [requiredStage, report] of Object.entries(required) as [
    GltfLoaderStage,
    unknown,
  ][]) {
    if (report !== undefined) {
      continue;
    }

    diagnostics.push({
      code: "gltfLoader.sideEffectWithoutPrerequisite",
      severity: "error",
      stage,
      requiredStage,
      message: `GLB loader orchestration includes '${stage}' without prerequisite '${requiredStage}'.`,
    });
  }
}
