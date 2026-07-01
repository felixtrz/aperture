import { createSystem, material, mesh } from "@aperture-engine/app/systems";
export default class SkySetup extends createSystem({ priority: 0 }) {
  override init(): void {
    this.spawn.camera({ key: "camera.main", transform: { translation: [0, 2, 10], lookAt: [0, 1, 0] }, fovYDegrees: 55 });
    this.spawn.light({ key: "sun", kind: "directional", illuminance: 5, transform: { rotationEulerDegrees: [-45, 30, 0] } });
    this.spawn.proceduralSky({ key: "sky" });
    this.spawn.fog({ key: "fog", mode: "linear", color: [0.6, 0.7, 0.8, 1], start: 8, end: 30 });
    for (let i = 0; i < 5; i++) this.spawn.mesh({ key: `pillar.${i}`, mesh: mesh.box({ size: [0.6, 3, 0.6] }), material: material.standard({ baseColor: [0.7, 0.5, 0.4, 1] }), transform: { translation: [(i - 2) * 2.5, 1.5, -i * 4] } });
  }
}
