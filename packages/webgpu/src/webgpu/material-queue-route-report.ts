export interface WebGpuAppMaterialQueueRouteEntityRef {
  readonly index: number;
  readonly generation: number;
}

export interface WebGpuAppMaterialQueueRouteQueueItem {
  readonly renderId: number;
  readonly drawIndex: number;
  readonly materialFamily: string;
  readonly renderPhase: string;
  readonly entity?: WebGpuAppMaterialQueueRouteEntityRef;
}

export interface WebGpuAppMaterialQueueRouteRoutedItem {
  readonly renderId: number;
  readonly drawIndex: number;
  readonly materialFamily: string;
  readonly renderPhase: string;
}

export type WebGpuAppMaterialQueueRouteDiagnosticSeverity =
  | "info"
  | "warning"
  | "error";

export interface WebGpuAppMaterialQueueRouteDiagnostic {
  readonly code: string;
  readonly message: string;
  readonly severity?: WebGpuAppMaterialQueueRouteDiagnosticSeverity;
  readonly renderId?: number;
  readonly drawIndex?: number;
  readonly materialFamily?: string;
  readonly materialKind?: string;
  readonly renderPhase?: string;
  readonly blendPreset?: string | null;
  readonly entity?: WebGpuAppMaterialQueueRouteEntityRef;
}

export interface WebGpuAppMaterialQueueRouteBucketSummary {
  readonly key: string;
  readonly queuedCount: number;
  readonly routedCount: number;
  readonly skippedCount: number;
}

export interface WebGpuAppMaterialQueueRouteDiagnosticSummary {
  readonly total: number;
  readonly bySeverity: Record<
    WebGpuAppMaterialQueueRouteDiagnosticSeverity,
    number
  >;
  readonly byCode: Record<string, number>;
}

export interface WebGpuAppMaterialQueueRouteMutableBucketSummary {
  key: string;
  queuedCount: number;
  routedCount: number;
  skippedCount: number;
}

export interface WebGpuAppMaterialQueueRouteMutableDiagnosticSummary {
  total: number;
  readonly bySeverity: Record<
    WebGpuAppMaterialQueueRouteDiagnosticSeverity,
    number
  >;
  readonly byCode: Record<string, number>;
}

export interface WebGpuAppMaterialQueueRouteReportShell {
  valid: boolean;
  queueItemCount: number;
  routedItemCount: number;
  skippedItemCount: number;
  readonly byFamily: Map<
    string,
    WebGpuAppMaterialQueueRouteMutableBucketSummary
  >;
  readonly byPhase: Map<
    string,
    WebGpuAppMaterialQueueRouteMutableBucketSummary
  >;
  readonly diagnosticSummary: WebGpuAppMaterialQueueRouteMutableDiagnosticSummary;
  readonly diagnostics: WebGpuAppMaterialQueueRouteDiagnostic[];
  readonly routedKeys: Set<string>;
}

export interface WebGpuAppMaterialQueueRouteReport {
  readonly valid: boolean;
  readonly queueItemCount: number;
  readonly routedItemCount: number;
  readonly skippedItemCount: number;
  readonly byFamily: readonly WebGpuAppMaterialQueueRouteBucketSummary[];
  readonly byPhase: readonly WebGpuAppMaterialQueueRouteBucketSummary[];
  readonly diagnosticSummary: WebGpuAppMaterialQueueRouteDiagnosticSummary;
  readonly diagnostics: readonly WebGpuAppMaterialQueueRouteDiagnostic[];
}

export type WebGpuAppMaterialQueueRouteReportJsonValue =
  WebGpuAppMaterialQueueRouteReport;

export interface WebGpuAppMaterialQueueRouteReportOptions {
  readonly queueItems: readonly WebGpuAppMaterialQueueRouteQueueItem[];
  readonly routedItems: readonly WebGpuAppMaterialQueueRouteRoutedItem[];
  readonly diagnostics?: readonly WebGpuAppMaterialQueueRouteDiagnostic[];
}

