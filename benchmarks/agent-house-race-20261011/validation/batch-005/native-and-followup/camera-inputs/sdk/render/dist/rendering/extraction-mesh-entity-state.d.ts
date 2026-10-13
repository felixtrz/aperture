import { type AssetRegistry, type Entity, type MaterialHandle, type Mat4, type MeshHandle } from "@aperture-engine/simulation";
import type { MeshAsset } from "../mesh/index.js";
import type { RenderDiagnostic } from "./snapshot.js";
export interface MeshEntityExtractionState {
    readonly layerMask: number;
    readonly castsShadow: boolean;
    readonly receivesShadow: boolean;
    readonly meshHandle: MeshHandle;
    readonly mesh: MeshAsset;
    readonly primaryMaterialHandle: MaterialHandle | null;
    readonly worldMatrix: Mat4;
}
export declare function readMeshEntityExtractionState(input: {
    readonly entity: Entity;
    readonly assets: AssetRegistry;
    readonly diagnostics: RenderDiagnostic[];
    readonly cameraLayerMask: number;
    readonly diagnoseLayerMismatch?: boolean;
}): MeshEntityExtractionState | null;
//# sourceMappingURL=extraction-mesh-entity-state.d.ts.map