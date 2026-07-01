import { createSystem, material, mesh } from "@aperture-engine/app/systems";
export default class BloomSetup extends createSystem({ priority: 0 }) {
  override init(): void {
    this.spawn.camera({ key: "camera.main", transform: { translation: [0, 0, 6], lookAt: [0, 0, 0] }, camera: { clearColor: [0.02, 0.02, 0.03, 1] } });
    this.spawn.light({ key: "fill", kind: "ambient", intensity: 0.4 });
    // A very bright emissive sphere -> should bloom if post-effects apply.
    this.spawn.mesh({ key: "glow", mesh: mesh.sphere({ radius: 1 }), material: material.standard({ baseColor: [1, 0.9, 0.3, 1], emissiveFactor: [6, 5, 1] }), transform: { translation: [0, 0, 0] } });
  }
}
