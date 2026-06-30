import { createSystem, material, mesh } from "@aperture-engine/app/systems";
export default class PickSystem extends createSystem({ priority: 0 }) {
  override init(): void {
    this.spawn.camera({ key: "cam", transform: { translation: [0, 0, 5], lookAt: [0, 0, 0] } });
    this.spawn.light({ key: "sun", kind: "directional", illuminance: 4 });
    this.spawn.mesh({ key: "target", mesh: mesh.box({ size: [2, 2, 2] }), material: material.standard() });
    this.interaction.onClick(() => {
      const c = this.signals.clicks; if (c) c.value = Number(c.value) + 1;
    });
    this.interaction.onDown(() => {
      const d = this.signals.downs; if (d) d.value = Number(d.value) + 1;
    });
  }
  override update(): void {
    const h = this.signals.hovering;
    if (h) h.value = this.interaction.hoveredEntity() !== null;
  }
}
