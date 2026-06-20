import {
  AppEntityKey,
  EcsType,
  LocalTransform,
  createSystem,
  material,
  mesh,
  quatFromEulerYXZ,
  shader,
  type Entity,
  type Vec3Tuple as Vec3,
} from "@aperture-engine/app/systems";
import { createMaterialHandle } from "@aperture-engine/simulation";
import { Light, Material } from "@aperture-engine/render";
import { CAMERA_START_YAW } from "../lib/city-layout.js";
import {
  HERO_LAYOUT_STATE_COMMAND_CHANNEL,
  type HeroLayoutCommand,
} from "../lib/hero-layout.js";
import {
  HERO_STORY_COMMAND_CHANNEL,
  HERO_STORY_MOMENTS,
  heroStoryMomentById,
  type HeroStoryCommand,
  type HeroStoryMomentId,
} from "../lib/hero-story.js";

// Drives the hero scene's day/night cycle. Every frame it animates the
// directional sun (color, intensity, and arc) and the ambient sky fill; the
// gradient sky dome — a custom-WGSL inverted sphere — is refreshed on a throttle
// by respawning it with the current top/bottom colors (its material/mesh assets
// are keyed by the stable "sky.dome" spawn key, so this updates them in place
// rather than leaking new assets, mirroring city-builder's despawn+respawn).

const SKY_RADIUS = 120;
// Custom-WGSL material uniforms are not runtime-patchable through
// `this.materials.set`, so the dome is refreshed with new uniform defaults.
// Keep the desktop cadence near display rate; lower rates make the day/night
// gradient visibly step as the cycle moves through dawn and dusk. Compact
// mobile layouts use a lower cadence because each refresh respawns the custom
// material asset and is noticeably expensive on iPhone-class GPUs.
const SKY_UPDATE_INTERVAL_DESKTOP = 1 / 60;
const SKY_UPDATE_INTERVAL_COMPACT = 1 / 8;
const SKY_COLOR_EPSILON = 0.0015;
const START_MOMENT_ID = HERO_STORY_MOMENTS[0].id;
const START_PHASE: number = HERO_STORY_MOMENTS[0].phase;
const SUNRISE_PHASE = 0.16;
const SUNSET_PHASE = 0.72;
const SUN_MAX_INTENSITY = 3.6;
const SUN_HORIZON_ELEVATION_DEGREES = 6;
const SUN_NOON_ELEVATION_DEGREES = 72;
const SUN_SIDE_WEIGHT = 1;
const SUN_BEHIND_WEIGHT = 0.45;
const LAMP_MAX_INTENSITY = 4; // street-lamp spot-light intensity at full night
const WINDOW_MAX_VISIBILITY = 1; // 0..1 window opacity/emissive multiplier at full night
const WINDOW_BASE_COLOR = [1, 0.78, 0.32] as const;
const WINDOW_EMISSIVE = [3.8, 2.2, 0.5] as const;
const WINDOW_VISIBILITY_EPSILON = 0.005;
const TAU = Math.PI * 2;
const SUN_SOURCE_LEFT_YAW = cameraRelativeSunYaw(-Math.PI / 2);
const SUN_SOURCE_RIGHT_YAW = cameraRelativeSunYaw(Math.PI / 2);

const SKY_WGSL = /* wgsl */ `
struct ViewProjectionUniform {
  viewProjection: mat4x4f,
  cameraPosition: vec4f,
};

struct SkyUniform {
  topColor: vec4f,
  bottomColor: vec4f,
};

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,
  @builtin(instance_index) instanceIndex: u32,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) clip: vec4f,
};

@group(0) @binding(0) var<uniform> view: ViewProjectionUniform;
@group(1) @binding(0) var<storage, read> worldTransforms: array<mat4x4f>;
@group(2) @binding(0) var<uniform> sky: SkyUniform;

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  let world = worldTransforms[input.instanceIndex];
  let clip = view.viewProjection * world * vec4f(input.position, 1.0);
  output.position = clip;
  output.clip = clip;
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  // Screen-space vertical gradient: bottom of frame = horizon (bottomColor),
  // top of frame = zenith (topColor). A world-direction gradient collapses to a
  // flat color in the steep isometric view (only a thin near-horizon band of
  // the dome is visible), so key the gradient off screen Y instead.
  let ndcY = input.clip.y / input.clip.w;
  let s = clamp(ndcY * 0.5 + 0.5, 0.0, 1.0);
  let t = smoothstep(0.28, 1.0, s);
  let color = mix(sky.bottomColor.rgb, sky.topColor.rgb, t);
  return vec4f(color, 1.0);
}
`;

