import { AppEntityKey, LocalTransform, createSystem, material, mesh } from "@aperture-engine/app/systems";

export default class TreeSystem extends createSystem({
  priority: 0,
  queries: { all: { required: [AppEntityKey] } },
}) {
  #parentRef: { index: number; generation: number } | null = null;
  #despawned = false;

  override init(): void {
    this.spawn.camera({ key: "cam", transform: { translation: [0, 2, 6], lookAt: [0, 0, 0] } });
    const parent = this.spawn.mesh({
      key: "tree.parent",
      tags: ["tree"],
      mesh: mesh.box({ size: [1, 1, 1] }),
      material: material.standard(),
      transform: { translation: [0, 0, 0] },
    });
    this.#parentRef = { index: parent.index, generation: parent.generation };
    for (let i = 0; i < 3; i += 1) {
      this.spawn.mesh({
        key: `tree.child.${i}`,
        tags: ["tree", "child"],
        mesh: mesh.box({ size: [0.3, 0.3, 0.3] }),
        material: material.standard(),
        transform: { translation: [i - 1, 1, 0], parent },
      });
    }
  }

  override update(): void {
    if (!this.#despawned && this.time.frame >= 10 && this.#parentRef) {
      this.hierarchy.despawnRecursive(this.#parentRef);
      this.#despawned = true;
    }
  }
}
