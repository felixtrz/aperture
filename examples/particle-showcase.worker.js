import { startGeneratedSimulationWorker } from "@aperture-engine/app/worker";
import {
  AppEntityKey,
  Enabled,
  LocalTransform,
  Name,
  Parent,
  WorldTransform,
  createSystem,
  material,
  mesh,
  quatFromAxisAngle,
  shader,
} from "@aperture-engine/app/systems";
import {
  Sprite,
  SpriteBillboardMode,
  SpriteBlendMode,
  SpriteDepthMode,
  Light,
  createSprite,
} from "@aperture-engine/render";
import {
  particleShowcaseConfig,
  particleShowcaseEffects,
} from "./particle-showcase.shared.js";

const EFFECT = Object.freeze({
  ember: "vfx-ember-plume",
  smoke: "vfx-smoke-veil",
  electric: "vfx-electric-fork",
});

const TEXTURE = Object.freeze({
  fire: "vfx-fire-mask",
  smoke: "vfx-smoke-mask",
  spark: "vfx-spark-mask",
  flare: "vfx-flare-mask",
});

const MODEL = Object.freeze({
  ground: "vfx-ground-road",
});

const LOOP_SECONDS = 11.2;
const FIRE_START_SECONDS = 2.5;
const FIRE_PEAK_SECONDS = 3.28;
const FIRE_FADE_START_SECONDS = 6.35;
const FIRE_END_SECONDS = 7.72;
const SMOKE_START_SECONDS = FIRE_START_SECONDS + 0.5;
const SMOKE_FULL_SECONDS = FIRE_PEAK_SECONDS + 0.95;
const SMOKE_FADE_SECONDS = FIRE_FADE_START_SECONDS + 0.45;
const SMOKE_END_SECONDS = FIRE_END_SECONDS + 0.5;
const SCORCH_END_SECONDS = SMOKE_END_SECONDS + 0.55;
const STRIKE_POINT = [0, -0.86, 0];
const STRIKE_IMPACT_SECONDS = 0.14;
const STRIKE_DOT_SIZE = 0.66;
const STRIKE_DOT_UNIFORM_KEY = "particle-showcase-impact-core-dot";
const LIGHTNING_WIDTH_SCALE = 2.35;
const LIGHTNING_HEIGHT_SCALE = 0.68;
const LIGHTNING_DURATION_SCALE = 1.35;
const HIDDEN_EFFECT_POSITION = [0, -100, 0];
const IDENTITY_ROTATION = [0, 0, 0, 1];
const IDENTITY_SCALE = [1, 1, 1];
const GROUND_ROTATION = Array.from(quatFromAxisAngle([1, 0, 0], -Math.PI / 2));
const HIDDEN_EFFECT_WORLD = {
  col0: [1, 0, 0, 0],
  col1: [0, 1, 0, 0],
  col2: [0, 0, 1, 0],
  col3: [0, -100, 0, 1],
};

const LIGHTNING_BOLTS = [
  ["bolt.01", -0.72, 0.2, 3.05, 0.02, 0.11, 1.08],
  ["bolt.02", 0.34, 0.16, 2.72, 0.12, 0.1, 0.88],
  ["bolt.03", 0.62, 0.23, 3.3, 0.2, 0.11, 1.16],
  ["bolt.04", -0.88, 0.17, 2.82, 0.31, 0.1, 0.92],
  ["bolt.05", 0.08, 0.15, 2.55, 0.41, 0.095, 0.82],
  ["bolt.06", -0.22, 0.27, 3.42, 0.5, 0.11, 1.24],
  ["bolt.07", 0.96, 0.17, 2.86, 0.6, 0.1, 0.9],
  ["bolt.08", 0.9, 0.22, 3.12, 0.69, 0.105, 1.02],
  ["bolt.09", -0.52, 0.2, 2.95, 0.79, 0.105, 0.98],
  ["bolt.10", -0.78, 0.15, 2.6, 0.9, 0.095, 0.8],
  ["bolt.11", -0.92, 0.24, 3.3, 0.99, 0.11, 1.14],
  ["bolt.12", 0.42, 0.17, 2.77, 1.1, 0.1, 0.88],
  ["bolt.13", 0.74, 0.28, 3.48, 1.2, 0.11, 1.26],
  ["bolt.14", -0.14, 0.19, 2.9, 1.29, 0.1, 0.94],
  ["bolt.15", -0.86, 0.15, 2.6, 1.41, 0.095, 0.82],
  ["bolt.16", -0.36, 0.24, 3.16, 1.5, 0.105, 1.08],
  ["bolt.17", 0.88, 0.18, 2.77, 1.6, 0.1, 0.9],
  ["bolt.18", -0.66, 0.3, 3.52, 1.7, 0.115, 1.34],
  ["bolt.19", 0.22, 0.2, 2.95, 1.82, 0.1, 0.94],
  ["bolt.20", 0.82, 0.17, 2.68, 1.94, 0.095, 0.86],
].map(([key, roll, width, height, start, duration, impactScale]) => ({
  key,
  roll,
  width,
  height,
  start,
  duration: duration * LIGHTNING_DURATION_SCALE,
  impactScale,
}));