interface DayKey {
  readonly phase: number;
  readonly skyTop: Vec3;
  readonly skyBottom: Vec3;
  readonly sun: Vec3;
  readonly ambient: Vec3;
  readonly ambientIntensity: number;
}

interface DaySample extends DayKey {
  readonly sunIntensity: number;
  readonly sunPitchDeg: number;
  readonly sunYawDeg: number;
}

interface SunArc {
  readonly intensity: number;
  readonly pitchDeg: number;
  readonly yawDeg: number;
}

// Keyframes around the loop. Linear-interpolated by phase with wraparound from
// the last key back to the first.
// The visible horizon band shows skyBottom. Keep the night and lamp-on
// transition phases dark there so the lit windows, street lamps, and headlights
// read against the background instead of competing with a bright orange band.
const KEYS: readonly DayKey[] = [
  {
    phase: 0.0, // night
    skyTop: [0.025, 0.035, 0.08],
    skyBottom: [0.006, 0.008, 0.018],
    sun: [0.32, 0.38, 0.62],
    ambient: [0.12, 0.14, 0.26],
    ambientIntensity: 0.58,
  },
  {
    phase: 0.12, // pre-dawn
    skyTop: [0.04, 0.055, 0.12],
    skyBottom: [0.01, 0.012, 0.028],
    sun: [0.42, 0.46, 0.68],
    ambient: [0.16, 0.17, 0.3],
    ambientIntensity: 0.64,
  },
  {
    phase: 0.16, // sunrise
    skyTop: [0.08, 0.1, 0.22],
    skyBottom: [0.035, 0.026, 0.06],
    sun: [0.72, 0.55, 0.46],
    ambient: [0.24, 0.22, 0.34],
    ambientIntensity: 0.78,
  },
  {
    phase: 0.24, // warm dawn
    skyTop: [0.12, 0.16, 0.32],
    skyBottom: [0.32, 0.16, 0.1],
    sun: [1.0, 0.68, 0.42],
    ambient: [0.36, 0.34, 0.44],
    ambientIntensity: 0.94,
  },
  {
    phase: 0.32, // morning
    skyTop: [0.28, 0.46, 0.82],
    skyBottom: [0.72, 0.5, 0.3],
    sun: [1.0, 0.88, 0.62],
    ambient: [0.56, 0.6, 0.7],
    ambientIntensity: 1.18,
  },
  {
    phase: 0.42, // midday (clear blue)
    skyTop: [0.13, 0.36, 0.84],
    skyBottom: [0.4, 0.66, 0.97],
    sun: [1.0, 0.96, 0.86],
    ambient: [0.66, 0.74, 0.86],
    ambientIntensity: 1.5,
  },
  {
    phase: 0.58, // afternoon
    skyTop: [0.16, 0.34, 0.74],
    skyBottom: [0.46, 0.58, 0.82],
    sun: [1.0, 0.86, 0.68],
    ambient: [0.62, 0.66, 0.78],
    ambientIntensity: 1.28,
  },
  {
    phase: 0.64, // late sunset, already dim enough for lamps
    skyTop: [0.07, 0.075, 0.18],
    skyBottom: [0.18, 0.065, 0.05],
    sun: [0.9, 0.42, 0.22],
    ambient: [0.28, 0.24, 0.34],
    ambientIntensity: 0.82,
  },
  {
    phase: 0.72, // nightfall
    skyTop: [0.055, 0.05, 0.13],
    skyBottom: [0.014, 0.012, 0.03],
    sun: [0.48, 0.36, 0.5],
    ambient: [0.18, 0.17, 0.29],
    ambientIntensity: 0.7,
  },
  {
    phase: 0.85, // twilight
    skyTop: [0.035, 0.04, 0.095],
    skyBottom: [0.008, 0.009, 0.022],
    sun: [0.36, 0.38, 0.58],
    ambient: [0.13, 0.14, 0.26],
    ambientIntensity: 0.6,
  },
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerp3(a: Vec3, b: Vec3, t: number): Vec3 {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

function colorDistance(a: Vec3, b: Vec3): number {
  return Math.max(
    Math.abs(a[0] - b[0]),
    Math.abs(a[1] - b[1]),
    Math.abs(a[2] - b[2]),
  );
}

export default class DayNightSystem extends createSystem({
  priority: 6,
  queries: {
    lights: { required: [AppEntityKey, Light, LocalTransform] },
    nightWindows: { required: [AppEntityKey, Material] },
  },
}) {
  #phase = START_PHASE;
  #activeMomentId: HeroStoryMomentId = START_MOMENT_ID;
  #skyTimer = SKY_UPDATE_INTERVAL_DESKTOP; // force a dome on the first update
  #compactLayout = false;
  #dome: Entity | null = null;
  #lastSkyTop: Vec3 | null = null;
  #lastSkyBottom: Vec3 | null = null;
  #lastWindowVisibility: number | null = null;
  #nightLightMaxIntensityByKey = new Map<string, number>();

  override update(delta: number): void {
    const dt = Math.min(Math.max(delta, 0), 1 / 30);
    this.#drainStoryCommands();
    this.#drainLayoutCommands();
    this.#publishStorySignals();

    const sample = this.#sample(this.#phase);

    // --- sun + ambient: every frame -----------------------------------------
    const sun = this.#lightByKey("light.sun");
    if (sun !== null) {
      sun
        .getVectorView(Light, "color")
        .set([sample.sun[0], sample.sun[1], sample.sun[2], 1]);
      sun.setValue(Light, "intensity", sample.sunIntensity);
      sun
        .getVectorView(LocalTransform, "rotation")
        .set(
          quatFromEulerYXZ(
            (sample.sunPitchDeg * Math.PI) / 180,
            (sample.sunYawDeg * Math.PI) / 180,
            0,
          ),
        );
    }

    const ambient = this.#lightByKey("light.ambient");
    if (ambient !== null) {
      ambient
        .getVectorView(Light, "color")
        .set([sample.ambient[0], sample.ambient[1], sample.ambient[2], 1]);
      ambient.setValue(Light, "intensity", sample.ambientIntensity);
    }

    // --- night lights: dark by day, warm glow as the sun sets --------------
    const lampFactor = Math.min(
      Math.max((2.6 - sample.sunIntensity) / (2.6 - 0.9), 0),
      1,
    );
    for (const entity of this.queries.lights.entities) {
      const key = entity.getValue(AppEntityKey, "value");
      if (typeof key === "string" && nightSyncedLight(key)) {
        entity.setValue(
          Light,
          "intensity",
          lampFactor * this.#nightLightMaxIntensity(entity, key),
        );
      }
    }

    // --- emissive windows: same night factor as the street lamps ------------
    this.#setWindowVisibility(lampFactor * WINDOW_MAX_VISIBILITY);

    // --- sky dome: throttled refresh ----------------------------------------
    this.#skyTimer += dt;
    if (this.#skyTimer >= this.#skyUpdateInterval()) {
      this.#skyTimer = 0;
      this.#refreshDomeIfChanged(sample.skyTop, sample.skyBottom);
    }
  }

  #refreshDomeIfChanged(top: Vec3, bottom: Vec3): void {
    if (
      this.#lastSkyTop !== null &&
      this.#lastSkyBottom !== null &&
      colorDistance(this.#lastSkyTop, top) < SKY_COLOR_EPSILON &&
      colorDistance(this.#lastSkyBottom, bottom) < SKY_COLOR_EPSILON
    ) {
      return;
    }

    this.#lastSkyTop = [...top] as Vec3;
    this.#lastSkyBottom = [...bottom] as Vec3;
    this.#refreshDome(top, bottom);
  }

  #refreshDome(top: Vec3, bottom: Vec3): void {
    const previous = this.#dome;
    if (previous !== null) {
      this.hierarchy.despawnRecursive({
        index: previous.index,
        generation: previous.generation,
      });
    }
    this.#dome = this.spawn.mesh({
      key: "sky.dome",
      name: "Sky Dome",
      tags: ["sky"],
      mesh: mesh.sphere({ radius: SKY_RADIUS, segments: 32 }),
      material: material.customWgsl({
        familyKey: "hero/sky-gradient",
        label: "Sky Gradient",
        shader: shader.inlineWgsl(SKY_WGSL, { virtualPath: "hero-sky.wgsl" }),
        entryPoints: { vertex: "vs_main", fragment: "fs_main" },
        renderState: {
          cullMode: "none",
          depth: { test: true, write: true, compare: "less" },
        },
        bindings: [
          material.uniform("sky", {
            binding: 0,
            visibility: ["fragment"],
            fields: {
              topColor: { type: EcsType.Vec4, default: [...top, 1] },
              bottomColor: { type: EcsType.Vec4, default: [...bottom, 1] },
            },
          }),
        ],
      }),
      castShadow: false,
      receiveShadow: false,
    });
  }

  #sample(phase: number): DaySample {
    const count = KEYS.length;
    let lower = KEYS[count - 1] as DayKey;
    let upper = KEYS[0] as DayKey;
    for (let i = 0; i < count; i += 1) {
      const key = KEYS[i] as DayKey;
      if (key.phase <= phase) {
        lower = key;
        upper = (KEYS[i + 1] ?? KEYS[0]) as DayKey;
      }
    }
    // Distance from lower to upper, handling wraparound past phase 1.
    let span = upper.phase - lower.phase;
    if (span <= 0) span += 1;
    let local = phase - lower.phase;
    if (local < 0) local += 1;
    const t = span === 0 ? 0 : Math.min(local / span, 1);
    const sunArc = sampleSunArc(phase);

    return {
      phase,
      skyTop: lerp3(lower.skyTop, upper.skyTop, t),
      skyBottom: lerp3(lower.skyBottom, upper.skyBottom, t),
      sun: lerp3(lower.sun, upper.sun, t),
      sunIntensity: sunArc.intensity,
      sunPitchDeg: sunArc.pitchDeg,
      sunYawDeg: sunArc.yawDeg,
      ambient: lerp3(lower.ambient, upper.ambient, t),
      ambientIntensity: lerp(lower.ambientIntensity, upper.ambientIntensity, t),
    };
  }

  #lightByKey(key: string): Entity | null {
    for (const entity of this.queries.lights.entities) {
      if (entity.getValue(AppEntityKey, "value") === key) {
        return entity;
      }
    }
    return null;
  }

  #drainStoryCommands(): void {
    for (const command of this.commands.drain<HeroStoryCommand>(
      HERO_STORY_COMMAND_CHANNEL,
    )) {
      if (command.kind === "set-phase") {
        const moment = heroStoryMomentById(command.moment);
        if (moment === undefined) {
          continue;
        }
        this.#activeMomentId = moment.id;
        this.#phase = wrap01(command.phase);
        continue;
      }

      if (command.kind !== "set-moment") {
        continue;
      }
      const moment = heroStoryMomentById(command.moment);
      if (moment === undefined) {
        continue;
      }
      this.#activeMomentId = moment.id;
      this.#phase = moment.phase;
    }
  }

  #drainLayoutCommands(): void {
    for (const command of this.commands.drain<HeroLayoutCommand>(
      HERO_LAYOUT_STATE_COMMAND_CHANNEL,
    )) {
      if (this.#compactLayout !== command.compact) {
        this.#compactLayout = command.compact;
      }
    }
  }

  #skyUpdateInterval(): number {
    return this.#compactLayout
      ? SKY_UPDATE_INTERVAL_COMPACT
      : SKY_UPDATE_INTERVAL_DESKTOP;
  }

  #publishStorySignals(): void {
    if (this.signals.heroMoment !== undefined) {
      this.signals.heroMoment.value = this.#activeMomentId;
    }
    if (this.signals.heroPhase !== undefined) {
      this.signals.heroPhase.value = Number(this.#phase.toFixed(4));
    }
  }

  #setWindowVisibility(visibility: number): void {
    const clamped = Math.min(Math.max(visibility, 0), 1);
    if (
      this.#lastWindowVisibility !== null &&
      Math.abs(this.#lastWindowVisibility - clamped) < WINDOW_VISIBILITY_EPSILON
    ) {
      return;
    }
    this.#lastWindowVisibility = clamped;

    for (const entity of this.queries.nightWindows.entities) {
      const key = entity.getValue(AppEntityKey, "value");
      if (typeof key !== "string" || !key.startsWith("window.glow.")) {
        continue;
      }

      const materialId = entity.getValue(Material, "materialId");
      if (typeof materialId !== "string") {
        continue;
      }

      const materialHandle = materialHandleFromKey(materialId);
      if (materialHandle === null) {
        continue;
      }

      const result = this.materials.set(materialHandle, {
        baseColorFactor: [...WINDOW_BASE_COLOR, clamped],
        emissiveFactor: [
          WINDOW_EMISSIVE[0] * clamped,
          WINDOW_EMISSIVE[1] * clamped,
          WINDOW_EMISSIVE[2] * clamped,
        ],
        renderState: {
          alphaMode: "blend",
          blend: { preset: "alpha" },
          depth: { test: true, write: false, compare: "less" },
        },
      });
      if (!result.ok) {
        this.diagnostics.warn("hero.windowMaterialFadeSkipped", {
          materialId,
          reason: result.diagnostic.message,
        });
      }
    }
  }

  #nightLightMaxIntensity(entity: Entity, key: string): number {
    const cached = this.#nightLightMaxIntensityByKey.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const authored = entity.getValue(Light, "intensity") ?? 0;
    const max =
      key.startsWith("light.lamp.") && authored <= 0
        ? LAMP_MAX_INTENSITY
        : authored;
    this.#nightLightMaxIntensityByKey.set(key, max);
    return max;
  }
}

