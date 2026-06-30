import { createSystem } from "@aperture-engine/app/systems";
export default class SoundSystem extends createSystem({ priority: 0 }) {
  override init(): void {
    this.audio.loop("test.loop", { clip: this.audio.clip("beep") });
  }
  override update(): void {
    if (this.time.frame === 3) {
      this.audio.playOneShot("test.oneshot", { clip: this.audio.clip("beep") });
    }
  }
}
