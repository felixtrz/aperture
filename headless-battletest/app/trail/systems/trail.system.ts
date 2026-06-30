import { createSystem } from "@aperture-engine/app/systems";
export default class TrailSystem extends createSystem({ priority: 0 }) {
  #trail = null;
  override init(): void {
    this.spawn.camera({ key: "cam", transform: { translation: [0, 5, 8], lookAt: [0, 0, 0] } });
    this.#trail = this.trails.groundRibbon("ribbon", { width: 0.3, color: [1, 0.4, 0.1] });
  }
  override update(): void {
    const t = this.time.elapsed;
    if (this.#trail) {
      this.#trail.track([Math.cos(t) * 3, 0.05, Math.sin(t) * 3]);
      this.#trail.flush();
    }
  }
}
