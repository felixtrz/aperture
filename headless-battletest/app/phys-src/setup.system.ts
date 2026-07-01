import { createSystem, material, mesh, physics } from "@aperture-engine/app/systems";

// A static floor plus three dynamic boxes dropped from different heights.
// Under gravity they should fall and settle on the floor (~y = floorTop + halfBox).
export default class PhysicsSetupSystem extends createSystem({ priority: 0 }) {
  override init(): void {
    this.spawn.camera({
      key: "camera.main",
      transform: { translation: [0, 3, 12], lookAt: [0, 2, 0] },
      fovYDegrees: 50,
    });
    this.spawn.light({
      key: "light.key",
      kind: "directional",
      illuminance: 4,
      transform: { rotationEulerDegrees: [-45, 30, 0] },
    });

    // Static floor: top surface at y = 0 (center -0.5, half-height 0.5).
    this.spawn.mesh({
      key: "floor",
      mesh: mesh.box({ size: [12, 1, 12] }),
      material: material.standard({ baseColor: [0.2, 0.3, 0.2, 1] }),
      transform: { translation: [0, -0.5, 0] },
      physics: {
        rigidBody: { type: "static" },
        collider: { shape: { kind: "box", halfExtents: [6, 0.5, 6] } },
      },
    });

    // Three dynamic unit cubes dropped from increasing heights.
    for (let i = 0; i < 3; i += 1) {
      this.spawn.mesh({
        key: `box.${i}`,
        name: `Box ${i}`,
        tags: ["box", "dynamic"],
        mesh: mesh.box({ size: [1, 1, 1] }),
        material: material.standard({ baseColor: [0.9, 0.4 + i * 0.15, 0.2, 1] }),
        transform: { translation: [i * 0.05, 3 + i * 2, 0] },
        physics: {
          rigidBody: { type: "dynamic" },
          collider: { shape: { kind: "box", halfExtents: [0.5, 0.5, 0.5] } },
        },
      });
    }
  }
}
