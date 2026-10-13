import type { RenderWorldReadyDraw } from "./render-world.js";
import type { RenderWorldDrawPackageScratch } from "./draw-package-types.js";
export interface MutableRenderWorldDrawPackage {
    renderId: number;
    packet: RenderWorldReadyDraw["packet"];
    meshResourceKey: string;
    materialResourceKey: string;
    batchKey: RenderWorldReadyDraw["batchKey"];
    sortKey: RenderWorldReadyDraw["packet"]["sortKey"];
    transformPackedOffset: number;
}
export declare function createRenderWorldDrawPackageScratch(capacity?: number): RenderWorldDrawPackageScratch;
export declare function drawPackageAt(scratch: RenderWorldDrawPackageScratch, index: number): MutableRenderWorldDrawPackage;
//# sourceMappingURL=draw-package-scratch.d.ts.map