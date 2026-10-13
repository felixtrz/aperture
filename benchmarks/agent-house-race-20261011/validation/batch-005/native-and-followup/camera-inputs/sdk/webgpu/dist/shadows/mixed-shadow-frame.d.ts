import { type CreateRenderShadowFrameOptions, type RenderShadowFrameResult } from "./render-shadow-frame.js";
/**
 * Compose the established per-kind caster builders. Keeping their matrix and
 * depth resources separate preserves point face indices and directional fitting.
 * The app folds every child pass into the same frame graph/queue submission.
 *
 * A single non-cascaded sun plus point lights is supported. Cascaded or multiple
 * suns, and mixed spot receivers, retain their existing selected-kind policy.
 */
export declare function createMixedDirectionalPointShadowFrame(options: CreateRenderShadowFrameOptions): RenderShadowFrameResult | null;
//# sourceMappingURL=mixed-shadow-frame.d.ts.map