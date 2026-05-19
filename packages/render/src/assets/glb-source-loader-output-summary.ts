import type { GltfReportDrivenGlbImportReport } from "./gltf-report-driven-import.js";
import type {
  GltfEcsAuthoringCommandPlan,
  GltfEcsAuthoringComponentName,
} from "./gltf-ecs-authoring-command-plan.js";
import {
  createGltfEcsReplayReadinessSummaryJsonValue,
  type GltfEcsReplayReadinessSummaryJsonValue,
} from "./gltf-ecs-command-replay-readiness.js";
import type { GltfSourceRegistrationOrchestrationReport } from "./gltf-source-registration-orchestration.js";

export type GlbSourceLoaderSummaryStatus = "absent" | "ready" | "invalid";

export interface GlbSourceLoaderMeshConstructionSummaryJsonValue {
  readonly status: GlbSourceLoaderSummaryStatus;
  readonly valid: boolean | null;
  readonly meshCount: number;
  readonly submeshCount: number;
  readonly vertexCount: number;
  readonly indexCount: number;
  readonly diagnosticsCount: number;
}

export interface GlbSourceLoaderOutputSummaryJsonValue {
  readonly meshConstruction: GlbSourceLoaderMeshConstructionSummaryJsonValue;
  readonly sourceRegistration: GlbSourceLoaderSourceRegistrationSummaryJsonValue;
  readonly ecsCommandPlan: GlbSourceLoaderEcsCommandPlanSummaryJsonValue;
  readonly ecsReplayReadiness: GltfEcsReplayReadinessSummaryJsonValue;
}

export interface GlbSourceLoaderSourceRegistrationSummaryJsonValue {
  readonly status: GlbSourceLoaderSummaryStatus;
  readonly valid: boolean | null;
  readonly writtenCount: number;
  readonly skippedCount: number;
  readonly diagnosticsCount: number;
  readonly stages: readonly {
    readonly stage: string;
    readonly status: string;
    readonly writtenCount: number;
    readonly skippedCount: number;
    readonly diagnosticCount: number;
  }[];
}

export interface GlbSourceLoaderOutputSummaryOptions {
  readonly sourceRegistration?: GltfSourceRegistrationOrchestrationReport | null;
  readonly ecsCommandPlan?: GltfEcsAuthoringCommandPlan | null;
}

export interface GlbSourceLoaderEcsCommandPlanSummaryJsonValue {
  readonly status: GlbSourceLoaderSummaryStatus;
  readonly valid: boolean | null;
  readonly sceneIndex: number | null;
  readonly rootEntityCount: number;
  readonly commandCount: number;
  readonly createEntityCount: number;
  readonly addComponentCount: number;
  readonly componentCounts: readonly {
    readonly component: GltfEcsAuthoringComponentName;
    readonly count: number;
  }[];
  readonly dependencyCount: number;
  readonly skippedCount: number;
  readonly diagnosticsCount: number;
}

export function createGlbSourceLoaderOutputSummaryJsonValue(
  report: GltfReportDrivenGlbImportReport,
  options: GlbSourceLoaderOutputSummaryOptions = {},
): GlbSourceLoaderOutputSummaryJsonValue {
  return {
    meshConstruction: createMeshConstructionSummary(report),
    sourceRegistration: createSourceRegistrationSummary(
      options.sourceRegistration ?? null,
    ),
    ecsCommandPlan: createEcsCommandPlanSummary(options.ecsCommandPlan ?? null),
    ecsReplayReadiness: createGltfEcsReplayReadinessSummaryJsonValue(
      options.ecsCommandPlan ?? null,
    ),
  };
}

