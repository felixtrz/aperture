import { type AssetRegistry, type Entity, type MaterialHandle } from "@aperture-engine/simulation";
import { type MaterialAsset, type StandardMaterialAsset } from "../materials/index.js";
import type { MeshAsset } from "../mesh/index.js";
import type { RenderDiagnostic } from "./snapshot.js";
export declare function validateStandardNormalMapReadiness(input: {
    readonly mesh: MeshAsset;
    readonly material: MaterialAsset;
    readonly meshKey: string;
    readonly materialKey: string;
    readonly entity: Entity;
    readonly diagnostics: RenderDiagnostic[];
}): boolean;
export declare function validateStandardMaterialTextureReadiness(input: {
    readonly registry: AssetRegistry;
    readonly material: MaterialHandle;
    readonly entity: Entity;
    readonly diagnostics: RenderDiagnostic[];
}): boolean;
export declare function validateStandardMaterialUvSetReadiness(input: {
    readonly mesh: MeshAsset;
    readonly material: StandardMaterialAsset;
    readonly meshKey: string;
    readonly materialKey: string;
    readonly entity: Entity;
    readonly diagnostics: RenderDiagnostic[];
}): boolean;
//# sourceMappingURL=extraction-standard-material-validation.d.ts.map