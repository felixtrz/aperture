import {
  assetHandleKey,
  type AssetRegistry,
} from "@aperture-engine/simulation";
import type {
  PreparedMaterialStore,
  PreparedSourceMaterialMetadata,
  RenderAssetPreparationDiagnostic,
  RenderAssetPreparationOutcome,
  RenderAssetPreparationReport,
} from "../assets/preparation.js";
import type { RenderDiagnostic, RenderSnapshot } from "./snapshot.js";

export interface PrepareSnapshotMaterialEntryReport {
  readonly materialKey: string;
  readonly outcome: RenderAssetPreparationOutcome;
  readonly action?: "created" | "updated";
  readonly diagnostics: readonly RenderDiagnostic[];
}

export interface PrepareSnapshotMaterialsReport {
  readonly totalMaterials: number;
  readonly prepared: number;
  readonly unchanged: number;
  readonly retry: number;
  readonly failed: number;
  readonly skipped: number;
  readonly pruned: number;
  readonly entries: readonly PrepareSnapshotMaterialEntryReport[];
  readonly diagnostics: readonly RenderDiagnostic[];
}

export interface PrepareSnapshotMaterialsOptions {
  readonly registry: AssetRegistry;
  readonly snapshot: RenderSnapshot;
  readonly materials: PreparedMaterialStore;
  readonly pruneUnreferenced?: boolean;
}

export function prepareSnapshotMaterials(
  options: PrepareSnapshotMaterialsOptions,
): PrepareSnapshotMaterialsReport {
  const seen = new Set<string>();
  const entries: PrepareSnapshotMaterialEntryReport[] = [];
  const diagnostics: RenderDiagnostic[] = [];
  let prepared = 0;
  let unchanged = 0;
  let retry = 0;
  let failed = 0;
  let skipped = 0;
  let pruned = 0;

  for (const draw of options.snapshot.meshDraws) {
    const materialKey = assetHandleKey(draw.material);

    if (seen.has(materialKey)) {
      continue;
    }

    seen.add(materialKey);

    const report = options.materials.prepare({
      registry: options.registry,
      handle: draw.material,
    });
    const entryDiagnostics = renderDiagnosticsFromPreparationReport(report);

    diagnostics.push(...entryDiagnostics);
    entries.push({
      materialKey,
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
    for (const entry of options.materials.list()) {
      if (seen.has(entry.assetKey)) {
        continue;
      }

      if (options.materials.remove(entry.handle).removed) {
        pruned += 1;
      }
    }
  }

  return {
    totalMaterials: seen.size,
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
  report: RenderAssetPreparationReport<
    "material",
    PreparedSourceMaterialMetadata
  >,
): readonly RenderDiagnostic[] {
  return report.diagnostics.map((diagnostic) =>
    renderDiagnosticFromPreparationDiagnostic(report, diagnostic),
  );
}

function renderDiagnosticFromPreparationDiagnostic(
  report: RenderAssetPreparationReport<
    "material",
    PreparedSourceMaterialMetadata
  >,
  diagnostic: RenderAssetPreparationDiagnostic,
): RenderDiagnostic {
  return {
    code: diagnostic.code,
    message: diagnostic.message,
    severity: diagnostic.severity,
    assetKey: diagnostic.assetKey ?? report.assetKey,
    materialKey: report.assetKey,
    status: report.outcome,
  };
}
