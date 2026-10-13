import type { ParseHdrRgbeFailure } from "./hdr-rgbe-types.js";
export declare function readHdrPixels(bytes: Uint8Array, dimensions: {
    readonly width: number;
    readonly height: number;
}): {
    readonly ok: true;
    readonly pixels: Uint8Array;
} | ParseHdrRgbeFailure;
//# sourceMappingURL=hdr-rgbe-pixels.d.ts.map