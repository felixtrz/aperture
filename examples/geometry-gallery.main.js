import { defineApertureConfig } from "@aperture-engine/app/config";

// Shared config + constants for the geometry-gallery example (parity plan G1):
// a grid of the round-out geometry primitives (circle, ring, torus, torus knot,
// the four platonic solids, and a rounded box) authored purely through the app
// facade with a single built-in `material.standard()` per mesh. All nine meshes
// draw in one frame; a distinct built-in material family per mesh stays on the
// standard pipeline, avoiding the multi-custom-WGSL latent path entirely.
export const geometryGalleryClearColor = [0.02, 0.03, 0.045, 1];
export const geometryGalleryExpectedMeshDraws = 9;
export const geometryGalleryOrthographicHeight = 7.5;

export const geometryGalleryConfig = defineApertureConfig({
  mode: "browser",
  canvas: "#aperture-canvas",
  render: {
    defaultCamera: false,
    defaultLight: false,
    clearColor: geometryGalleryClearColor,
    sampleCount: 1,
  },
});
