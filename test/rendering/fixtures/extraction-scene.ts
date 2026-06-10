import {
  AssetRegistry,
  WorldTransform,
  createMaterialHandle,
  createMeshHandle,
  createRootTransform,
  createWorld,
  registerMetadataComponents,
  registerTransformComponents,
} from "@aperture-engine/simulation";
import {
  Camera,
  Material,
  Mesh,
  RenderLayer,
  Visibility,
  createBoxMeshAsset,
  createCamera,
  createUnlitMaterialAsset,
  registerRenderAuthoringComponents,
} from "@aperture-engine/render";

export interface ExtractionScene {
  readonly world: ReturnType<typeof createWorld>;
  readonly assets: AssetRegistry;
  readonly entityCount: number;
}

/**
 * Deterministic N-entity scene for benchmarks and budget tests (AI-76): one
 * camera plus `entityCount` unlit box mesh entities laid out on a fixed grid,
 * all sharing one ready mesh + material asset. The same input always produces
 * the same snapshot counts, so timing harnesses can assert structure while
 * keeping time thresholds generous.
 */
export function buildExtractionScene(entityCount: number): ExtractionScene {
  const world = createWorld({ entityCapacity: entityCount + 8 });
  registerTransformComponents(world);
  registerMetadataComponents(world);
  registerRenderAuthoringComponents(world);

  const assets = new AssetRegistry();
  const mesh = createMeshHandle("bench-cube");
  const material = createMaterialHandle("bench-unlit");
  assets.register(mesh);
  assets.register(material);
  assets.markReady(mesh, createBoxMeshAsset({ label: "BenchCube" }));
  assets.markReady(material, createUnlitMaterialAsset({ label: "BenchUnlit" }));

  const camera = world.createEntity();
  camera.addComponent(
    WorldTransform,
    createRootTransform({ translation: [0, 0, 50] }).world,
  );
  camera.addComponent(Camera, createCamera({ priority: 0, layerMask: 1 }));

  const gridSide = Math.max(1, Math.ceil(Math.cbrt(entityCount)));

  for (let index = 0; index < entityCount; index += 1) {
    const x = index % gridSide;
    const y = Math.floor(index / gridSide) % gridSide;
    const z = Math.floor(index / (gridSide * gridSide));
    const entity = world.createEntity();

    entity.addComponent(
      WorldTransform,
      createRootTransform({
        translation: [x * 2 - gridSide, y * 2 - gridSide, -z * 2],
      }).world,
    );
    entity.addComponent(Mesh, { meshId: "mesh:bench-cube" });
    entity.addComponent(Material, { materialId: "material:bench-unlit" });
    entity.addComponent(RenderLayer, { mask: 1 });
    entity.addComponent(Visibility);
  }

  return { world, assets, entityCount };
}
