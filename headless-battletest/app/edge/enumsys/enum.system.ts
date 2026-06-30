import { createSystem } from "@aperture-engine/app/systems";
enum Dir { Up, Down }
export default class EnumSystem extends createSystem({ priority: 0 }) {
  override update(): void { const d: Dir = Dir.Up; void d; }
}
