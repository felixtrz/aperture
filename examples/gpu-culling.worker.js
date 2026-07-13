import { startGeneratedSimulationWorker } from "@aperture-engine/app/worker";
import { defineApertureConfig } from "@aperture-engine/app/config";
import { createSystem, material, mesh } from "@aperture-engine/app/systems";
import {
  CULL_ARGS_BUFFER_ID,
  CULL_ARGS_ELEMENT_COUNT,
  CULL_ARGS_ELEMENT_TYPE,
  CULL_INSTANCE_BUFFER_ID,
  CULL_INSTANCE_COUNT,
  CULL_INSTANCE_ELEMENT_TYPE,
  gpuCullingClearColor,
  seedArgsBuffer,
  seedInstanceBuffer,
} from "./gpu-culling-scene.js";

// C2 (three.js parity plan): the worker half of GPU-driven culling. It registers
// the two WRITABLE buffers (usage: "storage") the main thread's compute pass
// writes and the indirect draw consumes — one realized GPU buffer per handle,
// zero CPU copies — and spawns a tiny backdrop so the forward scene route runs
// (the culled triangles draw OVER scene-color as a user render pass).

const config = defineApertureConfig({
  mode: "browser",
  canvas: "#aperture-canvas",
  render: {
    defaultCamera: false,
    defaultLight: false,
    clearColor: gpuCullingClearColor,
    // The GPU-culled triangles draw on the forward route via a hand-built,
    // single-sampled render pipeline; opt out of MSAA so its sample count
    // matches the frame's color/depth attachments.
    sampleCount: 1,
  },
});

class GpuCullingSystem extends createSystem({ priority: 0 }) {
  init() {
    // The indirect-argument buffer: realized STORAGE | COPY_DST | COPY_SRC |
    // VERTEX | INDIRECT so ONE GPU buffer is written by the compute pass, read as
    // the drawIndirect argument source, and read back for the frame report.
    this.buffers.register({
      id: CULL_ARGS_BUFFER_ID,
      elementType: CULL_ARGS_ELEMENT_TYPE,
      elementCount: CULL_ARGS_ELEMENT_COUNT,
      usage: "storage",
      data: seedArgsBuffer(),
      label: "GPU Culling Indirect Args",
    });

    // The compacted survivor buffer the compute pass fills and the vertex shader
    // reads by @builtin(instance_index).
    this.buffers.register({
      id: CULL_INSTANCE_BUFFER_ID,
      elementType: CULL_INSTANCE_ELEMENT_TYPE,
      elementCount: CULL_INSTANCE_COUNT,
      usage: "storage",
      data: seedInstanceBuffer(),
      label: "GPU Culling Instances",
    });

    this.spawn.camera({
      key: "camera.main",
      name: "gpu-culling-camera",
      transform: { translation: [0, 0, 2], lookAt: [0, 0, 0] },
      fovYDegrees: 50,
    });

    // A dim backdrop quad so the forward scene route is active and there is a
    // surface behind the GPU-culled triangles.
    this.spawn.mesh({
      key: "backdrop",
      name: "gpu-culling-backdrop",
      mesh: mesh.plane({ size: [1.6, 1.2] }),
      material: material.unlit({ color: [0.05, 0.07, 0.12, 1] }),
      transform: { translation: [0, 0, -0.5] },
    });
  }
}

startGeneratedSimulationWorker({
  config,
  systems: [{ default: GpuCullingSystem }],
});
