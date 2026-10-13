import { type EcsWorld } from "@aperture-engine/simulation";
import { type RenderDiagnostic, type UiHitRegionPacket, type UiNodePacket } from "./snapshot.js";
/**
 * Result of a UI layout pass: the screen-space node packets plus the hit
 * regions interaction reads. Stable contract shared by the built-in
 * absolute/row/column extractor and any injected replacement.
 */
export interface UiLayoutExtractionResult {
    readonly nodes: readonly UiNodePacket[];
    readonly hitRegions: readonly UiHitRegionPacket[];
}
/**
 * Pluggable UI layout extractor. The default is the built-in
 * absolute/row/column pass below; `@aperture-engine/ui` injects a Yoga-backed
 * flexbox extractor through {@link setUiLayoutExtractor}. Keeping the wire
 * contract (packet types + `RenderSnapshot` fields) in `@aperture-engine/render`
 * while the implementation lives in `@aperture-engine/ui` avoids a circular
 * dependency (see docs/UI_PACKAGE_PLAN.md §3.2).
 */
export interface InjectedUiLayoutExtractor {
    extract(world: EcsWorld, diagnostics: RenderDiagnostic[], cameraLayerMask: number): UiLayoutExtractionResult;
}
/**
 * Register (or clear, with `null`) a replacement UI layout extractor for a
 * world. Keyed by world instance in a module-level `WeakMap`, so different
 * worlds can use different extractors, tests can register without a global
 * singleton, and entries are released when the world is collected.
 */
export declare function setUiLayoutExtractor(world: EcsWorld, extractor: InjectedUiLayoutExtractor | null): void;
export declare function extractUiLayout(world: EcsWorld, diagnostics: RenderDiagnostic[], cameraLayerMask: number): {
    readonly nodes: readonly UiNodePacket[];
    readonly hitRegions: readonly UiHitRegionPacket[];
};
//# sourceMappingURL=extraction-ui.d.ts.map