export function createWebGpuAppMaterialQueueRouteReport(
  options: WebGpuAppMaterialQueueRouteReportOptions,
): WebGpuAppMaterialQueueRouteReport {
  const shell = writeWebGpuAppMaterialQueueRouteReportShell(
    options,
    createWebGpuAppMaterialQueueRouteReportShell(),
  );

  return webGpuAppMaterialQueueRouteReportShellToReport(shell);
}

export function createWebGpuAppMaterialQueueRouteReportShell(): WebGpuAppMaterialQueueRouteReportShell {
  return {
    valid: true,
    queueItemCount: 0,
    routedItemCount: 0,
    skippedItemCount: 0,
    byFamily: new Map(),
    byPhase: new Map(),
    diagnosticSummary: {
      total: 0,
      bySeverity: { info: 0, warning: 0, error: 0 },
      byCode: {},
    },
    diagnostics: [],
    routedKeys: new Set(),
  };
}

export function resetWebGpuAppMaterialQueueRouteReportShell(
  shell: WebGpuAppMaterialQueueRouteReportShell,
): WebGpuAppMaterialQueueRouteReportShell {
  shell.valid = true;
  shell.queueItemCount = 0;
  shell.routedItemCount = 0;
  shell.skippedItemCount = 0;
  shell.byFamily.clear();
  shell.byPhase.clear();
  shell.diagnostics.length = 0;
  shell.routedKeys.clear();
  resetDiagnosticSummary(shell.diagnosticSummary);
  return shell;
}

export function writeWebGpuAppMaterialQueueRouteReportShell(
  options: WebGpuAppMaterialQueueRouteReportOptions,
  shell: WebGpuAppMaterialQueueRouteReportShell,
): WebGpuAppMaterialQueueRouteReportShell {
  resetWebGpuAppMaterialQueueRouteReportShell(shell);

  for (const item of options.routedItems) {
    shell.routedKeys.add(routeItemKey(item));
  }

  for (const item of options.queueItems) {
    const routed = shell.routedKeys.has(routeItemKey(item));

    if (routed) {
      shell.routedItemCount += 1;
    }

    incrementBucket(shell.byFamily, item.materialFamily, routed);
    incrementBucket(shell.byPhase, item.renderPhase, routed);
  }

  shell.queueItemCount = options.queueItems.length;
  shell.skippedItemCount = shell.queueItemCount - shell.routedItemCount;
  shell.diagnostics.push(...(options.diagnostics ?? []));
  writeDiagnosticSummary(shell.diagnostics, shell.diagnosticSummary);
  shell.valid =
    shell.skippedItemCount === 0 &&
    shell.diagnostics.every(
      (diagnostic) => diagnosticSeverity(diagnostic) !== "error",
    );

  return shell;
}

export function webGpuAppMaterialQueueRouteReportShellToReport(
  shell: WebGpuAppMaterialQueueRouteReportShell,
): WebGpuAppMaterialQueueRouteReport {
  return {
    valid: shell.valid,
    queueItemCount: shell.queueItemCount,
    routedItemCount: shell.routedItemCount,
    skippedItemCount: shell.skippedItemCount,
    byFamily: [...shell.byFamily.values()].map(freezeBucket),
    byPhase: [...shell.byPhase.values()].map(freezeBucket),
    diagnosticSummary: copyDiagnosticSummary(shell.diagnosticSummary),
    diagnostics: [...shell.diagnostics],
  };
}

export function webGpuAppMaterialQueueRouteReportToJsonValue(
  report: WebGpuAppMaterialQueueRouteReport,
): WebGpuAppMaterialQueueRouteReportJsonValue {
  return {
    valid: report.valid,
    queueItemCount: report.queueItemCount,
    routedItemCount: report.routedItemCount,
    skippedItemCount: report.skippedItemCount,
    byFamily: report.byFamily.map((entry) => ({ ...entry })),
    byPhase: report.byPhase.map((entry) => ({ ...entry })),
    diagnosticSummary: {
      total: report.diagnosticSummary.total,
      bySeverity: { ...report.diagnosticSummary.bySeverity },
      byCode: { ...report.diagnosticSummary.byCode },
    },
    diagnostics: report.diagnostics.map(diagnosticToJsonValue),
  };
}

