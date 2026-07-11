// Zero-config default environment: a daylight gradient sky plus matching
// image-based lighting, installed unless the app authors its own sky or
// environment light (or opts out via render.defaultEnvironment: false).
//
// This is the difference between a new scene that renders lit against a sky
// and one that renders near-black: StandardMaterial needs an environment (or
// authored lights) to look like anything, and camera clearColor defaults to
// black. The installer runs after user setup systems have initialized, so an
// authored ProceduralSky, Skybox, or environment Light suppresses it.
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

export const DEFAULT_ENVIRONMENT_ASSET_ID = "environment.default";
export const DEFAULT_ENVIRONMENT_SKY_KEY = "sky.default";
export const DEFAULT_ENVIRONMENT_LIGHT_KEY = "light.environment.default";

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

  if (worldHasAuthoredEnvironment(options.world)) {
    return false;
  }

  const handle = createEnvironmentMapHandle(DEFAULT_ENVIRONMENT_ASSET_ID);
  const registry = options.context.assetsRegistry;

  if (registry.get(handle) === undefined) {
    registry.register(handle, { label: "Default Environment" });
    registry.markReady(handle, {
      kind: "environment-map",
      label: "Default Environment",
      diffuseResourceKey: `environment-map:${DEFAULT_ENVIRONMENT_ASSET_ID}:diffuse`,
      specularResourceKey: `environment-map:${DEFAULT_ENVIRONMENT_ASSET_ID}:specular`,
      equirectSource: {
        label: DEFAULT_ENVIRONMENT_ASSET_ID,
        resourceKey: `environment-map:${DEFAULT_ENVIRONMENT_ASSET_ID}:equirect-cube`,
        width: EQUIRECT_WIDTH,
        height: EQUIRECT_HEIGHT,
        data: defaultEnvironmentEquirectRgba8(EQUIRECT_WIDTH, EQUIRECT_HEIGHT),
        faceSize: CUBE_FACE_SIZE,
        format: "rgba8unorm",
        mipLevelCount: SPECULAR_MIP_LEVEL_COUNT,
      },
      standardMaterialCount: 1,
    });
  }

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

  options.context.spawn.light({
    key: DEFAULT_ENVIRONMENT_LIGHT_KEY,
    name: "default-environment-light",
    kind: "environment",
    light: { environmentMap: handle },
  });

  return true;
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
  const data = new Uint8Array(width * height * 4);
  const { top, horizon, bottom } = DEFAULT_ENVIRONMENT_IBL_COLORS;

  for (let y = 0; y < height; y += 1) {
    const v = (y + 0.5) / height;
    const elevation = 2 * v - 1;
    const shaping = Math.pow(Math.abs(elevation), 0.75);
    const color =
      elevation >= 0
        ? mix3(horizon, top, shaping)
        : mix3(horizon, bottom, shaping);
    const r = channelToByte(color[0]);
    const g = channelToByte(color[1]);
    const b = channelToByte(color[2]);

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

function worldHasAuthoredEnvironment(
  world: InstallDefaultEnvironmentOptions["world"],
): boolean {
  const skies = world.queryManager.registerQuery({
    required: [ProceduralSky],
  });

  for (const _entity of skies.entities) {
    return true;
  }

  const skyboxes = world.queryManager.registerQuery({ required: [Skybox] });

  for (const _entity of skyboxes.entities) {
    return true;
  }

  const lights = world.queryManager.registerQuery({ required: [Light] });

  for (const entity of lights.entities) {
    const kind = (
      entity as { getValue(component: unknown, field: string): unknown }
    ).getValue(Light, "kind");

    if (kind === LightKind.Environment) {
      return true;
    }
  }

  return false;
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
