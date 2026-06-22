import type {
  MaterialAssetDependencyReadinessDiagnosticCode,
  MaterialAssetDependencyReadinessReportJsonValue,
  MaterialAssetDependencyReadinessStatus,
  MaterialDependencyKind,
  MaterialKind,
} from "@aperture-engine/render";

export interface MaterialDependencyStatusBucketSummary {
  readonly status: MaterialAssetDependencyReadinessStatus;
  readonly slotCount: number;
}

export interface MaterialDependencyKindBucketSummary {
  readonly dependencyKind: MaterialDependencyKind;
  readonly slotCount: number;
  readonly readySlotCount: number;
  readonly blockedSlotCount: number;
}

export interface MaterialDependencyMaterialKindBucketSummary {
  readonly materialKind: MaterialKind | "unknown";
  readonly materialCount: number;
  readonly readyMaterialCount: number;
  readonly blockedMaterialCount: number;
}

export interface MaterialDependencyDiagnosticCodeSummary {
  readonly total: number;
  readonly byCode: Readonly<
    Partial<Record<MaterialAssetDependencyReadinessDiagnosticCode, number>>
  >;
}

export interface MaterialDependencyDiagnosticsSummary {
  readonly materialCount: number;
  readonly readyMaterialCount: number;
  readonly blockedMaterialCount: number;
  readonly slotCount: number;
  readonly readySlotCount: number;
  readonly blockedSlotCount: number;
  readonly byMaterialKind: readonly MaterialDependencyMaterialKindBucketSummary[];
  readonly byDependencyKind: readonly MaterialDependencyKindBucketSummary[];
  readonly byStatus: readonly MaterialDependencyStatusBucketSummary[];
  readonly diagnostics: MaterialDependencyDiagnosticCodeSummary;
}

const MATERIAL_DEPENDENCY_KIND_ORDER: readonly MaterialDependencyKind[] = [
  "texture",
  "sampler",
];

const MATERIAL_DEPENDENCY_STATUS_ORDER: readonly MaterialAssetDependencyReadinessStatus[] =
  ["ready", "missing", "registered", "loading", "failed"];

export function createMaterialDependencyDiagnosticsSummary(
  reports: readonly MaterialAssetDependencyReadinessReportJsonValue[],
): MaterialDependencyDiagnosticsSummary {
  const materialKindCounts = new Map<
    MaterialKind | "unknown",
    MutableMaterialDependencyMaterialKindBucketSummary
  >();
  const dependencyKindCounts = new Map<
    MaterialDependencyKind,
    MutableMaterialDependencyKindBucketSummary
  >();
  const statusCounts = new Map<
    MaterialAssetDependencyReadinessStatus,
    MutableMaterialDependencyStatusBucketSummary
  >();
  const diagnosticCodes: Partial<
    Record<MaterialAssetDependencyReadinessDiagnosticCode, number>
  > = {};
  let readyMaterialCount = 0;
  let slotCount = 0;
  let readySlotCount = 0;
  let diagnosticCount = 0;

  for (const report of reports) {
    const materialBucket = materialKindBucket(
      materialKindCounts,
      report.materialKind ?? "unknown",
    );

    materialBucket.materialCount += 1;

    if (report.ready) {
      readyMaterialCount += 1;
      materialBucket.readyMaterialCount += 1;
    } else {
      materialBucket.blockedMaterialCount += 1;
    }

    for (const slot of report.slots) {
      const dependencyBucket = dependencyKindBucket(
        dependencyKindCounts,
        slot.dependencyKind,
      );
      const statusBucket = statusBucketFor(statusCounts, slot.status);

      slotCount += 1;
      dependencyBucket.slotCount += 1;
      statusBucket.slotCount += 1;

      if (slot.ready) {
        readySlotCount += 1;
        dependencyBucket.readySlotCount += 1;
      } else {
        dependencyBucket.blockedSlotCount += 1;
      }
    }

    for (const diagnostic of report.diagnostics) {
      diagnosticCount += 1;
      diagnosticCodes[diagnostic.code] =
        (diagnosticCodes[diagnostic.code] ?? 0) + 1;
    }
  }

  return {
    materialCount: reports.length,
    readyMaterialCount,
    blockedMaterialCount: reports.length - readyMaterialCount,
    slotCount,
    readySlotCount,
    blockedSlotCount: slotCount - readySlotCount,
    byMaterialKind: materialKindEntries(materialKindCounts),
    byDependencyKind: dependencyKindEntries(dependencyKindCounts),
    byStatus: statusEntries(statusCounts),
    diagnostics: {
      total: diagnosticCount,
      byCode: diagnosticCodes,
    },
  };
}

