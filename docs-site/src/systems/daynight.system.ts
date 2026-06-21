import {
  AppEntityKey,
  LocalTransform,
  createSystem,
  quatFromEulerYXZ,
  type Entity,
  type Vec3Tuple as Vec3,
} from "@aperture-engine/app/systems";
import { createMaterialHandle } from "@aperture-engine/simulation";
import { Light, Material, ProceduralSky } from "@aperture-engine/render";
import { CAMERA_START_YAW } from "../lib/city-layout.js";
import {
  HERO_STORY_COMMAND_CHANNEL,
  HERO_STORY_MOMENTS,
  heroStoryMomentById,
  type HeroStoryCommand,
  type HeroStoryMomentId,
} from "../lib/hero-story.js";

// Drives the landing scene's day/night cycle. Every update animates sun,
// ambient fill, night lights, glowing windows, and one ECS-authored procedural
// sky packet that the WebGPU renderer shades in a full-screen pass.
const SKY_COLOR_EPSILON = 0.00025;
const SKY_HORIZON_POSITION = 0.3;
const SKY_HORIZON_SOFTNESS = 0.24;
const SKY_DITHER_STRENGTH = 0.003;
const SKY_INTENSITY = 1;
const START_MOMENT_ID = HERO_STORY_MOMENTS[0].id;
const START_PHASE: number = HERO_STORY_MOMENTS[0].phase;
const SUNRISE_PHASE = 0.16;
const SUNSET_PHASE = 0.72;
const SUN_MAX_INTENSITY = 3.6;
const SUN_HORIZON_ELEVATION_DEGREES = 6;
const SUN_NOON_ELEVATION_DEGREES = 72;
const SUN_SIDE_WEIGHT = 1;
const SUN_BEHIND_WEIGHT = 0.45;
const MORNING_LIGHTS_OFF_PHASE = 0.2;
const LAMP_MAX_INTENSITY = 2; // street-lamp spot-light intensity at full night
const WINDOW_MAX_VISIBILITY = 1; // 0..1 window opacity/emissive multiplier at full night
const WINDOW_BASE_COLOR = [1, 0.78, 0.32] as const;
const WINDOW_EMISSIVE = [3.8, 2.2, 0.5] as const;
const WINDOW_VISIBILITY_EPSILON = 0.005;
const TAU = Math.PI * 2;
const SUN_SOURCE_LEFT_YAW = cameraRelativeSunYaw(-Math.PI / 2);
const SUN_SOURCE_RIGHT_YAW = cameraRelativeSunYaw(Math.PI / 2);

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

