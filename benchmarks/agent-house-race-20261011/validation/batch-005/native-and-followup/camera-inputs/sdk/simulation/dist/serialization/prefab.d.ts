import { type Entity } from "../ecs/index.js";
import type { EcsWorld } from "../ecs/index.js";
import type { ComponentRegistry } from "./component-registry.js";
import type { ApertureSceneDocument, SceneDocumentDiagnostic } from "./scene-document.js";
export interface PrefabTransformOverride {
    readonly translation?: readonly [number, number, number];
    readonly rotation?: readonly [number, number, number, number];
    readonly scale?: readonly [number, number, number];
}
export interface PrefabFieldOverride {
    /** Prefab-local serialized id (the document record's `id`). */
    readonly id: string;
    readonly component: string;
    readonly field: string;
    readonly value: unknown;
}
export interface InstantiatePrefabOptions {
    readonly registry: ComponentRegistry;
    /** Override applied to the subtree root's LocalTransform (per provided field). */
    readonly transform?: PrefabTransformOverride;
    /** Per-instance component-field overrides addressed by prefab-local id. */
    readonly overrides?: readonly PrefabFieldOverride[];
}
export interface InstantiatePrefabResult {
    readonly ok: boolean;
    readonly root: Entity | null;
    readonly entities: readonly Entity[];
    readonly diagnostics: readonly SceneDocumentDiagnostic[];
}
export declare function instantiatePrefab(world: EcsWorld, sceneDocument: ApertureSceneDocument, options: InstantiatePrefabOptions): InstantiatePrefabResult;
//# sourceMappingURL=prefab.d.ts.map