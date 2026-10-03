import { createSystem, material, mesh } from '/worker-modules/packages/app/dist/systems.js';
import { buildCottage, PALETTE, VIEWS } from './part-data.mjs';

export default class CottageSetup extends createSystem({ priority: 0 }) {
  init() {
    const options = { view: this.startOptions.string('view') ?? 'front', edit: this.startOptions.string('edit') ?? 'base' };
    const { parts, report } = buildCottage(options);
    const camera = VIEWS[options.view];
    this.spawn.camera({ key: 'camera.cottage', name: `Cottage ${options.view} view`,
      transform: { translation: camera.position, lookAt: camera.target },
      camera: { projection: 'orthographic', orthographicHeight: camera.height, aspect: 1,
        autoAspect: false, near: 0.1, far: 150, clearColor: [0.70, 0.68, 0.64, 1] } });
    this.spawn.light({ key: 'light.daylight-fill', name: 'Neutral daylight fill', kind: 'ambient',
      intensity: 0.65, color: [1, 0.98, 0.94, 1] });
    this.spawn.light({ key: 'light.daylight', name: 'Soft daylight', kind: 'directional',
      intensity: 4.2, color: [1, 0.98, 0.94, 1],
      transform: { translation: [-4.5, 11, 8], lookAt: [0, 0, 0] },
      shadow: { mapSize: 2048, cascadeCount: 1, shadowType: 2, strength: 0.72,
        filterRadius: 1, bias: 0.00015, normalBias: 0.012,
        center: [0, 1.2, 0], orthographicSize: 14, near: 0.1, far: 45, lightDistance: 20 } });
    for (const part of parts) {
      this.spawn.mesh({ key: part.name, name: part.name, tags: ['cottage', part.group],
        mesh: part.geometry.kind === 'box'
          ? mesh.box({ size: part.geometry.size })
          : part.geometry.kind === 'extrude'
            ? mesh.extrude({ label: part.name, outline: part.geometry.outline, holes: part.geometry.holes, depth: part.geometry.depth })
            : mesh.triangleList({ label: part.name, positions: part.geometry.positions }),
        material: material.standard({ baseColor: PALETTE[part.color], metallic: 0, roughness: part.roughness ?? 0.94 }),
        transform: { translation: part.center }, castShadow: part.castShadow !== false, receiveShadow: true });
    }
    // This report is emitted only after all authoritative ECS entities exist.
    globalThis.postMessage({ type: 'cottage-authored', report });
  }
}
