import type { Yoga } from "yoga-layout/load";
import { type LayoutEngine, type LayoutEngineOptions } from "./engine.js";
/**
 * Create a Yoga-backed {@link LayoutEngine}. Pass the module returned by
 * `loadLayoutModule()`. The engine owns one Yoga `Config`; call `dispose()` to
 * free it when the engine is discarded.
 */
export declare function createYogaLayoutEngine(yoga: Yoga, options?: LayoutEngineOptions): LayoutEngine;
//# sourceMappingURL=yoga-engine.d.ts.map