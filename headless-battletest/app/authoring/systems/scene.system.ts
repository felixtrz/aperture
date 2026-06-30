import { createSystem, material, mesh } from "@aperture-engine/app/systems";
export default class SceneSystem extends createSystem({ priority: 0 }) {
  override init(): void {
    this.spawn.camera({ key: "cam", transform: { translation: [0, 2, 8], lookAt: [0, 0, 0] } });
    this.spawn.light({ key: "sun", kind: "directional", illuminance: 4 });
    this.spawn.mesh({ key: "cube", mesh: mesh.box({ size: [1, 1, 1] }), material: material.standard() });
    this.spawn.fog({ key: "fog", kind: "exp2", color: [0.5, 0.6, 0.7, 1], density: 0.05 });
    this.spawn.proceduralSky({ key: "sky" });
    this.spawn.particles({
      key: "sparks",
      effect: { kind: "burst", options: {} },
      transform: { translation: [0, 1, 0] },
    });
  }
}
