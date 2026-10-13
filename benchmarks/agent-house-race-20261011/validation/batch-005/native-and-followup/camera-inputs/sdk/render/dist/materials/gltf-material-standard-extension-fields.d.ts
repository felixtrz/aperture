import type { StandardMaterialAsset } from "./types.js";
import type { GltfStandardMaterialFieldInput } from "./gltf-material-standard-fields.js";
export declare function mapStandardClearcoatFields(input: GltfStandardMaterialFieldInput): Pick<StandardMaterialAsset, "clearcoatFactor" | "clearcoatTexture" | "clearcoatRoughnessFactor" | "clearcoatRoughnessTexture">;
export declare function mapStandardTransmissionFields(input: GltfStandardMaterialFieldInput): Pick<StandardMaterialAsset, "transmissionFactor" | "transmissionTexture">;
export declare function mapStandardVolumeFields(input: GltfStandardMaterialFieldInput): Pick<StandardMaterialAsset, "ior" | "thickness" | "attenuationColor" | "attenuationDistance">;
export declare function mapStandardSheenFields(input: GltfStandardMaterialFieldInput): Pick<StandardMaterialAsset, "sheenColorFactor" | "sheenColorTexture" | "sheenRoughnessFactor" | "sheenRoughnessTexture">;
export declare function mapStandardIridescenceFields(input: GltfStandardMaterialFieldInput): Pick<StandardMaterialAsset, "iridescenceFactor" | "iridescenceTexture" | "iridescenceThicknessTexture" | "iridescenceIor" | "iridescenceThicknessMinimum" | "iridescenceThicknessMaximum">;
//# sourceMappingURL=gltf-material-standard-extension-fields.d.ts.map