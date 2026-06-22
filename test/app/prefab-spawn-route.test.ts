import { describe, expect, it } from "vitest";
import {
  createApertureHeadlessRunner,
  type ApertureHeadlessRunner,
} from "@aperture-engine/app/headless";
import {
  WorldTransform,
  createSystem,
  material,
  mesh,
} from "@aperture-engine/app/systems";
import { defineApertureConfig } from "@aperture-engine/app/config";
import type { ApertureSystemModule } from "@aperture-engine/app/advanced";
import {
  APERTURE_SCENE_FORMAT_VERSION,
  serializeEntityComponents,
  serializeEntityRef,
  type ApertureSceneDocument,
  type Entity,
} from "@aperture-engine/simulation";

// M7-T5 Done-when #4: a render-control route spawns 2 prefab instances and the
// snapshot shows the expected meshDraws count + distinct world positions.

const SetupSystem: ApertureSystemModule = {
  default: class PrefabSetupSystem extends createSystem({ priority: 0 }) {
    override init(): void {
      this.spawn.camera({
        key: "camera.main",
        transform: { translation: [0, 2, 8], lookAt: [0, 0, 0] },
      });
      this.spawn.light({
        key: "light.key",
        kind: "directional",
        illuminance: 4,
        transform: { rotationEulerDegrees: [-45, 35, 0] },
      });
    }
  },
};

async function createRunner(): Promise<ApertureHeadlessRunner> {
  return createApertureHeadlessRunner({
    config: defineApertureConfig({
      mode: "headless",
      systems: [],
      render: { defaultCamera: false, defaultLight: false },
    }),
    systems: [SetupSystem],
  });
}

function buildPrefabFromTemplate(template: Entity): ApertureSceneDocument {
  return {
    formatVersion: APERTURE_SCENE_FORMAT_VERSION,
    entities: [
      {
        id: serializeEntityRef(template),
        components: serializeEntityComponents(template),
      },
    ],
  };
}

function worldTranslation(entity: Entity): [number, number, number] {
  const col3 = entity.getVectorView(WorldTransform, "col3");
  return [col3[0] ?? 0, col3[1] ?? 0, col3[2] ?? 0];
}

describe("spawn.prefab render-control route (M7-T5)", () => {
  it("spawns 2 prefab instances with the expected meshDraws and distinct positions", async () => {
    const runner = await createRunner();
    const context = runner.app.context;

    // Build a 1-mesh prefab from a template entity, then drop the template so
    // only the instances render. The mesh/material assets stay registered.
    const template = context.spawn.mesh({
      mesh: mesh.box({ size: [1, 1, 1] }),
      material: material.standard({ baseColor: [0.8, 0.3, 0.2, 1] }),
      transform: { translation: [0, 0, 0] },
    });
    const document = buildPrefabFromTemplate(template);
    template.destroy();

    const handle = context.prefabs.register(document);

    const left = context.spawn.prefab(handle, {
      key: "prefab.left",
      transform: { translation: [-2, 0, 0] },
    });
    const right = context.spawn.prefab(handle, {
      key: "prefab.right",
      transform: { translation: [2, 0, 0] },
    });

    const snapshot = runner.step(1 / 60, 0).snapshot;

    expect(snapshot.views).toHaveLength(1);
    expect(snapshot.meshDraws).toHaveLength(2);

    const leftPosition = worldTranslation(left);
    const rightPosition = worldTranslation(right);
    expect(leftPosition[0]).toBeCloseTo(-2, 5);
    expect(rightPosition[0]).toBeCloseTo(2, 5);
    expect(leftPosition).not.toEqual(rightPosition);
  });
});
