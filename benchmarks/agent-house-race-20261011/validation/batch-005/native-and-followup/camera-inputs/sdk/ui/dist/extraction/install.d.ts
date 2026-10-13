import type { EcsWorld } from "@aperture-engine/simulation";
import { loadLayoutModule } from "../layout/yoga-loader.js";
import type { LayoutEngineOptions } from "../layout/engine.js";
import { type EcsUiLayoutExtractor, type EcsUiLayoutExtractorOptions } from "./ecs-extractor.js";
/** Handle for an installed Yoga UI layout pass. */
export interface InstalledUiLayout {
    /** The extractor registered on the world. */
    readonly extractor: EcsUiLayoutExtractor;
    /** Unregister from the world and free the retained tree + engine config. */
    uninstall(): void;
}
export interface InstallUiLayoutOptions extends LayoutEngineOptions, EcsUiLayoutExtractorOptions {
}
/**
 * Install the Yoga-backed flexbox layout pass on a world, replacing the built-in
 * absolute/row/column extractor. The Yoga module must already be loaded (it is
 * WASM with async init) — call {@link loadLayoutModule} during worker/system
 * bootstrap and pass the result, or use {@link installYogaUiLayoutAsync}.
 */
export declare function installYogaUiLayout(world: EcsWorld, yoga: Awaited<ReturnType<typeof loadLayoutModule>>, options?: InstallUiLayoutOptions): InstalledUiLayout;
/**
 * Convenience: load Yoga (async) and install the layout pass. Prefer
 * {@link installYogaUiLayout} with a module loaded once at bootstrap when
 * multiple worlds share the engine.
 */
export declare function installYogaUiLayoutAsync(world: EcsWorld, options?: InstallUiLayoutOptions): Promise<InstalledUiLayout>;
//# sourceMappingURL=install.d.ts.map