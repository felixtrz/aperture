import {
  assetHandleKey,
  type AssetRegistry,
} from "@aperture-engine/simulation";
import type {
  PreparedMeshAssetMetadata,
  PreparedMeshStore,
  RenderAssetPreparationDiagnostic,
  RenderAssetPreparationOutcome,
  RenderAssetPreparationReport,
} from "../assets/preparation.js";
import type { RenderDiagnostic, RenderSnapshot } from "./snapshot.js";

export interface PrepareSnapshotMeshEntryReport {
  readonly meshKey: string;
  readonly outcome: RenderAssetPreparationOutcome;
  readonly action?: "created" | "updated";
  readonly diagnostics: readonly RenderDiagnostic[];
}

export interface PrepareSnapshotMeshesReport {
  readonly totalMeshes: number;
  readonly prepared: number;
  readonly unchanged: number;
  readonly retry: number;
  readonly failed: number;
  readonly skipped: number;
  readonly pruned: number;
  readonly entries: readonly PrepareSnapshotMeshEntryReport[];
  readonly diagnostics: readonly RenderDiagnostic[];
}

export interface PrepareSnapshotMeshesOptions {
  readonly registry: AssetRegistry;
  readonly snapshot: RenderSnapshot;
  readonly meshes: PreparedMeshStore;
  readonly pruneUnreferenced?: boolean;
}

export function prepareSnapshotMeshes(
  options: PrepareSnapshotMeshesOptions,
): PrepareSnapshotMeshesReport {
  const seen = new Set<string>();
  const entries: PrepareSnapshotMeshEntryReport[] = [];
  const diagnostics: RenderDiagnostic[] = [];
  let prepared = 0;
  let unchanged = 0;
  let retry = 0;
  let failed = 0;
  let skipped = 0;
  let pruned = 0;

  for (const draw of options.snapshot.meshDraws) {
    const meshKey = assetHandleKey(draw.mesh);

    if (seen.has(meshKey)) {
      continue;
    }

    seen.add(meshKey);

    const report = options.meshes.prepare({
      registry: options.registry,
      handle: draw.mesh,
    });
    const entryDiagnostics = renderDiagnosticsFromPreparationReport(report);

    diagnostics.push(...entryDiagnostics);
    entries.push({
      meshKey,
      outcome: report.outcome,
      ...(report.action === undefined ? {} : { action: report.action }),
      diagnostics: entryDiagnostics,
    });

    switch (report.outcome) {
      case "prepared":
        prepared += 1;
        break;
      case "unchanged":
        unchanged += 1;
        break;
      case "retry":
        retry += 1;
        break;
      case "failed":
        failed += 1;
        break;
      case "skipped":
        skipped += 1;
        break;
    }
  }

  if (options.pruneUnreferenced === true) {
    for (const entry of options.meshes.list()) {
      if (seen.has(entry.assetKey)) {
        continue;
      }

      if (options.meshes.remove(entry.handle).removed) {
        pruned += 1;
      }
    }
  }

  return {
    totalMeshes: seen.size,
    prepared,
    unchanged,
    retry,
    failed,
    skipped,
    pruned,
    entries,
    diagnostics,
  };
}

function renderDiagnosticsFromPreparationReport(
  report: RenderAssetPreparationReport<"mesh", PreparedMeshAssetMetadata>,
): readonly RenderDiagnostic[] {
  return report.diagnostics.map((diagnostic) =>
    renderDiagnosticFromPreparationDiagnostic(report, diagnostic),
  );
}

function renderDiagnosticFromPreparationDiagnostic(
  report: RenderAssetPreparationReport<"mesh", PreparedMeshAssetMetadata>,
  diagnostic: RenderAssetPreparationDiagnostic,
): RenderDiagnostic {
  return {
    code: diagnostic.code,
    message: diagnostic.message,
    severity: diagnostic.severity,
    assetKey: diagnostic.assetKey ?? report.assetKey,
    meshKey: report.assetKey,
    status: report.outcome,
  };
}
