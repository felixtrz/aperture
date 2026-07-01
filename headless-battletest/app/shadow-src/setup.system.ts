import { createSystem, material, mesh } from "@aperture-engine/app/systems";
export default class ShadowSetup extends createSystem({ priority: 0 }) {
  override init(): void {
    this.spawn.camera({ key: "camera.main", transform: { translation: [4, 5, 7], lookAt: [0, 0.5, 0] }, fovYDegrees: 50, camera: { clearColor: [0.1, 0.12, 0.16, 1] } });
    this.spawn.light({ key: "sun", kind: "directional", illuminance: 6, transform: { rotationEulerDegrees: [-55, 35, 0] }, shadow: true });
    this.spawn.light({ key: "fill", kind: "ambient", intensity: 0.3 });
    this.spawn.mesh({ key: "ground", mesh: mesh.box({ size: [8, 0.2, 8] }), material: material.standard({ baseColor: [0.5, 0.5, 0.55, 1], roughness: 0.9 }), transform: { translation: [0, -0.1, 0] }, receiveShadow: true });
    this.spawn.mesh({ key: "box", mesh: mesh.box({ size: [1, 1, 1] }), material: material.standard({ baseColor: [0.9, 0.5, 0.2, 1] }), transform: { translation: [0, 1, 0] }, castShadow: true });
  }
}
