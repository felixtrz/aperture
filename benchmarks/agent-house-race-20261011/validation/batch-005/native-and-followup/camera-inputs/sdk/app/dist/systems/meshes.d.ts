import type { MeshAsset } from "@aperture-engine/render";
import { type AssetDiagnostic, type AssetRegistry, type MeshHandle } from "@aperture-engine/simulation";
export interface DynamicMeshOptions {
    readonly label?: string;
    readonly initial?: MeshAsset;
    readonly diagnostics?: readonly AssetDiagnostic[];
}
export interface MeshPublishOptions {
    readonly label?: string;
    readonly diagnostics?: readonly AssetDiagnostic[];
}
export interface MeshPublishResult {
    readonly handle: MeshHandle;
    readonly key: string;
    readonly version: number;
}
export interface DynamicMesh {
    readonly handle: MeshHandle;
    readonly key: string;
    get(): MeshAsset | undefined;
    publish(mesh: MeshAsset, options?: MeshPublishOptions): MeshPublishResult;
}
export interface MeshAccess {
    dynamic(id: string | MeshHandle, options?: DynamicMeshOptions): DynamicMesh;
    get(handle: MeshHandle): MeshAsset | undefined;
    publish(id: string | MeshHandle, mesh: MeshAsset, options?: MeshPublishOptions): MeshPublishResult;
}
export declare function createMeshAccess(registry: AssetRegistry): MeshAccess;
//# sourceMappingURL=meshes.d.ts.map