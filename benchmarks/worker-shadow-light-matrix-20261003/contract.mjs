export const MODES = Object.freeze([
  "directional",
  "cascaded",
  "spot",
  "point",
]);
export const STATES = Object.freeze([
  { id: "baseline", shape: "baseline", version: 1, reuse: false },
  { id: "noop", shape: "baseline", version: 1, reuse: true },
  { id: "vertices", shape: "vertices", version: 2, reuse: false },
  { id: "vertices-noop", shape: "vertices", version: 2, reuse: true },
  { id: "vertex-reset", shape: "baseline", version: 3, reuse: false },
  { id: "indices", shape: "indices", version: 4, reuse: false },
  { id: "indices-noop", shape: "indices", version: 4, reuse: true },
  { id: "index-reset", shape: "baseline", version: 5, reuse: false },
  { id: "reset-noop", shape: "baseline", version: 5, reuse: true },
]);
export const SIZE = 512;
export const LABEL = "matrix-caster";
export const CAMERA = Object.freeze({
  position: [5, 6, 8],
  target: [0, 0.6, 0],
  height: 8,
  near: 0.1,
  far: 30,
});

export const VARIANTS = Object.freeze([
  "live",
  "fresh-baseline",
  "fresh-vertices",
  "fresh-indices",
]);
export const CHANNEL = "matrix.apply";
export const ENGINE_SOURCE = "d0333acdd4443ed9a4a0239d24184755b812b447";
export const CONFIG = Object.freeze({
  mode: "browser",
  canvas: "#scene",
  assets: {},
  render: {
    defaultCamera: false,
    defaultLight: false,
    defaultEnvironment: false,
    tonemap: "none",
    sampleCount: 1,
    pixelRatio: 1,
    maxPixelRatio: 1,
    cadence: "demand",
    frameGraph: true,
    clearColor: [0.08, 0.1, 0.14, 1],
  },
  diagnostics: { level: "warn" },
});
export const WORKER_SETTINGS = Object.freeze({
  entityCapacity: 16,
  sharedSnapshotMessageRateHz: 240,
  sourceAssetsMessageRateHz: 240,
  workerFullSummaryIntervalMilliseconds: 16,
});
export function statesFor(mode, variant) {
  if (!MODES.includes(mode) || !VARIANTS.includes(variant))
    throw Error("Invalid matrix selection");
  return variant === "live"
    ? STATES
    : [
        {
          id: variant.slice(6),
          shape: variant.slice(6),
          version: 1,
          reuse: false,
        },
      ];
}
