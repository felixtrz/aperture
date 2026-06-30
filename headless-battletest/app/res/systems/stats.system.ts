import { createSystem, defineResource, resource } from "@aperture-engine/app/systems";

export const SimStats = defineResource("sim.stats", {
  ticks: resource.number(0),
  accumulated: resource.number(0),
  label: resource.string("init"),
});

export default class StatsSystem extends createSystem({ priority: 0 }) {
  override init(): void {
    this.resources.write(SimStats, (next) => {
      next.label = "running";
    });
  }
  override update(delta: number): void {
    this.resources.write(SimStats, (next) => {
      next.ticks = next.ticks + 1;
      next.accumulated = next.accumulated + delta;
    });
  }
}
