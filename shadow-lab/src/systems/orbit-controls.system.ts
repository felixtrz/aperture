import { createSystem } from "@aperture-engine/app/systems";

export default class OrbitControlsSystem extends createSystem({
  priority: 200,
}) {
  override update(): void {
    // Camera ownership is explicit in this lab:
    // - default: setup.system.ts uses the racing static camera pose;
    // - ?compare=three: compare/three-compare.ts drives both cameras.
  }
}
