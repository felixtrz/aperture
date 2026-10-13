import { type AssetRegistry } from "@aperture-engine/simulation";
import type { PreparedMaterialStore } from "../assets/preparation.js";
import type { RenderWorld, RenderWorldApplyReport } from "./render-world.js";
import { type PrepareSnapshotMaterialsReport } from "./snapshot-prepared-materials.js";
import type { RenderDiagnostic, RenderSnapshot } from "./snapshot.js";
export interface BindPreparedMaterialResourcesToRenderWorldOptions {
    readonly renderWorld: RenderWorld;
    readonly materials: PreparedMaterialStore;
}
export interface BindPreparedMaterialResourcesToRenderWorldReport {
    readonly updated: number;
    readonly missing: number;
    readonly diagnostics: readonly RenderDiagnostic[];
}
export interface PrepareAndBindSnapshotMaterialsToRenderWorldOptions {
    readonly registry: AssetRegistry;
    readonly snapshot: RenderSnapshot;
    readonly renderWorld: RenderWorld;
    readonly materials: PreparedMaterialStore;
}
export interface PrepareAndBindSnapshotMaterialsToRenderWorldReport {
    readonly apply: RenderWorldApplyReport;
    readonly preparation: PrepareSnapshotMaterialsReport;
    readonly binding: BindPreparedMaterialResourcesToRenderWorldReport;
    readonly diagnostics: readonly RenderDiagnostic[];
}
export declare function prepareAndBindSnapshotMaterialsToRenderWorld(options: PrepareAndBindSnapshotMaterialsToRenderWorldOptions): PrepareAndBindSnapshotMaterialsToRenderWorldReport;
export declare function bindPreparedMaterialResourcesToRenderWorld(options: BindPreparedMaterialResourcesToRenderWorldOptions): BindPreparedMaterialResourcesToRenderWorldReport;
//# sourceMappingURL=render-world-prepared-materials.d.ts.map