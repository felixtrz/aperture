import { createSystem } from "@aperture-engine/app/systems";
export default class BoomSystem extends createSystem({ priority: 0 }) {
  override update(): void {
    throw new Error("intentional boom in update");
  }
}
