import {
  color,
  createSystem,
  material,
  mesh,
} from "@aperture-engine/app/systems";

export default class CameraProjectionScene extends createSystem() {
  override init(): void {
    this.spawn.camera({
      key: "camera.main",
      transform: { translation: [0, 0, 8], lookAt: [0, 0, 0] },
      fovYDegrees: 60,
      camera: { near: 0.5, far: 80 },
    });
    this.spawn.mesh({
      key: "red.prop",
      mesh: mesh.roundedBox({
        halfExtents: [0.65, 0.65, 0.65],
        radius: 0.12,
        bevelSegments: 2,
      }),
      material: material.standard({
        baseColor: color.srgbHex("#da492c"),
        roughness: 0.65,
      }),
      transform: {
        translation: [-1.1, 0, 0],
        rotationEulerDegrees: [10, 25, 0],
      },
    });
    this.spawn.mesh({
      key: "blue.prop",
      mesh: mesh.box({ size: [0.8, 1.6, 0.8] }),
      material: material.standard({
        baseColor: color.srgbHex("#397cdf"),
        roughness: 0.7,
      }),
      transform: {
        translation: [1.1, 0.3, -1],
        rotationEulerDegrees: [0, -15, 0],
      },
    });
    this.spawn.mesh({
      key: "ground",
      mesh: mesh.box({ size: [5, 0.1, 3] }),
      material: material.standard({
        baseColor: color.srgbHex("#dad5c7"),
        roughness: 1,
      }),
      transform: { translation: [0, -0.75, 0] },
    });
    this.spawn.light({
      key: "sun",
      kind: "directional",
      illuminance: 3,
      transform: { rotationEulerDegrees: [-35, 20, 0] },
    });
    this.spawn.light({ key: "ambient", kind: "ambient", intensity: 0.4 });
  }
}
