import { AppEntityKey, createSystem } from "@aperture-engine/app/systems";
export default class SkinSystem extends createSystem({
  priority: 0,
  queries: { all: { required: [AppEntityKey] } },
}) {
  #started = false;
  override init(): void {
    this.spawn.camera({ key: "cam", transform: { translation: [0, 1, 5], lookAt: [0, 1, 0] } });
    this.spawn.gltf(this.assets.gltf("soldier"), { key: "soldier" });
  }
  override update(): void {
    if (this.#started) return;
    let model = null;
    for (const e of this.queries.all.entities) if (e.getValue(AppEntityKey, "value") === "soldier") model = e;
    if (model === null) return;
    const anim = this.spawn.animation(model);
    const c = this.signals.clips; if (c) c.value = anim.clipIds.length;
    if (anim.clipIds.length > 0) {
      anim.playClip(anim.clipIds[0], { loop: "repeat" });
      const p = this.signals.playing; if (p) p.value = anim.activeClipId !== null;
      this.#started = true;
    }
  }
}
