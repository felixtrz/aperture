import { type Entity } from "@aperture-engine/simulation";
import { type InjectedUiLayoutExtractor } from "@aperture-engine/render";
import type { LayoutEngine } from "../layout/engine.js";
import type { MeasureFn } from "../layout/types.js";
/** Options for {@link createEcsUiLayoutExtractor}. */
export interface EcsUiLayoutExtractorOptions {
    /**
     * Optional provider of a measure function for a text/leaf entity, used for
     * content-driven sizing (e.g. MSDF text). Returning `null` falls back to the
     * entity's explicit `UiNode` width/height.
     */
    readonly measureText?: (entity: Entity) => MeasureFn | null;
    /**
     * Optional content token for a measured entity. When it changes between
     * frames, the leaf is re-measured. Defaults to a hash of the text content.
     */
    readonly measureKey?: (entity: Entity) => string | number;
    /** Whether an entity's subtree is frozen (layout preserved). */
    readonly isFrozen?: (entity: Entity) => boolean;
}
/** A UI layout extractor plus the retained-tree resources it owns. */
export interface EcsUiLayoutExtractor extends InjectedUiLayoutExtractor {
    /** Free the retained layout tree (not the engine). */
    dispose(): void;
}
/**
 * Create a Yoga-backed UI layout extractor over the existing render UI
 * components. It maintains a retained {@link UiLayoutTree} keyed by entity, so
 * unchanged frames re-use computed layout, and emits the same
 * `UiNodePacket`/`UiHitRegionPacket` contract the renderer and interaction read.
 *
 * Register it on a world with `setUiLayoutExtractor` (from
 * `@aperture-engine/render`) to replace the built-in absolute/row/column pass.
 */
export declare function createEcsUiLayoutExtractor(engine: LayoutEngine, options?: EcsUiLayoutExtractorOptions): EcsUiLayoutExtractor;
//# sourceMappingURL=ecs-extractor.d.ts.map