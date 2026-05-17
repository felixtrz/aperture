import type { MaterialKind } from "../materials/index.js";
import {
  preparedMaterialStoreSummaryToJsonValue,
  preparedMeshStoreSummaryToJsonValue,
  type PreparedMaterialStore,
  type PreparedMaterialStoreFamilyJsonSummary,
  type PreparedMeshStore,
} from "../assets/preparation.js";
import type { BindPreparedMaterialResourcesToRenderWorldReport } from "./render-world-prepared-materials.js";
import type { BindPreparedMeshResourcesToRenderWorldReport } from "./render-world-prepared-meshes.js";
import type { PrepareAndBindSnapshotPreparedResourcesToRenderWorldReport } from "./render-world-prepared-resources.js";
import type { RenderWorldDrawReadinessReport } from "./render-world.js";
import type { RenderDiagnostic } from "./snapshot.js";

export interface RenderWorldPreparedMeshSummary {
  readonly totalEntries: number;
}

export interface RenderWorldPreparedMaterialSummary {
  readonly totalEntries: number;
  readonly families: Record<
    MaterialKind,
    PreparedMaterialStoreFamilyJsonSummary
  >;
}

export interface RenderWorldPreparedResourceBindingSummary {
  readonly present: boolean;
  readonly updated: number;
  readonly missing: number;
}

export interface RenderWorldPreparedResourceDrawReadinessSummary {
  readonly present: boolean;
  readonly ready: number;
  readonly blocked: number;
}

export interface RenderWorldPreparedResourceDiagnosticSummary {
  readonly total: number;
  readonly info: number;
  readonly warnings: number;
  readonly errors: number;
}

export interface RenderWorldPreparedResourceSummary {
  readonly preparedMeshes: RenderWorldPreparedMeshSummary;
  readonly preparedMaterials: RenderWorldPreparedMaterialSummary;
  readonly bindings: {
    readonly meshes: RenderWorldPreparedResourceBindingSummary;
    readonly materials: RenderWorldPreparedResourceBindingSummary;
  };
  readonly drawReadiness: RenderWorldPreparedResourceDrawReadinessSummary;
  readonly diagnostics: RenderWorldPreparedResourceDiagnosticSummary;
}

export type RenderWorldPreparedResourceSummaryJsonValue =
  RenderWorldPreparedResourceSummary;

export interface CreateRenderWorldPreparedResourceSummaryOptions {
  readonly meshes: PreparedMeshStore;
  readonly materials: PreparedMaterialStore;
  readonly meshBinding?: BindPreparedMeshResourcesToRenderWorldReport;
  readonly materialBinding?: BindPreparedMaterialResourcesToRenderWorldReport;
  readonly drawReadiness?: RenderWorldDrawReadinessReport;
  readonly diagnostics?: readonly RenderDiagnostic[];
}

export interface CreateRenderWorldPreparedResourceSummaryFromReportOptions {
  readonly meshes: PreparedMeshStore;
  readonly materials: PreparedMaterialStore;
  readonly report: PrepareAndBindSnapshotPreparedResourcesToRenderWorldReport;
  readonly drawReadiness?: RenderWorldDrawReadinessReport;
  readonly diagnostics?: readonly RenderDiagnostic[];
}

export function createRenderWorldPreparedResourceSummary(
  options: CreateRenderWorldPreparedResourceSummaryOptions,
): RenderWorldPreparedResourceSummary {
  const meshStore = preparedMeshStoreSummaryToJsonValue(options.meshes);
  const materialStore = preparedMaterialStoreSummaryToJsonValue(
    options.materials,
  );
  const diagnostics = collectDiagnostics(options);

  return {
    preparedMeshes: {
      totalEntries: meshStore.totalEntries,
    },
    preparedMaterials: {
      totalEntries: materialStore.totalEntries,
      families: materialStore.families,
    },
    bindings: {
      meshes: bindingSummary(options.meshBinding),
      materials: bindingSummary(options.materialBinding),
    },
    drawReadiness: options.drawReadiness
      ? {
          present: true,
          ready: options.drawReadiness.ready.length,
          blocked: options.drawReadiness.blocked.length,
        }
      : {
          present: false,
          ready: 0,
          blocked: 0,
        },
    diagnostics: diagnosticSummary(diagnostics),
  };
}

export function createRenderWorldPreparedResourceSummaryFromReport(
  options: CreateRenderWorldPreparedResourceSummaryFromReportOptions,
): RenderWorldPreparedResourceSummary {
  return createRenderWorldPreparedResourceSummary({
    meshes: options.meshes,
    materials: options.materials,
    meshBinding: options.report.meshes.binding,
    materialBinding: options.report.materials.binding,
    ...(options.drawReadiness === undefined
      ? {}
      : { drawReadiness: options.drawReadiness }),
    diagnostics: [
      ...options.report.apply.diagnostics,
      ...options.report.meshes.preparation.diagnostics,
      ...options.report.materials.preparation.diagnostics,
      ...(options.diagnostics ?? []),
    ],
  });
}

export function renderWorldPreparedResourceSummaryToJsonValue(
  summary: RenderWorldPreparedResourceSummary,
): RenderWorldPreparedResourceSummaryJsonValue {
  return {
    preparedMeshes: { ...summary.preparedMeshes },
    preparedMaterials: {
      totalEntries: summary.preparedMaterials.totalEntries,
      families: { ...summary.preparedMaterials.families },
    },
    bindings: {
      meshes: { ...summary.bindings.meshes },
      materials: { ...summary.bindings.materials },
    },
    drawReadiness: { ...summary.drawReadiness },
    diagnostics: { ...summary.diagnostics },
  };
}

function bindingSummary(
  report:
    | BindPreparedMeshResourcesToRenderWorldReport
    | BindPreparedMaterialResourcesToRenderWorldReport
    | undefined,
): RenderWorldPreparedResourceBindingSummary {
  return report === undefined
    ? { present: false, updated: 0, missing: 0 }
    : {
        present: true,
        updated: report.updated,
        missing: report.missing,
      };
}

function collectDiagnostics(
  options: CreateRenderWorldPreparedResourceSummaryOptions,
): readonly RenderDiagnostic[] {
  return [
    ...(options.meshBinding?.diagnostics ?? []),
    ...(options.materialBinding?.diagnostics ?? []),
    ...(options.drawReadiness?.diagnostics ?? []),
    ...(options.diagnostics ?? []),
  ];
}

function diagnosticSummary(
  diagnostics: readonly RenderDiagnostic[],
): RenderWorldPreparedResourceDiagnosticSummary {
  let info = 0;
  let warnings = 0;
  let errors = 0;

  for (const diagnostic of diagnostics) {
    switch (diagnostic.severity) {
      case "info":
        info += 1;
        break;
      case "warning":
        warnings += 1;
        break;
      case "error":
        errors += 1;
        break;
    }
  }

  return {
    total: diagnostics.length,
    info,
    warnings,
    errors,
  };
}
