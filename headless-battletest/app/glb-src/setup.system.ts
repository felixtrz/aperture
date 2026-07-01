import { createSystem } from "@aperture-engine/app/systems";
export default class GlbScene extends createSystem({ priority: 0 }) {
  override init(): void {
    this.spawn.camera({ key: "camera.main", transform: { translation: [2, 2, 3], lookAt: [0, 0, 0] }, camera: { clearColor: [0.1,0.1,0.14,1] } });
    this.spawn.light({ key: "sun", kind: "directional", illuminance: 5, transform: { rotationEulerDegrees: [-45, 30, 0] } });
    this.spawn.light({ key: "amb", kind: "ambient", intensity: 0.5 });
    this.spawn.gltf(this.assets.gltf("blaster"), { key: "blaster", transform: { scale: [1,1,1] } });
  }
}