function materialHandleFromKey(key: string) {
  const prefix = "material:";
  return key.startsWith(prefix) && key.length > prefix.length
    ? createMaterialHandle(key.slice(prefix.length))
    : null;
}

function nightSyncedLight(key: string): boolean {
  return (
    key.startsWith("light.lamp.") ||
    key.startsWith("light.garage-truck.headlight.")
  );
}

function sampleSunArc(phase: number): SunArc {
  const daylight = daylightProgress(phase);
  if (daylight === null) {
    return {
      intensity: 0,
      pitchDeg: -SUN_HORIZON_ELEVATION_DEGREES,
      yawDeg: radiansToDegrees(
        phase < SUNRISE_PHASE ? SUN_SOURCE_LEFT_YAW : SUN_SOURCE_RIGHT_YAW,
      ),
    };
  }

  const daylightEase = smoothstep01(daylight);
  const lift = smoothstep01(Math.sin(daylight * Math.PI));
  const elevation = lerp(
    SUN_HORIZON_ELEVATION_DEGREES,
    SUN_NOON_ELEVATION_DEGREES,
    lift,
  );
  const yaw = lerpAngle(SUN_SOURCE_LEFT_YAW, SUN_SOURCE_RIGHT_YAW, daylightEase);

  return {
    intensity: SUN_MAX_INTENSITY * lift,
    pitchDeg: -elevation,
    yawDeg: radiansToDegrees(yaw),
  };
}

