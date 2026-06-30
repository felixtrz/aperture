import { AppEntityKey, createSystem } from "@aperture-engine/app/systems";
export default class PlaySystem extends createSystem({
  priority: 0,
  queries: { all: { required: [AppEntityKey] } },
}) {
  #started = false;
  override init(): void {
    this.spawn.camera({ key: "cam", transform: { translation: [0, 1, 5], lookAt: [0, 0, 0] } });
    this.spawn.gltf(this.assets.gltf("cube"), { key: "model" });
  }
  override update(): void {
    if (this.#started) return;
    const model = this.#find("model");
    if (model === null) return;
    const anim = this.spawn.animation(model);
    const clips = this.signals.clips;
    if (clips) clips.value = anim.clipIds.length;
    if (anim.clipIds.length > 0) {
      anim.playClip(anim.clipIds[0]!, { loop: "repeat" });
      this.#started = true;
    }
  }
  #find(key: string) {
    for (const e of this.queries.all.entities) if (e.getValue(AppEntityKey, "value") === key) return e;
    return null;
  }
}
