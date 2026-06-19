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
import { Light } from "@aperture-engine/render";

// Drives the hero scene's day/night cycle. Every frame it animates the
// directional sun (color, intensity, and arc) and the ambient sky fill; the
// gradient sky dome — a custom-WGSL inverted sphere — is refreshed on a throttle
// by respawning it with the current top/bottom colors (its material/mesh assets
// are keyed by the stable "sky.dome" spawn key, so this updates them in place
// rather than leaking new assets, mirroring city-builder's despawn+respawn).

const SKY_RADIUS = 120;
const SKY_UPDATE_INTERVAL = 0.12; // seconds between gradient refreshes
const CYCLE_SECONDS = 48; // full sunrise -> day -> dusk -> night loop
const START_PHASE = 0.42; // open on bright midday

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
  @location(0) localPosition: vec3f,
};

@group(0) @binding(0) var<uniform> view: ViewProjectionUniform;
@group(1) @binding(0) var<storage, read> worldTransforms: array<mat4x4f>;
@group(2) @binding(0) var<uniform> sky: SkyUniform;

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  let world = worldTransforms[input.instanceIndex];
  output.position = view.viewProjection * world * vec4f(input.position, 1.0);
  output.localPosition = input.position;
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  let dir = normalize(input.localPosition);
  // Tighten the gradient into the low band actually visible in the steep
  // isometric view: the horizon shows bottomColor, the upper sky topColor.
  let t = smoothstep(-0.05, 0.4, dir.y);
  let color = mix(sky.bottomColor.rgb, sky.topColor.rgb, t);
  return vec4f(color, 1.0);
}
`;

interface DayKey {
  readonly phase: number;
  readonly skyTop: Vec3;
  readonly skyBottom: Vec3;
  readonly sun: Vec3;
  readonly sunIntensity: number;
  readonly sunPitchDeg: number;
  readonly sunYawDeg: number;
  readonly ambient: Vec3;
  readonly ambientIntensity: number;
}

// Keyframes around the loop. Linear-interpolated by phase with wraparound from
// the last key back to the first.
// The visible horizon band shows skyBottom, so that carries the saturated
// "hero" color of each moment; skyTop is a deeper/complementary zenith.
const KEYS: readonly DayKey[] = [
  {
    phase: 0.0, // night
    skyTop: [0.02, 0.03, 0.09],
    skyBottom: [0.06, 0.1, 0.2],
    sun: [0.45, 0.52, 0.74],
    sunIntensity: 0.6,
    sunPitchDeg: -24,
    sunYawDeg: 210,
    ambient: [0.22, 0.26, 0.42],
    ambientIntensity: 0.72,
  },
  {
    phase: 0.16, // sunrise
    skyTop: [0.35, 0.42, 0.72],
    skyBottom: [1.0, 0.62, 0.34],
    sun: [1.0, 0.72, 0.44],
    sunIntensity: 2.3,
    sunPitchDeg: -14,
    sunYawDeg: -78,
    ambient: [0.55, 0.54, 0.6],
    ambientIntensity: 1.1,
  },
  {
    phase: 0.28, // morning (brighter yellow)
    skyTop: [0.34, 0.56, 0.92],
    skyBottom: [1.0, 0.82, 0.48],
    sun: [1.0, 0.9, 0.64],
    sunIntensity: 3.1,
    sunPitchDeg: -34,
    sunYawDeg: -55,
    ambient: [0.62, 0.66, 0.74],
    ambientIntensity: 1.35,
  },
  {
    phase: 0.42, // midday (clear blue)
    skyTop: [0.13, 0.36, 0.84],
    skyBottom: [0.4, 0.66, 0.97],
    sun: [1.0, 0.96, 0.86],
    sunIntensity: 3.6,
    sunPitchDeg: -72,
    sunYawDeg: -18,
    ambient: [0.66, 0.74, 0.86],
    ambientIntensity: 1.5,
  },
  {
    phase: 0.58, // afternoon
    skyTop: [0.18, 0.4, 0.82],
    skyBottom: [0.5, 0.68, 0.94],
    sun: [1.0, 0.92, 0.76],
    sunIntensity: 3.2,
    sunPitchDeg: -50,
    sunYawDeg: 22,
    ambient: [0.66, 0.72, 0.82],
    ambientIntensity: 1.4,
  },
  {
    phase: 0.72, // dusk (orange)
    skyTop: [0.3, 0.22, 0.46],
    skyBottom: [1.0, 0.42, 0.17],
    sun: [1.0, 0.46, 0.2],
    sunIntensity: 2.1,
    sunPitchDeg: -12,
    sunYawDeg: 62,
    ambient: [0.52, 0.42, 0.46],
    ambientIntensity: 1.0,
  },
  {
    phase: 0.85, // twilight
    skyTop: [0.07, 0.08, 0.2],
    skyBottom: [0.52, 0.26, 0.34],
    sun: [0.55, 0.42, 0.52],
    sunIntensity: 1.0,
    sunPitchDeg: -7,
    sunYawDeg: 100,
    ambient: [0.32, 0.3, 0.46],
    ambientIntensity: 0.82,
  },
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerp3(a: Vec3, b: Vec3, t: number): Vec3 {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

export default class DayNightSystem extends createSystem({
  priority: 6,
  queries: { lights: { required: [AppEntityKey, Light, LocalTransform] } },
}) {
  #phase = START_PHASE;
  #skyTimer = SKY_UPDATE_INTERVAL; // force a dome on the first update
  #dome: Entity | null = null;

  override update(delta: number): void {
    const dt = Math.min(Math.max(delta, 0), 1 / 30);
    this.#phase = (this.#phase + dt / CYCLE_SECONDS) % 1;

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

    // --- sky dome: throttled refresh ----------------------------------------
    this.#skyTimer += dt;
    if (this.#skyTimer >= SKY_UPDATE_INTERVAL) {
      this.#skyTimer = 0;
      this.#refreshDome(sample.skyTop, sample.skyBottom);
    }
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

  #sample(phase: number): DayKey {
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

    return {
      phase,
      skyTop: lerp3(lower.skyTop, upper.skyTop, t),
      skyBottom: lerp3(lower.skyBottom, upper.skyBottom, t),
      sun: lerp3(lower.sun, upper.sun, t),
      sunIntensity: lerp(lower.sunIntensity, upper.sunIntensity, t),
      sunPitchDeg: lerp(lower.sunPitchDeg, upper.sunPitchDeg, t),
      sunYawDeg: lerp(lower.sunYawDeg, upper.sunYawDeg, t),
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
}
