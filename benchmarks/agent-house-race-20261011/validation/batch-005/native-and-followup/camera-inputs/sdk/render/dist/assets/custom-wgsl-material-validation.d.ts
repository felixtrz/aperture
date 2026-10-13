import { type CustomWgslMaterialAsset } from "../materials/index.js";
import type { RenderAssetPreparationDiagnostic } from "./preparation-types.js";
type CustomWgslMaterialSource = CustomWgslMaterialAsset;
export interface ValidateCustomMaterialSourceOptions {
    readonly assetKey?: string;
    readonly expectedFamily?: string;
}
export declare function validateCustomWgslMaterialSource(source: CustomWgslMaterialSource, assetKey: string, expectedFamily: string): readonly RenderAssetPreparationDiagnostic[];
export {};
//# sourceMappingURL=custom-wgsl-material-validation.d.ts.map