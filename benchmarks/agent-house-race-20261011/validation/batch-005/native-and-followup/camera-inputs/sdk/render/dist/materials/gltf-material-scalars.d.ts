import type { Vec4 } from "@aperture-engine/simulation";
import type { GltfMaterialMappingDiagnostic } from "./gltf-material-types.js";
export declare function mapBaseColorFactor(input: {
    readonly materialKey: string;
    readonly field: string;
    readonly value: unknown;
    readonly diagnostics: GltfMaterialMappingDiagnostic[];
}): Vec4;
export declare function mapVec3(input: {
    readonly materialKey: string;
    readonly field: string;
    readonly value: unknown;
    readonly fallback: readonly [number, number, number];
    readonly diagnostics: GltfMaterialMappingDiagnostic[];
}): readonly [number, number, number];
export declare function mapFiniteNumber(input: {
    readonly materialKey: string;
    readonly field: string;
    readonly value: unknown;
    readonly fallback: number;
    readonly diagnostics: GltfMaterialMappingDiagnostic[];
}): number;
export declare function mapAlphaCutoff(input: {
    readonly materialKey: string;
    readonly field: string;
    readonly value: unknown;
    readonly fallback: number;
    readonly diagnostics: GltfMaterialMappingDiagnostic[];
}): number;
//# sourceMappingURL=gltf-material-scalars.d.ts.map