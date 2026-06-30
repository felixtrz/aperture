import { createSystem } from "@aperture-engine/app/systems";
export default class B extends createSystem({ priority: 0 }) {
  override init(): void { throw new Error("boom in init"); }
}
