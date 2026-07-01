import { AppEntityKey, createSystem } from "@aperture-engine/app/systems";

// F15 contrast: a NODE-transform-animated glTF (spinning cube) authored at the
// same 0.01 node scale (mesh-world determinant = 1e-6) that freezes SKINNING.
// Node animation writes the node's own LocalTransform via updateAnimationDrivers
// and renders through resolveWorldTransforms — it never touches the skin-palette
// inversion — so it should animate here where a skinned rig would freeze.
export default class NodeAnimSystem extends createSystem({ priority: 0, queries: { all: { required: [AppEntityKey] } } }) {
  #started = false;
  override init(): void {
    this.spawn.camera({ key: "camera.main", transform: { translation: [0, 0.6, 2.2], lookAt: [0, 0, 0] }, camera: { clearColor: [0.1, 0.12, 0.16, 1] } });
    this.spawn.light({ key: "sun", kind: "directional", illuminance: 6, transform: { rotationEulerDegrees: [-40, 30, 0] } });
    this.spawn.light({ key: "amb", kind: "ambient", intensity: 0.6 });
    this.spawn.gltf(this.assets.gltf("spincube"), { key: "spincube", transform: { translation: [0, 0, 0] } });
  }
  override update(): void {
    if (this.#started || this.time.frame < 1) return;
    const cube = this.#find("spincube");
    if (!cube) return;
    const anim = this.spawn.animation(cube);
    this.diagnostics.info("nodeanim.clips", { clipIds: anim.clipIds });
    const clip = anim.clipIds[0];
    if (clip) { anim.playClip(clip, { loop: "repeat" }); this.#started = true; this.diagnostics.info("nodeanim.playing", { clip, active: anim.activeClipId }); }
  }
  #find(key: string) { for (const e of this.queries.all.entities) if (e.getValue(AppEntityKey, "value") === key) return e; return null; }
}