interface SkyState {
  readonly topColor: Vec3;
  readonly horizonColor: Vec3;
  readonly bottomColor: Vec3;
  readonly sunDirection: Vec3;
  readonly sunColor: Vec3;
  readonly sunGlow: number;
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
    ambient: [0.15, 0.17, 0.31],
    ambientIntensity: 0.7,
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
    skyTop: [0.055, 0.26, 0.96],
    skyBottom: [0.58, 0.68, 0.82],
    sun: [1.0, 0.96, 0.86],
    ambient: [0.66, 0.74, 0.86],
    ambientIntensity: 1.5,
  },
  {
    phase: 0.58, // afternoon
    skyTop: [0.065, 0.23, 0.78],
    skyBottom: [0.58, 0.64, 0.76],
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
    phase: 0.89, // night
    skyTop: [0.025, 0.035, 0.08],
    skyBottom: [0.006, 0.008, 0.018],
    sun: [0.32, 0.38, 0.62],
    ambient: [0.15, 0.17, 0.31],
    ambientIntensity: 0.7,
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
  #skyEntity: Entity | null = null;
  #lastSkyState: SkyState | null = null;
  #lastWindowVisibility: number | null = null;
  #nightLightMaxIntensityByKey = new Map<string, number>();

  override init(): void {
    const sample = this.#sample(this.#phase);
    this.#spawnProceduralSky(sample);
    this.#refreshSkyIfChanged(sample);
  }

  override update(delta: number): void {
    void delta;
    this.#drainStoryCommands();
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
    const lampFactor =
      Math.min(Math.max((2.6 - sample.sunIntensity) / (2.6 - 0.9), 0), 1) *
      morningNightLightFactor(this.#phase);
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

    // --- procedural sky: one full-screen WebGPU pass ------------------------
    this.#refreshSkyIfChanged(sample);
  }

  #spawnProceduralSky(sample: DaySample): void {
    if (this.#skyEntity !== null) {
      return;
    }

    const state = skyStateFromSample(sample);

    this.#skyEntity = this.spawn.proceduralSky({
      key: "sky.procedural",
      name: "Procedural Sky",
      tags: ["sky"],
      topColor: state.topColor,
      horizonColor: state.horizonColor,
      bottomColor: state.bottomColor,
      horizonPosition: SKY_HORIZON_POSITION,
      horizonSoftness: SKY_HORIZON_SOFTNESS,
      intensity: SKY_INTENSITY,
      sunDirection: state.sunDirection,
      sunColor: state.sunColor,
      sunRadius: 0.026,
      sunGlow: state.sunGlow,
      ditherStrength: SKY_DITHER_STRENGTH,
    });
  }

  #refreshSkyIfChanged(sample: DaySample): void {
    const sky = this.#skyEntity;
    if (sky === null) {
      return;
    }

    const state = skyStateFromSample(sample);
    if (
      this.#lastSkyState !== null &&
      skyStatesClose(this.#lastSkyState, state)
    ) {
      return;
    }

    this.#lastSkyState = cloneSkyState(state);
    sky.getVectorView(ProceduralSky, "topColor").set(state.topColor);
    sky.getVectorView(ProceduralSky, "horizonColor").set(state.horizonColor);
    sky.getVectorView(ProceduralSky, "bottomColor").set(state.bottomColor);
    sky.getVectorView(ProceduralSky, "sunDirection").set(state.sunDirection);
    sky.getVectorView(ProceduralSky, "sunColor").set(state.sunColor);
    sky.setValue(ProceduralSky, "sunGlow", state.sunGlow);
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
    const skyT = t;
    const colorT = smootherstep01(t);
    const sunArc = sampleSunArc(phase);

    return {
      phase,
      skyTop: lerp3(lower.skyTop, upper.skyTop, skyT),
      skyBottom: lerp3(lower.skyBottom, upper.skyBottom, skyT),
      sun: lerp3(lower.sun, upper.sun, colorT),
      sunIntensity: sunArc.intensity,
      sunPitchDeg: sunArc.pitchDeg,
      sunYawDeg: sunArc.yawDeg,
      ambient: lerp3(lower.ambient, upper.ambient, colorT),
      ambientIntensity: lerp(
        lower.ambientIntensity,
        upper.ambientIntensity,
        colorT,
      ),
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

function skyStateFromSample(sample: DaySample): SkyState {
  const sunVisibility = Math.min(
    Math.max(sample.sunIntensity / SUN_MAX_INTENSITY, 0),
    1,
  );
  const sunElevation = Math.max(-sample.sunPitchDeg, 0);
  const horizonGlow = 1 - smoothstepRange(22, 62, sunElevation);
  const sunGlow = sunVisibility * lerp(0.12, 0.38, horizonGlow);

  return {
    topColor: sample.skyTop,
    horizonColor: sample.skyBottom,
    bottomColor: lowerSkyColor(sample.skyBottom),
    sunDirection: sunDirectionFromAngles(sample.sunPitchDeg, sample.sunYawDeg),
    sunColor: scaleColor(sample.sun, sunVisibility * 0.7),
    sunGlow,
  };
}

function lowerSkyColor(horizon: Vec3): Vec3 {
  return [horizon[0] * 0.45, horizon[1] * 0.45, horizon[2] * 0.55];
}

function sunDirectionFromAngles(pitchDeg: number, yawDeg: number): Vec3 {
  const elevation = (-pitchDeg * Math.PI) / 180;
  const yaw = (yawDeg * Math.PI) / 180;
  const cosElevation = Math.cos(elevation);

  return (
    normalize3([
      Math.sin(yaw) * cosElevation,
      Math.sin(elevation),
      Math.cos(yaw) * cosElevation,
    ]) ?? [0, 1, 0]
  );
}

function skyStatesClose(a: SkyState, b: SkyState): boolean {
  return (
    colorDistance(a.topColor, b.topColor) < SKY_COLOR_EPSILON &&
    colorDistance(a.horizonColor, b.horizonColor) < SKY_COLOR_EPSILON &&
    colorDistance(a.bottomColor, b.bottomColor) < SKY_COLOR_EPSILON &&
    colorDistance(a.sunDirection, b.sunDirection) < SKY_COLOR_EPSILON &&
    colorDistance(a.sunColor, b.sunColor) < SKY_COLOR_EPSILON &&
    Math.abs(a.sunGlow - b.sunGlow) < SKY_COLOR_EPSILON
  );
}

function cloneSkyState(state: SkyState): SkyState {
  return {
    topColor: [...state.topColor] as Vec3,
    horizonColor: [...state.horizonColor] as Vec3,
    bottomColor: [...state.bottomColor] as Vec3,
    sunDirection: [...state.sunDirection] as Vec3,
    sunColor: [...state.sunColor] as Vec3,
    sunGlow: state.sunGlow,
  };
}

function scaleColor(color: Vec3, scale: number): Vec3 {
  return [color[0] * scale, color[1] * scale, color[2] * scale];
}

function normalize3(value: Vec3): Vec3 | null {
  const length = Math.hypot(value[0], value[1], value[2]);
  if (length <= 1e-6) {
    return null;
  }
  return [value[0] / length, value[1] / length, value[2] / length];
}

function nightSyncedLight(key: string): boolean {
  return (
    key.startsWith("light.lamp.") ||
    key.startsWith("light.garage-truck.headlight.")
  );
}

function morningNightLightFactor(phase: number): number {
  if (phase < SUNRISE_PHASE || phase >= 0.3) {
    return 1;
  }
  return 1 - smoothstepRange(SUNRISE_PHASE, MORNING_LIGHTS_OFF_PHASE, phase);
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
  const yaw = lerpAngle(
    SUN_SOURCE_LEFT_YAW,
    SUN_SOURCE_RIGHT_YAW,
    daylightEase,
  );

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

function smoothstepRange(start: number, end: number, value: number): number {
  if (end <= start) {
    return value >= end ? 1 : 0;
  }
  return smoothstep01((value - start) / (end - start));
}

function smootherstep01(value: number): number {
  const t = Math.min(Math.max(value, 0), 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
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
