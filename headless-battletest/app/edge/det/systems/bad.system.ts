import { createSystem } from "@aperture-engine/app/systems";
export default class BadGlobalsSystem extends createSystem({ priority: 0 }) {
  override init(): void {
    // nondeterministic global in init
    if (new Date().getFullYear() < 0) console.log("never");
  }
  override update(): void {
    const t = performance.now();
    if (t < 0) console.log("never", t);
  }
}
