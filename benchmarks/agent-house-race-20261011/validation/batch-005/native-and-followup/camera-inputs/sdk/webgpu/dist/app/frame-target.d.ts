import { type AssetRegistry } from "@aperture-engine/simulation";
import type { RenderSnapshot } from "@aperture-engine/render";
import type { FrameBoundaryViewRectangle } from "../render/frame/frame-boundary.js";
import type { WebGpuCanvasLike } from "../gpu/initialize-webgpu.js";
import type { CurrentTextureLike } from "./presentation/current-texture-view.js";
export type WebGpuAppFrameBoundaryTarget = {
    readonly source: "swapchain";
    readonly view: RenderSnapshot["views"][number];
    readonly renderTargetKey: null;
    readonly width: number;
    readonly height: number;
    readonly format: string;
} | {
    readonly source: "offscreen";
    readonly view: RenderSnapshot["views"][number];
    readonly renderTargetKey: string;
    readonly texture: CurrentTextureLike;
    readonly width: number;
    readonly height: number;
    readonly format: string;
};
interface WebGpuAppFrameBoundaryTargetApp {
    readonly canvas: WebGpuCanvasLike;
    readonly initialization: {
        readonly format: string;
    };
}
export declare function createWebGpuAppFrameBoundaryTargets(app: WebGpuAppFrameBoundaryTargetApp, assets: AssetRegistry, snapshot: RenderSnapshot): {
    readonly targets: readonly WebGpuAppFrameBoundaryTarget[];
    readonly diagnostics: readonly unknown[];
};
export declare function findLastSwapchainTargetIndex(targets: readonly WebGpuAppFrameBoundaryTarget[]): number;
export declare function countWebGpuAppFrameBoundaryTargetSubmissions(targets: readonly WebGpuAppFrameBoundaryTarget[]): Map<string, number>;
export declare function webGpuAppFrameBoundaryTargetSubmissionKey(target: WebGpuAppFrameBoundaryTarget): string;
export declare function resolveWebGpuAppTargetViewRectangles(target: WebGpuAppFrameBoundaryTarget): {
    readonly valid: boolean;
    readonly viewport: FrameBoundaryViewRectangle | null;
    readonly scissor: FrameBoundaryViewRectangle | null;
    readonly diagnostics: readonly unknown[];
};
export {};
//# sourceMappingURL=frame-target.d.ts.map