class ParticleShowcaseSystem extends createSystem({ priority: 0 }) {
  #effects = new Map();
  #lights = {
    fire: null,
    lightning: null,
  };
  #nextEmissionTimes = new Map();
  #emissions = 0;
  #sprites = new Map();
  #timelineStart = null;
  #groundGlowDotOpacity = -1;
  #groundGlowDotUniformVersion = 0;

  init() {
    for (const effect of particleShowcaseEffects) {
      this.#effects.set(effect.id, this.particles.effect(effect.id));
    }

    this.spawn.camera({
      key: "camera.particle-showcase",
      name: "particle showcase camera",
      transform: {
        translation: [0, 2.1, 7.15],
        lookAt: [0, -0.62, 0],
      },
      fovYDegrees: 43,
      near: 0.1,
      far: 80,
      camera: {
        frustumCulling: false,
      },
    });

    this.#spawnScene();
    this.#spawnStrikeSprites();
    this.#spawnGroundSprites();
    this.#spawnGroundGlowDot();
  }

  update(_delta, time) {
    this.#timelineStart ??= time;
    const localTime = time - this.#timelineStart;
    const phase = positiveModulo(localTime, LOOP_SECONDS);
    const strike = strikeTimeline(phase);
    const glyphPower = strike.impactPower;
    const firePower =
      smoothstep(FIRE_START_SECONDS, FIRE_PEAK_SECONDS, phase) *
      (1 - smoothstep(FIRE_FADE_START_SECONDS, FIRE_END_SECONDS, phase));
    const smokePower =
      smoothstep(SMOKE_START_SECONDS, SMOKE_FULL_SECONDS, phase) *
      (1 - smoothstep(SMOKE_FADE_SECONDS, SMOKE_END_SECONDS, phase));

    this.#updateLightningSprites(phase);
    this.#updateSceneLights({
      lightningPower: strike.impactPower,
      firePower,
      time: localTime,
    });
    this.#updateGroundSprites({
      phase,
      glyphPower,
      impactScale: strike.impactScale,
      firePower,
      smokePower,
      time: localTime,
    });
    this.#emitTimeline({
      phase,
      strikePower: strike.impactPower,
      glyphPower,
      firePower,
      smokePower,
      time: localTime,
    });
  }

  #spawnScene() {
    this.spawn.light({
      key: "light.scene-fill",
      name: "Scene fill",
      kind: "ambient",
      color: [0.42, 0.46, 0.52, 1],
      intensity: 0.025,
    });

    this.spawn.light({
      key: "light.scene-key",
      name: "Scene key",
      kind: "directional",
      color: [0.7, 0.82, 1, 1],
      illuminance: 0.045,
      transform: {
        rotationEulerDegrees: [-48, -24, 0],
      },
    });

    const ground = this.assets.gltf(MODEL.ground);

    if (ground.ready.value) {
      this.spawn.gltf(ground, {
        key: "scene.ground",
        name: "Kenney racing road tile",
        tags: ["ground", "scene"],
        castShadow: false,
        receiveShadow: true,
        transform: {
          translation: [STRIKE_POINT[0], STRIKE_POINT[1], STRIKE_POINT[2]],
          rotationEulerDegrees: [0, 45, 0],
          scale: [0.28, 0.28, 0.28],
        },
      });
    }

    this.#lights.lightning = this.spawn.light({
      key: "light.lightning-pulse",
      name: "Lightning pulse",
      kind: "point",
      color: [0.88, 0.97, 1, 1],
      intensity: 0,
      light: {
        range: 5.4,
      },
      transform: {
        translation: [STRIKE_POINT[0], STRIKE_POINT[1] + 0.62, STRIKE_POINT[2]],
      },
    });

    this.#lights.fire = this.spawn.light({
      key: "light.fire-flicker",
      name: "Fire flicker",
      kind: "point",
      color: [1, 0.48, 0.16, 1],
      intensity: 0,
      light: {
        range: 3.8,
      },
      transform: {
        translation: [STRIKE_POINT[0], STRIKE_POINT[1] + 0.48, STRIKE_POINT[2]],
      },
    });
  }

  #updateSceneLights(input) {
    if (this.#lights.lightning !== null) {
      const flash = input.lightningPower * input.lightningPower;
      this.#lights.lightning.setValue(Light, "intensity", flash * 34);
      this.#lights.lightning.setValue(Light, "range", 2.7 + flash * 1.6);
    }

    if (this.#lights.fire !== null) {
      const flicker =
        0.8 +
        Math.sin(input.time * 17.3) * 0.16 +
        Math.sin(input.time * 39.7 + 1.4) * 0.08;
      const intensity = input.firePower * Math.max(0.45, flicker) * 2.8;
      this.#lights.fire.setValue(Light, "intensity", intensity);
      this.#lights.fire.setValue(Light, "range", 1.6 + input.firePower * 0.55);
    }
  }

  #spawnStrikeSprites() {
    for (const bolt of LIGHTNING_BOLTS) {
      this.#sprites.set(
        bolt.key,
        this.#spawnSprite({
          key: bolt.key,
          name: `Lightning ${bolt.key}`,
          textureId: TEXTURE.spark,
          size: [bolt.width, bolt.height],
          pivot: [0.5, 0],
          blendMode: SpriteBlendMode.Additive,
          depthMode: SpriteDepthMode.Disabled,
          billboardMode: SpriteBillboardMode.Spherical,
        }),
      );
    }
  }

  #spawnGroundSprites() {
    this.#sprites.set(
      "impact.glyph",
      this.#spawnSprite({
        key: "impact.glyph",
        name: "Impact flare halo",
        textureId: TEXTURE.flare,
        size: [2.2, 2.2],
        pivot: [0.5, 0.5],
        blendMode: SpriteBlendMode.Additive,
        depthMode: SpriteDepthMode.Disabled,
        billboardMode: SpriteBillboardMode.None,
      }),
    );
    this.#sprites.set(
      "impact.flare",
      this.#spawnSprite({
        key: "impact.flare",
        name: "Impact flare",
        textureId: TEXTURE.flare,
        size: [1.45, 1.45],
        pivot: [0.5, 0.5],
        blendMode: SpriteBlendMode.Additive,
        depthMode: SpriteDepthMode.Disabled,
        billboardMode: SpriteBillboardMode.None,
      }),
    );
    this.#sprites.set(
      "impact.scorch",
      this.#spawnSprite({
        key: "impact.scorch",
        name: "Impact scorch",
        textureId: TEXTURE.smoke,
        size: [3.1, 3.1],
        pivot: [0.5, 0.5],
        blendMode: SpriteBlendMode.Alpha,
        depthMode: SpriteDepthMode.Disabled,
        billboardMode: SpriteBillboardMode.None,
      }),
    );
  }

  #spawnGroundGlowDot() {
    this.spawn.runtimeUniform({
      key: "impact.core-dot-uniform",
      name: "Impact core dot uniform",
      uniformKey: STRIKE_DOT_UNIFORM_KEY,
      values: { opacity: 0 },
    });

    this.spawn.mesh({
      key: "impact.core-dot",
      name: "Impact core dot",
      mesh: mesh.plane({ size: [STRIKE_DOT_SIZE, STRIKE_DOT_SIZE] }),
      material: material.customWgsl({
        familyKey: "particle-showcase/impact-core-dot",
        label: "Impact Core Dot Material",
        shader: shader.inlineWgsl(strikeDotWgsl(), {
          virtualPath: "particle-showcase-impact-core-dot.wgsl",
        }),
        entryPoints: { vertex: "vs_main", fragment: "fs_main" },
        renderState: {
          cullMode: "none",
          depth: { test: true, write: false, compare: "less" },
          blend: { preset: "additive" },
          alphaMode: "blend",
        },
        bindings: [
          material.uniform("glow", {
            binding: 0,
            visibility: ["fragment"],
            fields: {
              opacity: { type: "float32", default: 0 },
            },
            values: { opacity: 0 },
            runtimeUniformKey: STRIKE_DOT_UNIFORM_KEY,
            label: "ImpactCoreDotUniforms",
          }),
        ],
      }),
      castShadow: false,
      receiveShadow: false,
      transform: {
        translation: [
          STRIKE_POINT[0],
          STRIKE_POINT[1] + 0.055,
          STRIKE_POINT[2],
        ],
        rotation: GROUND_ROTATION,
      },
    });
  }

  #spawnSprite(input) {
    const entity = this.createEntity();
    entity.addComponent(Enabled, { value: true });
    entity.addComponent(Name, { value: input.name });
    entity.addComponent(AppEntityKey, {
      value: `particle-showcase.${input.key}`,
    });
    entity.addComponent(LocalTransform, {
      translation: HIDDEN_EFFECT_POSITION,
      rotation: IDENTITY_ROTATION,
      scale: IDENTITY_SCALE,
    });
    entity.addComponent(Parent, { entity: null });
    entity.addComponent(WorldTransform, HIDDEN_EFFECT_WORLD);
    entity.addComponent(
      Sprite,
      createSprite({
        texture: this.assets.texture(input.textureId).renderHandle,
        size: input.size,
        pivot: input.pivot,
        color: [1, 1, 1, 0],
        billboardMode: input.billboardMode,
        blendMode: input.blendMode,
        depthMode: input.depthMode,
      }),
    );
    return entity;
  }

  #updateLightningSprites(phase) {
    for (const bolt of LIGHTNING_BOLTS) {
      const entity = this.#sprites.get(bolt.key);
      if (entity === undefined) {
        continue;
      }

      const life = strikeLife(bolt, phase);
      const visible = life >= 0 && life <= 1;
      const attack = visible ? smoothstep(0, 0.08, life) : 0;
      const fade = visible ? 1 - smoothstep(0.22, 0.9, life) : 0;
      const alpha = clamp01(attack * fade);
      const shrink = visible ? smoothstep(0, 1, life) : 0;

      this.#writeSprite(entity, {
        position: STRIKE_POINT,
        rotation: IDENTITY_ROTATION,
        color: [0.96, 1, 1, alpha],
        width: bolt.width * LIGHTNING_WIDTH_SCALE * (1 - shrink * 0.08),
        height: bolt.height * LIGHTNING_HEIGHT_SCALE * (1 - shrink * 0.18),
        spriteRotation: bolt.roll,
      });
    }
  }

  #updateGroundSprites(input) {
    const glyph = this.#sprites.get("impact.glyph");
    const flare = this.#sprites.get("impact.flare");
    const scorch = this.#sprites.get("impact.scorch");
    const flareAlpha = clamp01(input.glyphPower * 0.34);
    const coreDotAlpha = clamp01(
      smoothstep(0, FIRE_START_SECONDS, input.phase) *
        (1 - smoothstep(FIRE_FADE_START_SECONDS, LOOP_SECONDS, input.phase)),
    );
    const groundFlashSize = 0.48 + input.impactScale * 0.72;
    const scorchAlpha =
      smoothstep(FIRE_START_SECONDS, FIRE_PEAK_SECONDS, input.phase) *
      (1 - smoothstep(SMOKE_END_SECONDS, SCORCH_END_SECONDS, input.phase)) *
      (0.012 + input.smokePower * 0.014);

    if (glyph !== undefined) {
      this.#writeSprite(glyph, {
        position: [STRIKE_POINT[0], STRIKE_POINT[1] + 0.025, STRIKE_POINT[2]],
        rotation: GROUND_ROTATION,
        color: [0.88, 0.96, 1, input.glyphPower * 0.14],
        width: groundFlashSize,
        height: groundFlashSize,
        spriteRotation: 0,
      });
    }

    if (flare !== undefined) {
      this.#writeSprite(flare, {
        position: [STRIKE_POINT[0], STRIKE_POINT[1] + 0.035, STRIKE_POINT[2]],
        rotation: GROUND_ROTATION,
        color: [0.86, 0.97, 1, flareAlpha],
        width: groundFlashSize * 0.55,
        height: groundFlashSize * 0.55,
        spriteRotation: 0,
      });
    }

    this.#writeGroundGlowDotUniform(coreDotAlpha);

    if (scorch !== undefined) {
      this.#writeSprite(scorch, {
        position: [STRIKE_POINT[0], STRIKE_POINT[1] + 0.015, STRIKE_POINT[2]],
        rotation: GROUND_ROTATION,
        color: [0.04, 0.026, 0.018, scorchAlpha],
        width: 1.18 + input.firePower * 0.16 + input.smokePower * 0.24,
        height: 1.18 + input.firePower * 0.16 + input.smokePower * 0.24,
        spriteRotation: 0,
      });
    }
  }

  #writeSprite(entity, input) {
    const alpha = input.color[3] ?? 0;
    entity
      .getVectorView(LocalTransform, "translation")
      .set(alpha > 0.004 ? input.position : HIDDEN_EFFECT_POSITION);
    entity.getVectorView(LocalTransform, "rotation").set(input.rotation);
    entity.getVectorView(LocalTransform, "scale").set(IDENTITY_SCALE);
    entity.getVectorView(Sprite, "color").set(input.color);
    entity.setValue(Sprite, "width", Math.max(0.001, input.width));
    entity.setValue(Sprite, "height", Math.max(0.001, input.height));
    entity.setValue(Sprite, "rotation", input.spriteRotation);
  }

  #writeGroundGlowDotUniform(opacity) {
    const nextOpacity = clamp01(opacity);
    if (nextOpacity !== this.#groundGlowDotOpacity) {
      this.#groundGlowDotOpacity = nextOpacity;
      this.#groundGlowDotUniformVersion += 1;
    }

    this.spawn.runtimeUniform({
      key: "impact.core-dot-uniform",
      name: "Impact core dot uniform",
      uniformKey: STRIKE_DOT_UNIFORM_KEY,
      values: { opacity: nextOpacity },
      version: this.#groundGlowDotUniformVersion,
    });
  }

  #emitTimeline(input) {
    this.#emitWhenReady({
      key: "strike-electric",
      effect: EFFECT.electric,
      interval: 0.085,
      count: 10 + input.strikePower * 22,
      intensity: input.strikePower,
      position: [STRIKE_POINT[0], STRIKE_POINT[1] + 0.14, STRIKE_POINT[2]],
      positionJitter: {
        min: [-0.22, -0.03, -0.22],
        max: [0.22, 0.55, 0.22],
      },
      velocity: {
        min: [-0.9, 0.2, -0.9],
        max: [0.9, 1.35, 0.9],
      },
      boundsRadius: 2.9,
      timeScale: 1.45,
      time: input.time,
    });

    this.#emitWhenReady({
      key: "fire-core",
      effect: EFFECT.ember,
      interval: lerp(0.13, 0.065, input.firePower),
      count: 3 + input.firePower * 10,
      intensity: input.firePower,
      position: [STRIKE_POINT[0], STRIKE_POINT[1] + 0.02, STRIKE_POINT[2]],
      positionJitter: {
        min: [-0.24, -0.04, -0.24],
        max: [0.24, 0.12, 0.24],
      },
      velocity: {
        min: [-0.2, 0.58, -0.2],
        max: [0.2, 1.58, 0.2],
      },
      boundsRadius: 3.4,
      time: input.time,
    });

    this.#emitWhenReady({
      key: "fire-licks",
      effect: EFFECT.ember,
      interval: 0.22,
      count: 2 + input.firePower * 5,
      intensity: input.firePower,
      position: [STRIKE_POINT[0], STRIKE_POINT[1] + 0.2, STRIKE_POINT[2]],
      positionJitter: {
        min: [-0.42, -0.05, -0.42],
        max: [0.42, 0.2, 0.42],
      },
      velocity: {
        min: [-0.34, 0.44, -0.34],
        max: [0.34, 1.1, 0.34],
      },
      boundsRadius: 3.4,
      timeScale: 0.92,
      time: input.time,
    });

    this.#emitWhenReady({
      key: "smoke-takeover",
      effect: EFFECT.smoke,
      interval: lerp(0.23, 0.105, input.smokePower),
      count: 2 + input.smokePower * 8,
      intensity: input.smokePower,
      position: [STRIKE_POINT[0], STRIKE_POINT[1] + 0.12, STRIKE_POINT[2]],
      positionJitter: {
        min: [-0.38, -0.04, -0.38],
        max: [0.38, 0.2, 0.38],
      },
      velocity: {
        min: [-0.16, 0.62, -0.16],
        max: [0.16, 1.48, 0.16],
      },
      boundsRadius: 4.1,
      timeScale: 1.05,
      time: input.time,
    });
  }

  #emitWhenReady(input) {
    if (input.intensity <= 0.01) {
      return;
    }

    const effect = this.#effects.get(input.effect);

    if (effect === undefined || !effect.ready.value) {
      return;
    }

    const nextTime = this.#nextEmissionTimes.get(input.key) ?? input.time;

    if (input.time + 1e-6 < nextTime) {
      return;
    }

    const emitted = this.particles.emit(effect, {
      count: Math.max(1, Math.round(input.count)),
      position: input.position,
      positionJitter: input.positionJitter,
      velocity: input.velocity,
      seed: (0x5f37_0000 + this.#emissions * 17) >>> 0,
      ...(input.timeScale === undefined ? {} : { timeScale: input.timeScale }),
      boundsCenter: input.position,
      boundsRadius: input.boundsRadius,
    });

    if (emitted) {
      this.#emissions += 1;
    }

    this.#nextEmissionTimes.set(
      input.key,
      input.time + input.interval / Math.max(0.32, input.intensity),
    );
  }
}

function positiveModulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function strikeTimeline(phase) {
  let impactPower = 0;
  let strongestPower = 0;
  let impactScale = 1;

  for (const bolt of LIGHTNING_BOLTS) {
    const age = phase - bolt.start;

    if (age < 0 || age > STRIKE_IMPACT_SECONDS) {
      continue;
    }

    const attack = smoothstep(0, 0.025, age);
    const fade = 1 - smoothstep(0.04, STRIKE_IMPACT_SECONDS, age);
    const power = attack * fade * bolt.impactScale;

    impactPower += power * 0.82;

    if (power > strongestPower) {
      strongestPower = power;
      impactScale = bolt.impactScale;
    }
  }

  return {
    impactPower: clamp01(impactPower),
    impactScale,
  };
}

function strikeLife(bolt, phase) {
  const age = phase - bolt.start;

  if (age < 0 || age > bolt.duration) {
    return -1;
  }

  return age / bolt.duration;
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(edge0, edge1, value) {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function lerp(start, end, amount) {
  return start + (end - start) * amount;
}

function strikeDotWgsl() {
  return `
struct ViewProjectionUniform {
  viewProjection: mat4x4f,
  cameraPosition: vec4f,
};

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,
  @builtin(instance_index) instanceIndex: u32,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

struct GlowUniforms {
  opacity: f32,
};

@group(0) @binding(0) var<uniform> view: ViewProjectionUniform;
@group(1) @binding(0) var<storage, read> worldTransforms: array<mat4x4f>;
@group(2) @binding(0) var<uniform> glow: GlowUniforms;

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  let world = worldTransforms[input.instanceIndex];
  output.position = view.viewProjection * world * vec4f(input.position, 1.0);
  output.uv = input.uv;
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  let centered = input.uv * 2.0 - vec2f(1.0, 1.0);
  let radius = length(centered);
  let radial = 1.0 - smoothstep(0.0, 1.0, radius);
  let alpha = clamp(radial * radial * glow.opacity, 0.0, 1.0);
  let heat = pow(clamp(1.0 - radius, 0.0, 1.0), 1.55);
  let orange = vec3f(1.0, 0.42, 0.08);
  let white = vec3f(1.0, 0.96, 0.78);
  let color = mix(orange, white, heat);
  let intensity = 0.75 + heat * 1.75;
  return vec4f(color * intensity, alpha);
}
`;
}

startGeneratedSimulationWorker({
  config: particleShowcaseConfig,
  systems: [{ default: ParticleShowcaseSystem }],
});
