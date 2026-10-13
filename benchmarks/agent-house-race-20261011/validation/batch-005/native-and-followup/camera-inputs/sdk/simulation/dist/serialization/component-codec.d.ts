import { type Entity } from "../ecs/index.js";
import type { ComponentRegistry } from "./component-registry.js";
/** Components excluded from serialization by default because they are derived. */
export declare const DERIVED_COMPONENT_IDS: readonly string[];
export interface SerializedComponent {
    readonly id: string;
    readonly fields: Readonly<Record<string, unknown>>;
}
export interface SerializeEntityComponentsOptions {
    /** Component ids to skip. Defaults to {@link DERIVED_COMPONENT_IDS}. */
    readonly exclude?: readonly string[];
}
export interface ComponentCodecDiagnostic {
    readonly code: string;
    readonly message: string;
    readonly data?: Readonly<Record<string, unknown>>;
}
export interface DeserializeEntityComponentsOptions {
    readonly registry: ComponentRegistry;
    /**
     * Turn a serialized `index:generation` token back into a live entity. Supplied
     * by the scene/prefab layer (which builds an old-id -> new-entity map). When
     * absent (or when it returns null) an Entity-typed field deserializes to null
     * and a diagnostic is recorded.
     */
    readonly resolveEntity?: (token: string) => Entity | null;
}
export interface DeserializeEntityComponentsResult {
    readonly ok: boolean;
    readonly applied: readonly string[];
    readonly diagnostics: readonly ComponentCodecDiagnostic[];
}
/** Serialize every registered component on `entity` to a JSON-safe record. */
export declare function serializeEntityComponents(entity: Entity, options?: SerializeEntityComponentsOptions): SerializedComponent[];
/** Reconstruct `serialized` components onto a (typically fresh) `entity`. */
export declare function deserializeEntityComponents(entity: Entity, serialized: readonly SerializedComponent[], options: DeserializeEntityComponentsOptions): DeserializeEntityComponentsResult;
/** The stable serialized token for an entity reference (`index:generation`). */
export declare function serializeEntityRef(entity: Entity): string;
//# sourceMappingURL=component-codec.d.ts.map