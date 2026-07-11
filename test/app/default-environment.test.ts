import { describe, expect, it } from "vitest";

import { createApertureApp, defineApertureConfig } from "@aperture-engine/app";
import {
  DEFAULT_ENVIRONMENT_ASSET_ID,
  DEFAULT_ENVIRONMENT_IBL_COLORS,
  DEFAULT_ENVIRONMENT_LIGHT_KEY,
  DEFAULT_ENVIRONMENT_SKY_KEY,
  defaultEnvironmentEquirectRgba8,
  type ApertureSystemModule,
} from "@aperture-engine/app/advanced";
import {
  DEFAULT_GENERATED_EXPOSURE,
  DEFAULT_GENERATED_TONEMAP,
  resolveGeneratedPostEffects,
  resolveGeneratedTonemapAndExposure,
} from "@aperture-engine/app/browser";
import { createSystem } from "@aperture-engine/app/systems";
import { createStandardMaterialAsset } from "@aperture-engine/render";
import { createEnvironmentMapHandle } from "@aperture-engine/simulation";

function headlessConfig(
  render?: Record<string, unknown>,
): ReturnType<typeof defineApertureConfig> {
  return defineApertureConfig({
    mode: "headless",
    systems: [],
    ...(render === undefined ? {} : { render }),
  });
}

function setupModule(spawner: (system: unknown) => void): ApertureSystemModule {
  return {
    default: class DefaultEnvironmentSetupSystem extends createSystem({
      priority: 0,
    }) {
      override init(): void {
        spawner(this);
      }
    },
  };
}

describe("default environment (zero-config daylight sky + IBL)", () => {
  it("installs a sky, an environment light, and a ready environment-map asset", async () => {
    const app = await createApertureApp({ config: headlessConfig() });

    app.step(1 / 60, 0);
    const snapshot = app.extract(1);

    expect(snapshot.proceduralSkies?.length).toBe(1);
    expect(snapshot.environments.length).toBe(1);
    expect(snapshot.environments[0]?.handle?.id).toBe(
      DEFAULT_ENVIRONMENT_ASSET_ID,
    );

    const entry = app.context.assetsRegistry.get(
      createEnvironmentMapHandle(DEFAULT_ENVIRONMENT_ASSET_ID),
    );
    expect(entry?.status).toBe("ready");

    const asset = entry?.asset as {
      readonly equirectSource?: {
        readonly data?: Uint8Array;
        readonly width?: number;
        readonly height?: number;
        readonly format?: string;
      };
    };
    expect(asset.equirectSource?.format).toBe("rgba8unorm");
    expect(asset.equirectSource?.data?.byteLength).toBe(
      (asset.equirectSource?.width ?? 0) *
        (asset.equirectSource?.height ?? 0) *
        4,
    );
  });

  it("is suppressed by render.defaultEnvironment: false", async () => {
    const app = await createApertureApp({
      config: headlessConfig({ defaultEnvironment: false }),
    });

    app.step(1 / 60, 0);
    const snapshot = app.extract(1);

    expect(snapshot.proceduralSkies?.length ?? 0).toBe(0);
    expect(snapshot.environments?.length ?? 0).toBe(0);
    expect(
      app.context.assetsRegistry.get(
        createEnvironmentMapHandle(DEFAULT_ENVIRONMENT_ASSET_ID),
      ),
    ).toBeUndefined();
  });

  it("is suppressed by an authored procedural sky", async () => {
    const app = await createApertureApp({
      config: headlessConfig(),
      systems: [
        setupModule((system) => {
          (
            system as {
              spawn: { proceduralSky(input: object): unknown };
            }
          ).spawn.proceduralSky({ key: "sky.authored" });
        }),
      ],
    });

    app.step(1 / 60, 0);
    const snapshot = app.extract(1);

    // Only the authored sky — the default did not stack a second one, and no
    // default environment light or asset was installed.
    expect(snapshot.proceduralSkies?.length).toBe(1);
    expect(snapshot.environments.length).toBe(0);
    expect(
      app.context.assetsRegistry.get(
        createEnvironmentMapHandle(DEFAULT_ENVIRONMENT_ASSET_ID),
      ),
    ).toBeUndefined();
  });

  it("is suppressed by an authored environment light", async () => {
    const app = await createApertureApp({
      config: headlessConfig(),
      systems: [
        setupModule((system) => {
          const typed = system as {
            assetsRegistry: {
              register(handle: unknown, options?: object): unknown;
              markReady(handle: unknown, asset: unknown): unknown;
            };
            spawn: { light(input: object): unknown };
          };
          const handle = createEnvironmentMapHandle("authored.env");

          typed.assetsRegistry.register(handle, { label: "Authored" });
          typed.assetsRegistry.markReady(handle, { kind: "environment-map" });
          typed.spawn.light({
            key: "light.authored-environment",
            kind: "environment",
            light: { environmentMap: handle },
          });
        }),
      ],
    });

    app.step(1 / 60, 0);
    const snapshot = app.extract(1);

    expect(snapshot.proceduralSkies?.length ?? 0).toBe(0);
    expect(snapshot.environments.length).toBe(1);
    expect(snapshot.environments[0]?.handle?.id).toBe("authored.env");
  });

  it("is NOT suppressed by plain directional/ambient lights", async () => {
    const app = await createApertureApp({
      config: headlessConfig({ defaultLight: true }),
    });

    app.step(1 / 60, 0);
    const snapshot = app.extract(1);

    expect(snapshot.proceduralSkies?.length).toBe(1);
    expect(snapshot.environments.length).toBe(1);
  });

  it("spawns entities under the documented default keys", async () => {
    const app = await createApertureApp({ config: headlessConfig() });

    expect(DEFAULT_ENVIRONMENT_SKY_KEY).toBe("sky.default");
    expect(DEFAULT_ENVIRONMENT_LIGHT_KEY).toBe("light.environment.default");
    // Both entities extract: one sky packet, one environment packet (asserted
    // above); this test pins the public key contract.
    app.step(1 / 60, 0);
    expect(app.extract(1).proceduralSkies?.length).toBe(1);
  });

  it("synthesizes a ground-to-sky LDR equirect gradient", () => {
    const width = 8;
    const height = 8;
    const data = defaultEnvironmentEquirectRgba8(width, height);

    expect(data.byteLength).toBe(width * height * 4);

    // Fully opaque.
    for (let i = 3; i < data.length; i += 4) {
      expect(data[i]).toBe(255);
    }

    // The projection convention puts the north pole at v=1: row 0 is the
    // ground (warm, red-heavy) and the last row is the sky (cool,
    // blue-heavy).
    const groundRed = data[0] ?? 0;
    const groundBlue = data[2] ?? 0;
    const lastRow = (height - 1) * width * 4;
    const skyRed = data[lastRow] ?? 0;
    const skyBlue = data[lastRow + 2] ?? 0;

    expect(groundRed).toBeGreaterThan(skyRed);
    expect(skyBlue).toBeGreaterThan(groundBlue);

    // Rows are horizontally uniform (pure vertical gradient).
    expect(data[4]).toBe(groundRed);
    expect(data[6]).toBe(groundBlue);

    // Matches the documented illumination palette at the poles' shaping
    // extremes (elevation → ±1 approaches top/bottom colors).
    expect(
      Math.abs(
        (groundRed ?? 0) / 255 - DEFAULT_ENVIRONMENT_IBL_COLORS.bottom[0],
      ),
    ).toBeLessThan(0.1);
  });
});

