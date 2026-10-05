import {
  createExtractionApp,
  withTransform,
  withCamera,
  withMesh,
  withMaterial,
} from "/worker-modules/packages/runtime/dist/index.js";
import {
  createBoxMeshAsset,
  createRenderAssetCollections,
  createUnlitMaterialAsset,
} from "/worker-modules/packages/render/dist/index.js";
import { meshBytes } from "./contract.mjs";
export function createProbeScene(cold = false) {
  const app = createExtractionApp({ worldOptions: { entityCapacity: 8 } });
  const assets = createRenderAssetCollections({ registry: app.assets });
  const baseline = createBoxMeshAsset({ label: "Sideband box baseline" });
  const changed = createBoxMeshAsset({
    label: "Sideband box changed",
    width: 2,
    height: 2,
    depth: 2,
  });
  const mesh = assets.meshes.add(baseline);
  const material = assets.materials.unlit.add(
    createUnlitMaterialAsset({ baseColorFactor: [0.8, 0.24, 0.06, 1] }),
  );
  app.spawn(
    withTransform({ translation: [0, 0, 5] }),
    withCamera({ clearColor: [0.08, 0.11, 0.16, 1] }),
  );
  app.spawn(withTransform(), withMesh(mesh), withMaterial(material));
  const change = () => app.assets.markReady(mesh, changed);
  if (cold) change();
  return {
    app,
    mesh,
    material,
    change,
    baseline: meshBytes(baseline),
    changed: meshBytes(changed),
  };
}
