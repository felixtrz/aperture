import {
  createSystem,
  material,
  mesh,
  type TriangleListMeshDescriptorOptions,
} from "@aperture-engine/app/systems";

/** A closed, outward-wound triangular prism: two gables and three sides. */
export const roof: TriangleListMeshDescriptorOptions = {
  label: "Low-poly roof",
  positions: [
    [-1, 0, 1],
    [1, 0, 1],
    [0, 1, 1],
    [-1, 0, -1],
    [1, 0, -1],
    [0, 1, -1],
  ],
  indices: [
    0, 1, 2, 3, 5, 4, 0, 3, 4, 0, 4, 1, 0, 2, 5, 0, 5, 3, 1, 4, 5, 1, 5, 2,
  ],
};

/** Explicit normals share the four vertices of a smooth sloping surface. */
export const ramp: TriangleListMeshDescriptorOptions = {
  label: "Ramp surface",
  positions: [
    [0, 0, 0],
    [2, 1, 0],
    [2, 1, -1],
    [0, 0, -1],
  ],
  indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
  normals: [
    [-1, 2, 0],
    [-1, 2, 0],
    [-1, 2, 0],
    [-1, 2, 0],
  ],
  uvs: [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ],
};

export default class TriangleAuthoringScene extends createSystem() {
  override init(): void {
    const group = this.spawn.group({
      key: "triangle.assembly",
      transform: { translation: [0, 0.5, 0] },
    });
    this.spawn.mesh({
      key: "triangle.roof",
      mesh: mesh.triangleList(roof),
      material: material.standard({ baseColor: [0.6, 0.16, 0.07, 1] }),
      transform: { parent: group, translation: [-2, 0, 0] },
      castShadow: true,
      receiveShadow: true,
    });
    this.spawn.mesh({
      key: "triangle.ramp",
      mesh: mesh.triangleList(ramp),
      material: material.standard({ baseColor: [0.25, 0.4, 0.55, 1] }),
      transform: { parent: group, translation: [1, 0, 0] },
      castShadow: true,
      receiveShadow: true,
    });
    this.spawn.gltf(this.assets.gltf("model"), {
      key: "triangle.imported",
      transform: { parent: group, translation: [0, 0, -3] },
    });
    this.spawn.light({
      key: "sun",
      kind: "directional",
      intensity: 3,
      shadow: true,
    });
  }
}
