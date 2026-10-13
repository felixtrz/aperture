import type {
  QueuedMaterialPrepareRouteResult,
  QueuedMaterialPrepareRouteStatus,
} from "./queued-material-prepare-route.js";
import type {
  QueuedMaterialFrameResourceRouteShellSummary,
  QueuedMaterialFrameResourceRouteStatus,
} from "./queued-material-frame-resource-route.js";

export interface QueuedMaterialPrepareRouteSummary {
  readonly valid: boolean;
  readonly status: QueuedMaterialPrepareRouteStatus;
  readonly family: string;
  readonly hasFacadeMeshResourceKey: boolean;
  readonly hasFacadeMaterialResourceKey: boolean;
  readonly pipelineKey: string;
  readonly sourceVersion: number;
  readonly frame: number;
  readonly diagnostics: {
    readonly total: number;
    readonly byCode: Record<string, number>;
  };
}

export type QueuedMaterialPrepareRouteSummaryJsonValue =
  QueuedMaterialPrepareRouteSummary;

export interface QueuedMaterialRouteSummaryStage<
  TStatus extends string = string,
> {
  readonly total: number;
  readonly valid: number;
  readonly invalid: number;
  readonly byStatus: Record<TStatus, number>;
  readonly diagnostics: {
    readonly total: number;
    readonly byCode: Record<string, number>;
  };
}

export interface QueuedMaterialRouteSummaryGroup {
  readonly prepareRoutes: QueuedMaterialRouteSummaryStage<QueuedMaterialPrepareRouteStatus>;
  readonly frameResources: QueuedMaterialRouteSummaryStage<QueuedMaterialFrameResourceRouteStatus>;
  readonly diagnostics: {
    readonly total: number;
    readonly byCode: Record<string, number>;
  };
}

export type QueuedMaterialRouteSummaryGroupJsonValue =
  QueuedMaterialRouteSummaryGroup;

export function createQueuedMaterialPrepareRouteSummary(
  route: QueuedMaterialPrepareRouteResult,
): QueuedMaterialPrepareRouteSummary {
  return {
    valid: route.valid,
    status: route.status,
    family: route.family,
    hasFacadeMeshResourceKey: route.meshResourceKey !== null,
    hasFacadeMaterialResourceKey: route.materialResourceKey !== null,
    pipelineKey: route.pipelineKey,
    sourceVersion: route.sourceVersion,
    frame: route.frame,
    diagnostics: {
      total: route.diagnostics.length,
      byCode: diagnosticCodeCounts(route.diagnostics),
    },
  };
}

export function queuedMaterialPrepareRouteSummaryToJsonValue(
  summary: QueuedMaterialPrepareRouteSummary,
): QueuedMaterialPrepareRouteSummaryJsonValue {
  return {
    valid: summary.valid,
    status: summary.status,
    family: summary.family,
    hasFacadeMeshResourceKey: summary.hasFacadeMeshResourceKey,
    hasFacadeMaterialResourceKey: summary.hasFacadeMaterialResourceKey,
    pipelineKey: summary.pipelineKey,
    sourceVersion: summary.sourceVersion,
    frame: summary.frame,
    diagnostics: {
      total: summary.diagnostics.total,
      byCode: { ...summary.diagnostics.byCode },
    },
  };
}

export function createQueuedMaterialRouteSummaryGroup(input: {
  readonly prepareRoutes?: readonly QueuedMaterialPrepareRouteSummary[];
  readonly frameResources?: readonly QueuedMaterialFrameResourceRouteShellSummary[];
}): QueuedMaterialRouteSummaryGroup {
  const prepareRoutes = stageSummary(input.prepareRoutes ?? []);
  const frameResources = stageSummary(input.frameResources ?? []);

  return {
    prepareRoutes,
    frameResources,
    diagnostics: {
      total: prepareRoutes.diagnostics.total + frameResources.diagnostics.total,
      byCode: mergeDiagnosticCodeCounts([
        prepareRoutes.diagnostics.byCode,
        frameResources.diagnostics.byCode,
      ]),
    },
  };
}

export function queuedMaterialRouteSummaryGroupToJsonValue(
  group: QueuedMaterialRouteSummaryGroup,
): QueuedMaterialRouteSummaryGroupJsonValue {
  return {
    prepareRoutes: copyStageSummary(group.prepareRoutes),
    frameResources: copyStageSummary(group.frameResources),
    diagnostics: {
      total: group.diagnostics.total,
      byCode: { ...group.diagnostics.byCode },
    },
  };
}

function stageSummary<TStatus extends string>(
  summaries: readonly {
    readonly valid: boolean;
    readonly status: TStatus;
    readonly diagnostics: {
      readonly total: number;
      readonly byCode: Record<string, number>;
    };
  }[],
): QueuedMaterialRouteSummaryStage<TStatus> {
  let valid = 0;
  const byStatus = {} as Record<TStatus, number>;

  for (const summary of summaries) {
    if (summary.valid) {
      valid += 1;
    }

    byStatus[summary.status] = (byStatus[summary.status] ?? 0) + 1;
  }

  const diagnostics = mergeDiagnosticCodeCounts(
    summaries.map((summary) => summary.diagnostics.byCode),
  );

  return {
    total: summaries.length,
    valid,
    invalid: summaries.length - valid,
    byStatus: sortRecord(byStatus),
    diagnostics: {
      total: summaries.reduce(
        (total, summary) => total + summary.diagnostics.total,
        0,
      ),
      byCode: diagnostics,
    },
  };
}

function copyStageSummary<TStatus extends string>(
  summary: QueuedMaterialRouteSummaryStage<TStatus>,
): QueuedMaterialRouteSummaryStage<TStatus> {
  return {
    total: summary.total,
    valid: summary.valid,
    invalid: summary.invalid,
    byStatus: { ...summary.byStatus },
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

  return sortRecord(counts);
}

function mergeDiagnosticCodeCounts(
  inputs: readonly Record<string, number>[],
): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const input of inputs) {
    for (const [code, count] of Object.entries(input)) {
      counts[code] = (counts[code] ?? 0) + count;
    }
  }

  return sortRecord(counts);
}

function sortRecord<T extends Record<string, number>>(record: T): T {
  return Object.fromEntries(
    Object.entries(record).sort(([a], [b]) => a.localeCompare(b)),
  ) as T;
}

function diagnosticCode(diagnostic: unknown): string | null {
  if (typeof diagnostic !== "object" || diagnostic === null) {
    return null;
  }

  const code = (diagnostic as { readonly code?: unknown }).code;

  return typeof code === "string" ? code : null;
}
