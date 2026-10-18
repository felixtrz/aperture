import { createSystem, mesh, material } from "@aperture-engine/app/systems";
import { spawnSkiff, spawnCanopy, linearColor } from "../props.ts";

export default class ReflectionScene extends createSystem({ priority: 0 }) {
  override init(): void {
    this.spawn.camera({
      key: "camera",
      transform: { translation: [8, 7, 10], lookAt: [0, 0.5, 0] },
      camera: {
        projection: "orthographic",
        orthographicHeight: 8.8,
        near: 0.1,
        far: 80,
        frustumCulling: false,
        clearColor: linearColor(0xf3e7cd),
      },
    });
    this.spawn.light({
      key: "sun",
      kind: "directional",
      intensity: 3.2,
      color: [1, 0.92, 0.8, 1],
      transform: { rotationEulerDegrees: [-48, -35, 0] },
      shadow: {
        mapSize: 1024,
        cascadeCount: 1,
        shadowType: 1,
        strength: 0.8,
        filterRadius: 2,
        normalBias: 0.015,
        orthographicSize: 14,
        center: [0, 0, 0],
        lightDistance: 20,
        near: 0.1,
        far: 40,
      },
    });
    this.spawn.mesh({
      key: "backdrop",
      mesh: mesh.box({ size: [200, 0.1, 200] }),
      material: material.standard({ baseColor: linearColor(0xf3e7cd) }),
      transform: { translation: [0, -0.65, 0] },
      receiveShadow: true,
    });
    this.spawn.mesh({
      key: "water-base",
      mesh: mesh.box({ size: [9, 0.5, 7] }),
      material: material.standard({ baseColor: linearColor(0x348d92) }),
      transform: { translation: [0, -0.3, 0] },
    });
    this.spawn.mesh({
      key: "water",
      mesh: mesh.plane({ size: [9, 7] }),
      material: material.standard({
        baseColor: linearColor(0x2e9ca2),
        roughness: 0.4,
      }),
      transform: { rotationEulerDegrees: [-90, 0, 0] },
      receiveShadow: true,
    });
    this.spawn.mesh({
      key: "landing",
      mesh: mesh.beveledBox({ size: [3.3, 0.36, 2.3], bevel: 0.08 }),
      material: material.standard({ baseColor: linearColor(0xc8b38c) }),
      transform: { translation: [-2.2, 0.15, -1.5] },
      castShadow: true,
      receiveShadow: true,
    });
    this.spawn.mesh({
      key: "faceted-rock",
      mesh: mesh.icosphere({ radius: 0.42, subdivisions: 0 }),
      material: material.standard({ baseColor: linearColor(0xa69d86) }),
      transform: { translation: [-3.4, 0.52, -2.1], scale: [1, 0.75, 0.8] },
      castShadow: true,
      receiveShadow: true,
    });
    spawnSkiff(this.spawn);
    spawnCanopy(this.spawn);
    this.spawn.mesh({
      key: "mooring",
      mesh: mesh.tube({
        path: [
          [-0.7, 0.42, -0.4],
          [-0.25, 0.22, -0.05],
          [0.3, 0.35, 0.3],
          [0.65, 0.7, 0.6],
        ],
        radius: 0.025,
        radialSegments: 6,
      }),
      material: material.standard({ baseColor: linearColor(0xd7bd87) }),
      castShadow: true,
      receiveShadow: true,
    });
  }
}
