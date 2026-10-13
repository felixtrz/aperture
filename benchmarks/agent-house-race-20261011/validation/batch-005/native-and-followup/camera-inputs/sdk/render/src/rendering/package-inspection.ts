import type { RenderDiagnostic } from "./snapshot.js";
import type { RenderWorldDrawPackage } from "./draw-package.js";

export interface RenderPackageInspectionReport {
  readonly packageCount: number;
  readonly renderIds: readonly number[];
  readonly meshResourceKeys: readonly string[];
  readonly materialResourceKeys: readonly string[];
  readonly batchKeys: readonly string[];
  readonly transformPackedOffsets: readonly number[];
  readonly diagnostics: readonly RenderDiagnostic[];
}

export function inspectRenderPackages(
  packages: readonly RenderWorldDrawPackage[],
): RenderPackageInspectionReport {
  const diagnostics: RenderDiagnostic[] = [];
  const seen = new Set<number>();

  for (const drawPackage of packages) {
    if (seen.has(drawPackage.renderId)) {
      diagnostics.push({
        code: "renderPackage.duplicateRenderId",
        message: `Duplicate render package id ${drawPackage.renderId}.`,
        severity: "warning",
      });
      continue;
    }

    seen.add(drawPackage.renderId);
  }

  if (packages.length === 0) {
    diagnostics.push({
      code: "renderPackage.empty",
      message: "No render packages were provided for inspection.",
      severity: "info",
    });
  }

  return {
    packageCount: packages.length,
    renderIds: uniqueSortedNumbers(
      packages.map((drawPackage) => drawPackage.renderId),
    ),
    meshResourceKeys: uniqueSortedStrings(
      packages.map((drawPackage) => drawPackage.meshResourceKey),
    ),
    materialResourceKeys: uniqueSortedStrings(
      packages.map((drawPackage) => drawPackage.materialResourceKey),
    ),
    batchKeys: uniqueSortedStrings(
      packages.map((drawPackage) => batchKeyString(drawPackage)),
    ),
    transformPackedOffsets: uniqueSortedNumbers(
      packages.map((drawPackage) => drawPackage.transformPackedOffset),
    ),
    diagnostics,
  };
}

function batchKeyString(drawPackage: RenderWorldDrawPackage): string {
  const key = drawPackage.batchKey;

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

function uniqueSortedNumbers(values: readonly number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

function uniqueSortedStrings(values: readonly string[]): string[] {
  return [...new Set(values)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}
