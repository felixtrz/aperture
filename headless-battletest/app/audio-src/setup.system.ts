import { createSystem } from "@aperture-engine/app/systems";
export default class AudioSetup extends createSystem({ priority: 0 }) {
  override init(): void {
    this.spawn.camera({ key: "camera.main", transform: { translation: [0, 0, 5], lookAt: [0, 0, 0] } });
    const emitter = this.audio.playOneShot("blip.oneshot", { clip: this.audio.clip("blip"), gain: 0.5 });
    this.diagnostics.info("audio.played", { entity: emitter?.index ?? null });
  }
}
