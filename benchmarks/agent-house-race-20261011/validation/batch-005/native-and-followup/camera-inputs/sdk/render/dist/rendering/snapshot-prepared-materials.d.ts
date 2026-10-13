import { type AssetRegistry } from "@aperture-engine/simulation";
import type { PreparedMaterialStore, RenderAssetPreparationOutcome } from "../assets/preparation.js";
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
export declare function prepareSnapshotMaterials(options: PrepareSnapshotMaterialsOptions): PrepareSnapshotMaterialsReport;
//# sourceMappingURL=snapshot-prepared-materials.d.ts.map