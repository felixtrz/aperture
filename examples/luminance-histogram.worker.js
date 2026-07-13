import { startGeneratedSimulationWorker } from "@aperture-engine/app/worker";
import { defineApertureConfig } from "@aperture-engine/app/config";
import { createSystem, material, mesh } from "@aperture-engine/app/systems";
import {
  HISTOGRAM_BIN_COUNT,
  HISTOGRAM_INPUT_BUFFER_ID,
  HISTOGRAM_INPUT_ELEMENT_TYPE,
  HISTOGRAM_KERNEL_OUTPUT_BUFFER_ID,
  HISTOGRAM_OUTPUT_ELEMENT_TYPE,
  HISTOGRAM_PIXEL_COUNT,
  HISTOGRAM_RAW_OUTPUT_BUFFER_ID,
  histogramPixels,
  luminanceHistogramClearColor,
} from "./luminance-histogram-scene.js";

// C3 (three.js parity plan): the worker half of the luminance histogram. It
// registers the READ-ONLY input pixel buffer both compute passes sample and the
// two WRITABLE (usage: "storage") output buffers — one for the raw dispatch, one
// for the data-described kernel dispatch — plus a tiny backdrop so the forward
// FrameGraph route runs (user compute passes fold into its single encoder).

const config = defineApertureConfig({
  mode: "browser",
  canvas: "#aperture-canvas",
  render: {
    defaultCamera: false,
    defaultLight: false,
    clearColor: luminanceHistogramClearColor,
  },
});

class LuminanceHistogramSystem extends createSystem({ priority: 0 }) {
  init() {
    // Read-only input: 64 RGB pixels (vec4f, xyz = rgb). Both passes sample it.
    this.buffers.register({
      id: HISTOGRAM_INPUT_BUFFER_ID,
      elementType: HISTOGRAM_INPUT_ELEMENT_TYPE,
      elementCount: HISTOGRAM_PIXEL_COUNT,
      data: histogramPixels(),
      label: "Luminance Histogram Pixels",
    });

    // Writable output for the RAW dispatch (hand-built pipeline + bind group).
    this.buffers.register({
      id: HISTOGRAM_RAW_OUTPUT_BUFFER_ID,
      elementType: HISTOGRAM_OUTPUT_ELEMENT_TYPE,
      elementCount: HISTOGRAM_BIN_COUNT,
      usage: "storage",
      label: "Luminance Histogram (raw path)",
    });

    // Writable output for the DATA-DESCRIBED kernel dispatch.
    this.buffers.register({
      id: HISTOGRAM_KERNEL_OUTPUT_BUFFER_ID,
      elementType: HISTOGRAM_OUTPUT_ELEMENT_TYPE,
      elementCount: HISTOGRAM_BIN_COUNT,
      usage: "storage",
      label: "Luminance Histogram (kernel path)",
    });

    this.spawn.camera({
      key: "camera.main",
      name: "luminance-histogram-camera",
      transform: { translation: [0, 0, 2], lookAt: [0, 0, 0] },
      fovYDegrees: 50,
    });

    // A dim backdrop so the forward scene route produces a swapchain target the
    // user compute passes fold into (the compute work is off-screen; nothing is
    // drawn from the histogram).
    this.spawn.mesh({
      key: "backdrop",
      name: "luminance-histogram-backdrop",
      mesh: mesh.plane({ size: [1.6, 1.2] }),
      material: material.unlit({ color: [0.05, 0.07, 0.12, 1] }),
      transform: { translation: [0, 0, -0.5] },
    });
  }
}

startGeneratedSimulationWorker({
  config,
  systems: [{ default: LuminanceHistogramSystem }],
});
