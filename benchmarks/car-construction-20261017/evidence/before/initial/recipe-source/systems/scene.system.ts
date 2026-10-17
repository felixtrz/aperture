import { createSystem, material, mesh } from "@aperture-engine/app/systems";
import { linearColor, spawnFittedCar } from "../car.ts";

export default class CarScene extends createSystem({ priority: 0 }) {
  override init(): void {
    this.spawn.camera({
      key: "camera",
      transform: { translation: [4.5, 2.9, 5.7], lookAt: [0, 0.68, 0] },
      camera: {
        projection: "orthographic",
        orthographicHeight: 3.5,
        near: 0.1,
        far: 80,
        clearColor: [0.86, 0.83, 0.76, 1],
      },
    });
    this.spawn.light({
      key: "sun",
      kind: "directional",
      intensity: 3.1,
      color: [1, 0.91, 0.78, 1],
      transform: { rotationEulerDegrees: [-48, -35, 0] },
      shadow: {
        mapSize: 2048,
        cascadeCount: 1,
        shadowType: 1,
        filterRadius: 3,
        normalBias: 0.015,
        orthographicSize: 10,
        center: [0, 0.7, 0],
        lightDistance: 15,
        near: 0.1,
        far: 35,
      },
    });
    this.spawn.mesh({
      key: "ground",
      mesh: mesh.box({ size: [200, 0.08, 200] }),
      material: material.standard({
        baseColor: linearColor(0xe7ddc7),
        roughness: 1,
      }),
      transform: { translation: [0, -0.04, 0] },
      receiveShadow: true,
    });
    spawnFittedCar(this.spawn, { key: "car", color: 0x5c8ca7 });
  }
}
