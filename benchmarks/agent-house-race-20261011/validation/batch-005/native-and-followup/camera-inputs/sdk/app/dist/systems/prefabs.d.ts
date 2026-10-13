import { type ApertureSceneDocument, type AssetRegistry, type PrefabHandle } from "@aperture-engine/simulation";
export interface PrefabRegisterOptions {
    /** Explicit handle id; defaults to a generated unique id. */
    readonly id?: string;
    readonly label?: string;
}
export interface PrefabAccess {
    register(document: ApertureSceneDocument, options?: PrefabRegisterOptions): PrefabHandle;
}
export declare function createPrefabAccess(registry: AssetRegistry): PrefabAccess;
//# sourceMappingURL=prefabs.d.ts.map