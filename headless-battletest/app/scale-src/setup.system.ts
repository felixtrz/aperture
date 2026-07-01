import { createSystem, material, mesh } from "@aperture-engine/app/systems";
const N = 600; // 600 cubes in a grid
export default class ScaleSetup extends createSystem({ priority: 0 }) {
  override init(): void {
    this.spawn.camera({ key: "camera.main", transform: { translation: [0, 40, 90], lookAt: [0, 0, 0] }, fovYDegrees: 60, camera: { clearColor: [0.02,0.02,0.05,1] } });
    this.spawn.light({ key: "light", kind: "directional", illuminance: 4, transform: { rotationEulerDegrees: [-50, 30, 0] } });
    const side = Math.ceil(Math.sqrt(N));
    for (let i = 0; i < N; i += 1) {
      const gx = (i % side) - side / 2;
      const gz = Math.floor(i / side) - side / 2;
      this.spawn.mesh({
        key: `cube.${i}`,
        tags: ["cube"],
        mesh: mesh.box({ size: [0.8, 0.8, 0.8] }),
        material: material.standard({ baseColor: [(i % 7) / 7, (i % 5) / 5, 0.6, 1] }),
        transform: { translation: [gx * 1.5, 0, gz * 1.5] },
      });
    }
  }
}
