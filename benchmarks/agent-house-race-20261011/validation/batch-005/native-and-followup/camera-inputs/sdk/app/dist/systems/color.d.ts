import { type Vec4 } from "@aperture-engine/simulation";
/** Authoring colors are linear RGBA; CSS hex RGB channels are decoded from sRGB. */
export declare const color: Readonly<{
    /** Decode #rgb, #rgba, #rrggbb or #rrggbbaa into straight, linear RGBA. */
    srgbHex(value: string): Vec4;
    /** Copy finite linear RGBA, including HDR RGB values, without gamma or clamping. */
    linear(r: number, g: number, b: number, a?: number): Vec4;
}>;
//# sourceMappingURL=color.d.ts.map