export function webGpuAppMaterialQueueRouteReportShellToJsonValue(
  shell: WebGpuAppMaterialQueueRouteReportShell,
): WebGpuAppMaterialQueueRouteReportJsonValue {
  return webGpuAppMaterialQueueRouteReportToJsonValue(
    webGpuAppMaterialQueueRouteReportShellToReport(shell),
  );
}

export function webGpuAppMaterialQueueRouteReportToJson(
  report: WebGpuAppMaterialQueueRouteReport,
): string {
  return JSON.stringify(webGpuAppMaterialQueueRouteReportToJsonValue(report));
}

export function unknownToWebGpuAppMaterialQueueRouteDiagnostics(
  diagnostic: unknown,
): WebGpuAppMaterialQueueRouteDiagnostic[] {
  if (typeof diagnostic !== "object" || diagnostic === null) {
    return [];
  }

  const candidate = diagnostic as {
    readonly code?: unknown;
    readonly message?: unknown;
    readonly severity?: unknown;
    readonly renderId?: unknown;
    readonly drawIndex?: unknown;
    readonly materialFamily?: unknown;
    readonly materialKind?: unknown;
    readonly renderPhase?: unknown;
    readonly blendPreset?: unknown;
    readonly entity?: unknown;
  };

  if (typeof candidate.code !== "string") {
    return [];
  }

  return [
    {
      code: candidate.code,
      message: typeof candidate.message === "string" ? candidate.message : "",
      ...optionalUnknownSeverity(candidate.severity),
      ...optionalUnknownNumber("renderId", candidate.renderId),
      ...optionalUnknownNumber("drawIndex", candidate.drawIndex),
      ...optionalUnknownString("materialFamily", candidate.materialFamily),
      ...optionalUnknownString("materialKind", candidate.materialKind),
      ...optionalUnknownString("renderPhase", candidate.renderPhase),
      ...optionalUnknownBlendPreset(candidate.blendPreset),
      ...optionalUnknownEntity(candidate.entity),
    },
  ];
}

function routeItemKey(input: {
  readonly renderId: number;
  readonly drawIndex: number;
}): string {
  return `${input.renderId}:${input.drawIndex}`;
}

function incrementBucket(
  buckets: Map<string, WebGpuAppMaterialQueueRouteMutableBucketSummary>,
  key: string,
  routed: boolean,
): void {
  let bucket = buckets.get(key);

  if (bucket === undefined) {
    bucket = {
      key,
      queuedCount: 0,
      routedCount: 0,
      skippedCount: 0,
    };
    buckets.set(key, bucket);
  }

  bucket.queuedCount += 1;
  if (routed) {
    bucket.routedCount += 1;
  } else {
    bucket.skippedCount += 1;
  }
}

function freezeBucket(
  bucket: WebGpuAppMaterialQueueRouteMutableBucketSummary,
): WebGpuAppMaterialQueueRouteBucketSummary {
  return { ...bucket };
}

function copyDiagnosticSummary(
  summary: WebGpuAppMaterialQueueRouteDiagnosticSummary,
): WebGpuAppMaterialQueueRouteDiagnosticSummary {
  return {
    total: summary.total,
    bySeverity: { ...summary.bySeverity },
    byCode: { ...summary.byCode },
  };
}

function diagnosticSeverity(
  diagnostic: WebGpuAppMaterialQueueRouteDiagnostic,
): WebGpuAppMaterialQueueRouteDiagnosticSeverity {
  return diagnostic.severity ?? "error";
}

function diagnosticToJsonValue(
  diagnostic: WebGpuAppMaterialQueueRouteDiagnostic,
): WebGpuAppMaterialQueueRouteDiagnostic {
  return {
    code: diagnostic.code,
    message: diagnostic.message,
    ...optionalSeverity(diagnostic.severity),
    ...optionalNumber("renderId", diagnostic.renderId),
    ...optionalNumber("drawIndex", diagnostic.drawIndex),
    ...optionalString("materialFamily", diagnostic.materialFamily),
    ...optionalString("materialKind", diagnostic.materialKind),
    ...optionalString("renderPhase", diagnostic.renderPhase),
    ...optionalBlendPreset(diagnostic.blendPreset),
    ...optionalEntity(diagnostic.entity),
  };
}