function createMeshConstructionSummary(
  report: GltfReportDrivenGlbImportReport,
): GlbSourceLoaderMeshConstructionSummaryJsonValue {
  const importReport = report.importReport;
  const meshConstruction = importReport?.meshConstruction ?? null;

  if (meshConstruction === null) {
    return {
      status: "absent",
      valid: null,
      meshCount: 0,
      submeshCount: 0,
      vertexCount: 0,
      indexCount: 0,
      diagnosticsCount: 0,
    };
  }

  const dependencyDiagnosticsCount =
    (importReport?.accessorValidation?.diagnostics.length ?? 0) +
    (importReport?.accessorDecoding?.diagnostics.length ?? 0);
  const valid =
    meshConstruction.valid &&
    (importReport?.accessorValidation?.valid ?? true) &&
    (importReport?.accessorDecoding?.valid ?? true);

  return {
    status: valid ? "ready" : "invalid",
    valid,
    meshCount: meshConstruction.meshes.length,
    submeshCount: meshConstruction.meshes.reduce(
      (total, mesh) => total + (mesh.mesh?.submeshes.length ?? 0),
      0,
    ),
    vertexCount: meshConstruction.meshes.reduce(
      (total, mesh) =>
        total +
        (mesh.mesh?.submeshes.reduce(
          (submeshTotal, submesh) => submeshTotal + submesh.vertexCount,
          0,
        ) ?? 0),
      0,
    ),
    indexCount: meshConstruction.meshes.reduce(
      (total, mesh) =>
        total +
        (mesh.mesh?.submeshes.reduce(
          (submeshTotal, submesh) => submeshTotal + submesh.indexCount,
          0,
        ) ?? 0),
      0,
    ),
    diagnosticsCount:
      meshConstruction.diagnostics.length + dependencyDiagnosticsCount,
  };
}

function createSourceRegistrationSummary(
  report: GltfSourceRegistrationOrchestrationReport | null,
): GlbSourceLoaderSourceRegistrationSummaryJsonValue {
  if (report === null) {
    return {
      status: "absent",
      valid: null,
      writtenCount: 0,
      skippedCount: 0,
      diagnosticsCount: 0,
      stages: [],
    };
  }

  return {
    status: report.valid ? "ready" : "invalid",
    valid: report.valid,
    writtenCount: report.stages.reduce(
      (total, stage) => total + stage.writtenCount,
      0,
    ),
    skippedCount: report.stages.reduce(
      (total, stage) => total + stage.skippedCount,
      0,
    ),
    diagnosticsCount:
      report.diagnostics.length +
      report.stages.reduce((total, stage) => total + stage.diagnosticCount, 0),
    stages: report.stages.map((stage) => ({ ...stage })),
  };
}

function createEcsCommandPlanSummary(
  plan: GltfEcsAuthoringCommandPlan | null,
): GlbSourceLoaderEcsCommandPlanSummaryJsonValue {
  if (plan === null) {
    return {
      status: "absent",
      valid: null,
      sceneIndex: null,
      rootEntityCount: 0,
      commandCount: 0,
      createEntityCount: 0,
      addComponentCount: 0,
      componentCounts: [],
      dependencyCount: 0,
      skippedCount: 0,
      diagnosticsCount: 0,
    };
  }

  const componentCountMap = new Map<GltfEcsAuthoringComponentName, number>();
  let createEntityCount = 0;
  let addComponentCount = 0;

  for (const command of plan.commands) {
    if (command.type === "createEntity") {
      createEntityCount += 1;
      continue;
    }

    addComponentCount += 1;
    componentCountMap.set(
      command.component,
      (componentCountMap.get(command.component) ?? 0) + 1,
    );
  }

  return {
    status: plan.valid ? "ready" : "invalid",
    valid: plan.valid,
    sceneIndex: plan.sceneIndex,
    rootEntityCount: plan.rootEntityKeys.length,
    commandCount: plan.commands.length,
    createEntityCount,
    addComponentCount,
    componentCounts: COMPONENT_COUNT_ORDER.flatMap((component) => {
      const count = componentCountMap.get(component) ?? 0;
      return count === 0 ? [] : [{ component, count }];
    }),
    dependencyCount: plan.dependencies.length,
    skippedCount: plan.skipped.length,
    diagnosticsCount:
      plan.diagnostics.length +
      plan.skipped.reduce(
        (total, entry) => total + entry.diagnostics.length,
        0,
      ),
  };
}

const COMPONENT_COUNT_ORDER: readonly GltfEcsAuthoringComponentName[] = [
  "Name",
  "LocalTransform",
  "Parent",
  "WorldTransform",
  "Mesh",
  "Material",
  "Visibility",
];
