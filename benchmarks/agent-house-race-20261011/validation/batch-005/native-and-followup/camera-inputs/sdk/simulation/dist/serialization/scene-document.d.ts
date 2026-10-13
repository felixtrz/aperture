import type { EcsWorld, Entity } from "../ecs/index.js";
import { type ComponentCodecDiagnostic, type SerializeEntityComponentsOptions, type SerializedComponent } from "./component-codec.js";
import type { ComponentRegistry } from "./component-registry.js";
export declare const APERTURE_SCENE_FORMAT_VERSION = 1;
export interface ApertureSceneEntity {
    /** Stable serialized id (`index:generation`) used to remap Entity-typed fields. */
    readonly id: string;
    readonly components: readonly SerializedComponent[];
}
export interface ApertureSceneDocument {
    readonly formatVersion: number;
    readonly entities: readonly ApertureSceneEntity[];
}
export type SceneDocumentDiagnostic = ComponentCodecDiagnostic;
export type SaveSceneOptions = SerializeEntityComponentsOptions;
export interface LoadSceneOptions {
    /** Allow-list of components the document is permitted to instantiate. */
    readonly registry: ComponentRegistry;
}
export interface LoadSceneResult {
    readonly ok: boolean;
    readonly entities: readonly Entity[];
    readonly diagnostics: readonly SceneDocumentDiagnostic[];
}
/** Serialize every active entity in `world` into a versioned scene document. */
export declare function saveScene(world: EcsWorld, options?: SaveSceneOptions): ApertureSceneDocument;
/**
 * Instantiate `document` into `world`. Creates one entity per record, builds an
 * old-id -> new-entity map, deserializes components, remaps Entity-typed fields
 * through that map, then runs resolveWorldTransforms to regenerate WorldTransform.
 * An unknown formatVersion instantiates nothing and returns a diagnostic.
 */
export declare function loadScene(world: EcsWorld, sceneDocument: ApertureSceneDocument, options: LoadSceneOptions): LoadSceneResult;
//# sourceMappingURL=scene-document.d.ts.map