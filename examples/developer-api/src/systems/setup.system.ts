import {
  EcsType,
  createSystem,
  material,
  mesh,
  shader,
} from "@aperture-engine/app/systems";

export default class SetupSystem extends createSystem({
  priority: 0,
}) {
  override init(): void {
    this.spawn.camera({
      key: "camera.main",
      name: "main-camera",
      transform: {
        translation: [0, 1.5, 5],
        lookAt: [0, 0.75, 0],
      },
      fovYDegrees: 60,
      camera: {
        clearColor: [0.03, 0.035, 0.04, 1],
      },
    });

    this.spawn.light({
      key: "light.key",
      name: "key-light",
      kind: "directional",
      illuminance: 4,
      transform: {
        rotationEulerDegrees: [-45, 35, 0],
      },
    });

    this.spawn.light({
      key: "light.fill",
      name: "fill-light",
      kind: "ambient",
      intensity: 0.75,
    });

    const crate = this.spawn.mesh({
      key: "level.crate.primary",
      name: "crate",
      tags: ["interactive", "crate"],
      mesh: mesh.box({ size: [1, 1, 1] }),
      material: material.standard({
        baseColor: [1, 0.55, 0.25, 1],
        roughness: 0.55,
        metallic: 0.05,
      }),
      transform: { translation: [-1, 0.5, 0] },
    });
    this.spatial.setBounds([
      {
        entity: crate,
        worldAabb: {
          min: [0.2, 0.45, -1],
          max: [0.3, 0.55, 1],
        },
      },
    ]);

    this.spawn.gltf(this.assets.gltf("robot"), {
      key: "level.robot",
      name: "robot",
      tags: ["asset", "robot"],
      transform: { translation: [1, 0, 0] },
    });

    const generatedWaterShader = this.assets.shader("generatedWater");

    if (generatedWaterShader.ready.value) {
      this.spawn.mesh({
        key: "level.custom.water",
        name: "generated custom water",
        tags: ["custom-wgsl", "shader-asset"],
        mesh: mesh.plane({ size: [1.3, 0.7] }),
        material: material.customWgsl({
          familyKey: "example/generated-water",
          label: "Generated Water",
          shader: shader.asset(generatedWaterShader),
          entryPoints: { vertex: "vs_main", fragment: "fs_main" },
          renderState: { cullMode: "none" },
          bindings: [
            material.uniform("water", {
              binding: 0,
              visibility: ["fragment"],
              fields: {
                color: { type: EcsType.Vec4, default: [0.02, 0.58, 0.95, 1] },
              },
            }),
          ],
        }),
        transform: { translation: [0, 0.65, -0.9] },
      });
    }
  }
}
