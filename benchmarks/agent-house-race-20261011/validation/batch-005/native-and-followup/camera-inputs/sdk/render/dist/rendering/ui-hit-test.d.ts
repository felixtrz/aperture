import type { RenderEntityRef, UiHitRegionPacket, UiNodePacket } from "./snapshot.js";
export interface UiHitTestPoint {
    readonly x: number;
    readonly y: number;
}
export interface UiHitTestResult {
    readonly region: UiHitRegionPacket;
    readonly entity: RenderEntityRef;
    readonly point: UiHitTestPoint;
    readonly blocksInput: boolean;
    readonly cursor: string;
}
export interface UiHitTestRegionsOptions {
    readonly layerMask?: number | null;
}
export interface UiHitTestLayoutOptions extends UiHitTestRegionsOptions {
    /**
     * Normalized pointer coordinates in [0, 1]. They are mapped into each
     * extracted UiScreen rect before testing that screen's hit regions.
     */
    readonly position: readonly [number, number];
    readonly nodes: readonly UiNodePacket[];
    readonly hitRegions: readonly UiHitRegionPacket[];
}
export declare function hitTestUiRegions(hitRegions: readonly UiHitRegionPacket[], point: UiHitTestPoint, options?: UiHitTestRegionsOptions): UiHitTestResult | null;
export declare function hitTestUiLayout(options: UiHitTestLayoutOptions): UiHitTestResult | null;
//# sourceMappingURL=ui-hit-test.d.ts.map