import { rgbeToFloatRgba } from "./hdr-rgbe-conversion.js";
import { readHdrHeader } from "./hdr-rgbe-header.js";
import { readHdrPixels } from "./hdr-rgbe-pixels.js";
export function parseHdrRgbe(source) {
    const bytes = source instanceof Uint8Array ? source : new Uint8Array(source);
    const header = readHdrHeader(bytes);
    if (!header.ok) {
        return header;
    }
    const rgbe = readHdrPixels(bytes.subarray(header.header.dataOffset), {
        width: header.header.width,
        height: header.header.height,
    });
    if (!rgbe.ok) {
        return rgbe;
    }
    return {
        ok: true,
        image: {
            kind: "hdr-rgbe",
            width: header.header.width,
            height: header.header.height,
            data: rgbeToFloatRgba(rgbe.pixels),
            rgbe: rgbe.pixels,
            header: header.header.text,
            gamma: header.header.gamma,
            exposure: header.header.exposure,
            colorSpace: "linear",
            format: "rgba32float",
        },
        diagnostics: [],
    };
}
//# sourceMappingURL=hdr-rgbe-parser.js.map