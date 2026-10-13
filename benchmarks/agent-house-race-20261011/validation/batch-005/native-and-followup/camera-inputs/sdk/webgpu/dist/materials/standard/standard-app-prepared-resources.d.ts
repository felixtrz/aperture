import type { AssetRegistry, MaterialHandle, MeshHandle } from "@aperture-engine/simulation";
import type { MeshAsset, StandardMaterialAsset } from "@aperture-engine/render";
import { type PreparedAppMaterialFallbackDiagnostic, type PreparedAppMaterialResourceUse } from "../core/prepared-app-material-resource.js";
import type { PreparedMaterialTextureSamplerDependencies } from "../core/prepared-material-texture-sampler-dependencies.js";
import { type PreparedAppMeshResourceUse, type PreparedMeshGpuResourceCache } from "../../resources/meshes/prepared-app-mesh-resource.js";
import { type PreparedBaseColorTexturedStandardMaterialResource, type PreparedClearcoatRoughnessTexturedStandardMaterialResource, type PreparedClearcoatTexturedStandardMaterialResource, type PreparedIridescenceThicknessTexturedStandardMaterialResource, type PreparedIridescenceTexturedStandardMaterialResource, type PreparedMetallicRoughnessTexturedStandardMaterialResource, type PreparedNormalTexturedStandardMaterialResource, type PreparedOcclusionEmissiveTexturedStandardMaterialResource, type PreparedScalarStandardMaterialCache, type PreparedScalarStandardMaterialResource, type PreparedSheenColorTexturedStandardMaterialResource, type PreparedSheenRoughnessTexturedStandardMaterialResource, type PreparedTransmissionTexturedStandardMaterialResource } from "./prepared-standard-material-cache.js";
import type { StandardMaterialBindGroupLayoutResource } from "./standard-bind-group.js";
export type PreparedStandardMaterialUse = PreparedAppMaterialResourceUse<PreparedScalarStandardMaterialResource | PreparedBaseColorTexturedStandardMaterialResource | PreparedMetallicRoughnessTexturedStandardMaterialResource | PreparedNormalTexturedStandardMaterialResource | PreparedClearcoatTexturedStandardMaterialResource | PreparedClearcoatRoughnessTexturedStandardMaterialResource | PreparedTransmissionTexturedStandardMaterialResource | PreparedSheenColorTexturedStandardMaterialResource | PreparedSheenRoughnessTexturedStandardMaterialResource | PreparedIridescenceTexturedStandardMaterialResource | PreparedIridescenceThicknessTexturedStandardMaterialResource | PreparedOcclusionEmissiveTexturedStandardMaterialResource>;
export declare function preparePreparedStandardMesh(options: {
    readonly device: unknown;
    readonly mesh: MeshAsset | null;
    readonly meshHandle: MeshHandle;
    readonly meshKey: string;
    readonly frame?: number | undefined;
    readonly material: StandardMaterialAsset | null;
    readonly preparedMeshes: PreparedMeshGpuResourceCache;
}): PreparedAppMeshResourceUse | null;
export declare function preparePreparedStandardMaterial(options: {
    readonly device: unknown;
    readonly preparedScalarMaterials: PreparedScalarStandardMaterialCache;
    readonly materialHandle: MaterialHandle;
    readonly material: StandardMaterialAsset | null;
    readonly materialKey: string;
    readonly sourceMaterialKey: string;
    readonly frame?: number | undefined;
    readonly pipelineKey: string;
    readonly assets: AssetRegistry;
    readonly materialLayout: StandardMaterialBindGroupLayoutResource | null;
    readonly textureSamplerDependencies: PreparedMaterialTextureSamplerDependencies;
}, fallbackDiagnostics: PreparedAppMaterialFallbackDiagnostic[]): PreparedStandardMaterialUse | null;
//# sourceMappingURL=standard-app-prepared-resources.d.ts.map