function daylightProgress(phase: number): number | null {
  if (phase < SUNRISE_PHASE || phase > SUNSET_PHASE) {
    return null;
  }
  return (phase - SUNRISE_PHASE) / (SUNSET_PHASE - SUNRISE_PHASE);
}

function cameraRelativeSunYaw(sideOffset: number): number {
  const side = yawVector(CAMERA_START_YAW + sideOffset);
  const behind = yawVector(CAMERA_START_YAW + Math.PI);
  const x = side[0] * SUN_SIDE_WEIGHT + behind[0] * SUN_BEHIND_WEIGHT;
  const z = side[1] * SUN_SIDE_WEIGHT + behind[1] * SUN_BEHIND_WEIGHT;
  return Math.atan2(x, z);
}

function yawVector(yaw: number): readonly [number, number] {
  return [Math.sin(yaw), Math.cos(yaw)];
}

function smoothstep01(value: number): number {
  const t = Math.min(Math.max(value, 0), 1);
  return t * t * (3 - 2 * t);
}

function lerpAngle(a: number, b: number, t: number): number {
  return a + wrapRadians(b - a) * t;
}

function wrapRadians(value: number): number {
  return ((((value + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
}

function radiansToDegrees(value: number): number {
  return (value * 180) / Math.PI;
}

function wrap01(value: number): number {
  return ((value % 1) + 1) % 1;
}
