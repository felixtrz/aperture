import { describe, expect, it } from "vitest";
import { createParent } from "@aperture-engine/simulation";
import { createApertureApp } from "@aperture-engine/app";
import {
  asset,
  defineApertureConfig,
  type ApertureConfig,
} from "@aperture-engine/app/config";
import {
  createSystem,
  Parent,
  ParticleSimulationSpace,
} from "@aperture-engine/app/systems";
import { particlesFeature } from "@aperture-engine/particles/app";
import { uiFeature } from "@aperture-engine/ui/app";
import {
  UiHitTarget,
  UiNode,
  UiPanel,
  UiScreen,
  createUiHitTarget,
  createUiNode,
  createUiPanel,
  createUiScreen,
} from "@aperture-engine/render";

describe("feature-gated render extraction", () => {
  it("emits no optional UI or particle packets when explicit feature config omits them", async () => {
    const app = await createApertureApp({
      config: defineApertureConfig({
        mode: "headless",
        features: [],
        assets: particleAssets(),
      }),
      systems: [{ default: OptionalRenderFeatureSetupSystem }],
    });

    const snapshot = app.extract(1);

    expect(snapshot.particleEmitters).toBeUndefined();
    expect(snapshot.uiNodes).toBeUndefined();
    expect(snapshot.uiHitRegions).toBeUndefined();
    expect(snapshot.report.particleEmitters).toBe(0);
    expect(snapshot.report.uiNodes).toBe(0);
    expect(snapshot.report.uiHitRegions).toBe(0);

    await app.dispose();
  });

  it("emits optional UI and particle packets when explicit feature config includes them", async () => {
    const app = await createApertureApp({
      config: defineApertureConfig({
        mode: "headless",
        features: [particlesFeature(), uiFeature()],
        assets: particleAssets(),
      }),
      systems: [{ default: OptionalRenderFeatureSetupSystem }],
    });

    const snapshot = app.extract(1);

    expect(snapshot.report.particleEmitters).toBe(1);
    expect(snapshot.report.uiNodes).toBe(2);
    expect(snapshot.report.uiHitRegions).toBe(1);
    expect(snapshot.particleEmitters?.[0]).toMatchObject({
      effect: { kind: "particle-effect", id: "smokeEffect" },
      simulationSpace: "local",
    });

    await app.dispose();
  });

  it("lets extraction features opt into packet families without hard-coded feature ids", async () => {
    const app = await createApertureApp({
      config: defineApertureConfig({
        mode: "headless",
        features: [
          {
            id: "custom-particles",
            installExtraction({ registerExtractor }) {
              return registerExtractor({
                id: "custom-particles",
                packetFamilies: ["particleEmitters"],
              });
            },
          },
        ],
        assets: particleAssets(),
      }),
      systems: [{ default: OptionalRenderFeatureSetupSystem }],
    });

    const snapshot = app.extract(1);

    expect(snapshot.report.particleEmitters).toBe(1);
    expect(snapshot.report.uiNodes).toBe(0);
    expect(snapshot.report.uiHitRegions).toBe(0);
    expect(snapshot.particleEmitters?.[0]).toMatchObject({
      effect: { kind: "particle-effect", id: "smokeEffect" },
    });
    expect(snapshot.uiNodes).toBeUndefined();
    expect(snapshot.uiHitRegions).toBeUndefined();

    await app.dispose();
  });

  it("warns once per gated-off family that still has live entities", async () => {
    const app = await createApertureApp({
      config: defineApertureConfig({
        mode: "headless",
        features: [],
        assets: particleAssets(),
      }),
      systems: [{ default: OptionalRenderFeatureSetupSystem }],
    });

    const gatedWarnings = (snapshot: { diagnostics: readonly unknown[] }) =>
      snapshot.diagnostics.filter(
        (diagnostic) =>
          (diagnostic as { code?: string }).code ===
          "render.extraction.featureGatedWithLiveEntities",
      ) as readonly { message: string; severity: string }[];

    const first = gatedWarnings(app.extract(1));
    const second = gatedWarnings(app.extract(2));

    expect(first.map((diagnostic) => diagnostic.severity)).toEqual([
      "warning",
      "warning",
    ]);
    expect(first[0]?.message).toContain("'particles'");
    expect(first[1]?.message).toContain("'ui'");
    // Once per family per session, not per frame.
    expect(second).toEqual([]);

    await app.dispose();
  });

  it("fails install when an extractor registers an unknown packet family", async () => {
    await expect(
      createApertureApp({
        config: defineApertureConfig({
          mode: "headless",
          features: [
            {
              id: "decals",
              installExtraction({ registerExtractor }) {
                return registerExtractor({
                  id: "decals",
                  packetFamilies: ["decalDraws"],
                });
              },
            },
          ],
        }),
      }),
    ).rejects.toMatchObject({
      code: "aperture.feature.unknownPacketFamily",
      diagnostics: [
        expect.objectContaining({
          code: "aperture.feature.unknownPacketFamily",
          featureId: "decals",
          severity: "error",
          data: expect.objectContaining({
            unknownFamilies: ["decalDraws"],
          }),
        }),
      ],
    });
  });

  it("keeps legacy configs extracting UI and particles when feature config is omitted", async () => {
    const app = await createApertureApp({
      config: defineApertureConfig({
        mode: "headless",
        assets: particleAssets(),
      }),
      systems: [{ default: OptionalRenderFeatureSetupSystem }],
    });

    const snapshot = app.extract(1);

    expect(snapshot.report.particleEmitters).toBe(1);
    expect(snapshot.report.uiNodes).toBe(2);
    expect(snapshot.report.uiHitRegions).toBe(1);

    await app.dispose();
  });
});

class OptionalRenderFeatureSetupSystem extends createSystem({ priority: 0 }) {
  override init(): void {
    this.spawn.camera({
      key: "camera.features",
      transform: { translation: [0, 0, 6], lookAt: [0, 0, 0] },
      camera: { frustumCulling: false },
    });
    this.spawn.particles({
      key: "smoke.emitter",
      effect: this.assets.particleEffect("smokeEffect"),
      capacity: 16,
      seed: 7,
      simulationSpace: ParticleSimulationSpace.Local,
    });

    const screen = this.createEntity();
    screen.addComponent(UiScreen, createUiScreen({ width: 400, height: 300 }));

    const panel = this.createEntity();
    panel.addComponent(Parent, createParent(screen));
    panel.addComponent(
      UiNode,
      createUiNode({
        x: 100,
        y: 100,
        width: 120,
        height: 80,
      }),
    );
    panel.addComponent(UiPanel, createUiPanel({ color: [1, 0, 0, 1] }));
    panel.addComponent(
      UiHitTarget,
      createUiHitTarget({ blocksInput: true, priority: 1 }),
    );
  }
}

function particleAssets(): NonNullable<ApertureConfig["assets"]> {
  return {
    smokeEffect: asset.particleEffect({
      preload: "blocking",
      main: {
        maxParticles: 32,
        startLifetime: { min: 1, max: 1 },
      },
      emission: {
        rateOverTime: 4,
      },
    }),
  };
}
