import type { SpatialTriangleMesh } from "@aperture-engine/simulation";
import type { MeshAsset } from "./types.js";
export type MeshSpatialAdapterDiagnosticCode = "spatial.mesh.missing-position" | "spatial.mesh.unsupported-position-format" | "spatial.mesh.unsupported-normal-format" | "spatial.mesh.unsupported-uv-format" | "spatial.mesh.unsupported-index-format" | "spatial.mesh.unsupported-topology";
export interface MeshSpatialAdapterDiagnostic {
    readonly code: MeshSpatialAdapterDiagnosticCode;
    readonly severity: "warning" | "error";
    readonly message: string;
    readonly suggestedFix?: string;
    readonly data?: Readonly<Record<string, unknown>>;
}
export interface MeshSpatialAdapterReport {
    readonly mesh: SpatialTriangleMesh | null;
    readonly diagnostics: readonly MeshSpatialAdapterDiagnostic[];
}
export declare function createSpatialTriangleMeshFromMeshAsset(mesh: MeshAsset): MeshSpatialAdapterReport;
//# sourceMappingURL=spatial-adapter.d.ts.map