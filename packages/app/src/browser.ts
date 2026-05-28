export {
  DEFAULT_GENERATED_MAX_PIXEL_RATIO,
  DEFAULT_GENERATED_MSAA_SAMPLE_COUNT,
  measureGeneratedCanvasResize,
  resolveGeneratedRenderSettings,
} from "./browser/render.js";
export type {
  GeneratedBrowserRenderSettings,
  GeneratedCanvasMeasurementSource,
  GeneratedCanvasMeasureElement,
  GeneratedCanvasResizeMeasurement,
  GeneratedCanvasResizeSource,
  GeneratedPixelRatioSource,
} from "./browser/render.js";
export {
  APERTURE_GENERATED_VIRTUAL_INPUT_EVENT,
  dispatchApertureInputAction,
} from "./browser/input.js";
export type { ApertureVirtualActionInput } from "./browser/input.js";
export {
  APERTURE_MCP_MANAGED_GLOBAL,
  APERTURE_MCP_RUNTIME_GLOBAL,
} from "./browser/devtools/index.js";
export type { ApertureMcpRuntime } from "./browser/devtools/index.js";
export {
  APERTURE_GENERATED_STATUS_GLOBAL,
  readGeneratedBrowserAppStatus,
} from "./browser/status.js";
export type {
  GeneratedBrowserAppStatus,
  GeneratedBrowserSystemManifestEntry,
} from "./browser/status.js";
export { startGeneratedBrowserApp } from "./browser/app.js";
export type {
  GeneratedBrowserApp,
  StartGeneratedBrowserAppOptions,
} from "./browser/app.js";
