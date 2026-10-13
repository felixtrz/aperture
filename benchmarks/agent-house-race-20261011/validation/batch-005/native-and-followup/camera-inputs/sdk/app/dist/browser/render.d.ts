import type { ApertureViewportResizeCommandPayload } from "../commands.js";
import type { ApertureRenderDefaults, ApertureTonemapOperator } from "../config.js";
export declare const DEFAULT_GENERATED_MSAA_SAMPLE_COUNT = 4;
export declare const DEFAULT_GENERATED_MAX_PIXEL_RATIO = 2;
export declare const DEFAULT_GENERATED_TONEMAP: ApertureTonemapOperator;
export declare const DEFAULT_GENERATED_EXPOSURE = 1;
export type GeneratedPixelRatioSource = "configured" | "device" | "capped";
export type GeneratedCanvasResizeSource = "initial" | "resize-observer" | "window-resize";
export type GeneratedCanvasMeasurementSource = "css-box" | "device-pixel-content-box";
export interface GeneratedBrowserRenderSettings {
    readonly requestedSampleCount: number;
    readonly sampleCountSource: "config" | "default" | "sanitized";
    readonly pixelRatio: number;
    readonly devicePixelRatio: number;
    readonly maxPixelRatio: number;
    readonly pixelRatioSource: GeneratedPixelRatioSource;
    readonly profile: string | null;
    readonly diagnostics: readonly unknown[];
}
export interface GeneratedBrowserRenderProfileEnvironment {
    readonly viewportWidth?: number;
    readonly viewportHeight?: number;
    readonly devicePixelRatio?: number;
}
export interface GeneratedBrowserEffectiveRenderDefaults {
    readonly render: ApertureRenderDefaults | undefined;
    readonly profile: string | null;
}
export interface GeneratedCanvasMeasureElement {
    readonly clientWidth: number;
    readonly clientHeight: number;
    getBoundingClientRect(): {
        readonly width: number;
        readonly height: number;
    };
}
export interface GeneratedCanvasResizeMeasurement extends ApertureViewportResizeCommandPayload {
    readonly devicePixelRatio: number;
    readonly maxPixelRatio: number;
    readonly pixelRatioSource: GeneratedPixelRatioSource;
    readonly resizeSource: GeneratedCanvasResizeSource;
    readonly measurementSource: GeneratedCanvasMeasurementSource;
}
export declare function resolveGeneratedRenderSettings(render: ApertureRenderDefaults | undefined, devicePixelRatio?: number | undefined, profile?: string | null): GeneratedBrowserRenderSettings;
export interface GeneratedTonemapAndExposure {
    readonly tonemap: ApertureTonemapOperator;
    /** Undefined keeps the legacy 8-bit in-material path (no HDR buffer). */
    readonly exposure: number | undefined;
}
/**
 * Resolve the generated app's tonemap operator and exposure. Defaults to the
 * filmic pipeline (ACES through the HDR scene buffer at exposure 1); an
 * explicit tonemap "none" without exposure or post effects keeps the legacy
 * byte-identical 8-bit path, and configuring any post effect always implies
 * the HDR path.
 */
export declare function resolveGeneratedTonemapAndExposure(render: ApertureRenderDefaults | undefined, postEffectsEnabled: boolean): GeneratedTonemapAndExposure;
export declare function resolveGeneratedEffectiveRenderDefaults(render: ApertureRenderDefaults | undefined, environment?: GeneratedBrowserRenderProfileEnvironment): GeneratedBrowserEffectiveRenderDefaults;
export declare function readGeneratedRenderProfileEnvironment(canvas: GeneratedCanvasMeasureElement): GeneratedBrowserRenderProfileEnvironment;
export declare function measureGeneratedCanvasResize(canvas: GeneratedCanvasMeasureElement, options?: {
    readonly render?: ApertureRenderDefaults;
    readonly resizeSource?: GeneratedCanvasResizeSource;
    readonly devicePixelRatio?: number;
    readonly resizeEntry?: ResizeObserverEntry;
}): GeneratedCanvasResizeMeasurement;
//# sourceMappingURL=render.d.ts.map