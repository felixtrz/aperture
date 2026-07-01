import { createSystem, material, mesh } from "@aperture-engine/app/systems";

// Two-camera split-screen (F13 repro): extraction yields 2 views with correct
// viewport rects, but `aperture render` renders these fractional viewports blank.
// Also exercises context.random.fork() independence.
export default class MultiSetup extends createSystem({ priority: 0 }) {
  override init(): void {
    this.spawn.camera({ key: "cam.a", transform: { translation: [0, 2, 8], lookAt: [0, 0, 0] }, fovYDegrees: 55, camera: { priority: 0, viewport: [0, 0, 0.5, 1] } });
    this.spawn.camera({ key: "cam.b", transform: { translation: [8, 2, 0], lookAt: [0, 0, 0] }, fovYDegrees: 55, camera: { priority: 1, viewport: [0.5, 0, 0.5, 1] } });
    this.spawn.light({ key: "light", kind: "ambient", intensity: 1 });
    this.spawn.mesh({ key: "cube", mesh: mesh.box({ size: [1, 1, 1] }), material: material.standard({ baseColor: [0.9, 0.4, 0.2, 1] }), transform: { translation: [0, 0, 0] } });
    const rngA = this.random.fork("stream-a");
    const rngB = this.random.fork("stream-b");
    this.diagnostics.info("fork.streams", {
      a: [rngA.int(1000), rngA.int(1000)],
      b: [rngB.int(1000), rngB.int(1000)],
    });
  }
}
