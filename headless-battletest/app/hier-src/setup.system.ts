import {
  createSystem,
  material,
  mesh,
  serializeEntityRef,
} from "@aperture-engine/app/systems";

// Verifies parent/child transform composition and despawnRecursive on a subtree.
// A parent bar is translated to x=5 and rotated 90° about Z; three children sit
// at local +y offsets, so their WORLD positions should compose parent∘child.
// On frame 60 we despawn the whole subtree and confirm only camera/light remain.
export default class HierSetupSystem extends createSystem({ priority: 0 }) {
  private parentRef: string | null = null;
  private parentEntity: { index: number; generation: number } | null = null;

  override init(): void {
    this.spawn.camera({
      key: "camera.main",
      transform: { translation: [0, 2, 12], lookAt: [0, 0, 0] },
      fovYDegrees: 55,
    });
    this.spawn.light({ key: "light", kind: "ambient", intensity: 1 });

    const parent = this.spawn.mesh({
      key: "parent",
      tags: ["hier"],
      mesh: mesh.box({ size: [0.5, 0.5, 0.5] }),
      material: material.standard({ baseColor: [1, 0.5, 0.2, 1] }),
      transform: { translation: [5, 0, 0], rotationEulerDegrees: [0, 0, 90] },
    });
    this.parentRef = serializeEntityRef(parent);
    this.parentEntity = { index: parent.index, generation: parent.generation };

    for (let i = 0; i < 3; i += 1) {
      this.spawn.mesh({
        key: `child.${i}`,
        tags: ["hier", "child"],
        mesh: mesh.box({ size: [0.3, 0.3, 0.3] }),
        material: material.standard({ baseColor: [0.2, 0.6, 1, 1] }),
        transform: { translation: [0, 1 + i, 0], parent },
      });
    }
  }

  override update(): void {
    if (this.time.frame === 60 && this.parentRef !== null) {
      // (A) serializeEntityRef() STRING — expected to be rejected.
      const viaString = this.hierarchy.despawnRecursive(
        this.parentRef as unknown as { index: number; generation: number },
      );
      this.diagnostics.info("hier.viaString", {
        despawned: viaString.despawned,
        ok: viaString.ok,
        diag: viaString.diagnostic?.code ?? null,
      });
      this.parentRef = null;
    }
    if (this.time.frame === 61 && this.parentEntity !== null) {
      // (B) { index, generation } OBJECT — the documented EcsEntityRef shape.
      const viaObject = this.hierarchy.despawnRecursive(this.parentEntity);
      this.diagnostics.info("hier.viaObject", {
        despawned: viaObject.despawned,
        ok: viaObject.ok,
      });
      this.parentEntity = null;
    }
  }
}