function optionalSeverity(
  value: WebGpuAppMaterialQueueRouteDiagnostic["severity"],
): { readonly severity?: WebGpuAppMaterialQueueRouteDiagnosticSeverity } {
  return value === undefined ? {} : { severity: value };
}

function optionalNumber<Key extends "renderId" | "drawIndex">(
  key: Key,
  value: WebGpuAppMaterialQueueRouteDiagnostic[Key],
): { readonly [Property in Key]?: number } {
  return value === undefined
    ? {}
    : ({ [key]: value } as { readonly [Property in Key]?: number });
}

function optionalString<
  Key extends "materialFamily" | "materialKind" | "renderPhase",
>(
  key: Key,
  value: WebGpuAppMaterialQueueRouteDiagnostic[Key],
): { readonly [Property in Key]?: string } {
  return value === undefined
    ? {}
    : ({ [key]: value } as { readonly [Property in Key]?: string });
}

function optionalBlendPreset(value: string | null | undefined): {
  readonly blendPreset?: string | null;
} {
  return value === undefined ? {} : { blendPreset: value };
}

function optionalEntity(
  value: WebGpuAppMaterialQueueRouteDiagnostic["entity"],
): {
  readonly entity?: NonNullable<
    WebGpuAppMaterialQueueRouteDiagnostic["entity"]
  >;
} {
  return value === undefined
    ? {}
    : {
        entity: { ...value },
      };
}

function optionalUnknownSeverity(value: unknown): {
  readonly severity?: WebGpuAppMaterialQueueRouteDiagnosticSeverity;
} {
  return value === "info" || value === "warning" || value === "error"
    ? { severity: value }
    : {};
}

function optionalUnknownNumber<Key extends "renderId" | "drawIndex">(
  key: Key,
  value: unknown,
): { readonly [Property in Key]?: number } {
  return typeof value === "number" && Number.isFinite(value)
    ? ({ [key]: value } as { readonly [Property in Key]?: number })
    : {};
}

function optionalUnknownString<
  Key extends "materialFamily" | "materialKind" | "renderPhase",
>(key: Key, value: unknown): { readonly [Property in Key]?: string } {
  return typeof value === "string"
    ? ({ [key]: value } as { readonly [Property in Key]?: string })
    : {};
}

function optionalUnknownBlendPreset(value: unknown): {
  readonly blendPreset?: string | null;
} {
  return typeof value === "string" || value === null
    ? { blendPreset: value }
    : {};
}

function optionalUnknownEntity(value: unknown): {
  readonly entity?: NonNullable<
    WebGpuAppMaterialQueueRouteDiagnostic["entity"]
  >;
} {
  if (typeof value !== "object" || value === null) {
    return {};
  }

  const entity = value as {
    readonly index?: unknown;
    readonly generation?: unknown;
  };

  return typeof entity.index === "number" &&
    Number.isFinite(entity.index) &&
    typeof entity.generation === "number" &&
    Number.isFinite(entity.generation)
    ? {
        entity: {
          index: entity.index,
          generation: entity.generation,
        },
      }
    : {};
}

function resetDiagnosticSummary(
  summary: WebGpuAppMaterialQueueRouteMutableDiagnosticSummary,
): void {
  summary.total = 0;
  summary.bySeverity.info = 0;
  summary.bySeverity.warning = 0;
  summary.bySeverity.error = 0;

  for (const key of Object.keys(summary.byCode)) {
    delete summary.byCode[key];
  }
}

function writeDiagnosticSummary(
  diagnostics: readonly WebGpuAppMaterialQueueRouteDiagnostic[],
  summary: WebGpuAppMaterialQueueRouteMutableDiagnosticSummary,
): void {
  resetDiagnosticSummary(summary);
  summary.total = diagnostics.length;

  for (const diagnostic of diagnostics) {
    const severity = diagnosticSeverity(diagnostic);
    summary.bySeverity[severity] += 1;
    summary.byCode[diagnostic.code] =
      (summary.byCode[diagnostic.code] ?? 0) + 1;
  }
}
