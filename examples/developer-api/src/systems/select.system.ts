import {
  DebugMetadata,
  Name,
  createSystem,
} from "@aperture-engine/app/systems";

// M7-T8: the public pointer-on-object ergonomics replace the manual
// rayFromPointer + raycastFirst flow. A click on a crate (an entity in the
// `crates` query) selects it — the interaction layer does the ray + pick + the
// click-vs-drag discrimination; this system only reacts to the resulting event.
export default class SelectSystem extends createSystem({
  priority: 50,
  queries: {
    crates: {
      required: [Name],
      where: [{ component: Name, key: "value", op: "eq", value: "crate" }],
    },
  },
}) {
  override init(): void {
    this.interaction.onClick(
      (ref) =>
        [...this.queries.crates.entities].some(
          (entity) =>
            entity.index === ref.index && entity.generation === ref.generation,
        ),
      (event) => {
        const selected = [...this.queries.crates.entities].find(
          (entity) =>
            entity.index === event.entity.index &&
            entity.generation === event.entity.generation,
        );

        if (selected === undefined) {
          this.diagnostics.warn("select.noTarget");
          return;
        }

        const selectedSignal = this.signals.selectedEntity;
        if (selectedSignal !== undefined) {
          selectedSignal.value = event.entity;
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
          selectedEntity: event.entity,
          ...(event.point === undefined ? {} : { hitPoint: event.point }),
          mutatedComponent: DebugMetadata.id,
        });
      },
    );
  }
}
