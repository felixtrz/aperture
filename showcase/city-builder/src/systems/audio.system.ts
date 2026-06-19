import {
  AudioSimulationSpace,
  createSystem,
} from "@aperture-engine/app/systems";

// Keeps the looping city ambience alive (main.tscn AudioStreamPlayer, autoplay,
// -30 dB). The loop handle is refreshed every frame, mirroring how the other
// ports drive long-running loops from a system.
export default class AudioSystem extends createSystem({ priority: 90 }) {
  override update(): void {
    this.audio.loop("city.ambience", {
      clip: this.audio.clip("ambience"),
      busId: "ambient",
      gain: 0.3,
      simulationSpace: AudioSimulationSpace.Local,
    });
  }
}
