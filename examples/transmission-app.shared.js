import { defineApertureConfig } from "@aperture-engine/app/config";

// App-facade variant of the low-level transmission example (parity plan A3
// AC2): the same factor-driven scene, authored through `material.standard()`
// spawn descriptors instead of hand-registered render assets. The textured
// transmission-mask panel from the low-level scene is intentionally omitted —
// texture bindings are not part of the A3 surface.
export const transmissionAppClearColor = [0.018, 0.022, 0.028, 1];
export const transmissionAppStripeCount = 24;
export const transmissionAppStripeSpan = 2.16;
// 24 background stripes + the glossy and rough transmissive spheres.
export const transmissionAppExpectedMeshDraws = transmissionAppStripeCount + 2;
export const transmissionAppTransmissionFactor = 0.9;
export const transmissionAppRoughness = Object.freeze({
  glossy: 0.02,
  rough: 0.85,
});

export const transmissionAppConfig = defineApertureConfig({
  mode: "browser",
  canvas: "#aperture-canvas",
  render: {
    defaultCamera: false,
    defaultLight: false,
    clearColor: transmissionAppClearColor,
    // Match the low-level transmission example's non-MSAA route so the
    // through-glass grab pass samples the same scene-color pixels.
    sampleCount: 1,
  },
});
