import { EcsType, createSystem, material, mesh, shader } from "@aperture-engine/app/systems";
export default class WgslSetup extends createSystem({ priority: 0 }) {
  override init(): void {
    this.spawn.camera({ key: "camera.main", transform: { translation: [0, 0, 3], lookAt: [0, 0, 0] }, camera: { clearColor: [0.05, 0.05, 0.08, 1] } });
    this.spawn.light({ key: "fill", kind: "ambient", intensity: 1 });
    const water = this.assets.shader("water");
    this.spawn.mesh({
      key: "water.plane",
      tags: ["custom-wgsl"],
      mesh: mesh.plane({ size: [2, 1.2] }),
      material: material.customWgsl({
        familyKey: "test/water",
        label: "Water",
        shader: shader.asset(water),
        entryPoints: { vertex: "vs_main", fragment: "fs_main" },
        renderState: { cullMode: "none" },
        bindings: [
          material.uniform("water", { binding: 0, visibility: ["fragment"], fields: { color: { type: EcsType.Vec4, default: [0.1, 0.6, 0.95, 1] } } }),
        ],
      }),
      transform: { translation: [0, 0, 0] },
    });
    this.diagnostics.info("wgsl.shaderReady", { ready: water.ready.value });
  }
}