describe("generated tonemap/exposure defaults", () => {
  it("defaults to ACES through the HDR path at exposure 1", () => {
    expect(resolveGeneratedTonemapAndExposure(undefined, false)).toEqual({
      tonemap: DEFAULT_GENERATED_TONEMAP,
      exposure: DEFAULT_GENERATED_EXPOSURE,
    });
    expect(DEFAULT_GENERATED_TONEMAP).toBe("aces");
  });

  it("keeps the legacy 8-bit path only for explicit tonemap none without post effects", () => {
    expect(
      resolveGeneratedTonemapAndExposure({ tonemap: "none" }, false),
    ).toEqual({ tonemap: "none", exposure: undefined });
    // Post effects force the HDR path even with tonemap none.
    expect(
      resolveGeneratedTonemapAndExposure({ tonemap: "none" }, true),
    ).toEqual({ tonemap: "none", exposure: DEFAULT_GENERATED_EXPOSURE });
  });

  it("respects explicit operator and exposure", () => {
    expect(
      resolveGeneratedTonemapAndExposure(
        { tonemap: "agx", exposure: 1.4 },
        false,
      ),
    ).toEqual({ tonemap: "agx", exposure: 1.4 });
  });
});

describe("generated post effects (render.bloom / render.ssao)", () => {
  it("returns no effects by default", () => {
    expect(resolveGeneratedPostEffects(undefined)).toEqual([]);
    expect(resolveGeneratedPostEffects({ bloom: false, ssao: false })).toEqual(
      [],
    );
  });

  it("wires SSAO before bloom", () => {
    const effects = resolveGeneratedPostEffects({
      ssao: { radiusPixels: 12, intensity: 1.5 },
      bloom: { threshold: 0.75, intensity: 0.04 },
    });

    expect(effects.map((effect) => effect.id)).toEqual(["ssao", "bloom"]);
  });

  it("accepts ssao: true with defaults", () => {
    const effects = resolveGeneratedPostEffects({ ssao: true });

    expect(effects.map((effect) => effect.id)).toEqual(["ssao"]);
  });
});

describe("material.standard() dielectric default", () => {
  it("keeps the glTF spec default (metallic 1) in the raw factory", () => {
    const asset = createStandardMaterialAsset({});

    expect(asset.metallicFactor).toBe(1);
    expect(asset.roughnessFactor).toBe(1);
  });

  it("registers spawned hand-authored materials as dielectrics (metallic 0)", async () => {
    const app = await createApertureApp({
      config: headlessConfig({ defaultEnvironment: false }),
      systems: [
        setupModule((system) => {
          const typed = system as {
            spawn: { mesh(input: object): unknown };
          };

          typed.spawn.mesh({
            key: "starter.cube",
            mesh: { kind: "box", options: { size: [1, 1, 1] } },
            material: {
              kind: "standard",
              options: { baseColor: [0.2, 0.5, 1, 1], roughness: 0.45 },
            },
          });
        }),
      ],
    });

    const materials = app.context.assetsRegistry.list({ kind: "material" });
    const standard = materials
      .map(
        (entry) =>
          entry.asset as {
            readonly kind?: string;
            readonly metallicFactor?: number;
            readonly roughnessFactor?: number;
          } | null,
      )
      .find((asset) => asset?.kind === "standard");

    expect(standard).toBeDefined();
    expect(standard?.metallicFactor).toBe(0);
    expect(standard?.roughnessFactor).toBe(0.45);
  });
});
