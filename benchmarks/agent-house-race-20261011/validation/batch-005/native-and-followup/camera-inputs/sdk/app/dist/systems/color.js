import { vec4 } from "@aperture-engine/simulation";
import { ApertureSystemError } from "./errors.js";
/** Authoring colors are linear RGBA; CSS hex RGB channels are decoded from sRGB. */
export const color = Object.freeze({
    /** Decode #rgb, #rgba, #rrggbb or #rrggbbaa into straight, linear RGBA. */
    srgbHex(value) {
        if (typeof value !== "string" ||
            !/^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(value)) {
            throw new ApertureSystemError("aperture.color.invalidHex", "sRGB hex color must use #rgb, #rgba, #rrggbb or #rrggbbaa.", "Pass a CSS hex color such as color.srgbHex('#808080') or color.srgbHex('#80808080').", { value });
        }
        const source = value.slice(1);
        const hex = source.length <= 4
            ? [...source].map((digit) => digit + digit).join("")
            : source;
        const channel = (offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
        return vec4(srgbToLinear(channel(0)), srgbToLinear(channel(2)), srgbToLinear(channel(4)), hex.length === 8 ? channel(6) : 1);
    },
    /** Copy finite linear RGBA, including HDR RGB values, without gamma or clamping. */
    linear(r, g, b, a = 1) {
        const channels = [r, g, b, a];
        const result = channels.every(Number.isFinite)
            ? vec4(r, g, b, a)
            : undefined;
        if (result === undefined ||
            ![result[0], result[1], result[2], result[3]].every(Number.isFinite)) {
            throw new ApertureSystemError("aperture.color.invalidLinear", "Linear RGBA channels must be finite numbers representable in vector storage.", "Pass finite numbers to color.linear(r, g, b, a), or use color.srgbHex for a CSS hex color.", { r, g, b, a });
        }
        return result;
    },
});
function srgbToLinear(value) {
    // IEC 61966-2-1 transfer; alpha never uses this color-channel transform.
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}
//# sourceMappingURL=color.js.map