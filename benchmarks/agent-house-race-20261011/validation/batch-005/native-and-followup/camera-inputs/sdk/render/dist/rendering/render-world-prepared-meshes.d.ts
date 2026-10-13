import { type AssetRegistry } from "@aperture-engine/simulation";
import type { PreparedMeshStore } from "../assets/preparation.js";
import type { RenderWorld, RenderWorldApplyReport } from "./render-world.js";
import { type PrepareSnapshotMeshesReport } from "./snapshot-prepared-meshes.js";
import type { RenderDiagnostic, RenderSnapshot } from "./snapshot.js";
export interface BindPreparedMeshResourcesToRenderWorldOptions {
    readonly renderWorld: RenderWorld;
    readonly meshes: PreparedMeshStore;
}
export interface BindPreparedMeshResourcesToRenderWorldReport {
    readonly updated: number;
    readonly missing: number;
    readonly diagnostics: readonly RenderDiagnostic[];
}
export interface PrepareAndBindSnapshotMeshesToRenderWorldOptions {
    readonly registry: AssetRegistry;
    readonly snapshot: RenderSnapshot;
    readonly renderWorld: RenderWorld;
    readonly meshes: PreparedMeshStore;
}
export interface PrepareAndBindSnapshotMeshesToRenderWorldReport {
    readonly apply: RenderWorldApplyReport;
    readonly preparation: PrepareSnapshotMeshesReport;
    readonly binding: BindPreparedMeshResourcesToRenderWorldReport;
    readonly diagnostics: readonly RenderDiagnostic[];
}
export declare function prepareAndBindSnapshotMeshesToRenderWorld(options: PrepareAndBindSnapshotMeshesToRenderWorldOptions): PrepareAndBindSnapshotMeshesToRenderWorldReport;
export declare function bindPreparedMeshResourcesToRenderWorld(options: BindPreparedMeshResourcesToRenderWorldOptions): BindPreparedMeshResourcesToRenderWorldReport;
//# sourceMappingURL=render-world-prepared-meshes.d.ts.map