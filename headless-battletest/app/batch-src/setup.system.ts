import { createSystem } from "@aperture-engine/app/systems";
import type { SpawnGltfBatchInstance } from "@aperture-engine/app/systems";

// Instanced-render probe: spawn a 4x4 grid of the same GLB via a single
// spawn.gltfBatch call, each instance at a distinct transform. Verifies the
// batch API returns one root per instance and that all instances extract as
// independent draws (the instanced/batched render path) headless.
export default class BatchScene extends createSystem({ priority: 0 }) {
  override init(): void {
    this.spawn.camera({ key: "camera.main", transform: { translation: [0, 7, 12], lookAt: [0, 0, 0] }, camera: { clearColor: [0.08, 0.09, 0.13, 1] } });
    this.spawn.light({ key: "sun", kind: "directional", illuminance: 6, transform: { rotationEulerDegrees: [-50, 25, 0] } });
    this.spawn.light({ key: "amb", kind: "ambient", intensity: 0.5 });

    const instances: SpawnGltfBatchInstance[] = [];
    for (let x = 0; x < 4; x += 1) {
      for (let z = 0; z < 4; z += 1) {
        instances.push({
          key: `blaster.${x}.${z}`,
          transform: { translation: [(x - 1.5) * 3, 0, (z - 1.5) * 3], rotationEulerDegrees: [0, (x * 4 + z) * 22, 0] },
        });
      }
    }
    const roots = this.spawn.gltfBatch(this.assets.gltf("blaster"), { tags: ["batch"], instances });
    this.diagnostics.info("batch.spawned", { requested: instances.length, roots: roots.length });
  }
}
