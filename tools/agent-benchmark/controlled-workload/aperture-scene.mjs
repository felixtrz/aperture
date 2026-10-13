import { createSystem } from "@aperture-engine/app/systems";
import {
  createMaterialHandle,
  createMeshHandle,
  createSamplerHandle,
  createTextureHandle,
} from "@aperture-engine/simulation";
import {
  createSamplerAsset,
  createStandardMaterialAsset,
  createTextureAsset,
  createTriangleListMeshAsset,
} from "@aperture-engine/render";
import workload from "./workload.json";
import { typedGeometry } from "./scene.mjs";

export default class ControlledScene extends createSystem({ priority: 0 }) {
  init() {
    const { settings } = workload;
    const { camera } = settings;
    this.spawn.camera({
      key: "camera.main",
      transform: { translation: camera.position, lookAt: camera.target },
      fovYDegrees: camera.fovYDegrees,
      camera: {
        near: camera.near,
        far: camera.far,
        frustumCulling: camera.frustumCulling,
      },
    });
    const sunPosition = settings.sun.directionToLight.map(
      (value, axis) =>
        settings.shadow.center[axis] + value * settings.shadow.lightDistance,
    );
    this.spawn.light({
      key: "light.sun",
      kind: "directional",
      color: [...settings.sun.color, 1],
      intensity: settings.sun.intensity,
      transform: { translation: sunPosition, lookAt: settings.shadow.center },
      ...(settings.shadow.enabled ? { shadow: settings.shadow } : {}),
    });
    this.spawn.light({
      key: "light.ambient",
      kind: "ambient",
      color: [...settings.ambient.color, 1],
      intensity: settings.ambient.intensity,
    });

    const register = (handle, asset) => {
      this.assetsRegistry.register(handle);
      this.assetsRegistry.markReady(handle, asset);
      return handle;
    };
    const sampler = register(
      createSamplerHandle("controlled.surface-sampler"),
      createSamplerAsset({
        label: "Controlled nonmipmapped linear repeat",
        addressModeU: "repeat",
        addressModeV: "repeat",
        magFilter: "linear",
        minFilter: "linear",
        mipmapFilter: "nearest",
      }),
    );
    const textures = new Map(
      workload.textures.map((source) => [
        source.id,
        register(
          createTextureHandle(`controlled.${source.id}`),
          createTextureAsset({
            label: source.id,
            dimension: "2d",
            width: source.width,
            height: source.height,
            format: "rgba8unorm-srgb",
            colorSpace: "srgb",
            semantic: "base-color",
            sourceData: {
              bytes: Uint8Array.from(source.bytes),
              bytesPerRow: source.width * 4,
            },
          }),
        ),
      ]),
    );
    const materials = new Map(
      workload.materials.map((source) => [
        source.id,
        register(
          createMaterialHandle(`controlled.${source.id}`),
          createStandardMaterialAsset({
            label: source.id,
            baseColorFactor: source.color,
            metallicFactor: source.metallic,
            roughnessFactor: source.roughness,
            baseColorTexture: source.texture
              ? { texture: textures.get(source.texture), sampler }
              : null,
          }),
        ),
      ]),
    );
    const meshes = new Map(
      workload.geometries.map((source) => [
        source.id,
        register(
          createMeshHandle(`controlled.${source.id}`),
          createTriangleListMeshAsset({
            ...typedGeometry(source),
            label: source.id,
          }),
        ),
      ]),
    );
    for (const source of workload.instances)
      this.spawn.mesh({
        key: source.id,
        mesh: meshes.get(source.geometry),
        material: materials.get(source.material),
        transform: {
          translation: source.translation,
          rotation: source.rotation,
          scale: source.scale,
        },
        castShadow: settings.shadow.enabled && source.castShadow,
        receiveShadow: settings.shadow.enabled && source.receiveShadow,
      });
  }
}
