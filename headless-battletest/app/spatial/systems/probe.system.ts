import { createSystem, material, mesh } from "@aperture-engine/app/systems";
export default class ProbeSystem extends createSystem({ priority: 0 }) {
  override init(): void {
    this.spawn.camera({ key: "cam", transform: { translation: [0, 0, 8], lookAt: [0, 0, 0] } });
    this.spawn.mesh({ key: "box", mesh: mesh.box({ size: [2, 2, 2] }), material: material.standard(), transform: { translation: [0, 0, 0] } });
  }
  override update(): void {
    // Ray from (0,0,5) toward -Z should hit the 2x2x2 box (front face at z=1) at dist 4.
    const hit = this.spatial.raycastFirst({ origin: [0, 0, 5], direction: [0, 0, -1] });
    const rd = this.signals.rayHitDist; if (rd) rd.value = hit ? hit.distance : -1;
    const ov = this.spatial.overlapSphere([0, 0, 0], 2);
    const oc = this.signals.overlapCount; if (oc) oc.value = ov.length;
    const cp = this.spatial.closestPoint([5, 0, 0]);
    const cd = this.signals.closestDist; if (cd) cd.value = cp ? cp.distance : -1;
  }
}
