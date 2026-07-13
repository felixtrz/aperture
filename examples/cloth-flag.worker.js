import { defineApertureConfig } from "@aperture-engine/app/config";
import { createSystem, material } from "@aperture-engine/app/systems";
import { startGeneratedSimulationWorker } from "@aperture-engine/app/worker";

import {
  CLOTH_MESH_ID,
  CLOTH_STREAM_ID,
  CLOTH_UPDATE_RANGE,
  createClothGeometry,
  createClothMeshAsset,
  deformCloth,
} from "./cloth-flag-scene.js";

// D5 (three.js parity plan): first-class dynamic mesh API. A CPU-simulated
// cloth flag (a small pinned grid) is deformed every frame on the worker and
// streamed to the GPU with `this.meshes.update(handle, { streams, updateRanges
// })`. Only the moving-row byte window crosses to the existing GPU buffer via
// the update-range plan — the mesh asset is never re-registered and the index
// buffer is never re-uploaded, which the frame report proves via its
// dynamic-mesh upload byte counter (partial, not full re-realization).

const clearColor = [0.03, 0.04, 0.08, 1];

const config = defineApertureConfig({
  mode: "browser",
  canvas: "#aperture-canvas",
  render: {
    defaultCamera: false,
    defaultLight: false,
    clearColor,
  },
});

class ClothFlagSystem extends createSystem({ priority: 0 }) {
  #time = 0;
  #positions = null;
  #mesh = null;

  init() {
    const { positions, indices } = createClothGeometry();
    this.#positions = positions;

    // Register the deforming grid as a dynamic mesh. The initial publish seeds
    // the GPU buffers at their full size; every later frame streams only the
    // changed window through meshes.update().
    this.#mesh = this.meshes.dynamic(CLOTH_MESH_ID, {
      label: "Cloth Flag",
      initial: createClothMeshAsset(positions, indices),
    });

    this.spawn.camera({
      key: "camera.main",
      name: "cloth-camera",
      transform: { translation: [1.5, 0.35, 4.6], lookAt: [0, -0.1, 0] },
      fovYDegrees: 45,
      camera: { aspect: 960 / 540, priority: 0, near: 0.1, far: 50 },
    });

    this.spawn.light({
      name: "sun",
      kind: "directional",
      color: [1, 0.96, 0.9, 1],
      intensity: 2.8,
      transform: { translation: [2.5, 3, 4], lookAt: [0, 0, 0] },
    });
    this.spawn.light({
      name: "fill",
      kind: "ambient",
      color: [0.42, 0.48, 0.62, 1],
      intensity: 0.55,
    });

    // Built-in standard material (double-sided so the flag's back shows as it
    // waves). Deliberately NOT a custom-WGSL material — the D5 slice must not
    // trip the known multi-custom-WGSL-black-frame bug.
    this.spawn.mesh({
      name: "cloth-flag",
      mesh: this.#mesh.handle,
      material: material.standard({
        baseColor: [0.86, 0.16, 0.18, 1],
        roughness: 0.55,
        metallic: 0,
        renderState: { cullMode: "none" },
      }),
    });
  }

  update(delta) {
    const dt = Math.min(Math.max(delta, 0), 1 / 30);
    this.#time += dt;

    // CPU cloth step: mutate the moving rows in place, then upload ONLY that
    // contiguous window. Naming a single stream + range leaves the index buffer
    // (and the pinned top row) untouched, so the renderer streams a partial
    // update through queue.writeBuffer rather than re-realizing the mesh.
    deformCloth(this.#positions, this.#time);
    this.#mesh.update({
      streams: [
        {
          id: CLOTH_STREAM_ID,
          data: this.#positions,
          updateRanges: [{ ...CLOTH_UPDATE_RANGE }],
        },
      ],
    });
  }
}

startGeneratedSimulationWorker({
  config,
  systems: [{ default: ClothFlagSystem }],
});
