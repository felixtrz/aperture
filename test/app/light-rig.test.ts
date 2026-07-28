import { describe, expect, it } from "vitest";

import { createApertureApp, defineApertureConfig } from "@aperture-engine/app";
import {
  LIGHT_RIG_PRESETS,
  createSystem,
  type SpawnedLightRig,
} from "@aperture-engine/app/systems";
import { Light, LightShadowSettings } from "@aperture-engine/render";
import {
  createEnvironmentMapHandle,
  createTextureHandle,
  type Entity,
  type EnvironmentMapHandle,
} from "@aperture-engine/simulation";

describe("ECS lighting presets", () => {
  it("spawns inspectable studio entities and tears down everything it owns", async () => {
    const refs: { rig: SpawnedLightRig | null } = { rig: null };
    const environment = createEnvironmentMapHandle("studio-neutral");

    class LightingSetupSystem extends createSystem({ priority: 0 }) {
      override init(): void {
        this.assetsRegistry.register(environment);
        this.assetsRegistry.markReady(environment, { kind: "rgbe-fixture" });
        this.spawn.camera({ key: "camera.main" });
        refs.rig = this.spawn.lightRig({
          key: "lighting.presentation",
          preset: "studio-neutral",
          environmentMap: environment,
          shadows: true,
          keyLight: { intensity: 4.25 },
        });
      }
    }

    const app = await createApertureApp({
      config: defineApertureConfig({
        mode: "headless",
        render: { defaultCamera: false, defaultLight: false },
      }),
      systems: [{ default: LightingSetupSystem }],
    });
    const snapshot = app.extract(1);
    const rig = refs.rig;

    expect(rig).not.toBeNull();
    expect(LIGHT_RIG_PRESETS["studio-neutral"]).toMatchObject({
      environment: { intensity: 1 },
      keyLight: { kind: "directional", intensity: 3 },
      rimLight: { kind: "rect-area", intensity: 1.5 },
    });
    expect(rig?.lights).toHaveLength(3);
    expect(snapshot.environments).toEqual([
      expect.objectContaining({ handle: environment, intensity: 1 }),
    ]);
    expect(snapshot.lights.map((light) => light.kind).sort()).toEqual([
      "directional",
      "rect-area",
    ]);
    const key = rig?.lights.find(
      (entity) => entity.getValue(Light, "kind") === "directional",
    );
    expect(key?.getValue(Light, "intensity")).toBeCloseTo(4.25);
    expect(key?.getValue(LightShadowSettings, "enabled")).toBe(true);

    rig?.remove();
    expect(rig?.root.active).toBe(false);
    expect(rig?.lights.every((entity) => !entity.active)).toBe(true);
    const afterRemoval = app.extract(2);
    expect(afterRemoval.environments).toEqual([]);
    expect(afterRemoval.lights).toEqual([]);
  });

  it("authors direct environment lights through normal ECS inspection", async () => {
    const refs: { environment: Entity | null } = { environment: null };
    const source = createEnvironmentMapHandle("warehouse");

    class EnvironmentSetupSystem extends createSystem({ priority: 0 }) {
      override init(): void {
        this.assetsRegistry.register(source);
        this.assetsRegistry.markReady(source, { kind: "rgbe-fixture" });
        refs.environment = this.spawn.environment({
          key: "lighting.environment",
          source,
          intensity: 0.75,
          color: [0.9, 0.95, 1, 1],
        });
      }
    }

    const app = await createApertureApp({
      config: defineApertureConfig({
        mode: "headless",
        render: { defaultCamera: false, defaultLight: false },
      }),
      systems: [{ default: EnvironmentSetupSystem }],
    });
    const snapshot = app.extract(1);

    expect(refs.environment?.getValue(Light, "kind")).toBe("environment");
    expect(refs.environment?.getValue(Light, "environmentMapId")).toBe(
      "environment-map:warehouse",
    );
    expect(refs.environment?.getValue(Light, "intensity")).toBeCloseTo(0.75);
    expect(snapshot.environments).toEqual([
      expect.objectContaining({ handle: source, intensity: 0.75 }),
    ]);
  });

  it("keeps illuminance compatible while diagnosing deprecation and conflicts", async () => {
    let light: Entity | null = null;

    class LegacyLightSystem extends createSystem({ priority: 0 }) {
      override init(): void {
        light = this.spawn.light({ illuminance: 9, intensity: 2 });
      }
    }

    const app = await createApertureApp({
      config: defineApertureConfig({
        mode: "headless",
        render: { defaultCamera: false, defaultLight: false },
      }),
      systems: [{ default: LegacyLightSystem }],
    });

    const spawnedLight = light as Entity | null;
    expect(spawnedLight).not.toBeNull();
    expect(spawnedLight?.getValue(Light, "intensity")).toBe(2);
    expect(
      app.context.diagnostics.list().map((diagnostic) => diagnostic.code),
    ).toEqual([
      "aperture.spawn.lightIntensityConflict",
      "aperture.spawn.illuminanceDeprecated",
    ]);
  });

  it("rejects invalid environment asset kinds with an authoring code", async () => {
    class InvalidEnvironmentSystem extends createSystem({ priority: 0 }) {
      override init(): void {
        this.spawn.environment({
          source: createTextureHandle(
            "not-an-environment",
          ) as unknown as EnvironmentMapHandle,
        });
      }
    }

    await expect(
      createApertureApp({
        config: defineApertureConfig({ mode: "headless" }),
        systems: [{ default: InvalidEnvironmentSystem }],
      }),
    ).rejects.toMatchObject({
      code: "aperture.spawn.invalidEnvironmentAssetKind",
    });
  });
});
