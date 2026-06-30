import { createSystem, material, mesh, shader } from "@aperture-engine/app/systems";
export default class WgslSystem extends createSystem({ priority: 0 }) {
  override init(): void {
    this.spawn.camera({ key: "cam", transform: { translation: [0, 0, 5], lookAt: [0, 0, 0] } });
    const inlineShader = shader.inlineWgsl(
      "@vertex fn vs_main() -> @builtin(position) vec4f { return vec4f(); }\n@fragment fn fs_main() -> @location(0) vec4f { return vec4f(1.0); }",
      { virtualPath: "inline-test.wgsl" },
    );
    this.spawn.mesh({
      key: "custom",
      mesh: mesh.box({ size: [1, 1, 1] }),
      material: material.customWgsl({
        familyKey: "app/test",
        label: "TestWgsl",
        shader: inlineShader,
        entryPoints: { vertex: "vs_main", fragment: "fs_main" },
        renderState: { cullMode: "none" },
      }),
    });
  }
}