interface MutableMaterialDependencyStatusBucketSummary {
  status: MaterialAssetDependencyReadinessStatus;
  slotCount: number;
}

interface MutableMaterialDependencyKindBucketSummary {
  dependencyKind: MaterialDependencyKind;
  slotCount: number;
  readySlotCount: number;
  blockedSlotCount: number;
}

interface MutableMaterialDependencyMaterialKindBucketSummary {
  materialKind: MaterialKind | "unknown";
  materialCount: number;
  readyMaterialCount: number;
  blockedMaterialCount: number;
}

function materialKindBucket(
  counts: Map<
    MaterialKind | "unknown",
    MutableMaterialDependencyMaterialKindBucketSummary
  >,
  materialKind: MaterialKind | "unknown",
): MutableMaterialDependencyMaterialKindBucketSummary {
  const existing = counts.get(materialKind);

  if (existing !== undefined) {
    return existing;
  }

  const bucket: MutableMaterialDependencyMaterialKindBucketSummary = {
    materialKind,
    materialCount: 0,
    readyMaterialCount: 0,
    blockedMaterialCount: 0,
  };

  counts.set(materialKind, bucket);
  return bucket;
}

function dependencyKindBucket(
  counts: Map<
    MaterialDependencyKind,
    MutableMaterialDependencyKindBucketSummary
  >,
  dependencyKind: MaterialDependencyKind,
): MutableMaterialDependencyKindBucketSummary {
  const existing = counts.get(dependencyKind);

  if (existing !== undefined) {
    return existing;
  }

  const bucket: MutableMaterialDependencyKindBucketSummary = {
    dependencyKind,
    slotCount: 0,
    readySlotCount: 0,
    blockedSlotCount: 0,
  };

  counts.set(dependencyKind, bucket);
  return bucket;
}

function statusBucketFor(
  counts: Map<
    MaterialAssetDependencyReadinessStatus,
    MutableMaterialDependencyStatusBucketSummary
  >,
  status: MaterialAssetDependencyReadinessStatus,
): MutableMaterialDependencyStatusBucketSummary {
  const existing = counts.get(status);

  if (existing !== undefined) {
    return existing;
  }

  const bucket: MutableMaterialDependencyStatusBucketSummary = {
    status,
    slotCount: 0,
  };

  counts.set(status, bucket);
  return bucket;
}

function materialKindEntries(
  counts: ReadonlyMap<
    MaterialKind | "unknown",
    MutableMaterialDependencyMaterialKindBucketSummary
  >,
): MaterialDependencyMaterialKindBucketSummary[] {
  return [...counts.values()].sort((a, b) =>
    compareStrings(a.materialKind, b.materialKind),
  );
}

function dependencyKindEntries(
  counts: ReadonlyMap<
    MaterialDependencyKind,
    MutableMaterialDependencyKindBucketSummary
  >,
): MaterialDependencyKindBucketSummary[] {
  return [...counts.values()].sort(
    (a, b) =>
      MATERIAL_DEPENDENCY_KIND_ORDER.indexOf(a.dependencyKind) -
      MATERIAL_DEPENDENCY_KIND_ORDER.indexOf(b.dependencyKind),
  );
}

function statusEntries(
  counts: ReadonlyMap<
    MaterialAssetDependencyReadinessStatus,
    MutableMaterialDependencyStatusBucketSummary
  >,
): MaterialDependencyStatusBucketSummary[] {
  return [...counts.values()].sort(
    (a, b) =>
      MATERIAL_DEPENDENCY_STATUS_ORDER.indexOf(a.status) -
      MATERIAL_DEPENDENCY_STATUS_ORDER.indexOf(b.status),
  );
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
