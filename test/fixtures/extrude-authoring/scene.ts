import {
  createSystem,
  material,
  mesh,
  type ExtrudeMeshDescriptorOptions,
} from "@aperture-engine/app/systems";

/** One continuous facade, with a door notch and a separate window opening. */
export const facade: ExtrudeMeshDescriptorOptions = {
  label: "Cottage facade",
  outline: [
    [0, 0],
    [3, 0],
    [3, 2.5],
    [5, 2.5],
    [5, 0],
    [8, 0],
    [8, 5],
    [4, 7],
    [0, 5],
  ],
  holes: [
    [
      [0.5, 2],
      [2.5, 2],
      [2.5, 4],
      [0.5, 4],
    ],
  ],
  depth: 0.4,
};
export default class ExtrudeAuthoringScene extends createSystem() {
  override init(): void {
    this.spawn.mesh({
      key: "facade",
      mesh: mesh.extrude(facade),
      material: material.standard({
        baseColor: [0.7, 0.5, 0.3, 1],
        roughness: 0.8,
      }),
      castShadow: true,
      receiveShadow: true,
    });
    this.spawn.mesh({
      key: "ground",
      mesh: mesh.plane({ size: 24 }),
      material: material.standard({ baseColor: [0.25, 0.3, 0.2, 1] }),
      receiveShadow: true,
    });
    this.spawn.camera({
      key: "camera",
      camera: { frustumCulling: false },
      transform: { translation: [12, 8, 14], lookAt: [4, 3, 0] },
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
