import type { RenderSnapshot } from "./snapshot.js";
import type { RenderWorldApplyOptions, RenderWorldApplyReport, RenderWorldDrawReadinessReport, RenderWorldObject, RenderWorldResourceBindingResult, RenderWorldResourceBindingUpdate } from "./render-world-types.js";
export { planRenderWorldDrawReadiness } from "./render-world-readiness.js";
export type { RenderWorldApplyOptions, RenderWorldApplyReport, RenderWorldBlockedDraw, RenderWorldDrawBlockReason, RenderWorldDrawReadinessReport, RenderWorldGpuPlaceholders, RenderWorldObject, RenderWorldObjectStatus, RenderWorldReadyDraw, RenderWorldResourceBindingFailure, RenderWorldResourceBindingResult, RenderWorldResourceBindingSuccess, RenderWorldResourceBindingUpdate, } from "./render-world-types.js";
export declare class RenderWorld {
    #private;
    get size(): number;
    getObject(renderId: number): RenderWorldObject | undefined;
    listObjects(): RenderWorldObject[];
    createDrawReadinessReport(): RenderWorldDrawReadinessReport;
    updateResourceBindings(renderId: number, update: RenderWorldResourceBindingUpdate): RenderWorldResourceBindingResult;
    applySnapshot(snapshot: RenderSnapshot, options?: RenderWorldApplyOptions): RenderWorldApplyReport;
}
//# sourceMappingURL=render-world.d.ts.map