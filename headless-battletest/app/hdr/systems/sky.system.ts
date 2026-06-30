import { createSystem } from "@aperture-engine/app/systems";
export default class SkySystem extends createSystem({ priority: 0 }) {
  override init(): void {
    this.spawn.camera({ key: "cam", transform: { translation: [0, 1, 5], lookAt: [0, 0, 0] } });
  }
}
