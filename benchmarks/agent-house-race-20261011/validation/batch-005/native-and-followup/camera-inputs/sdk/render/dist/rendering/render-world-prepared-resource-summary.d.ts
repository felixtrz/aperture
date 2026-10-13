import type { MaterialKind } from "../materials/index.js";
import { type PreparedMaterialStore, type PreparedMaterialStoreFamilyJsonSummary, type PreparedMeshStore } from "../assets/preparation.js";
import type { BindPreparedMaterialResourcesToRenderWorldReport } from "./render-world-prepared-materials.js";
import type { BindPreparedMeshResourcesToRenderWorldReport } from "./render-world-prepared-meshes.js";
import type { RenderWorldDrawReadinessReport } from "./render-world.js";
import type { RenderDiagnostic } from "./snapshot.js";
export interface RenderWorldPreparedMeshSummary {
    readonly totalEntries: number;
}
export interface RenderWorldPreparedMaterialSummary {
    readonly totalEntries: number;
    readonly families: Record<MaterialKind, PreparedMaterialStoreFamilyJsonSummary>;
}
export interface RenderWorldPreparedResourceBindingSummary {
    readonly present: boolean;
    readonly updated: number;
    readonly missing: number;
}
export interface RenderWorldPreparedResourceDrawReadinessSummary {
    readonly present: boolean;
    readonly ready: number;
    readonly blocked: number;
}
export interface RenderWorldPreparedResourceDiagnosticSummary {
    readonly total: number;
    readonly info: number;
    readonly warnings: number;
    readonly errors: number;
}
export interface RenderWorldPreparedResourceSummary {
    readonly preparedMeshes: RenderWorldPreparedMeshSummary;
    readonly preparedMaterials: RenderWorldPreparedMaterialSummary;
    readonly bindings: {
        readonly meshes: RenderWorldPreparedResourceBindingSummary;
        readonly materials: RenderWorldPreparedResourceBindingSummary;
    };
    readonly drawReadiness: RenderWorldPreparedResourceDrawReadinessSummary;
    readonly diagnostics: RenderWorldPreparedResourceDiagnosticSummary;
}
export type RenderWorldPreparedResourceSummaryJsonValue = RenderWorldPreparedResourceSummary;
export interface CreateRenderWorldPreparedResourceSummaryOptions {
    readonly meshes: PreparedMeshStore;
    readonly materials: PreparedMaterialStore;
    readonly meshBinding?: BindPreparedMeshResourcesToRenderWorldReport;
    readonly materialBinding?: BindPreparedMaterialResourcesToRenderWorldReport;
    readonly drawReadiness?: RenderWorldDrawReadinessReport;
    readonly diagnostics?: readonly RenderDiagnostic[];
}
export declare function createRenderWorldPreparedResourceSummary(options: CreateRenderWorldPreparedResourceSummaryOptions): RenderWorldPreparedResourceSummary;
export declare function renderWorldPreparedResourceSummaryToJsonValue(summary: RenderWorldPreparedResourceSummary): RenderWorldPreparedResourceSummaryJsonValue;
//# sourceMappingURL=render-world-prepared-resource-summary.d.ts.map