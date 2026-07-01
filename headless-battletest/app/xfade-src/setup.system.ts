import { AppEntityKey, createSystem } from "@aperture-engine/app/systems";

// Animation blending probe: play "Idle", then crossFade to "Run" at frame 30.
// The soldier is spawned at scale 2 (effective 0.02, mesh-world det=8e-6 > 1e-6)
// so skinning is NOT frozen by F15 and the blend is actually visible. Verifies
// AnimationMixer.crossFadeTo drives isCrossFading and blends the palette headless.
export default class XfadeSystem extends createSystem({ priority: 0, queries: { all: { required: [AppEntityKey] } } }) {
  #anim: ReturnType<XfadeSystem["spawn"]["animation"]> | null = null;
  #phase = 0;
  override init(): void {
    this.spawn.camera({ key: "camera.main", transform: { translation: [0, 3, 8], lookAt: [0, 3, 0] }, camera: { clearColor: [0.1, 0.12, 0.16, 1] } });
    this.spawn.light({ key: "sun", kind: "directional", illuminance: 6, transform: { rotationEulerDegrees: [-45, 25, 0] } });
    this.spawn.light({ key: "amb", kind: "ambient", intensity: 0.6 });
    this.spawn.gltf(this.assets.gltf("soldier"), { key: "soldier", transform: { translation: [0, 0, 0], scale: [2, 2, 2] } });
  }
  override update(): void {
    if (this.#phase === 0 && this.time.frame >= 1) {
      const s = this.#find("soldier");
      if (!s) return;
      this.#anim = this.spawn.animation(s);
      const clips = this.#anim.clipIds;
      this.diagnostics.info("xfade.clips", { clipIds: clips });
      if (clips.includes("Idle")) { this.#anim.playClip("Idle", { loop: "repeat" }); this.#phase = 1; this.diagnostics.info("xfade.idle", { active: this.#anim.activeClipId }); }
    } else if (this.#phase === 1 && this.time.frame === 30 && this.#anim) {
      this.#anim.crossFade("Idle", "Run", 0.5);
      this.#phase = 2;
      this.diagnostics.info("xfade.start", { active: this.#anim.activeClipId, crossFading: this.#anim.isCrossFading });
    } else if (this.#phase === 2 && this.time.frame === 60 && this.#anim) {
      this.diagnostics.info("xfade.after", { active: this.#anim.activeClipId, crossFading: this.#anim.isCrossFading });
      this.#phase = 3;
    }
  }
  #find(key: string) { for (const e of this.queries.all.entities) if (e.getValue(AppEntityKey, "value") === key) return e; return null; }
}
