export const RENDER_RESOURCE_LIFECYCLE_KINDS = [
  "mesh",
  "material",
  "view",
  "shader",
  "pipeline",
] as const;

export type RenderResourceLifecycleKind =
  (typeof RENDER_RESOURCE_LIFECYCLE_KINDS)[number];

export interface RenderResourceLifecycleKeySets {
  readonly mesh: ReadonlySet<string>;
  readonly material: ReadonlySet<string>;
  readonly view: ReadonlySet<string>;
  readonly shader: ReadonlySet<string>;
  readonly pipeline: ReadonlySet<string>;
}

export interface RenderResourceLifecycleInput {
  readonly previous: RenderResourceLifecycleKeySets;
  readonly next: RenderResourceLifecycleKeySets;
}

export interface RenderResourceLifecycleChangeSet {
  readonly retained: readonly string[];
  readonly created: readonly string[];
  readonly removed: readonly string[];
}

export type RenderResourceLifecycleChangesByKind = {
  readonly [Kind in RenderResourceLifecycleKind]: RenderResourceLifecycleChangeSet;
};

export interface RenderResourceLifecycleCounts {
  readonly retained: number;
  readonly created: number;
  readonly removed: number;
}

export interface RenderResourceLifecycleReport {
  readonly byKind: RenderResourceLifecycleChangesByKind;
  readonly totals: RenderResourceLifecycleCounts;
  readonly hasChanges: boolean;
}

export type RenderResourceInspectionStatus =
  | "live"
  | "missing"
  | "stale"
  | "pending-destroy";

export interface RenderResourceInspectionRecord {
  readonly kind: RenderResourceLifecycleKind;
  readonly resourceKey: string;
  readonly assetKey?: string;
  readonly version?: number | string;
  readonly expectedVersion?: number | string;
  readonly status: RenderResourceInspectionStatus;
  readonly pendingDestroy: boolean;
}

export interface RenderResourceInspectionCounts {
  readonly total: number;
  readonly live: number;
  readonly missing: number;
  readonly stale: number;
  readonly pendingDestroy: number;
}

export type RenderResourceInspectionDiagnosticCode =
  | "renderResourceInspection.missingResource"
  | "renderResourceInspection.staleResource"
  | "renderResourceInspection.pendingDestroy";

export interface RenderResourceInspectionDiagnostic {
  readonly code: RenderResourceInspectionDiagnosticCode;
  readonly message: string;
  readonly resourceKey: string;
  readonly assetKey?: string;
  readonly kind: RenderResourceLifecycleKind;
  readonly status: RenderResourceInspectionStatus;
}

export interface RenderResourceInspectionReport {
  readonly records: readonly RenderResourceInspectionRecord[];
  readonly counts: RenderResourceInspectionCounts;
  readonly diagnostics: readonly RenderResourceInspectionDiagnostic[];
}

export function createRenderResourceLifecycleReport(
  input: RenderResourceLifecycleInput,
): RenderResourceLifecycleReport {
  const byKind = Object.fromEntries(
    RENDER_RESOURCE_LIFECYCLE_KINDS.map((kind) => [
      kind,
      diffResourceKeys(input.previous[kind], input.next[kind]),
    ]),
  ) as RenderResourceLifecycleChangesByKind;
  const totals = totalLifecycleCounts(byKind);

  return {
    byKind,
    totals,
    hasChanges: totals.created > 0 || totals.removed > 0,
  };
}

export function createRenderResourceInspectionReport(
  records: readonly RenderResourceInspectionRecord[],
): RenderResourceInspectionReport {
  const sorted = [...records].sort(
    (a, b) =>
      RENDER_RESOURCE_LIFECYCLE_KINDS.indexOf(a.kind) -
        RENDER_RESOURCE_LIFECYCLE_KINDS.indexOf(b.kind) ||
      a.resourceKey.localeCompare(b.resourceKey),
  );
  const diagnostics = sorted.flatMap(resourceInspectionDiagnostic);

  return {
    records: sorted,
    counts: {
      total: sorted.length,
      live: sorted.filter((record) => record.status === "live").length,
      missing: sorted.filter((record) => record.status === "missing").length,
      stale: sorted.filter((record) => record.status === "stale").length,
      pendingDestroy: sorted.filter(
        (record) =>
          record.pendingDestroy || record.status === "pending-destroy",
      ).length,
    },
    diagnostics,
  };
}

function diffResourceKeys(
  previous: ReadonlySet<string>,
  next: ReadonlySet<string>,
): RenderResourceLifecycleChangeSet {
  return {
    retained: sortedKeys(next, (key) => previous.has(key)),
    created: sortedKeys(next, (key) => !previous.has(key)),
    removed: sortedKeys(previous, (key) => !next.has(key)),
  };
}

function sortedKeys(
  keys: ReadonlySet<string>,
  include: (key: string) => boolean,
): readonly string[] {
  return [...keys].filter(include).sort();
}

function totalLifecycleCounts(
  byKind: RenderResourceLifecycleChangesByKind,
): RenderResourceLifecycleCounts {
  return RENDER_RESOURCE_LIFECYCLE_KINDS.reduce<RenderResourceLifecycleCounts>(
    (totals, kind) => ({
      retained: totals.retained + byKind[kind].retained.length,
      created: totals.created + byKind[kind].created.length,
      removed: totals.removed + byKind[kind].removed.length,
    }),
    { retained: 0, created: 0, removed: 0 },
  );
}

function resourceInspectionDiagnostic(
  record: RenderResourceInspectionRecord,
): readonly RenderResourceInspectionDiagnostic[] {
  if (record.status === "missing") {
    return [
      {
        code: "renderResourceInspection.missingResource",
        kind: record.kind,
        status: record.status,
        resourceKey: record.resourceKey,
        ...(record.assetKey === undefined ? {} : { assetKey: record.assetKey }),
        message: `Renderer resource '${record.resourceKey}' is missing.`,
      },
    ];
  }

  if (record.status === "stale") {
    return [
      {
        code: "renderResourceInspection.staleResource",
        kind: record.kind,
        status: record.status,
        resourceKey: record.resourceKey,
        ...(record.assetKey === undefined ? {} : { assetKey: record.assetKey }),
        message: `Renderer resource '${record.resourceKey}' is stale.`,
      },
    ];
  }

  if (record.pendingDestroy || record.status === "pending-destroy") {
    return [
      {
        code: "renderResourceInspection.pendingDestroy",
        kind: record.kind,
        status: record.status,
        resourceKey: record.resourceKey,
        ...(record.assetKey === undefined ? {} : { assetKey: record.assetKey }),
        message: `Renderer resource '${record.resourceKey}' is pending destruction.`,
      },
    ];
  }

  return [];
}
