import type { BatchCompatibilityKey } from "./snapshot.js";
import type { RenderWorldDrawPackage } from "./draw-package.js";

export interface DrawPackageBatchGroup {
  readonly key: string;
  readonly batchKey: BatchCompatibilityKey;
  readonly drawCount: number;
  readonly renderIds: readonly number[];
  readonly meshResourceKeys: readonly string[];
  readonly materialResourceKeys: readonly string[];
}

export interface DrawPackageBatchingDiagnostic {
  readonly code: "drawBatching.emptyPackages";
  readonly message: string;
  readonly severity: "info";
}

export interface DrawPackageBatchingReport {
  readonly drawCount: number;
  readonly batchCount: number;
  readonly groups: readonly DrawPackageBatchGroup[];
  readonly diagnostics: readonly DrawPackageBatchingDiagnostic[];
}

export interface MergedDrawPackageBatchingReport {
  readonly reportCount: number;
  readonly drawCount: number;
  readonly batchCount: number;
  readonly diagnostics: readonly DrawPackageBatchingDiagnostic[];
}

export function createDrawPackageBatchingReport(
  packages: readonly RenderWorldDrawPackage[],
): DrawPackageBatchingReport {
  const groups = new Map<string, MutableBatchGroup>();

  for (const drawPackage of packages) {
    const key = batchKeyString(drawPackage.batchKey);
    const group =
      groups.get(key) ?? createMutableBatchGroup(key, drawPackage.batchKey);

    group.renderIds.push(drawPackage.renderId);
    group.meshResourceKeys.add(drawPackage.meshResourceKey);
    group.materialResourceKeys.add(drawPackage.materialResourceKey);
    groups.set(key, group);
  }

  const sortedGroups = [...groups.values()]
    .sort((a, b) => compareStrings(a.key, b.key))
    .map((group) => ({
      key: group.key,
      batchKey: group.batchKey,
      drawCount: group.renderIds.length,
      renderIds: [...group.renderIds].sort((a, b) => a - b),
      meshResourceKeys: [...group.meshResourceKeys].sort(compareStrings),
      materialResourceKeys: [...group.materialResourceKeys].sort(
        compareStrings,
      ),
    }));

  return {
    drawCount: packages.length,
    batchCount: sortedGroups.length,
    groups: sortedGroups,
    diagnostics:
      packages.length === 0
        ? [
            {
              code: "drawBatching.emptyPackages",
              message: "No draw packages were provided for batching.",
              severity: "info",
            },
          ]
        : [],
  };
}

export function mergeDrawPackageBatchingReports(
  reports: readonly DrawPackageBatchingReport[],
): MergedDrawPackageBatchingReport {
  return {
    reportCount: reports.length,
    drawCount: reports.reduce((sum, report) => sum + report.drawCount, 0),
    batchCount: reports.reduce((sum, report) => sum + report.batchCount, 0),
    diagnostics: reports.flatMap((report) => [...report.diagnostics]),
  };
}

interface MutableBatchGroup {
  readonly key: string;
  readonly batchKey: BatchCompatibilityKey;
  readonly renderIds: number[];
  readonly meshResourceKeys: Set<string>;
  readonly materialResourceKeys: Set<string>;
}

function createMutableBatchGroup(
  key: string,
  batchKey: BatchCompatibilityKey,
): MutableBatchGroup {
  return {
    key,
    batchKey,
    renderIds: [],
    meshResourceKeys: new Set(),
    materialResourceKeys: new Set(),
  };
}

function batchKeyString(key: BatchCompatibilityKey): string {
  return [
    key.pipelineKey,
    key.materialKey,
    key.meshLayoutKey,
    key.topology,
    key.instanced ? "instanced" : "single",
    key.skinned ? "skinned" : "rigid",
    key.morphed ? "morphed" : "static",
  ].join("|");
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
