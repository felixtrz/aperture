import {
  DebugMetadata,
  Name,
  createSystem,
} from "@aperture-engine/app/systems";

export const schedule = { priority: 50 };

const SelectSystemBase = createSystem({
  crates: {
    required: [Name],
    where: [{ component: Name, key: "value", op: "eq", value: "crate" }],
  },
});

export default class SelectSystem extends SelectSystemBase {
  override init(): void {
    const select = this.input.actions.select;
    if (select === undefined) {
      this.diagnostics.warn("select.actionMissing");
      return;
    }

    this.effects.watch(select.pressed, (pressed) => {
      if (!pressed) {
        return;
      }

      const [crate] = this.queries.crates.entities;
      const ray = this.cameras.main.rayFromPointer(
        this.input.pointer.primary.position.value,
      );
      const hit = this.spatial.raycastFirst(ray, {
        query: this.queries.crates,
        source: "bounds",
        maxDistance: 5,
      });

      if (crate === undefined || hit === null) {
        this.diagnostics.warn("select.noTarget");
        return;
      }

      const selected = hit.entity.entity;
      const selectedSignal = this.signals.selectedEntity;
      if (selectedSignal !== undefined) {
        selectedSignal.value = hit.entity.ref;
      }

      if (selected.hasComponent(DebugMetadata)) {
        selected.setValue(DebugMetadata, "tag", "input");
        selected.setValue(DebugMetadata, "note", "select.pressed");
      } else {
        selected.addComponent(DebugMetadata, {
          tag: "input",
          note: "select.pressed",
        });
      }

      this.diagnostics.info("select.pressed", {
        entity: selected.index,
        selectedEntity: hit.entity.ref,
        hitDistance: hit.distance,
        hitPoint: hit.point,
        mutatedComponent: DebugMetadata.id,
      });
    });
  }
}
