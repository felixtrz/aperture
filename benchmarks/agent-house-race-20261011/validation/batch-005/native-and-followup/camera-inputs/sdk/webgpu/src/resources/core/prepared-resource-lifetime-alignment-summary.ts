import type {
  RenderResourceSummaryCounts,
  RenderResourceSummaryReport,
} from "./resource-summary.js";

export interface PreparedResourceLifetimeFacadeSummary {
  readonly preparedMeshes: { readonly totalEntries: number };
  readonly preparedMaterials: { readonly totalEntries: number };
  readonly drawReadiness: {
    readonly ready: number;
    readonly blocked: number;
  };
}

export type PreparedResourceLifetimeAlignmentDiagnosticCode =
  | "preparedResourceLifetime.backendMissingResources"
  | "preparedResourceLifetime.backendStaleResources"
  | "preparedResourceLifetime.backendPendingDestroyResources";

export interface PreparedResourceLifetimeAlignmentDiagnostic {
  readonly code: PreparedResourceLifetimeAlignmentDiagnosticCode;
  readonly message: string;
  readonly severity: "warning";
  readonly facadePreparedMeshes: number;
  readonly facadePreparedMaterials: number;
  readonly backendMissingResources?: number;
  readonly backendStaleResources?: number;
  readonly backendPendingDestroyResources?: number;
}

export interface PreparedResourceLifetimeAlignmentSummary {
  readonly facade: {
    readonly preparedMeshes: number;
    readonly preparedMaterials: number;
    readonly readyDraws: number;
    readonly blockedDraws: number;
  };
  readonly backend: Pick<
    RenderResourceSummaryCounts,
    | "meshResources"
    | "materialBuffers"
    | "staleResources"
    | "missingResources"
    | "pendingDestroyResources"
  >;
  readonly diagnostics: readonly PreparedResourceLifetimeAlignmentDiagnostic[];
}

export type PreparedResourceLifetimeAlignmentSummaryJsonValue =
  PreparedResourceLifetimeAlignmentSummary;

export function createPreparedResourceLifetimeAlignmentSummary(input: {
  readonly facade: PreparedResourceLifetimeFacadeSummary;
  readonly backend: RenderResourceSummaryReport;
}): PreparedResourceLifetimeAlignmentSummary {
  const facadePreparedMeshes = input.facade.preparedMeshes.totalEntries;
  const facadePreparedMaterials = input.facade.preparedMaterials.totalEntries;
  const diagnostics: PreparedResourceLifetimeAlignmentDiagnostic[] = [];

  if (
    (facadePreparedMeshes > 0 || facadePreparedMaterials > 0) &&
    input.backend.counts.missingResources > 0
  ) {
    diagnostics.push({
      code: "preparedResourceLifetime.backendMissingResources",
      severity: "warning",
      facadePreparedMeshes,
      facadePreparedMaterials,
      backendMissingResources: input.backend.counts.missingResources,
      message:
        "Prepared facade entries exist while backend resource inspection reports missing resources.",
    });
  }

  if (
    (facadePreparedMeshes > 0 || facadePreparedMaterials > 0) &&
    input.backend.counts.staleResources > 0
  ) {
    diagnostics.push({
      code: "preparedResourceLifetime.backendStaleResources",
      severity: "warning",
      facadePreparedMeshes,
      facadePreparedMaterials,
      backendStaleResources: input.backend.counts.staleResources,
      message:
        "Prepared facade entries exist while backend resource inspection reports stale resources.",
    });
  }

  if (
    (facadePreparedMeshes > 0 || facadePreparedMaterials > 0) &&
    input.backend.counts.pendingDestroyResources > 0
  ) {
    diagnostics.push({
      code: "preparedResourceLifetime.backendPendingDestroyResources",
      severity: "warning",
      facadePreparedMeshes,
      facadePreparedMaterials,
      backendPendingDestroyResources:
        input.backend.counts.pendingDestroyResources,
      message:
        "Prepared facade entries exist while backend resource inspection reports pending-destroy resources.",
    });
  }

  return {
    facade: {
      preparedMeshes: facadePreparedMeshes,
      preparedMaterials: facadePreparedMaterials,
      readyDraws: input.facade.drawReadiness.ready,
      blockedDraws: input.facade.drawReadiness.blocked,
    },
    backend: {
      meshResources: input.backend.counts.meshResources,
      materialBuffers: input.backend.counts.materialBuffers,
      staleResources: input.backend.counts.staleResources,
      missingResources: input.backend.counts.missingResources,
      pendingDestroyResources: input.backend.counts.pendingDestroyResources,
    },
    diagnostics,
  };
}

export function preparedResourceLifetimeAlignmentSummaryToJsonValue(
  summary: PreparedResourceLifetimeAlignmentSummary,
): PreparedResourceLifetimeAlignmentSummaryJsonValue {
  return {
    facade: { ...summary.facade },
    backend: { ...summary.backend },
    diagnostics: summary.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}
