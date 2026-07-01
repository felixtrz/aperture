import { AppEntityKey, LocalTransform, createSystem, mesh, material } from "@aperture-engine/app/systems";
export default class Bounce extends createSystem({ priority: 0, queries: { balls: { required: [AppEntityKey, LocalTransform] } } }) {
  #peaks: number[] = [];
  #lastY = 0; #rising = false;
  override init(): void {
    this.spawn.mesh({ key: "floor", mesh: mesh.box({ size: [10, 0.4, 10] }), material: material.standard(), transform: { translation: [0, -0.2, 0] },
      physics: { rigidBody: { type: "static" }, collider: { shape: { kind: "box", halfExtents: [5, 0.2, 5] }, restitution: 0.9 } } });
    this.spawn.mesh({ key: "ball", mesh: mesh.sphere({ radius: 0.5 }), material: material.standard({ baseColor: [0.9,0.3,0.2,1] }), transform: { translation: [0, 5, 0] },
      physics: { rigidBody: { type: "dynamic" }, collider: { shape: { kind: "sphere", radius: 0.5 }, restitution: 0.9 } } });
  }
  override update(): void {
    for (const e of this.queries.balls.entities) if (e.getValue(AppEntityKey,"value")==="ball") {
      const y = e.getVectorView(LocalTransform,"translation")[1] ?? 0;
      // Detect a local max (a bounce apex) after the ball starts rising.
      if (y > this.#lastY) this.#rising = true;
      else if (this.#rising && y < this.#lastY) { this.#peaks.push(Number(this.#lastY.toFixed(3))); this.diagnostics.info("bounce.apex",{y:Number(this.#lastY.toFixed(3))}); this.#rising = false; }
      this.#lastY = y;
    }
  }
  override destroy(): void { this.diagnostics.info("bounce.peaks", { peaks: this.#peaks }); }
}
