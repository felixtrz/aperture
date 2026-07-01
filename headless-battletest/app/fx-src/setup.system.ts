import { createSystem } from "@aperture-engine/app/systems";
export default class FxSetupSystem extends createSystem({ priority: 0 }) {
  override init(): void {
    this.spawn.camera({ key: "camera.main", transform: { translation: [0, 2, 8], lookAt: [0, 0, 0] }, fovYDegrees: 55 });
    this.spawn.light({ key: "light", kind: "ambient", intensity: 1 });
    const ok = this.particles.emit(this.particles.effect("spark"), { count: 24, position: [0, 1, 0] });
    this.diagnostics.info("fx.emit", { ok });
  }
}
