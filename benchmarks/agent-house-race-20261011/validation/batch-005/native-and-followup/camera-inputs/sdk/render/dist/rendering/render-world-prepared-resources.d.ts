import type { AssetRegistry } from "@aperture-engine/simulation";
import type { PreparedMaterialStore, PreparedMeshStore } from "../assets/preparation.js";
import type { RenderWorld, RenderWorldApplyReport } from "./render-world.js";
import { type BindPreparedMaterialResourcesToRenderWorldReport } from "./render-world-prepared-materials.js";
import { type BindPreparedMeshResourcesToRenderWorldReport } from "./render-world-prepared-meshes.js";
import { type PrepareSnapshotMaterialsReport } from "./snapshot-prepared-materials.js";
import { type PrepareSnapshotMeshesReport } from "./snapshot-prepared-meshes.js";
import type { RenderDiagnostic, RenderSnapshot } from "./snapshot.js";
export interface PrepareAndBindSnapshotPreparedResourcesToRenderWorldOptions {
    readonly registry: AssetRegistry;
    readonly snapshot: RenderSnapshot;
    readonly renderWorld: RenderWorld;
    readonly meshes: PreparedMeshStore;
    readonly materials: PreparedMaterialStore;
}
export interface PrepareAndBindSnapshotPreparedResourcesToRenderWorldReport {
    readonly apply: RenderWorldApplyReport;
    readonly meshes: {
        readonly preparation: PrepareSnapshotMeshesReport;
        readonly binding: BindPreparedMeshResourcesToRenderWorldReport;
    };
    readonly materials: {
        readonly preparation: PrepareSnapshotMaterialsReport;
        readonly binding: BindPreparedMaterialResourcesToRenderWorldReport;
    };
    readonly diagnostics: readonly RenderDiagnostic[];
}
export declare function prepareAndBindSnapshotPreparedResourcesToRenderWorld(options: PrepareAndBindSnapshotPreparedResourcesToRenderWorldOptions): PrepareAndBindSnapshotPreparedResourcesToRenderWorldReport;
//# sourceMappingURL=render-world-prepared-resources.d.ts.map