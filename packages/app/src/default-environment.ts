// Zero-config default environment: a daylight gradient sky plus matching
// image-based lighting, installed unless the app authors its own sky or
// environment light (or opts out via render.defaultEnvironment: false).
// An authored ProceduralSky replaces only the visible half: unless the app
// also authors an ambient fill, the sky's own colors feed a sky-matched IBL,
// so a dusk or night sky still lights the scene the way it looks (three.js
// apps do this by hand with PMREMGenerator.fromScene).
//
// This is the difference between a new scene that renders lit against a sky
// and one that renders near-black: StandardMaterial needs an environment (or
// authored lights) to look like anything, and camera clearColor defaults to
// black. The installer runs after user setup systems have initialized, so an
// authored Skybox or environment Light suppresses it entirely.
//
// The IBL half synthesizes a small LDR equirect gradient (the equirect→cube
// source format is rgba8unorm) and registers it as a ready environment-map
// asset; the renderer's PMREM/irradiance chain derives specular and diffuse
// IBL from it. The visible half is a ProceduralSky with matching colors. The
// two are tuned together: the illumination gradient is deliberately brighter
// and less saturated than the visible sky so materials read neutral, not
// blue-tinted.

import { createEnvironmentMapHandle } from "@aperture-engine/simulation";
import {
  Light,
  LightKind,
  ProceduralSky,
  Skybox,
} from "@aperture-engine/render";
import type { ApertureConfig } from "./config.js";
import type { ApertureSystemContext } from "./systems/context.js";

/** Visible sky gradient (linear RGB): soft blue → pale horizon → warm ground. */
export const DEFAULT_ENVIRONMENT_SKY_COLORS = {
  top: [0.2423, 0.6172, 0.8308],
  horizon: [0.6584, 0.7084, 0.7913],
  bottom: [0.807, 0.7758, 0.7454],
} as const;

/** Illumination gradient (linear RGB): brighter sky term tuned for lighting. */
export const DEFAULT_ENVIRONMENT_IBL_COLORS = {
  top: [0.6902, 0.749, 0.7843],
  horizon: [0.6584, 0.7084, 0.7913],
  bottom: [0.807, 0.7758, 0.7454],
} as const;

/**
 * Scale applied to the illumination gradient before it feeds the irradiance
 * convolution. The convolution stores irradiance/π, so an unscaled ~0.75
 * gradient would contribute ~0.75 × albedo of ambient diffuse — tuned for an
 * IBL-only rig. The default environment is designed to sit UNDER a directional
 * sun (the template/showcase recipe), so it targets the ~0.35–0.45 ambient
 * fill the showcases were tuned around while keeping the sky's tint.
 */
export const DEFAULT_ENVIRONMENT_IBL_INTENSITY = 0.55;

export const DEFAULT_ENVIRONMENT_ASSET_ID = "environment.default";
/** Environment-map asset synthesized from an authored ProceduralSky. */
export const SKY_ENVIRONMENT_ASSET_ID = "environment.sky";
export const DEFAULT_ENVIRONMENT_SKY_KEY = "sky.default";
export const DEFAULT_ENVIRONMENT_LIGHT_KEY = "light.environment.default";
export const DEFAULT_ENVIRONMENT_SUN_KEY = "light.sun.default";

/**
 * Illuminance of the soft default sun added when the app authors no analytic
 * lights at all. Matches the showcase/template tuning (the city-builder sun)
 * so a zero-config scene reads directional without washing out under ACES.
 */
export const DEFAULT_ENVIRONMENT_SUN_ILLUMINANCE = 2.2;

const EQUIRECT_WIDTH = 64;
const EQUIRECT_HEIGHT = 32;
const CUBE_FACE_SIZE = 64;
const SPECULAR_MIP_LEVEL_COUNT = 4;

export interface InstallDefaultEnvironmentOptions {
  readonly config: ApertureConfig;
  readonly context: ApertureSystemContext;
  readonly world: {
    readonly queryManager: {
      registerQuery(config: { readonly required: readonly unknown[] }): {
        readonly entities: Iterable<unknown>;
      };
    };
  };
}

