import type { RenderAssetAdapter, RenderAssetPreparationDiagnostic } from "./preparation-types.js";
import { type ValidateCustomMaterialSourceOptions } from "./custom-wgsl-material-validation.js";
import type { CustomWgslMaterialSource, PreparedCustomWgslMaterial } from "./custom-wgsl-material-types.js";
export type { CustomWgslBindingDeclaration, CustomWgslBindingKind, CustomWgslMaterialSource, CustomWgslShaderSource, CustomWgslShaderStage, PreparedCustomWgslBindingLayoutEntry, PreparedCustomWgslBindingResourceEntry, PreparedCustomWgslMaterial, } from "./custom-wgsl-material-types.js";
export type { ValidateCustomMaterialSourceOptions } from "./custom-wgsl-material-validation.js";
export declare function createCustomWgslMaterialRenderAssetAdapter(familyKey: string): RenderAssetAdapter<"material", CustomWgslMaterialSource, PreparedCustomWgslMaterial>;
export declare function validateCustomMaterialSource(source: CustomWgslMaterialSource, options?: ValidateCustomMaterialSourceOptions): readonly RenderAssetPreparationDiagnostic[];
//# sourceMappingURL=custom-wgsl-material-preparation.d.ts.map