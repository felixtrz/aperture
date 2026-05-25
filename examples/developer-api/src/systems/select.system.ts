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
    this.effects.watch(this.input.actions.select.pressed, (pressed) => {
      if (!pressed) {
        return;
      }

      const [crate] = this.queries.crates.entities;
      if (crate === undefined) {
        this.diagnostics.warn("select.noTarget");
        return;
      }

      if (crate.hasComponent(DebugMetadata)) {
        crate.setValue(DebugMetadata, "tag", "input");
        crate.setValue(DebugMetadata, "note", "select.pressed");
      } else {
        crate.addComponent(DebugMetadata, {
          tag: "input",
          note: "select.pressed",
        });
      }

      this.diagnostics.info("select.pressed", {
        entity: crate.index,
        mutatedComponent: DebugMetadata.id,
      });
    });
  }
}
