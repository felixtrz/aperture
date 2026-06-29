import { createSystem } from "@aperture-engine/app/systems";

export default class NondeterministicSystem extends createSystem({
  priority: 0,
}) {
  override update(): void {
    void Math.random();
  }
}
