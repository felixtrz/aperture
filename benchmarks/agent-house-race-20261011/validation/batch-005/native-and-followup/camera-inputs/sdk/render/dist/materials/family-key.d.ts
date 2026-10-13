import { type CustomWgslMaterialAsset, type MaterialKind, type SourceMaterialAsset } from "./types.js";
export declare function isBuiltInMaterialKind(value: string): value is MaterialKind;
export declare function isValidCustomMaterialFamilyKey(value: string): boolean;
export declare function isValidMaterialFamilyKey(value: string): boolean;
export declare function isCustomWgslMaterialAsset(material: SourceMaterialAsset): material is CustomWgslMaterialAsset;
//# sourceMappingURL=family-key.d.ts.map