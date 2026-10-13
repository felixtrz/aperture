import type { GltfMaterialDiagnosticValue, GltfMaterialMappingDiagnostic, GltfMaterialTextureBindingResolverReport, GltfMaterialTextureSlot } from "./gltf-material-types.js";
import type { MaterialTextureBinding, MaterialTextureTransform } from "./types.js";
export declare function recordField(source: Record<string, unknown>, field: string): Record<string, unknown> | undefined;
export declare function optionalRecordField(input: {
    readonly source: Record<string, unknown>;
    readonly field: string;
    readonly materialKey: string;
    readonly diagnostics: GltfMaterialMappingDiagnostic[];
}): Record<string, unknown> | undefined;
export declare function isRecord(value: unknown): value is Record<string, unknown>;
export declare function isMaterialTextureBinding(value: unknown): value is MaterialTextureBinding;
export declare function isTextureBindingResolverReport(value: unknown): value is GltfMaterialTextureBindingResolverReport;
export declare function isNonNegativeInteger(value: unknown): value is number;
export declare function isFiniteNumberTuple(value: unknown, length: number): value is readonly number[];
export declare function isIdentityTransform(transform: MaterialTextureTransform): boolean;
export declare function isSupportedTextureTransform(slot: GltfMaterialTextureSlot, texCoord: number, transform: MaterialTextureTransform): boolean;
export declare function toDiagnosticValue(value: unknown): GltfMaterialDiagnosticValue;
//# sourceMappingURL=gltf-material-utils.d.ts.map