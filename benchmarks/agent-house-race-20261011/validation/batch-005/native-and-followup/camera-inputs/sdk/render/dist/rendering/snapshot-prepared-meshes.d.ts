import { type AssetRegistry } from "@aperture-engine/simulation";
import type { PreparedMeshStore, RenderAssetPreparationOutcome } from "../assets/preparation.js";
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
export declare function prepareSnapshotMeshes(options: PrepareSnapshotMeshesOptions): PrepareSnapshotMeshesReport;
//# sourceMappingURL=snapshot-prepared-meshes.d.ts.map