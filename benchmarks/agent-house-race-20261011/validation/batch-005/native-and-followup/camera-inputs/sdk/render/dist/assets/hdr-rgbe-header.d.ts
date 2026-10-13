import type { ParseHdrRgbeFailure } from "./hdr-rgbe-types.js";
export interface HdrHeader {
    readonly text: string;
    readonly format: string;
    readonly width: number;
    readonly height: number;
    readonly gamma: number;
    readonly exposure: number;
    readonly dataOffset: number;
}
export declare function readHdrHeader(bytes: Uint8Array): {
    readonly ok: true;
    readonly header: HdrHeader;
} | ParseHdrRgbeFailure;
//# sourceMappingURL=hdr-rgbe-header.d.ts.map