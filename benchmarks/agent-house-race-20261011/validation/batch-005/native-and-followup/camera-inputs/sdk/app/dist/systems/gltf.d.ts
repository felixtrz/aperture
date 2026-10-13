import { type EcsWorld, type Entity } from "@aperture-engine/simulation";
export type GltfNodeLookupDiagnosticCode = "aperture.gltf.invalidNodeName" | "aperture.gltf.rootInactive" | "aperture.gltf.nodeMissing" | "aperture.gltf.nodeDuplicate";
export interface GltfNodeLookupDiagnostic {
    readonly code: GltfNodeLookupDiagnosticCode;
    readonly severity: "error" | "warning";
    readonly message: string;
    readonly suggestedFix: string;
    readonly data?: Record<string, unknown>;
}
export interface GltfNodeRecord {
    readonly entity: Entity;
    readonly name: string;
    readonly assetId: string;
    readonly nodeIndex: number;
    readonly nodePath: string;
}
export interface GltfNodeFilter {
    readonly name?: string;
    readonly nameIncludes?: string;
    readonly assetId?: string;
}
export interface GltfNodeLookupResult {
    readonly ok: boolean;
    readonly entity: Entity | null;
    readonly node: GltfNodeRecord | null;
    readonly matches: readonly GltfNodeRecord[];
    readonly diagnostic?: GltfNodeLookupDiagnostic;
}
export interface GltfInstanceAccess {
    /** Return GLTF-authored nodes in a spawned root subtree. */
    nodes(root: Entity, filter?: GltfNodeFilter): readonly GltfNodeRecord[];
    /**
     * Return exactly one named GLTF node from a spawned root subtree.
     * Missing and duplicate names are reported explicitly.
     */
    node(root: Entity, name: string, filter?: Omit<GltfNodeFilter, "name">): GltfNodeLookupResult;
}
export declare function createGltfInstanceAccess(world: EcsWorld): GltfInstanceAccess;
//# sourceMappingURL=gltf.d.ts.map