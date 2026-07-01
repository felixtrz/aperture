import { AppEntityKey, createSystem, material, mesh } from "@aperture-engine/app/systems";
export default class SpatialSystem extends createSystem({ priority: 0, queries: { all: { required: [AppEntityKey] } } }) {
  #done = false;
  override init(): void {
    this.spawn.camera({ key: "camera.main", transform: { translation: [0, 0, 6], lookAt: [0, 0, 0] }, fovYDegrees: 50 });
    this.spawn.light({ key: "l", kind: "ambient", intensity: 1 });
    this.spawn.mesh({ key: "target", mesh: mesh.box({ size: [1, 1, 1] }), material: material.standard({ baseColor: [1,0.4,0.2,1] }), transform: { translation: [0, 0, 0] } });
    this.spawn.mesh({ key: "offside", mesh: mesh.box({ size: [1, 1, 1] }), material: material.standard(), transform: { translation: [4, 0, 0] } });
  }
  override update(): void {
    if (this.#done || this.time.frame < 2) return;
    this.#done = true;
    const ray = this.cameras.main.rayFromPointer([0.5, 0.5]); // screen center -> points at 'target'
    const hit = this.spatial.raycastFirst(ray, { source: "visual-mesh" });
    let key = "none";
    if (hit) for (const e of this.queries.all.entities) if (e.index === hit.entity?.ref?.index) key = e.getValue(AppEntityKey,"value") ?? "?";
    const overlaps = this.spatial.overlapSphere([0, 0, 0], 1.5);
    this.diagnostics.info("spatial.result", { rayHitKey: key, hitSource: hit?.source ?? null, hitDistance: hit? Number(hit.distance?.toFixed?.(3) ?? hit.distance):null, overlapCount: overlaps.length });
  }
}
