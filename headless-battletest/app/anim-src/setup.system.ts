import { AppEntityKey, createSystem } from "@aperture-engine/app/systems";

// Skeletal-animation demonstrator (finding F15). Loads Soldier.glb (a rigged
// mesh with 49 joints and 4 clips), then plays clip[0] ("Idle") on repeat. The
// animation mixer advances correctly every headless step and writes all 156
// joint channels into the joints' LocalTransforms — but because Soldier.glb is
// authored at a uniform 0.01 scale, its mesh-entity world matrix has
// determinant 0.01^3 = 1e-6, which sits exactly on invertMat4's EPSILON=1e-6
// singularity threshold. The skinning-palette compute then treats the mesh
// world as non-invertible and writes an identity block for every joint, so the
// extracted skin palette is frozen at bind pose and the render never animates.
// Scaling the model up (so det > 1e-6) or lowering EPSILON restores animation.
export default class AnimSystem extends createSystem({ priority: 0, queries: { all: { required: [AppEntityKey] } } }) {
  #started = false;
  override init(): void {
    this.spawn.camera({ key: "camera.main", transform: { translation: [0, 1.5, 4], lookAt: [0, 1, 0] }, camera: { clearColor: [0.1, 0.12, 0.16, 1] } });
    this.spawn.light({ key: "sun", kind: "directional", illuminance: 5, transform: { rotationEulerDegrees: [-40, 25, 0] } });
    this.spawn.light({ key: "amb", kind: "ambient", intensity: 0.6 });
    // Optional uniform-scale override (F15 boundary sweep). Default 1 keeps the
    // model's authored 0.01 scale, which sits exactly on invertMat4's epsilon.
    const s = Number(process.env.ANIM_SCALE ?? "1");
    const scale: [number, number, number] = [s, s, s];
    this.spawn.gltf(this.assets.gltf("soldier"), { key: "soldier", transform: { translation: [0, 0, 0], scale } });
  }
  override update(): void {
    if (this.#started || this.time.frame < 1) return;
    const soldier = this.#find("soldier");
    if (!soldier) return;
    const anim = this.spawn.animation(soldier);
    this.diagnostics.info("anim.clips", { clipIds: anim.clipIds, count: anim.clipIds.length });
    const clip = anim.clipIds[0];
    if (clip) {
      anim.playClip(clip, { loop: "repeat" });
      this.#started = true;
      this.diagnostics.info("anim.playing", { clip, active: anim.activeClipId });
    }
  }
  #find(key: string) { for (const e of this.queries.all.entities) if (e.getValue(AppEntityKey, "value") === key) return e; return null; }
}
