import type {
  PreparedMaterialStore,
  PreparedMeshStore,
} from "../assets/preparation.js";
import type { RenderWorldDrawReadinessReport } from "./render-world.js";
import type { PrepareAndBindSnapshotPreparedResourcesToRenderWorldReport } from "./render-world-prepared-resources.js";
import {
  createRenderWorldPreparedResourceSummary,
  type RenderWorldPreparedResourceSummary,
} from "./render-world-prepared-resource-summary.js";
import type { RenderDiagnostic } from "./snapshot.js";

export interface CreateRenderWorldPreparedResourceSummaryFromReportOptions {
  readonly meshes: PreparedMeshStore;
  readonly materials: PreparedMaterialStore;
  readonly report: PrepareAndBindSnapshotPreparedResourcesToRenderWorldReport;
  readonly drawReadiness?: RenderWorldDrawReadinessReport;
  readonly diagnostics?: readonly RenderDiagnostic[];
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
