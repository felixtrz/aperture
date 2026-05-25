import { createSystem } from "@aperture-engine/app/systems";

export const schedule = { priority: 50 };

export default class SelectSystem extends createSystem() {
  override init(): void {
    this.effects.watch(this.input.actions.select.pressed, (pressed) => {
      if (pressed) {
        this.diagnostics.info("select.pressed");
      }
    });
  }
}
