import { startGeneratedSimulationWorker } from "@aperture-engine/app/worker";
import { defineApertureConfig } from "@aperture-engine/app/config";
import { createSystem, material, mesh } from "@aperture-engine/app/systems";
import {
  createMaterialHandle,
  createMeshHandle,
} from "@aperture-engine/simulation";
import { defineInstanceAttributes } from "@aperture-engine/render";
import {
  BOID_BUFFER_ID,
  BOID_COUNT,
  BOID_ELEMENT_TYPE,
  boidsClearColor,
  boidsRenderWgsl,
  seedBoids,
} from "./boids-scene.js";

// C1 (three.js parity plan): the worker half of GPU boids. It registers a
// WRITABLE buffer asset (usage: "storage"), spawns BOID_COUNT instanced entities
// sharing one custom material, and that material consumes the SAME buffer BOTH
// as a read-only storage binding (group 2) AND as a buffer-backed instance
// stream (@location(6), slot 1). No CPU position streaming — the main thread's
// compute pass writes the buffer on the GPU and the frame graph orders it before
// this draw.

const config = defineApertureConfig({
  mode: "browser",
  canvas: "#aperture-canvas",
  render: {
    defaultCamera: false,
    defaultLight: false,
    clearColor: boidsClearColor,
  },
});

class BoidsSystem extends createSystem({ priority: 0 }) {
  init() {
    // The writable flock buffer, seeded deterministically. The renderer realizes
    // ONE GPU buffer per handle@version (STORAGE | VERTEX | COPY_DST | COPY_SRC)
    // shared by the storage binding, the instance stream, and the compute pass.
    const buffer = this.buffers.register({
      id: BOID_BUFFER_ID,
      elementType: BOID_ELEMENT_TYPE,
      elementCount: BOID_COUNT,
      usage: "storage",
      data: seedBoids(BOID_COUNT),
      label: "Boid Flock State",
    });

    this.spawn.camera({
      key: "camera.main",
      name: "boids-camera",
      transform: { translation: [0, 0, 2], lookAt: [0, 0, 0] },
      fovYDegrees: 50,
    });

    const boidMaterial = material.customWgsl({
      familyKey: "example/boids",
      label: "Boids",
      shader: {
        kind: "inline-wgsl",
        code: boidsRenderWgsl,
        virtualPath: "boids.wgsl",
      },
      entryPoints: { vertex: "vs_main", fragment: "fs_main" },
      renderState: { cullMode: "none" },
      // Consumption (a): the whole flock array, read-only.
      bindings: [
        material.storage("boids", {
          binding: 0,
          visibility: ["vertex"],
          buffer,
        }),
      ],
      // Consumption (b): the buffer-backed instance stream at @location(6).
      instanceBuffer: {
        buffer,
        attributes: defineInstanceAttributes([
          { name: "instanceState", format: "float32x4" },
        ]),
      },
    });

    // Boid 0 registers the shared mesh + material under stable ids; the rest
    // reuse the handles, so the whole flock batches into ONE instanced draw.
    this.spawn.mesh({
      key: "boid",
      name: "boid-0",
      mesh: mesh.plane({ size: [0.03, 0.05] }),
      material: boidMaterial,
      transform: { translation: [0, 0, 0] },
    });

    const meshHandle = createMeshHandle("boid.mesh");
    const materialHandle = createMaterialHandle("boid.material");

    for (let index = 1; index < BOID_COUNT; index += 1) {
      this.spawn.mesh({
        name: `boid-${index}`,
        mesh: meshHandle,
        material: materialHandle,
        transform: { translation: [0, 0, 0] },
      });
    }
  }
}

startGeneratedSimulationWorker({
  config,
  systems: [{ default: BoidsSystem }],
});
