import { defineApertureConfig } from "@aperture-engine/app/config";

// Shared config + constants for the racetrack-tube example (parity plan G2):
// a single procedural tube swept along a closed Catmull-Rom loop and drawn with
// one built-in `material.standard()`. Only ONE mesh draws per frame, and a
// built-in material family keeps it on the standard pipeline (avoiding the
// latent multi-custom-WGSL black-frame path). Segment counts are kept tiny so
// the scene stays cheap under SwiftShader in CI.
export const racetrackTubeClearColor = [0.02, 0.03, 0.05, 1];
export const racetrackTubeExpectedMeshDraws = 1;
export const racetrackTubeOrthographicHeight = 8.5;

export const racetrackTubeConfig = defineApertureConfig({
  mode: "browser",
  canvas: "#aperture-canvas",
  render: {
    defaultCamera: false,
    defaultLight: false,
    clearColor: racetrackTubeClearColor,
    sampleCount: 1,
  },
});
