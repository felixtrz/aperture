import { type MaterialAsset, type StandardMaterialPatch } from "@aperture-engine/render";
import type { AssetRegistry, MaterialHandle } from "@aperture-engine/simulation";
export interface MaterialSetDiagnostic {
    readonly code: string;
    readonly message: string;
    readonly data?: Readonly<Record<string, unknown>>;
}
export type MaterialSetResult = {
    readonly ok: true;
    readonly version: number;
    readonly kind: string;
} | {
    readonly ok: false;
    readonly diagnostic: MaterialSetDiagnostic;
};
export type MaterialPatch = StandardMaterialPatch;
export interface MaterialAccess {
    get(handle: MaterialHandle): MaterialAsset | undefined;
    set(handle: MaterialHandle, patch: MaterialPatch): MaterialSetResult;
}
export declare function createMaterialAccess(registry: AssetRegistry): MaterialAccess;
//# sourceMappingURL=materials.d.ts.map