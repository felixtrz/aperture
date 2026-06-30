import { createSystem, material, mesh } from "@aperture-engine/app/systems";
export default class S extends createSystem({ priority: 0 }) {
  override init(): void {
    this.spawn.camera({ key: "cam.a", transform: { translation: [0, 2, 6], lookAt: [0, 0, 0] } });
    this.spawn.camera({ key: "cam.b", transform: { translation: [6, 2, 0], lookAt: [0, 0, 0] } });
    this.spawn.light({ key: "sun", kind: "directional", illuminance: 4 });
    this.spawn.mesh({ key: "cube", mesh: mesh.box({ size: [1,1,1] }), material: material.standard() });
  }
}
