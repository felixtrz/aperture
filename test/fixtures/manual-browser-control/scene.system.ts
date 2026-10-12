import {
  color,
  createSystem,
  defineResource,
  material,
  mesh,
  resource,
  LocalTransform,
} from "@aperture-engine/app/systems";
import {
  createMaterialHandle,
  createMeshHandle,
  type Entity,
} from "@aperture-engine/simulation";
import {
  createRoundedBoxMeshAsset,
  createStandardMaterialAsset,
} from "@aperture-engine/render";

export const Revision = defineResource("validation.manual.revision", {
  revision: resource.number(0),
});

export default class ManualControlScene extends createSystem() {
  #revision = 0;
  #prop: Entity | null = null;

  override init(): void {
    this.resources.read(Revision);
    this.spawn.camera({
      key: "camera.main",
      transform: { translation: [4, 3, 6], lookAt: [0, 0.5, 0] },
      camera: { near: 0.1, far: 60, frustumCulling: false },
    });
    this.spawn.mesh({
      key: "ground",
      mesh: mesh.box({ size: [8, 0.15, 8] }),
      material: material.standard({
        baseColor: color.srgbHex("#d2c9bb"),
        roughness: 0.9,
      }),
      transform: { translation: [0, -0.12, 0] },
      receiveShadow: true,
    });
    this.#prop = this.spawn.mesh({
      key: "prop",
      mesh: mesh.roundedBox({
        halfExtents: [0.7, 0.7, 0.7],
        radius: 0.16,
        bevelSegments: 3,
      }),
      material: material.standard({
        baseColor: color.srgbHex("#d65a30"),
        roughness: 0.55,
      }),
      transform: { translation: [0, 0.7, 0] },
      castShadow: true,
      receiveShadow: true,
    });
    this.spawn.light({
      key: "light.sun",
      kind: "directional",
      illuminance: 3.5,
      transform: { rotationEulerDegrees: [-45, 35, 0] },
      shadow: {
        mapSize: 512,
        cascadeCount: 1,
        shadowType: 1,
        strength: 0.65,
        filterRadius: 2,
        normalBias: 0.04,
      },
    });
  }

  override update(): void {
    const revision = this.resources.read(Revision).revision;
    if (revision === this.#revision) return;
    this.#revision = revision;
    this.assetsRegistry.markReady(
      createMeshHandle("prop.mesh"),
      createRoundedBoxMeshAsset({
        halfExtents: [1.2, 0.35, 0.7],
        radius: 0.14,
        bevelSegments: 3,
        label: "Updated rounded source geometry",
      }),
    );
    this.assetsRegistry.markReady(
      createMaterialHandle("prop.material"),
      createStandardMaterialAsset({
        baseColorFactor: color.srgbHex("#20b8ad"),
        metallicFactor: 0,
        roughnessFactor: 0.55,
        label: "Updated linear teal material",
      }),
    );
    this.#prop!.getVectorView(LocalTransform, "translation").set([
      0.35, 0.35, 0,
    ]);
  }
}
