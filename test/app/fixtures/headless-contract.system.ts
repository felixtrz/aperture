import { createSystem, material, mesh } from "@aperture-engine/app/systems";

export const lifecycle = {
  initialized: 0,
  destroyed: 0,
  destroy: async (): Promise<void> => {},
};

export default class ImportedScene extends createSystem({ priority: 7 }) {
  override init(): void {
    lifecycle.initialized += 1;
    this.spawn.camera({
      key: "headless.contract.camera",
      transform: { translation: [0, 0, 4], lookAt: [0, 0, 0] },
    });
    this.spawn.mesh({
      key: "headless.contract.mesh",
      mesh: mesh.box({ size: [1, 1, 1] }),
      material: material.standard(),
    });
  }

  override async destroy(): Promise<void> {
    super.destroy();
    lifecycle.destroyed += 1;
    await lifecycle.destroy();
  }
}
