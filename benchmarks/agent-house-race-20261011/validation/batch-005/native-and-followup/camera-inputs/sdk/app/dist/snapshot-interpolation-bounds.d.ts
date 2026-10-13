import type { RenderSnapshot } from "@aperture-engine/render";
import { type Mat4Like } from "@aperture-engine/simulation";
export declare function rewriteInterpolatedPacketBounds(options: {
    readonly snapshot: RenderSnapshot;
    readonly boundsIndex: number;
    readonly worldMatrix: Mat4Like;
    readonly writtenBounds: Set<number>;
}): number;
//# sourceMappingURL=snapshot-interpolation-bounds.d.ts.map