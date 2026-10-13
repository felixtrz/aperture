import type { RenderSnapshot } from "@aperture-engine/render";
import type { PlanRenderFrameFromSnapshotResult } from "../render/frame/render-frame-plan.js";
import type { RenderPassCommand } from "../render/passes/render-pass-commands.js";
import type { createRenderedGeometryInspector, RenderedGeometryFrameCapture } from "./rendered-geometry-inspector.js";
import { collectSubmittedStaticGeometry } from "./rendered-geometry-submission.js";
import type { RenderedGeometryOmission } from "./rendered-geometry-types.js";
type Inspector = ReturnType<typeof createRenderedGeometryInspector>;
export interface RenderedGeometrySubmissionRecipe {
    capture(commands: readonly RenderPassCommand[], viewId: number, targetKey: string): {
        readonly draws: ReturnType<typeof collectSubmittedStaticGeometry>["draws"];
        readonly omissions: readonly RenderedGeometryOmission[];
    };
}
/** Own packet/slot metadata before the frame-plan scratch is reused or awaited. */
export declare function createRenderedGeometrySubmissionRecipe(inspector: Inspector, snapshot: RenderSnapshot, framePlan?: PlanRenderFrameFromSnapshotResult): RenderedGeometrySubmissionRecipe;
/** Record immediately after the exact scene queue submit, before any readback. */
export declare function recordRenderedGeometrySceneSubmission(input: {
    readonly frame?: RenderedGeometryFrameCapture | undefined;
    readonly recipe?: RenderedGeometrySubmissionRecipe | undefined;
    readonly commands: readonly RenderPassCommand[];
    readonly viewId: number;
    readonly targetKey: string;
    readonly submitted: boolean;
    readonly encoded: boolean;
    readonly unsupportedRoute?: "custom-wgsl" | "user-pass" | "unsupported-route" | undefined;
}): void;
/** All scene views encoded into one accepted FrameGraph command buffer. */
export declare function recordRenderedGeometrySceneSubmissionBatch(input: {
    readonly frame?: RenderedGeometryFrameCapture | undefined;
    readonly recipe?: RenderedGeometrySubmissionRecipe | undefined;
    readonly submitted: boolean;
    readonly unsupportedRoute?: "custom-wgsl" | "user-pass" | "unsupported-route" | undefined;
    readonly views: readonly {
        readonly commands: readonly RenderPassCommand[];
        readonly viewId: number;
        readonly targetKey: string;
        readonly encoded: boolean;
    }[];
}): void;
export {};
//# sourceMappingURL=rendered-geometry-frame.d.ts.map