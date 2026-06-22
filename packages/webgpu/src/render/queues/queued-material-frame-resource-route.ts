import type { QueuedMaterialPrepareRouteResult } from "./queued-material-prepare-route.js";

export type QueuedMaterialFrameResourceRouteStatus = "prepared" | "failed";

export interface QueuedMaterialFrameResourceResultLike<TDiagnostic = unknown> {
  readonly valid: boolean;
  readonly diagnostics: readonly TDiagnostic[];
}

export interface QueuedMaterialFrameResourceRouteShell<TDiagnostic = unknown> {
  readonly valid: boolean;
  readonly status: QueuedMaterialFrameResourceRouteStatus;
  readonly family: string;
  readonly facadeMeshResourceKey: string | null;
  readonly facadeMaterialResourceKey: string | null;
  readonly backendMeshKey: string;
  readonly backendMaterialKey: string;
  readonly pipelineKey: string;
  readonly sourceVersion: number;
  readonly frame: number;
  readonly diagnostics: readonly TDiagnostic[];
}

export interface QueuedMaterialFrameResourceRouteShellSummary {
  readonly valid: boolean;
  readonly status: QueuedMaterialFrameResourceRouteStatus;
  readonly family: string;
  readonly hasFacadeMeshResourceKey: boolean;
  readonly hasFacadeMaterialResourceKey: boolean;
  readonly hasBackendMeshKey: boolean;
  readonly hasBackendMaterialKey: boolean;
  readonly pipelineKey: string;
  readonly sourceVersion: number;
  readonly frame: number;
  readonly diagnostics: {
    readonly total: number;
    readonly byCode: Record<string, number>;
  };
}

export type QueuedMaterialFrameResourceRouteShellSummaryJsonValue =
  QueuedMaterialFrameResourceRouteShellSummary;

export function createQueuedMaterialFrameResourceRouteShell<
  TDiagnostic = unknown,
>(options: {
  readonly prepareRoute: QueuedMaterialPrepareRouteResult;
  readonly backendMeshKey: string;
  readonly backendMaterialKey: string;
  readonly frameResources: QueuedMaterialFrameResourceResultLike<TDiagnostic>;
}): QueuedMaterialFrameResourceRouteShell<TDiagnostic> {
  return {
    valid: options.prepareRoute.valid && options.frameResources.valid,
    status:
      options.prepareRoute.valid && options.frameResources.valid
        ? "prepared"
        : "failed",
    family: options.prepareRoute.family,
    facadeMeshResourceKey: options.prepareRoute.meshResourceKey,
    facadeMaterialResourceKey: options.prepareRoute.materialResourceKey,
    backendMeshKey: options.backendMeshKey,
    backendMaterialKey: options.backendMaterialKey,
    pipelineKey: options.prepareRoute.pipelineKey,
    sourceVersion: options.prepareRoute.sourceVersion,
    frame: options.prepareRoute.frame,
    diagnostics: options.frameResources.diagnostics,
  };
}

export function createQueuedMaterialFrameResourceRouteShellSummary(
  shell: QueuedMaterialFrameResourceRouteShell,
): QueuedMaterialFrameResourceRouteShellSummary {
  return {
    valid: shell.valid,
    status: shell.status,
    family: shell.family,
    hasFacadeMeshResourceKey: shell.facadeMeshResourceKey !== null,
    hasFacadeMaterialResourceKey: shell.facadeMaterialResourceKey !== null,
    hasBackendMeshKey: shell.backendMeshKey.length > 0,
    hasBackendMaterialKey: shell.backendMaterialKey.length > 0,
    pipelineKey: shell.pipelineKey,
    sourceVersion: shell.sourceVersion,
    frame: shell.frame,
    diagnostics: {
      total: shell.diagnostics.length,
      byCode: diagnosticCodeCounts(shell.diagnostics),
    },
  };
}

export function queuedMaterialFrameResourceRouteShellSummaryToJsonValue(
  summary: QueuedMaterialFrameResourceRouteShellSummary,
): QueuedMaterialFrameResourceRouteShellSummaryJsonValue {
  return {
    valid: summary.valid,
    status: summary.status,
    family: summary.family,
    hasFacadeMeshResourceKey: summary.hasFacadeMeshResourceKey,
    hasFacadeMaterialResourceKey: summary.hasFacadeMaterialResourceKey,
    hasBackendMeshKey: summary.hasBackendMeshKey,
    hasBackendMaterialKey: summary.hasBackendMaterialKey,
    pipelineKey: summary.pipelineKey,
    sourceVersion: summary.sourceVersion,
    frame: summary.frame,
    diagnostics: {
      total: summary.diagnostics.total,
      byCode: { ...summary.diagnostics.byCode },
    },
  };
}

function diagnosticCodeCounts(
  diagnostics: readonly unknown[],
): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const diagnostic of diagnostics) {
    const code = diagnosticCode(diagnostic);

    if (code === null) {
      continue;
    }

    counts[code] = (counts[code] ?? 0) + 1;
  }

  return Object.fromEntries(
    Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)),
  );
}

function diagnosticCode(diagnostic: unknown): string | null {
  if (typeof diagnostic !== "object" || diagnostic === null) {
    return null;
  }

  const code = (diagnostic as { readonly code?: unknown }).code;

  return typeof code === "string" ? code : null;
}
