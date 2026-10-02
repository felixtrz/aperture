import {
  createSystem,
  material,
  mesh,
  type LatheMeshDescriptorOptions,
} from "@aperture-engine/app/systems";

export const bowl: LatheMeshDescriptorOptions = {
  label: "Thick bowl",
  radialSegments: 12,
  profile: [
    [0, 0],
    [1, 0],
    [1.2, 1],
    [1, 1],
    [0.8, 0.2],
    [0, 0.2],
  ],
};
export const column: LatheMeshDescriptorOptions = {
  label: "Faceted column",
  radialSegments: 12,
  profile: [
    [0, 0],
    [0.8, 0],
    [0.6, 0.2],
    [0.6, 2.8],
    [0.8, 3],
    [0, 3],
  ],
};

export default class LatheAuthoringScene extends createSystem() {
  override init(): void {
    for (const [key, options, x] of [
      ["bowl", bowl, 1.7],
      ["column", column, -1.7],
    ] as const) {
      this.spawn.mesh({
        key,
        mesh: mesh.lathe(options),
        material: material.standard({
          baseColor: key === "bowl" ? [0.55, 0.2, 0.1, 1] : [0.7, 0.65, 0.5, 1],
          roughness: 0.7,
        }),
        transform: { translation: [x, 0, 0] },
        castShadow: true,
        receiveShadow: true,
      });
    }
    this.spawn.mesh({
      key: "ground",
      mesh: mesh.plane({ size: 12 }),
      material: material.standard({ baseColor: [0.25, 0.3, 0.2, 1] }),
      receiveShadow: true,
    });
    this.spawn.camera({
      key: "camera",
      camera: { frustumCulling: false },
      transform: { translation: [6, 5, 9], lookAt: [0, 1, 0] },
    });
    this.spawn.light({
      key: "sun",
      kind: "directional",
      intensity: 3,
      shadow: true,
      transform: { rotationEulerDegrees: [-55, -30, 0] },
    });
  }
}