export function installDefaultEnvironment(
  options: InstallDefaultEnvironmentOptions,
): boolean {
  if (options.config.render?.defaultEnvironment === false) {
    return false;
  }

  const authored = readAuthoredEnvironmentState(options.world);

  if (authored.hasEnvironmentLight || authored.hasSkybox) {
    return false;
  }

  if (authored.sky !== null) {
    // An app that pairs its sky with an ambient fill already chose its fill
    // (and may animate the sky); leave it exactly as authored.
    if (authored.hasAmbientLight) {
      return false;
    }
    // Keep the authored sky; light the scene from its own colors.
    const handle = registerGradientEnvironment(
      options.context.assetsRegistry,
      SKY_ENVIRONMENT_ASSET_ID,
      "Sky Environment",
      skyEnvironmentIblColors(authored.sky),
      DEFAULT_ENVIRONMENT_IBL_INTENSITY * Math.max(authored.sky.intensity, 0),
    );
    spawnEnvironmentRig(options, handle, authored.hasAnalyticLight);
    return true;
  }

  const handle = registerGradientEnvironment(
    options.context.assetsRegistry,
    DEFAULT_ENVIRONMENT_ASSET_ID,
    "Default Environment",
    DEFAULT_ENVIRONMENT_IBL_COLORS,
    DEFAULT_ENVIRONMENT_IBL_INTENSITY,
  );

  options.context.spawn.proceduralSky({
    key: DEFAULT_ENVIRONMENT_SKY_KEY,
    name: "default-sky",
    topColor: DEFAULT_ENVIRONMENT_SKY_COLORS.top,
    horizonColor: DEFAULT_ENVIRONMENT_SKY_COLORS.horizon,
    bottomColor: DEFAULT_ENVIRONMENT_SKY_COLORS.bottom,
    // A clean gradient with no sun disk: the default look is neutral studio
    // daylight, not a time of day.
    sunRadius: 0,
    sunGlow: 0,
  });
  spawnEnvironmentRig(options, handle, authored.hasAnalyticLight);
  return true;
}

interface GradientColors {
  readonly top: readonly [number, number, number];
  readonly horizon: readonly [number, number, number];
  readonly bottom: readonly [number, number, number];
}

interface AuthoredSkyColors extends GradientColors {
  readonly intensity: number;
}

/**
 * Illumination gradient for an authored sky: the visible colors, with the
 * zenith pulled halfway to the horizon so the fill reads less saturated than
 * the backdrop (the same tuning the default daylight pair uses).
 */
export function skyEnvironmentIblColors(sky: GradientColors): GradientColors {
  return {
    top: mix3(sky.top, sky.horizon, 0.5),
    horizon: sky.horizon,
    bottom: sky.bottom,
  };
}

function registerGradientEnvironment(
  registry: ApertureSystemContext["assetsRegistry"],
  assetId: string,
  label: string,
  colors: GradientColors,
  intensity: number,
): ReturnType<typeof createEnvironmentMapHandle> {
  const handle = createEnvironmentMapHandle(assetId);

  if (registry.get(handle) === undefined) {
    registry.register(handle, { label });
    registry.markReady(handle, {
      kind: "environment-map",
      label,
      diffuseResourceKey: `environment-map:${assetId}:diffuse`,
      specularResourceKey: `environment-map:${assetId}:specular`,
      equirectSource: {
        label: assetId,
        resourceKey: `environment-map:${assetId}:equirect-cube`,
        width: EQUIRECT_WIDTH,
        height: EQUIRECT_HEIGHT,
        data: gradientEquirectRgba8(
          EQUIRECT_WIDTH,
          EQUIRECT_HEIGHT,
          colors,
          intensity,
        ),
        faceSize: CUBE_FACE_SIZE,
        format: "rgba8unorm",
        mipLevelCount: SPECULAR_MIP_LEVEL_COUNT,
      },
      standardMaterialCount: 1,
    });
  }

  return handle;
}

function spawnEnvironmentRig(
  options: InstallDefaultEnvironmentOptions,
  handle: ReturnType<typeof createEnvironmentMapHandle>,
  hasAnalyticLight: boolean,
): void {
  options.context.spawn.light({
    key: DEFAULT_ENVIRONMENT_LIGHT_KEY,
    name: "default-environment-light",
    kind: "environment",
    light: { environmentMap: handle },
  });

  // The standard-material light buffer requires at least one analytic light —
  // an environment-only world fails frame resource creation. When the app
  // authored no lights at all, complete the daylight rig with a soft sun
  // (no shadows; the templates author the shadow-casting sun).
  if (!hasAnalyticLight) {
    options.context.spawn.light({
      key: DEFAULT_ENVIRONMENT_SUN_KEY,
      name: "default-sun",
      kind: "directional",
      illuminance: DEFAULT_ENVIRONMENT_SUN_ILLUMINANCE,
      transform: {
        rotationEulerDegrees: [-45, 35, 0],
      },
    });
  }
}

