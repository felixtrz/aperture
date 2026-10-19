import { createSystem, material, mesh } from "@aperture-engine/app/systems";
import { instrumentHousingSurfaces } from "../housing.ts";
import { spawnUtilityVehicle } from "../vehicle.ts";

export default class FittedPropsScene extends createSystem({ priority: 0 }) {
  override init(): void {
    this.spawn.camera({
      key: "camera",
      transform: { translation: [5.7, 3.6, 6.7], lookAt: [0.3, 0.85, 0] },
      camera: {
        projection: "orthographic",
        orthographicHeight: 3.9,
        near: 0.1,
        far: 80,
        clearColor: [0.87, 0.86, 0.81, 1],
      },
    });
    this.spawn.light({
      key: "sun",
      kind: "directional",
      intensity: 3.2,
      color: [1, 0.94, 0.83, 1],
      transform: { rotationEulerDegrees: [-46, -32, 0] },
      shadow: {
        mapSize: 2048,
        cascadeCount: 1,
        shadowType: 1,
        filterRadius: 3,
        normalBias: 0.015,
        orthographicSize: 12,
        center: [0, 0.8, 0],
        lightDistance: 15,
        near: 0.1,
        far: 35,
      },
    });
    this.spawn.mesh({
      key: "ground",
      mesh: mesh.box({ size: [200, 0.08, 200] }),
      material: material.standard({ baseColor: [0.72, 0.7, 0.63, 1] }),
      transform: { translation: [0, -0.04, 0] },
      receiveShadow: true,
    });
    spawnUtilityVehicle(this.spawn, "utility-vehicle");
    const housing = instrumentHousingSurfaces();
    const root = this.spawn.group({
      key: "instrument",
      transform: {
        translation: [1.75, 0, -0.7],
        rotationEulerDegrees: [0, -18, 0],
      },
    });
    for (const [key, geometry, color] of [
      ["shell", housing.shell, [0.42, 0.29, 0.13, 1]],
      ["display", housing.display, [0.025, 0.065, 0.075, 1]],
    ] as const)
      this.spawn.mesh({
        key: `instrument.${key}`,
        mesh: mesh.polygons(geometry),
        material: material.standard({ baseColor: color, roughness: 0.5 }),
        transform: { parent: root },
        castShadow: true,
        receiveShadow: true,
      });
  }
}
