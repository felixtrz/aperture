import { createSystem } from "@aperture-engine/app/systems";
import type { SimulationFixedStepContext } from "@aperture-engine/app/systems";
export default class FixedSystem extends createSystem({ priority: 0 }) {
  override update(): void {
    const u = this.signals.updateTicks; if (u) u.value = Number(u.value) + 1;
  }
  override fixedUpdate(context: SimulationFixedStepContext): void {
    const f = this.signals.fixedTicks; if (f) f.value = Number(f.value) + 1;
    const d = this.signals.lastFixedDelta; if (d) d.value = context.fixedDelta;
  }
}