/**
 * Synthesize the LDR equirect gradient feeding the IBL chain. The projection
 * convention puts the north pole at v=1 (see
 * equirect-to-cube-compute-pipeline.ts), so row 0 is the ground and the last
 * row is the sky.
 */
export function defaultEnvironmentEquirectRgba8(
  width: number,
  height: number,
): Uint8Array {
  return gradientEquirectRgba8(
    width,
    height,
    DEFAULT_ENVIRONMENT_IBL_COLORS,
    DEFAULT_ENVIRONMENT_IBL_INTENSITY,
  );
}

function gradientEquirectRgba8(
  width: number,
  height: number,
  colors: GradientColors,
  intensity: number,
): Uint8Array {
  const data = new Uint8Array(width * height * 4);
  const { top, horizon, bottom } = colors;

  for (let y = 0; y < height; y += 1) {
    const v = (y + 0.5) / height;
    const elevation = 2 * v - 1;
    const shaping = Math.pow(Math.abs(elevation), 0.75);
    const color =
      elevation >= 0
        ? mix3(horizon, top, shaping)
        : mix3(horizon, bottom, shaping);
    const r = channelToByte(color[0] * intensity);
    const g = channelToByte(color[1] * intensity);
    const b = channelToByte(color[2] * intensity);

    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;

      data[offset] = r;
      data[offset + 1] = g;
      data[offset + 2] = b;
      data[offset + 3] = 255;
    }
  }

  return data;
}

interface AuthoredEnvironmentState {
  /** The highest-priority authored ProceduralSky, if any. */
  readonly sky: AuthoredSkyColors | null;
  readonly hasSkybox: boolean;
  /** An authored environment (IBL) light exists. */
  readonly hasEnvironmentLight: boolean;
  /** Any authored non-environment (analytic) light exists. */
  readonly hasAnalyticLight: boolean;
  /** An authored ambient fill light exists. */
  readonly hasAmbientLight: boolean;
}

function readAuthoredEnvironmentState(
  world: InstallDefaultEnvironmentOptions["world"],
): AuthoredEnvironmentState {
  let sky: (AuthoredSkyColors & { readonly priority: number }) | null = null;
  let hasSkybox = false;
  let hasEnvironmentLight = false;
  let hasAnalyticLight = false;
  let hasAmbientLight = false;

  const skies = world.queryManager.registerQuery({
    required: [ProceduralSky],
  });

  for (const entity of skies.entities) {
    const read = entity as {
      getValue(component: unknown, field: string): unknown;
      getVectorView(component: unknown, field: string): ArrayLike<number>;
    };
    const priority = Number(read.getValue(ProceduralSky, "priority") ?? 0);

    // Same rule the renderer uses: highest priority, first one on ties.
    if (sky === null || priority > sky.priority) {
      sky = {
        priority,
        top: readColor(read.getVectorView(ProceduralSky, "topColor")),
        horizon: readColor(read.getVectorView(ProceduralSky, "horizonColor")),
        bottom: readColor(read.getVectorView(ProceduralSky, "bottomColor")),
        intensity: Number(read.getValue(ProceduralSky, "intensity") ?? 1),
      };
    }
  }

  const skyboxes = world.queryManager.registerQuery({ required: [Skybox] });

  for (const _entity of skyboxes.entities) {
    hasSkybox = true;
    break;
  }

  const lights = world.queryManager.registerQuery({ required: [Light] });

  for (const entity of lights.entities) {
    const kind = (
      entity as { getValue(component: unknown, field: string): unknown }
    ).getValue(Light, "kind");

    if (kind === LightKind.Environment) {
      hasEnvironmentLight = true;
    } else {
      hasAnalyticLight = true;
      hasAmbientLight ||= kind === LightKind.Ambient;
    }
  }

  return {
    sky,
    hasSkybox,
    hasEnvironmentLight,
    hasAnalyticLight,
    hasAmbientLight,
  };
}

function readColor(
  value: ArrayLike<number>,
): readonly [number, number, number] {
  return [value[0] ?? 0, value[1] ?? 0, value[2] ?? 0];
}

function mix3(
  from: readonly [number, number, number],
  to: readonly [number, number, number],
  t: number,
): readonly [number, number, number] {
  return [
    from[0] + (to[0] - from[0]) * t,
    from[1] + (to[1] - from[1]) * t,
    from[2] + (to[2] - from[2]) * t,
  ];
}

function channelToByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value * 255)));
}
