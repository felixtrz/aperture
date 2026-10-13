import { setUiLayoutExtractor } from "@aperture-engine/render";
import { createYogaLayoutEngine } from "../layout/yoga-engine.js";
import { loadLayoutModule } from "../layout/yoga-loader.js";
import { registerUiComponents } from "../components/register.js";
import { createEcsUiLayoutExtractor, } from "./ecs-extractor.js";
/**
 * Install the Yoga-backed flexbox layout pass on a world, replacing the built-in
 * absolute/row/column extractor. The Yoga module must already be loaded (it is
 * WASM with async init) — call {@link loadLayoutModule} during worker/system
 * bootstrap and pass the result, or use {@link installYogaUiLayoutAsync}.
 */
export function installYogaUiLayout(world, yoga, options = {}) {
    registerUiComponents(world);
    const engine = createYogaLayoutEngine(yoga, options);
    const extractor = createEcsUiLayoutExtractor(engine, options);
    setUiLayoutExtractor(world, extractor);
    return {
        extractor,
        uninstall() {
            setUiLayoutExtractor(world, null);
            extractor.dispose();
            engine.dispose();
        },
    };
}
/**
 * Convenience: load Yoga (async) and install the layout pass. Prefer
 * {@link installYogaUiLayout} with a module loaded once at bootstrap when
 * multiple worlds share the engine.
 */
export async function installYogaUiLayoutAsync(world, options = {}) {
    const yoga = await loadLayoutModule();
    return installYogaUiLayout(world, yoga, options);
}
//# sourceMappingURL=install.js.map