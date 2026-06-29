import type {
  AssetHandle,
  SamplerHandle,
  TextureHandle,
  Vec3Like,
  Vec4Like,
} from "@aperture-engine/simulation";
import {
  ParticleSimulationSpace,
  SpriteBlendMode,
} from "../rendering/authoring-types.js";

export type ParticleScalarCurveKeyframe = ParticleCurveKeyframe;
export type ParticleColorGradientKeyframe = ParticleGradientKeyframe;

export interface ParticleScalarRange {
  readonly min: number;
  readonly max: number;
}

export interface ParticleCurveKeyframe {
  readonly t: number;
  readonly value: number;
}

export interface ParticleGradientKeyframe {
  readonly t: number;
  readonly color: Vec4Like;
}

export interface ParticleBurst {
  readonly time: number;
  readonly count: number;
  readonly cycle?: number;
  readonly interval?: number;
  readonly probability?: number;
}

export interface ParticleConstantScalar {
  readonly mode: "constant";
  readonly value: number;
}

export interface ParticleRandomScalar {
  readonly mode: "random-between-two-constants";
  readonly min: number;
  readonly max: number;
}

export interface ParticleCurveScalar {
  readonly mode: "curve";
  readonly curve: readonly ParticleCurveKeyframe[];
  readonly multiplier?: number;
}

export interface ParticleRandomCurveScalar {
  readonly mode: "random-between-two-curves";
  readonly minCurve: readonly ParticleCurveKeyframe[];
  readonly maxCurve: readonly ParticleCurveKeyframe[];
  readonly multiplier?: number;
}

export type ParticleScalarValue =
  | number
  | Partial<ParticleScalarRange>
  | ParticleConstantScalar
  | ParticleRandomScalar
  | ParticleCurveScalar
  | ParticleRandomCurveScalar;

export interface ParticleConstantColor {
  readonly mode: "constant";
  readonly color: Vec4Like;
}

export interface ParticleRandomColor {
  readonly mode: "random-between-two-colors";
  readonly min: Vec4Like;
  readonly max: Vec4Like;
}

export interface ParticleGradientColor {
  readonly mode: "gradient";
  readonly gradient: readonly ParticleGradientKeyframe[];
}

export interface ParticleRandomGradientColor {
  readonly mode: "random-between-two-gradients";
  readonly minGradient: readonly ParticleGradientKeyframe[];
  readonly maxGradient: readonly ParticleGradientKeyframe[];
}

export type ParticleColorValue =
  | Vec4Like
  | ParticleConstantColor
  | ParticleRandomColor
  | ParticleGradientColor
  | ParticleRandomGradientColor;

export interface ParticleConstantVec3 {
  readonly mode: "constant";
  readonly value: Vec3Like;
}

export interface ParticleRandomVec3 {
  readonly mode: "random-between-two-vectors";
  readonly min: Vec3Like;
  readonly max: Vec3Like;
}

export interface ParticleCurveVec3 {
  readonly mode: "curve";
  readonly x: ParticleScalarValue;
  readonly y: ParticleScalarValue;
  readonly z: ParticleScalarValue;
}

export type ParticleVec3Value =
  | Vec3Like
  | ParticleConstantVec3
  | ParticleRandomVec3
  | ParticleCurveVec3;

export type ParticleCullingMode =
  | "automatic"
  | "always-simulate"
  | "pause-and-catch-up"
  | "pause";

export interface ParticleMainModuleInput {
  readonly duration?: number;
  readonly loop?: boolean;
  readonly prewarm?: boolean;
  readonly startDelay?: ParticleScalarValue;
  readonly startLifetime?: ParticleScalarValue;
  readonly startSpeed?: ParticleScalarValue;
  readonly startSize?: ParticleScalarValue | ParticleVec3Value;
  readonly startRotation?: ParticleScalarValue | ParticleVec3Value;
  readonly startColor?: ParticleColorValue;
  readonly gravityModifier?: ParticleScalarValue;
  readonly simulationSpace?: ParticleSimulationSpace;
  readonly simulationSpeed?: number;
  readonly maxParticles?: number;
  readonly randomSeed?: number;
  readonly cullingMode?: ParticleCullingMode;
}

export interface ParticleEmissionModuleInput {
  readonly enabled?: boolean;
  readonly rateOverTime?: ParticleScalarValue;
  readonly rateOverDistance?: ParticleScalarValue;
  readonly bursts?: readonly ParticleBurst[];
}

export type ParticleShapeType =
  | "point"
  | "sphere"
  | "hemisphere"
  | "cone"
  | "circle"
  | "box"
  | "donut"
  | "grid"
  | "rectangle"
  | "mesh-surface";

export type ParticleShapeArcMode = "random" | "loop" | "ping-pong" | "burst";

export interface ParticleShapeModuleInput {
  readonly enabled?: boolean;
  readonly type?: ParticleShapeType;
  readonly mesh?: AssetHandle<"mesh"> | null;
  readonly radius?: number;
  readonly radiusThickness?: number;
  readonly arc?: number;
  readonly arcMode?: ParticleShapeArcMode;
  readonly angle?: number;
  readonly box?: Vec3Like;
  readonly scale?: Vec3Like;
  readonly alignToDirection?: boolean;
  readonly randomDirectionAmount?: number;
  readonly sphericalDirectionAmount?: number;
}

export type ParticleRenderMode =
  | "billboard"
  | "stretched-billboard"
  | "horizontal-billboard"
  | "vertical-billboard"
  | "mesh"
  | "trail";

export type ParticleSortMode = "none" | "distance" | "oldest" | "youngest";

export interface ParticleSoftParticleInput {
  readonly enabled?: boolean;
  readonly nearFade?: number;
  readonly farFade?: number;
}

export interface ParticleRendererModuleInput {
  readonly renderMode?: ParticleRenderMode;
  readonly blendMode?: SpriteBlendMode;
  readonly texture?: TextureHandle | null;
  readonly sampler?: SamplerHandle | null;
  readonly sortMode?: ParticleSortMode;
  readonly renderOrder?: number;
  readonly softParticles?: boolean | ParticleSoftParticleInput;
}

export interface ParticleTextureSheetAnimationModuleInput {
  readonly enabled?: boolean;
  readonly tiles?: readonly [number, number];
  readonly frameOverTime?: ParticleScalarValue;
  readonly startFrame?: ParticleScalarValue;
  readonly cycleCount?: number;
}

export interface ParticleColorOverLifetimeModuleInput {
  readonly enabled?: boolean;
  readonly color?: ParticleColorValue;
}

export interface ParticleSizeOverLifetimeModuleInput {
  readonly enabled?: boolean;
  readonly size?: ParticleScalarValue | ParticleVec3Value;
}

export interface ParticleRotationOverLifetimeModuleInput {
  readonly enabled?: boolean;
  readonly angularVelocity?: ParticleScalarValue | ParticleVec3Value;
}

export interface ParticleVelocityOverLifetimeModuleInput {
  readonly enabled?: boolean;
  readonly velocity?: ParticleVec3Value;
  readonly space?: ParticleSimulationSpace;
}

export interface ParticleForceOverLifetimeModuleInput {
  readonly enabled?: boolean;
  readonly force?: ParticleVec3Value;
  readonly space?: ParticleSimulationSpace;
}

export interface ParticleLimitVelocityOverLifetimeModuleInput {
  readonly enabled?: boolean;
  readonly speed?: ParticleScalarValue;
  readonly dampen?: number;
}

export interface ParticleNoiseModuleInput {
  readonly enabled?: boolean;
  readonly strength?: ParticleScalarValue;
  readonly frequency?: number;
  readonly scrollSpeed?: number;
  readonly damping?: boolean;
}

export interface ParticleSpeedOverLifetimeModuleInput {
  readonly enabled?: boolean;
  readonly speed?: ParticleScalarValue;
}

export interface ParticleColorBySpeedModuleInput {
  readonly enabled?: boolean;
  readonly color?: ParticleColorValue;
  readonly speedRange?: ParticleScalarRange;
}

export interface ParticleSizeBySpeedModuleInput {
  readonly enabled?: boolean;
  readonly size?: ParticleScalarValue | ParticleVec3Value;
  readonly speedRange?: ParticleScalarRange;
}

export interface ParticleRotationBySpeedModuleInput {
  readonly enabled?: boolean;
  readonly angularVelocity?: ParticleScalarValue | ParticleVec3Value;
  readonly speedRange?: ParticleScalarRange;
}

export interface ParticleOrbitalVelocityOverLifetimeModuleInput {
  readonly enabled?: boolean;
  readonly orbital?: ParticleVec3Value;
  readonly offset?: ParticleVec3Value;
  readonly radial?: ParticleScalarValue;
}

export interface ParticleTrailsModuleInput {
  readonly enabled?: boolean;
  readonly lifetime?: ParticleScalarValue;
  readonly ratio?: number;
  readonly minVertexDistance?: number;
}

export interface ParticleCollisionModuleInput {
  readonly enabled?: boolean;
  readonly mode?: "world" | "planes" | "custom";
  readonly dampen?: number;
  readonly bounce?: number;
  readonly lifetimeLoss?: number;
}

export interface ParticleSubEmitterInput {
  readonly type: "birth" | "collision" | "death";
  readonly effect: string;
  readonly probability?: number;
}

export interface ParticleSourceMetadata {
  readonly format: "aperture" | "shuriken" | "three.quarks";
  readonly version?: string;
  readonly sourceName?: string;
  readonly unsupportedFeatures?: readonly string[];
}

export interface ParticleCompositeEmitterTransformInput {
  readonly translation?: Vec3Like;
  readonly rotation?: Vec4Like;
  readonly scale?: Vec3Like;
}

export interface ParticleCompositeEmitterInput {
  readonly label?: string;
  readonly effect: AssetHandle<"particle-effect">;
  readonly delay?: number;
  readonly duration?: number;
  readonly timeScale?: number;
  readonly transform?: ParticleCompositeEmitterTransformInput;
}

export interface ParticleCompositeEmitter {
  readonly label: string;
  readonly effect: AssetHandle<"particle-effect">;
  readonly delay: number;
  readonly duration: number | null;
  readonly timeScale: number;
  readonly transform: {
    readonly translation: readonly [number, number, number];
    readonly rotation: readonly [number, number, number, number];
    readonly scale: readonly [number, number, number];
  };
}

export interface ParticleCompositeEffectAssetInput {
  readonly version: 2;
  readonly type: "composite";
  readonly label?: string;
  readonly emitters: readonly ParticleCompositeEmitterInput[];
  readonly source?: ParticleSourceMetadata;
}

export interface ParticleCompositeEffectAsset {
  readonly kind: "particle-effect";
  readonly type: "composite";
  readonly version: 2;
  readonly label: string;
  readonly emitters: readonly ParticleCompositeEmitter[];
  readonly dependencies: readonly AssetHandle<"particle-effect">[];
  readonly source?: ParticleSourceMetadata;
}

export interface ParticleEmitterEffectAssetInput {
  readonly version: 2;
  readonly type?: "emitter";
  readonly label?: string;
  readonly main?: ParticleMainModuleInput;
  readonly emission?: ParticleEmissionModuleInput;
  readonly shape?: ParticleShapeModuleInput;
  readonly renderer?: ParticleRendererModuleInput;
  readonly textureSheetAnimation?: ParticleTextureSheetAnimationModuleInput;
  readonly colorOverLifetime?: ParticleColorOverLifetimeModuleInput;
  readonly sizeOverLifetime?: ParticleSizeOverLifetimeModuleInput;
  readonly rotationOverLifetime?: ParticleRotationOverLifetimeModuleInput;
  readonly velocityOverLifetime?: ParticleVelocityOverLifetimeModuleInput;
  readonly forceOverLifetime?: ParticleForceOverLifetimeModuleInput;
  readonly limitVelocityOverLifetime?: ParticleLimitVelocityOverLifetimeModuleInput;
  readonly noise?: ParticleNoiseModuleInput;
  readonly speedOverLifetime?: ParticleSpeedOverLifetimeModuleInput;
  readonly colorBySpeed?: ParticleColorBySpeedModuleInput;
  readonly sizeBySpeed?: ParticleSizeBySpeedModuleInput;
  readonly rotationBySpeed?: ParticleRotationBySpeedModuleInput;
  readonly orbitalVelocityOverLifetime?: ParticleOrbitalVelocityOverLifetimeModuleInput;
  readonly trails?: ParticleTrailsModuleInput;
  readonly collision?: ParticleCollisionModuleInput;
  readonly subEmitters?: readonly ParticleSubEmitterInput[];
  readonly source?: ParticleSourceMetadata;
  readonly curveSampleCount?: number;
}

/**
 * Authoring input for a particle effect. An effect is either a single
 * Shuriken-style leaf emitter ({@link ParticleEmitterEffectAssetInput}) or a
 * composite ({@link ParticleCompositeEffectAssetInput}) whose children each
 * reference another particle effect. The two forms must not be mixed in one
 * object; {@link validateParticleEffectInput} rejects that.
 */
export type ParticleEffectAssetInput =
  | ParticleEmitterEffectAssetInput
  | ParticleCompositeEffectAssetInput;

export interface ParticleEffectRuntime {
  readonly capacity: number;
  readonly duration: number;
  readonly looping: boolean;
  readonly prewarm: boolean;
  readonly startDelay: number;
  readonly simulationSpeed: number;
  readonly emissionRate: number;
  readonly emissionRateOverDistance: number;
  readonly bursts: readonly Required<ParticleBurst>[];
  readonly lifetime: ParticleScalarRange;
  readonly startSpeed: ParticleScalarRange;
  readonly startSize: ParticleScalarRange;
  readonly startRotation: ParticleScalarRange;
  readonly startColor: readonly [number, number, number, number];
  readonly endColor: readonly [number, number, number, number];
  readonly velocityOverLifetime: readonly [number, number, number];
  readonly angularVelocity: ParticleScalarRange;
  readonly trailLifetime: number;
  readonly trailRatio: number;
  readonly trailMinVertexDistance: number;
  readonly collisionEnabled: boolean;
  readonly collisionDampen: number;
  readonly collisionBounce: number;
  readonly collisionLifetimeLoss: number;
  readonly orbitalVelocity: readonly [number, number, number];
  readonly orbitalOffset: readonly [number, number, number];
  readonly radialVelocity: number;
  readonly noiseStrength: number;
  readonly noiseFrequency: number;
  readonly noiseScrollSpeed: number;
  readonly noiseDamping: boolean;
  readonly speedOverLifetime: readonly ParticleCurveKeyframe[];
  readonly maxSpeed: number;
  readonly colorBySpeed: readonly ParticleGradientKeyframe[];
  readonly colorBySpeedRange: ParticleScalarRange;
  readonly sizeBySpeed: readonly ParticleCurveKeyframe[];
  readonly sizeBySpeedRange: ParticleScalarRange;
  readonly angularVelocityBySpeed: ParticleScalarRange;
  readonly rotationBySpeedRange: ParticleScalarRange;
  readonly gravity: readonly [number, number, number];
  readonly linearDamping: number;
  readonly renderMode: ParticleRenderMode;
  readonly blendMode: SpriteBlendMode;
  readonly texture?: TextureHandle | null;
  readonly sampler?: SamplerHandle | null;
  readonly atlasFrameCount: number;
  readonly textureSheetTiles: readonly [number, number];
  readonly textureSheetStartFrame: number;
  readonly textureSheetCycleCount: number;
  readonly textureSheetFrameOverTime: readonly ParticleCurveKeyframe[];
  readonly sizeOverLifetime: readonly ParticleCurveKeyframe[];
  readonly colorOverLifetime: readonly ParticleGradientKeyframe[];
}

export interface ParticleEffectCurveTable {
  readonly sampleCount: number;
  /** One float per normalized lifetime sample. */
  readonly sizeOverLifetime: Float32Array;
  /** RGBA, four floats per normalized lifetime sample. */
  readonly colorOverLifetime: Float32Array;
}

export interface ParticleEmitterEffectAsset {
  readonly kind: "particle-effect";
  readonly type: "emitter";
  readonly version: 2;
  readonly label: string;
  readonly main: Required<ParticleMainModuleInput>;
  readonly emission: Required<ParticleEmissionModuleInput>;
  readonly shape: Required<ParticleShapeModuleInput>;
  readonly renderer: Required<
    Omit<ParticleRendererModuleInput, "texture" | "sampler" | "softParticles">
  > & {
    readonly texture?: TextureHandle | null;
    readonly sampler?: SamplerHandle | null;
    readonly softParticles: ParticleSoftParticleInput;
  };
  readonly textureSheetAnimation: Required<ParticleTextureSheetAnimationModuleInput>;
  readonly colorOverLifetime: Required<ParticleColorOverLifetimeModuleInput>;
  readonly sizeOverLifetime: Required<ParticleSizeOverLifetimeModuleInput>;
  readonly rotationOverLifetime: Required<ParticleRotationOverLifetimeModuleInput>;
  readonly velocityOverLifetime: Required<ParticleVelocityOverLifetimeModuleInput>;
  readonly forceOverLifetime: Required<ParticleForceOverLifetimeModuleInput>;
  readonly limitVelocityOverLifetime: Required<ParticleLimitVelocityOverLifetimeModuleInput>;
  readonly noise: Required<ParticleNoiseModuleInput>;
  readonly speedOverLifetime: Required<ParticleSpeedOverLifetimeModuleInput>;
  readonly colorBySpeed: Required<ParticleColorBySpeedModuleInput>;
  readonly sizeBySpeed: Required<ParticleSizeBySpeedModuleInput>;
  readonly rotationBySpeed: Required<ParticleRotationBySpeedModuleInput>;
  readonly orbitalVelocityOverLifetime: Required<ParticleOrbitalVelocityOverLifetimeModuleInput>;
  readonly trails: Required<ParticleTrailsModuleInput>;
  readonly collision: Required<ParticleCollisionModuleInput>;
  readonly subEmitters: readonly ParticleSubEmitterInput[];
  readonly source?: ParticleSourceMetadata;
  readonly runtime: ParticleEffectRuntime;
  readonly curves: ParticleEffectCurveTable;
  readonly runtimeFeatures: ParticleEffectRuntimeFeatureReport;
}

/**
 * A normalized, runtime-ready particle effect asset. Both variants share
 * `kind: "particle-effect"` so a single `AssetHandle<"particle-effect">` (and a
 * single ECS {@link ParticleEmitter}) can reference either form. The `type`
 * field discriminates a leaf emitter from a composite. The renderer and GPU
 * simulation only ever consume leaf {@link ParticleEmitterEffectAsset}s;
 * composites are expanded into leaf emitter packets during extraction.
 */
export type ParticleEffectAsset =
  | ParticleEmitterEffectAsset
  | ParticleCompositeEffectAsset;

/** Narrows a particle effect asset to a leaf emitter effect. */
export function isParticleEmitterEffectAsset(
  asset: ParticleEffectAsset,
): asset is ParticleEmitterEffectAsset {
  return asset.type === "emitter";
}

/** Narrows a particle effect asset to a composite effect. */
export function isParticleCompositeEffectAsset(
  asset: ParticleEffectAsset,
): asset is ParticleCompositeEffectAsset {
  return asset.type === "composite";
}

export type ParticleEffectRuntimeMode = "burst" | "continuous";

export type ParticleEffectRuntimeFeatureDiagnosticCode =
  | "particleEffect.unsupportedFeature"
  | "particleEffect.partiallySupportedFeature";

export interface ParticleEffectRuntimeFeatureDiagnostic {
  readonly code: ParticleEffectRuntimeFeatureDiagnosticCode;
  readonly field: string;
  readonly severity: "info" | "warning";
  readonly supportedModes: readonly ParticleEffectRuntimeMode[];
  readonly unsupportedModes: readonly ParticleEffectRuntimeMode[];
  readonly message: string;
}

export interface ParticleEffectRuntimeFeatureReport {
  readonly version: 2;
  readonly supportedFields: readonly string[];
  readonly partiallySupportedFields: readonly string[];
  readonly unsupportedFields: readonly string[];
  readonly diagnostics: readonly ParticleEffectRuntimeFeatureDiagnostic[];
}

export type ParticleEffectRuntimeFeatureInput = ParticleEffectAssetInput;

export type ParticleEffectDiagnosticCode =
  | "particleEffect.invalidVersion"
  | "particleEffect.legacyField"
  | "particleEffect.invalidCapacity"
  | "particleEffect.invalidDuration"
  | "particleEffect.invalidEmissionRate"
  | "particleEffect.invalidLinearDamping"
  | "particleEffect.invalidBurst"
  | "particleEffect.invalidRange"
  | "particleEffect.invalidAtlasFrameCount"
  | "particleEffect.invalidCurve"
  | "particleEffect.invalidGradient"
  | "particleEffect.invalidModule"
  | "particleEffect.invalidShape"
  | "particleEffect.invalidRenderer"
  | "particleEffect.invalidComposite"
  | "particleEffect.compositeMixedModules"
  | "particleEffect.invalidCompositeEmitter"
  | "particleEffect.invalidCompositeChildEffect";

export interface ParticleEffectDiagnostic {
  readonly code: ParticleEffectDiagnosticCode;
  readonly field: string;
  readonly message: string;
}

export interface ParticleEffectValidationReport {
  readonly valid: boolean;
  readonly diagnostics: readonly ParticleEffectDiagnostic[];
}

const DEFAULT_CURVE_SAMPLE_COUNT = 16;
const LEGACY_PARTICLE_FIELDS = new Set([
  "capacity",
  "duration",
  "looping",
  "prewarm",
  "emissionRate",
  "bursts",
  "lifetime",
  "startSpeed",
  "startSize",
  "startColor",
  "endColor",
  "gravity",
  "linearDamping",
  "blendMode",
  "texture",
  "sampler",
  "atlasFrameCount",
]);
const LEGACY_PARTICLE_MODULE_FIELD_SHAPES = new Set([
  "sizeOverLifetime",
  "colorOverLifetime",
]);

/**
 * Detects whether a particle effect input describes a composite effect. An
 * input is composite when it sets `type: "composite"` or carries an `emitters`
 * array. Leaf Shuriken modules (`main`, `emission`, ...) belong to the emitter
 * form; mixing the two is rejected by {@link validateParticleEffectInput}.
 */
export function isCompositeEffectInput(
  input: ParticleEffectAssetInput,
): input is ParticleCompositeEffectAssetInput {
  return (
    (input as { readonly type?: unknown }).type === "composite" ||
    Array.isArray((input as { readonly emitters?: unknown }).emitters)
  );
}

/**
 * Normalizes a particle effect input into a runtime-ready asset. Dispatches to
 * the leaf emitter or composite normalizer based on the input shape, so a
 * single authoring entry point covers both Shuriken-style emitters and
 * Unity-prefab-style composite VFX.
 */
export function createParticleEffectAsset(
  input: ParticleEffectAssetInput = { version: 2 },
): ParticleEffectAsset {
  if (isCompositeEffectInput(input)) {
    return createParticleCompositeEffectAsset(input);
  }

  return createParticleEmitterEffectAsset(input);
}

export function createParticleEmitterEffectAsset(
  input: ParticleEmitterEffectAssetInput = { version: 2 },
): ParticleEmitterEffectAsset {
  const main = normalizeMainModule(input.main);
  const emission = normalizeEmissionModule(input.emission);
  const shape = normalizeShapeModule(input.shape);
  const renderer = normalizeRendererModule(input.renderer);
  const textureSheetAnimation = normalizeTextureSheetAnimationModule(
    input.textureSheetAnimation,
  );
  const colorOverLifetime = normalizeColorOverLifetimeModule(
    input.colorOverLifetime,
    main.startColor,
  );
  const sizeOverLifetime = normalizeSizeOverLifetimeModule(
    input.sizeOverLifetime,
  );
  const rotationOverLifetime = normalizeRotationOverLifetimeModule(
    input.rotationOverLifetime,
  );
  const velocityOverLifetime = normalizeVelocityOverLifetimeModule(
    input.velocityOverLifetime,
  );
  const forceOverLifetime = normalizeForceOverLifetimeModule(
    input.forceOverLifetime,
  );
  const limitVelocityOverLifetime = normalizeLimitVelocityOverLifetimeModule(
    input.limitVelocityOverLifetime,
  );
  const noise = normalizeNoiseModule(input.noise);
  const speedOverLifetime = normalizeSpeedOverLifetimeModule(
    input.speedOverLifetime,
  );
  const colorBySpeed = normalizeColorBySpeedModule(
    input.colorBySpeed,
    main.startColor,
  );
  const sizeBySpeed = normalizeSizeBySpeedModule(input.sizeBySpeed);
  const rotationBySpeed = normalizeRotationBySpeedModule(input.rotationBySpeed);
  const orbitalVelocityOverLifetime =
    normalizeOrbitalVelocityOverLifetimeModule(
      input.orbitalVelocityOverLifetime,
    );
  const trails = normalizeTrailsModule(input.trails);
  const collision = normalizeCollisionModule(input.collision);
  const runtime = normalizeRuntime({
    main,
    emission,
    renderer,
    textureSheetAnimation,
    colorOverLifetime,
    sizeOverLifetime,
    rotationOverLifetime,
    velocityOverLifetime,
    forceOverLifetime,
    limitVelocityOverLifetime,
    trails,
    collision,
    noise,
    speedOverLifetime,
    colorBySpeed,
    sizeBySpeed,
    rotationBySpeed,
    orbitalVelocityOverLifetime,
  });

  return Object.freeze({
    kind: "particle-effect",
    type: "emitter",
    version: 2,
    label: input.label ?? "ParticleEffect",
    main,
    emission,
    shape,
    renderer,
    textureSheetAnimation,
    colorOverLifetime,
    sizeOverLifetime,
    rotationOverLifetime,
    velocityOverLifetime,
    forceOverLifetime,
    limitVelocityOverLifetime,
    noise,
    speedOverLifetime,
    colorBySpeed,
    sizeBySpeed,
    rotationBySpeed,
    orbitalVelocityOverLifetime,
    trails,
    collision,
    subEmitters: [...(input.subEmitters ?? [])],
    ...(input.source === undefined ? {} : { source: input.source }),
    runtime,
    curves: packParticleEffectCurves({
      sizeOverLifetime: runtime.sizeOverLifetime,
      colorOverLifetime: runtime.colorOverLifetime,
      sampleCount: input.curveSampleCount ?? DEFAULT_CURVE_SAMPLE_COUNT,
    }),
    runtimeFeatures: analyzeParticleEffectRuntimeFeatures(input),
  });
}

export function createParticleCompositeEffectAsset(
  input: ParticleCompositeEffectAssetInput = {
    version: 2,
    type: "composite",
    emitters: [],
  },
): ParticleCompositeEffectAsset {
  const emitters = (input.emitters ?? []).map((emitter, index) =>
    normalizeCompositeEmitter(emitter, index),
  );
  const dependencies = new Map<string, AssetHandle<"particle-effect">>();

  for (const emitter of emitters) {
    dependencies.set(
      `${emitter.effect.kind}:${emitter.effect.id}`,
      emitter.effect,
    );
  }

  return Object.freeze({
    kind: "particle-effect",
    type: "composite",
    version: 2,
    label: input.label ?? "ParticleCompositeEffect",
    emitters,
    dependencies: [...dependencies.values()],
    ...(input.source === undefined ? {} : { source: input.source }),
  });
}

export function analyzeParticleEffectRuntimeFeatures(
  input: ParticleEffectRuntimeFeatureInput = { version: 2 },
): ParticleEffectRuntimeFeatureReport {
  if (isCompositeEffectInput(input)) {
    return {
      version: 2,
      supportedFields: ["emitters", "type", "version"],
      partiallySupportedFields: [],
      unsupportedFields: [],
      diagnostics: [],
    };
  }

  const supportedFields = new Set<string>();
  const partiallySupportedFields = new Set<string>();
  const unsupportedFields = new Set<string>();
  const diagnostics: ParticleEffectRuntimeFeatureDiagnostic[] = [];

  for (const field of Object.keys(input)) {
    const value = (input as unknown as Record<string, unknown>)[field];

    if (
      LEGACY_PARTICLE_FIELDS.has(field) ||
      (LEGACY_PARTICLE_MODULE_FIELD_SHAPES.has(field) && Array.isArray(value))
    ) {
      unsupportedFields.add(field);
      diagnostics.push(
        runtimeFeatureDiagnostic({
          code: "particleEffect.unsupportedFeature",
          field,
          severity: "warning",
          supportedModes: [],
          unsupportedModes: ["burst", "continuous"],
          message: `Legacy particle field '${field}' was removed. Use Shuriken-style modules such as main, emission, shape, and renderer.`,
        }),
      );
      continue;
    }

    switch (field) {
      case "version":
      case "type":
      case "label":
      case "main":
      case "emission":
      case "shape":
      case "renderer":
      case "textureSheetAnimation":
      case "colorOverLifetime":
      case "sizeOverLifetime":
      case "rotationOverLifetime":
      case "velocityOverLifetime":
      case "forceOverLifetime":
      case "limitVelocityOverLifetime":
      case "noise":
      case "speedOverLifetime":
      case "colorBySpeed":
      case "sizeBySpeed":
      case "rotationBySpeed":
      case "orbitalVelocityOverLifetime":
      case "trails":
      case "collision":
      case "subEmitters":
      case "source":
      case "curveSampleCount":
        supportedFields.add(field);
        break;
      default:
        break;
    }
  }

  markUnsupportedModuleFeatures(
    input,
    partiallySupportedFields,
    unsupportedFields,
    diagnostics,
  );

  return {
    version: 2,
    supportedFields: [...supportedFields].sort(),
    partiallySupportedFields: [...partiallySupportedFields].sort(),
    unsupportedFields: [...unsupportedFields].sort(),
    diagnostics,
  };
}

export function validateParticleEffectAsset(
  asset: ParticleEffectAsset,
): ParticleEffectValidationReport {
  if (asset.type === "composite") {
    return validateParticleCompositeEffectAsset(asset);
  }

  const diagnostics: ParticleEffectDiagnostic[] = [];

  if (asset.version !== 2) {
    diagnostics.push(diagnostic("particleEffect.invalidVersion", "version"));
  }
  if (!positiveInteger(asset.runtime.capacity)) {
    diagnostics.push(
      diagnostic("particleEffect.invalidCapacity", "main.maxParticles"),
    );
  }
  if (!positiveFinite(asset.runtime.duration)) {
    diagnostics.push(
      diagnostic("particleEffect.invalidDuration", "main.duration"),
    );
  }
  if (!nonNegativeFinite(asset.runtime.startDelay)) {
    diagnostics.push(
      diagnostic("particleEffect.invalidRange", "main.startDelay"),
    );
  }
  if (!nonNegativeFinite(asset.runtime.simulationSpeed)) {
    diagnostics.push(
      diagnostic("particleEffect.invalidRange", "main.simulationSpeed"),
    );
  }
  if (!nonNegativeFinite(asset.runtime.emissionRate)) {
    diagnostics.push(
      diagnostic("particleEffect.invalidEmissionRate", "emission.rateOverTime"),
    );
  }
  if (!nonNegativeFinite(asset.runtime.emissionRateOverDistance)) {
    diagnostics.push(
      diagnostic(
        "particleEffect.invalidEmissionRate",
        "emission.rateOverDistance",
      ),
    );
  }
  validateRange(asset.runtime.lifetime, "main.startLifetime", diagnostics);
  validateRange(asset.runtime.startSpeed, "main.startSpeed", diagnostics);
  validateRange(asset.runtime.startSize, "main.startSize", diagnostics);
  validateFiniteRange(
    asset.runtime.startRotation,
    "main.startRotation",
    diagnostics,
  );
  validateFiniteRange(
    asset.runtime.angularVelocity,
    "rotationOverLifetime.angularVelocity",
    diagnostics,
  );
  if (!tuple3(asset.runtime.velocityOverLifetime).every(Number.isFinite)) {
    diagnostics.push(
      diagnostic(
        "particleEffect.invalidRange",
        "velocityOverLifetime.velocity",
      ),
    );
  }
  if (
    !nonNegativeFinite(asset.runtime.trailLifetime) ||
    !nonNegativeFinite(asset.runtime.trailRatio) ||
    !nonNegativeFinite(asset.runtime.trailMinVertexDistance)
  ) {
    diagnostics.push(diagnostic("particleEffect.invalidRange", "trails"));
  }
  if (
    !Number.isFinite(asset.runtime.collisionDampen) ||
    !Number.isFinite(asset.runtime.collisionBounce) ||
    !Number.isFinite(asset.runtime.collisionLifetimeLoss)
  ) {
    diagnostics.push(diagnostic("particleEffect.invalidRange", "collision"));
  }
  if (!tuple3(asset.runtime.orbitalVelocity).every(Number.isFinite)) {
    diagnostics.push(
      diagnostic(
        "particleEffect.invalidRange",
        "orbitalVelocityOverLifetime.orbital",
      ),
    );
  }
  if (!tuple3(asset.runtime.orbitalOffset).every(Number.isFinite)) {
    diagnostics.push(
      diagnostic(
        "particleEffect.invalidRange",
        "orbitalVelocityOverLifetime.offset",
      ),
    );
  }
  if (!Number.isFinite(asset.runtime.radialVelocity)) {
    diagnostics.push(
      diagnostic(
        "particleEffect.invalidRange",
        "orbitalVelocityOverLifetime.radial",
      ),
    );
  }
  if (
    !nonNegativeFinite(asset.runtime.noiseStrength) ||
    !nonNegativeFinite(asset.runtime.noiseFrequency) ||
    !Number.isFinite(asset.runtime.noiseScrollSpeed)
  ) {
    diagnostics.push(diagnostic("particleEffect.invalidRange", "noise"));
  }
  validateCurve(
    asset.runtime.speedOverLifetime,
    "speedOverLifetime.speed",
    diagnostics,
  );
  validateGradient(
    asset.runtime.colorBySpeed,
    "colorBySpeed.color",
    diagnostics,
  );
  validateFiniteRange(
    asset.runtime.colorBySpeedRange,
    "colorBySpeed.speedRange",
    diagnostics,
  );
  validateCurve(asset.runtime.sizeBySpeed, "sizeBySpeed.size", diagnostics);
  validateFiniteRange(
    asset.runtime.sizeBySpeedRange,
    "sizeBySpeed.speedRange",
    diagnostics,
  );
  validateFiniteRange(
    asset.runtime.angularVelocityBySpeed,
    "rotationBySpeed.angularVelocity",
    diagnostics,
  );
  validateFiniteRange(
    asset.runtime.rotationBySpeedRange,
    "rotationBySpeed.speedRange",
    diagnostics,
  );
  if (!nonNegativeFinite(asset.runtime.maxSpeed)) {
    diagnostics.push(
      diagnostic(
        "particleEffect.invalidRange",
        "limitVelocityOverLifetime.speed",
      ),
    );
  }
  if (!nonNegativeFinite(asset.runtime.linearDamping)) {
    diagnostics.push(
      diagnostic(
        "particleEffect.invalidLinearDamping",
        "limitVelocityOverLifetime.dampen",
      ),
    );
  }
  if (!positiveInteger(asset.runtime.atlasFrameCount)) {
    diagnostics.push(
      diagnostic(
        "particleEffect.invalidAtlasFrameCount",
        "textureSheetAnimation.tiles",
      ),
    );
  }
  if (!positiveFinite(asset.runtime.textureSheetCycleCount)) {
    diagnostics.push(
      diagnostic(
        "particleEffect.invalidRange",
        "textureSheetAnimation.cycleCount",
      ),
    );
  }
  for (let index = 0; index < asset.runtime.bursts.length; index += 1) {
    const burst = asset.runtime.bursts[index] as Required<ParticleBurst>;
    if (
      !nonNegativeFinite(burst.time) ||
      !positiveInteger(burst.count) ||
      !positiveInteger(burst.cycle) ||
      !positiveFinite(burst.interval) ||
      !nonNegativeFinite(burst.probability) ||
      burst.probability > 1
    ) {
      diagnostics.push(
        diagnostic("particleEffect.invalidBurst", `emission.bursts.${index}`),
      );
    }
  }
  validateCurve(
    asset.runtime.sizeOverLifetime,
    "sizeOverLifetime.size",
    diagnostics,
  );
  validateGradient(
    asset.runtime.colorOverLifetime,
    "colorOverLifetime.color",
    diagnostics,
  );
  validateCurve(
    asset.runtime.textureSheetFrameOverTime,
    "textureSheetAnimation.frameOverTime",
    diagnostics,
  );
  validateShapeModule(asset.shape, diagnostics);
  validateRendererModule(asset.renderer, diagnostics);
  validateTextureSheetAnimationModule(asset.textureSheetAnimation, diagnostics);

  return { valid: diagnostics.length === 0, diagnostics };
}

export function validateParticleCompositeEffectAsset(
  asset: ParticleCompositeEffectAsset,
): ParticleEffectValidationReport {
  const diagnostics: ParticleEffectDiagnostic[] = [];

  if (asset.version !== 2) {
    diagnostics.push(diagnostic("particleEffect.invalidVersion", "version"));
  }
  if (asset.emitters.length === 0) {
    diagnostics.push(diagnostic("particleEffect.invalidComposite", "emitters"));
  }

  for (let index = 0; index < asset.emitters.length; index += 1) {
    const emitter = asset.emitters[index] as ParticleCompositeEmitter;
    const field = `emitters.${index}`;

    if (
      emitter.effect.kind !== "particle-effect" ||
      emitter.effect.id.length === 0
    ) {
      diagnostics.push(
        diagnostic(
          "particleEffect.invalidCompositeChildEffect",
          `${field}.effect`,
        ),
      );
    }
    if (
      !nonNegativeFinite(emitter.delay) ||
      (emitter.duration !== null && !nonNegativeFinite(emitter.duration)) ||
      !positiveFinite(emitter.timeScale) ||
      !tuple3(emitter.transform.translation).every(Number.isFinite) ||
      !tuple4(emitter.transform.rotation).every(Number.isFinite) ||
      !tuple3(emitter.transform.scale).every(Number.isFinite)
    ) {
      diagnostics.push(
        diagnostic("particleEffect.invalidCompositeEmitter", field),
      );
    }
  }

  return { valid: diagnostics.length === 0, diagnostics };
}

export function validateParticleEffectInput(
  input: unknown,
): ParticleEffectValidationReport {
  const diagnostics: ParticleEffectDiagnostic[] = [];

  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return {
      valid: false,
      diagnostics: [diagnostic("particleEffect.invalidModule", "effect")],
    };
  }

  if (isCompositeEffectInputCandidate(input)) {
    return validateParticleCompositeEffectInput(input);
  }

  for (const key of Object.keys(input)) {
    const value = (input as Record<string, unknown>)[key];

    if (
      LEGACY_PARTICLE_FIELDS.has(key) ||
      (LEGACY_PARTICLE_MODULE_FIELD_SHAPES.has(key) && Array.isArray(value))
    ) {
      diagnostics.push({
        code: "particleEffect.legacyField",
        field: key,
        message: `Legacy particle field '${key}' was removed. Use version: 2 with Shuriken-style modules such as main, emission, shape, and renderer.`,
      });
    }
  }

  const version = (input as { readonly version?: unknown }).version;
  if (version !== 2) {
    diagnostics.push(diagnostic("particleEffect.invalidVersion", "version"));
  }

  if (diagnostics.length > 0) {
    return { valid: false, diagnostics };
  }

  return validateParticleEffectAsset(
    createParticleEffectAsset(input as ParticleEffectAssetInput),
  );
}

const LEAF_PARTICLE_MODULE_FIELDS = new Set([
  "main",
  "emission",
  "shape",
  "renderer",
  "textureSheetAnimation",
  "colorOverLifetime",
  "sizeOverLifetime",
  "rotationOverLifetime",
  "velocityOverLifetime",
  "forceOverLifetime",
  "limitVelocityOverLifetime",
  "noise",
  "speedOverLifetime",
  "colorBySpeed",
  "sizeBySpeed",
  "rotationBySpeed",
  "orbitalVelocityOverLifetime",
  "trails",
  "collision",
  "subEmitters",
  "curveSampleCount",
]);

function isCompositeEffectInputCandidate(input: object): boolean {
  // Must match isCompositeEffectInput so the validator and the factory agree on
  // whether an input is composite (a stray non-array `emitters` stays leaf).
  return (
    (input as { readonly type?: unknown }).type === "composite" ||
    Array.isArray((input as { readonly emitters?: unknown }).emitters)
  );
}

function validateParticleCompositeEffectInput(
  input: object,
): ParticleEffectValidationReport {
  const diagnostics: ParticleEffectDiagnostic[] = [];
  const record = input as Record<string, unknown>;

  for (const key of Object.keys(record)) {
    if (LEAF_PARTICLE_MODULE_FIELDS.has(key)) {
      diagnostics.push({
        code: "particleEffect.compositeMixedModules",
        field: key,
        message:
          'Particle effect cannot mix composite emitters with Shuriken modules. Use either type: "composite" with emitters, or leaf modules like main/emission/renderer.',
      });
    }
  }

  if (record.version !== 2) {
    diagnostics.push(diagnostic("particleEffect.invalidVersion", "version"));
  }

  const emitters = record.emitters;
  if (!Array.isArray(emitters) || emitters.length === 0) {
    diagnostics.push(diagnostic("particleEffect.invalidComposite", "emitters"));
    return { valid: false, diagnostics };
  }

  for (let index = 0; index < emitters.length; index += 1) {
    const emitter = emitters[index] as Record<string, unknown> | null;
    const field = `emitters.${index}`;

    if (typeof emitter !== "object" || emitter === null) {
      diagnostics.push(
        diagnostic("particleEffect.invalidCompositeEmitter", field),
      );
      continue;
    }
    if (!isParticleEffectReference(emitter.effect)) {
      diagnostics.push(
        diagnostic(
          "particleEffect.invalidCompositeChildEffect",
          `${field}.effect`,
        ),
      );
    }
    if (
      !optionalNonNegativeFinite(emitter.delay) ||
      !optionalNonNegativeFinite(emitter.duration) ||
      !optionalPositiveFinite(emitter.timeScale)
    ) {
      diagnostics.push(
        diagnostic("particleEffect.invalidCompositeEmitter", field),
      );
    }
  }

  return { valid: diagnostics.length === 0, diagnostics };
}

function isParticleEffectReference(value: unknown): boolean {
  if (typeof value === "string") {
    return value.length > 0;
  }
  if (typeof value === "object" && value !== null) {
    const handle = value as { readonly kind?: unknown; readonly id?: unknown };
    return handle.kind === "particle-effect" && typeof handle.id === "string";
  }
  return false;
}

function optionalNonNegativeFinite(value: unknown): boolean {
  return (
    value === undefined || (Number.isFinite(value) && (value as number) >= 0)
  );
}

function optionalPositiveFinite(value: unknown): boolean {
  return (
    value === undefined || (Number.isFinite(value) && (value as number) > 0)
  );
}

export function packParticleEffectCurves(input: {
  readonly sizeOverLifetime: readonly ParticleCurveKeyframe[];
  readonly colorOverLifetime: readonly ParticleGradientKeyframe[];
  readonly sampleCount?: number;
}): ParticleEffectCurveTable {
  const sampleCount = Math.max(
    2,
    Math.trunc(input.sampleCount ?? DEFAULT_CURVE_SAMPLE_COUNT),
  );
  const size = new Float32Array(sampleCount);
  const color = new Float32Array(sampleCount * 4);

  for (let index = 0; index < sampleCount; index += 1) {
    const t = sampleCount === 1 ? 0 : index / (sampleCount - 1);
    const sampledColor = sampleGradient(input.colorOverLifetime, t);

    size[index] = sampleCurve(input.sizeOverLifetime, t);
    color[index * 4] = sampledColor[0];
    color[index * 4 + 1] = sampledColor[1];
    color[index * 4 + 2] = sampledColor[2];
    color[index * 4 + 3] = sampledColor[3];
  }

  return {
    sampleCount,
    sizeOverLifetime: size,
    colorOverLifetime: color,
  };
}

export function particleEffectDependencies(
  asset: ParticleEffectAsset,
): readonly AssetHandle[] {
  if (asset.type === "composite") {
    return asset.dependencies;
  }

  const dependencies: AssetHandle[] = [];

  if (asset.runtime.texture !== undefined && asset.runtime.texture !== null) {
    dependencies.push(asset.runtime.texture);
  }
  if (asset.runtime.sampler !== undefined && asset.runtime.sampler !== null) {
    dependencies.push(asset.runtime.sampler);
  }
  if (asset.shape.mesh !== undefined && asset.shape.mesh !== null) {
    dependencies.push(asset.shape.mesh);
  }

  return dependencies;
}

function normalizeMainModule(
  input: ParticleMainModuleInput | undefined,
): Required<ParticleMainModuleInput> {
  return {
    duration: input?.duration ?? 5,
    loop: input?.loop ?? true,
    prewarm: input?.prewarm ?? false,
    startDelay: input?.startDelay ?? 0,
    startLifetime: input?.startLifetime ?? 1,
    startSpeed: input?.startSpeed ?? 0,
    startSize: input?.startSize ?? 1,
    startRotation: input?.startRotation ?? 0,
    startColor: input?.startColor ?? [1, 1, 1, 1],
    gravityModifier: input?.gravityModifier ?? 0,
    simulationSpace: input?.simulationSpace ?? ParticleSimulationSpace.World,
    simulationSpeed: input?.simulationSpeed ?? 1,
    maxParticles: Math.trunc(input?.maxParticles ?? 1024),
    randomSeed: Math.trunc(input?.randomSeed ?? 1),
    cullingMode: input?.cullingMode ?? "automatic",
  };
}

function normalizeEmissionModule(
  input: ParticleEmissionModuleInput | undefined,
): Required<ParticleEmissionModuleInput> {
  return {
    enabled: input?.enabled ?? true,
    rateOverTime: input?.rateOverTime ?? 64,
    rateOverDistance: input?.rateOverDistance ?? 0,
    bursts: [...(input?.bursts ?? [])],
  };
}

function normalizeShapeModule(
  input: ParticleShapeModuleInput | undefined,
): Required<ParticleShapeModuleInput> {
  return {
    enabled: input?.enabled ?? true,
    type: input?.type ?? "sphere",
    radius: input?.radius ?? 1,
    radiusThickness: input?.radiusThickness ?? 1,
    arc: input?.arc ?? Math.PI * 2,
    arcMode: input?.arcMode ?? "random",
    angle: input?.angle ?? Math.PI / 6,
    box: tuple3(input?.box ?? [1, 1, 1]),
    scale: tuple3(input?.scale ?? [1, 1, 1]),
    mesh: input?.mesh ?? null,
    alignToDirection: input?.alignToDirection ?? false,
    randomDirectionAmount: input?.randomDirectionAmount ?? 0,
    sphericalDirectionAmount: input?.sphericalDirectionAmount ?? 0,
  };
}

function normalizeRendererModule(
  input: ParticleRendererModuleInput | undefined,
): ParticleEmitterEffectAsset["renderer"] {
  return {
    renderMode: input?.renderMode ?? "billboard",
    blendMode: input?.blendMode ?? SpriteBlendMode.Additive,
    ...(input?.texture === undefined ? {} : { texture: input.texture }),
    ...(input?.sampler === undefined ? {} : { sampler: input.sampler }),
    sortMode: input?.sortMode ?? "none",
    renderOrder: input?.renderOrder ?? 0,
    softParticles: normalizeSoftParticles(input?.softParticles),
  };
}

function normalizeCompositeEmitter(
  input: ParticleCompositeEmitterInput,
  index: number,
): ParticleCompositeEmitter {
  return {
    label: input.label ?? `Emitter${index}`,
    effect: input.effect,
    delay: finiteOr(input.delay, 0),
    duration:
      input.duration === undefined
        ? null
        : Math.max(0, finiteOr(input.duration, 0)),
    // Keep the authored value (defaulting only undefined/non-finite) so a
    // non-positive time scale is rejected by validation instead of being
    // silently clamped to an invalid 0.
    timeScale: finiteOr(input.timeScale, 1),
    transform: {
      translation: tuple3(input.transform?.translation ?? [0, 0, 0]),
      rotation: tuple4(input.transform?.rotation ?? [0, 0, 0, 1]),
      scale: tuple3(input.transform?.scale ?? [1, 1, 1]),
    },
  };
}

function normalizeTextureSheetAnimationModule(
  input: ParticleTextureSheetAnimationModuleInput | undefined,
): Required<ParticleTextureSheetAnimationModuleInput> {
  return {
    enabled: input?.enabled ?? false,
    tiles: input?.tiles ?? [1, 1],
    frameOverTime:
      input?.frameOverTime ??
      (input?.enabled === true
        ? {
            mode: "curve",
            curve: [
              { t: 0, value: 0 },
              { t: 1, value: 1 },
            ],
          }
        : 0),
    startFrame: input?.startFrame ?? 0,
    cycleCount: input?.cycleCount ?? 1,
  };
}

function normalizeColorOverLifetimeModule(
  input: ParticleColorOverLifetimeModuleInput | undefined,
  startColor: ParticleColorValue,
): Required<ParticleColorOverLifetimeModuleInput> {
  return {
    enabled: input?.enabled ?? false,
    color: input?.color ?? startColor,
  };
}

function normalizeSizeOverLifetimeModule(
  input: ParticleSizeOverLifetimeModuleInput | undefined,
): Required<ParticleSizeOverLifetimeModuleInput> {
  return {
    enabled: input?.enabled ?? false,
    size: input?.size ?? 1,
  };
}

function normalizeRotationOverLifetimeModule(
  input: ParticleRotationOverLifetimeModuleInput | undefined,
): Required<ParticleRotationOverLifetimeModuleInput> {
  return {
    enabled: input?.enabled ?? false,
    angularVelocity: input?.angularVelocity ?? 0,
  };
}

function normalizeVelocityOverLifetimeModule(
  input: ParticleVelocityOverLifetimeModuleInput | undefined,
): Required<ParticleVelocityOverLifetimeModuleInput> {
  return {
    enabled: input?.enabled ?? false,
    velocity: input?.velocity ?? [0, 0, 0],
    space: input?.space ?? ParticleSimulationSpace.Local,
  };
}

function normalizeForceOverLifetimeModule(
  input: ParticleForceOverLifetimeModuleInput | undefined,
): Required<ParticleForceOverLifetimeModuleInput> {
  return {
    enabled: input?.enabled ?? false,
    force: input?.force ?? [0, 0, 0],
    space: input?.space ?? ParticleSimulationSpace.Local,
  };
}

function normalizeLimitVelocityOverLifetimeModule(
  input: ParticleLimitVelocityOverLifetimeModuleInput | undefined,
): Required<ParticleLimitVelocityOverLifetimeModuleInput> {
  return {
    enabled: input?.enabled ?? false,
    speed: input?.speed ?? 0,
    dampen: input?.dampen ?? 0,
  };
}

function normalizeNoiseModule(
  input: ParticleNoiseModuleInput | undefined,
): Required<ParticleNoiseModuleInput> {
  return {
    enabled: input?.enabled ?? false,
    strength: input?.strength ?? 0,
    frequency: input?.frequency ?? 0.5,
    scrollSpeed: input?.scrollSpeed ?? 0,
    damping: input?.damping ?? false,
  };
}

function normalizeSpeedOverLifetimeModule(
  input: ParticleSpeedOverLifetimeModuleInput | undefined,
): Required<ParticleSpeedOverLifetimeModuleInput> {
  return {
    enabled: input?.enabled ?? false,
    speed: input?.speed ?? 1,
  };
}

function normalizeColorBySpeedModule(
  input: ParticleColorBySpeedModuleInput | undefined,
  startColor: ParticleColorValue,
): Required<ParticleColorBySpeedModuleInput> {
  return {
    enabled: input?.enabled ?? false,
    color: input?.color ?? startColor,
    speedRange: input?.speedRange ?? { min: 0, max: 1 },
  };
}

function normalizeSizeBySpeedModule(
  input: ParticleSizeBySpeedModuleInput | undefined,
): Required<ParticleSizeBySpeedModuleInput> {
  return {
    enabled: input?.enabled ?? false,
    size: input?.size ?? 1,
    speedRange: input?.speedRange ?? { min: 0, max: 1 },
  };
}

function normalizeRotationBySpeedModule(
  input: ParticleRotationBySpeedModuleInput | undefined,
): Required<ParticleRotationBySpeedModuleInput> {
  return {
    enabled: input?.enabled ?? false,
    angularVelocity: input?.angularVelocity ?? 0,
    speedRange: input?.speedRange ?? { min: 0, max: 1 },
  };
}

function normalizeOrbitalVelocityOverLifetimeModule(
  input: ParticleOrbitalVelocityOverLifetimeModuleInput | undefined,
): Required<ParticleOrbitalVelocityOverLifetimeModuleInput> {
  return {
    enabled: input?.enabled ?? false,
    orbital: input?.orbital ?? [0, 0, 0],
    offset: input?.offset ?? [0, 0, 0],
    radial: input?.radial ?? 0,
  };
}

function normalizeTrailsModule(
  input: ParticleTrailsModuleInput | undefined,
): Required<ParticleTrailsModuleInput> {
  return {
    enabled: input?.enabled ?? false,
    lifetime: input?.lifetime ?? 1,
    ratio: input?.ratio ?? 1,
    minVertexDistance: input?.minVertexDistance ?? 0.1,
  };
}

function normalizeCollisionModule(
  input: ParticleCollisionModuleInput | undefined,
): Required<ParticleCollisionModuleInput> {
  return {
    enabled: input?.enabled ?? false,
    mode: input?.mode ?? "world",
    dampen: input?.dampen ?? 0,
    bounce: input?.bounce ?? 0,
    lifetimeLoss: input?.lifetimeLoss ?? 0,
  };
}

function normalizeRuntime(input: {
  readonly main: Required<ParticleMainModuleInput>;
  readonly emission: Required<ParticleEmissionModuleInput>;
  readonly renderer: ParticleEmitterEffectAsset["renderer"];
  readonly textureSheetAnimation: Required<ParticleTextureSheetAnimationModuleInput>;
  readonly colorOverLifetime: Required<ParticleColorOverLifetimeModuleInput>;
  readonly sizeOverLifetime: Required<ParticleSizeOverLifetimeModuleInput>;
  readonly rotationOverLifetime: Required<ParticleRotationOverLifetimeModuleInput>;
  readonly velocityOverLifetime: Required<ParticleVelocityOverLifetimeModuleInput>;
  readonly forceOverLifetime: Required<ParticleForceOverLifetimeModuleInput>;
  readonly limitVelocityOverLifetime: Required<ParticleLimitVelocityOverLifetimeModuleInput>;
  readonly trails: Required<ParticleTrailsModuleInput>;
  readonly collision: Required<ParticleCollisionModuleInput>;
  readonly noise: Required<ParticleNoiseModuleInput>;
  readonly speedOverLifetime: Required<ParticleSpeedOverLifetimeModuleInput>;
  readonly colorBySpeed: Required<ParticleColorBySpeedModuleInput>;
  readonly sizeBySpeed: Required<ParticleSizeBySpeedModuleInput>;
  readonly rotationBySpeed: Required<ParticleRotationBySpeedModuleInput>;
  readonly orbitalVelocityOverLifetime: Required<ParticleOrbitalVelocityOverLifetimeModuleInput>;
}): ParticleEffectRuntime {
  const startColor = colorValueStart(input.main.startColor);
  const colorCurve = input.colorOverLifetime.enabled
    ? colorValueGradient(input.colorOverLifetime.color, startColor)
    : [
        { t: 0, color: startColor },
        { t: 1, color: startColor },
      ];
  const sizeCurve = input.sizeOverLifetime.enabled
    ? scalarValueCurve(input.sizeOverLifetime.size, 1)
    : [
        { t: 0, value: 1 },
        { t: 1, value: 1 },
      ];
  const speedOverLifetimeCurve = input.speedOverLifetime.enabled
    ? scalarValueCurve(input.speedOverLifetime.speed, 1)
    : [
        { t: 0, value: 1 },
        { t: 1, value: 1 },
      ];
  const colorBySpeedGradient = input.colorBySpeed.enabled
    ? colorValueGradient(input.colorBySpeed.color, [1, 1, 1, 1])
    : [
        { t: 0, color: [1, 1, 1, 1] },
        { t: 1, color: [1, 1, 1, 1] },
      ];
  const sizeBySpeedCurve = input.sizeBySpeed.enabled
    ? scalarValueCurve(input.sizeBySpeed.size, 1)
    : [
        { t: 0, value: 1 },
        { t: 1, value: 1 },
      ];
  const gravityModifier = scalarValueRange(
    input.main.gravityModifier,
    0,
    0,
  ).max;
  const force: readonly [number, number, number] = input.forceOverLifetime
    .enabled
    ? vec3ValueMax(input.forceOverLifetime.force)
    : [0, 0, 0];
  const velocityOverLifetime: readonly [number, number, number] = input
    .velocityOverLifetime.enabled
    ? vec3ValueMax(input.velocityOverLifetime.velocity)
    : [0, 0, 0];
  const orbitalVelocity: readonly [number, number, number] = input
    .orbitalVelocityOverLifetime.enabled
    ? vec3ValueMax(input.orbitalVelocityOverLifetime.orbital)
    : [0, 0, 0];
  const orbitalOffset: readonly [number, number, number] = input
    .orbitalVelocityOverLifetime.enabled
    ? vec3ValueMax(input.orbitalVelocityOverLifetime.offset)
    : [0, 0, 0];
  const radialVelocity = input.orbitalVelocityOverLifetime.enabled
    ? scalarValueRange(input.orbitalVelocityOverLifetime.radial, 0, 0).max
    : 0;
  const noiseStrength = input.noise.enabled
    ? scalarValueRange(input.noise.strength, 0, 0).max
    : 0;
  const trailLifetime = input.trails.enabled
    ? scalarValueRange(input.trails.lifetime, 0, 0).max
    : 0;
  const tiles = input.textureSheetAnimation.tiles;
  const textureSheetTiles: readonly [number, number] = [
    Math.max(1, Math.trunc(tiles[0] ?? 1)),
    Math.max(1, Math.trunc(tiles[1] ?? 1)),
  ];
  const textureSheetFrameOverTime = input.textureSheetAnimation.enabled
    ? scalarValueCurve(input.textureSheetAnimation.frameOverTime, 0)
    : [
        { t: 0, value: 0 },
        { t: 1, value: 0 },
      ];

  return {
    capacity: input.main.maxParticles,
    duration: input.main.duration,
    looping: input.main.loop,
    prewarm: input.main.prewarm,
    startDelay: scalarValueRange(input.main.startDelay, 0, 0).max,
    simulationSpeed: input.main.simulationSpeed,
    emissionRate: input.emission.enabled
      ? scalarValueRange(input.emission.rateOverTime, 0, 0).max
      : 0,
    emissionRateOverDistance: input.emission.enabled
      ? scalarValueRange(input.emission.rateOverDistance, 0, 0).max
      : 0,
    bursts: input.emission.enabled
      ? input.emission.bursts.map((burst) => ({
          time: burst.time,
          count: Math.trunc(burst.count),
          cycle: Math.trunc(burst.cycle ?? 1),
          interval: burst.interval ?? 0.1,
          probability: burst.probability ?? 1,
        }))
      : [],
    lifetime: scalarValueRange(input.main.startLifetime, 1, 1),
    startSpeed: scalarValueRange(input.main.startSpeed, 0, 0),
    startSize: scalarValueRange(input.main.startSize, 1, 1),
    startRotation: scalarValueRange(input.main.startRotation, 0, 0),
    startColor,
    endColor: colorCurve[colorCurve.length - 1]?.color
      ? tuple4(colorCurve[colorCurve.length - 1]?.color ?? startColor)
      : startColor,
    velocityOverLifetime,
    angularVelocity: input.rotationOverLifetime.enabled
      ? scalarValueRange(input.rotationOverLifetime.angularVelocity, 0, 0)
      : { min: 0, max: 0 },
    trailLifetime,
    trailRatio: input.trails.enabled ? input.trails.ratio : 0,
    trailMinVertexDistance: input.trails.enabled
      ? input.trails.minVertexDistance
      : 0,
    collisionEnabled: input.collision.enabled,
    collisionDampen: input.collision.enabled ? input.collision.dampen : 0,
    collisionBounce: input.collision.enabled ? input.collision.bounce : 0,
    collisionLifetimeLoss: input.collision.enabled
      ? input.collision.lifetimeLoss
      : 0,
    orbitalVelocity,
    orbitalOffset,
    radialVelocity,
    noiseStrength,
    noiseFrequency: input.noise.enabled ? input.noise.frequency : 0,
    noiseScrollSpeed: input.noise.enabled ? input.noise.scrollSpeed : 0,
    noiseDamping: input.noise.enabled ? input.noise.damping : false,
    speedOverLifetime: sortedCurve(speedOverLifetimeCurve),
    maxSpeed: input.limitVelocityOverLifetime.enabled
      ? scalarValueRange(input.limitVelocityOverLifetime.speed, 0, 0).max
      : 0,
    colorBySpeed: sortedGradient(colorBySpeedGradient),
    colorBySpeedRange: input.colorBySpeed.speedRange,
    sizeBySpeed: sortedCurve(sizeBySpeedCurve),
    sizeBySpeedRange: input.sizeBySpeed.speedRange,
    angularVelocityBySpeed: input.rotationBySpeed.enabled
      ? scalarValueRange(input.rotationBySpeed.angularVelocity, 0, 0)
      : { min: 0, max: 0 },
    rotationBySpeedRange: input.rotationBySpeed.speedRange,
    gravity: [force[0], force[1] - 9.81 * gravityModifier, force[2]],
    linearDamping: input.limitVelocityOverLifetime.enabled
      ? input.limitVelocityOverLifetime.dampen
      : 0,
    renderMode: input.renderer.renderMode,
    blendMode: input.renderer.blendMode,
    ...(input.renderer.texture === undefined
      ? {}
      : { texture: input.renderer.texture }),
    ...(input.renderer.sampler === undefined
      ? {}
      : { sampler: input.renderer.sampler }),
    atlasFrameCount:
      input.textureSheetAnimation.enabled === true
        ? textureSheetTiles[0] * textureSheetTiles[1]
        : 1,
    textureSheetTiles,
    textureSheetStartFrame: scalarValueRange(
      input.textureSheetAnimation.startFrame,
      0,
      0,
    ).max,
    textureSheetCycleCount: input.textureSheetAnimation.cycleCount,
    textureSheetFrameOverTime: sortedCurve(textureSheetFrameOverTime),
    sizeOverLifetime: sortedCurve(sizeCurve),
    colorOverLifetime: sortedGradient(colorCurve),
  };
}

function normalizeSoftParticles(
  input: boolean | ParticleSoftParticleInput | undefined,
): ParticleSoftParticleInput {
  if (input === true) {
    return { enabled: true, nearFade: 0, farFade: 1 };
  }
  if (input === false || input === undefined) {
    return { enabled: false, nearFade: 0, farFade: 0 };
  }

  return {
    enabled: input.enabled ?? true,
    nearFade: input.nearFade ?? 0,
    farFade: input.farFade ?? 1,
  };
}

function scalarValueRange(
  input: ParticleScalarValue | ParticleVec3Value,
  fallbackMin: number,
  fallbackMax: number,
): ParticleScalarRange {
  if (typeof input === "number") {
    return { min: input, max: input };
  }
  if (Array.isArray(input)) {
    const value = input[0] ?? fallbackMin;
    return { min: value, max: value };
  }
  if (input === undefined || input === null) {
    return { min: fallbackMin, max: fallbackMax };
  }
  if ("mode" in input) {
    switch (input.mode) {
      case "constant":
        if ("color" in input) {
          return { min: fallbackMin, max: fallbackMax };
        }
        if ("value" in input) {
          const value = Array.isArray(input.value)
            ? (input.value[0] ?? fallbackMin)
            : input.value;
          return { min: value, max: value };
        }
        break;
      case "random-between-two-constants":
        return { min: input.min, max: input.max };
      case "curve": {
        if (!("curve" in input)) {
          return {
            min: Math.min(
              scalarValueRange(input.x, fallbackMin, fallbackMax).min,
              scalarValueRange(input.y, fallbackMin, fallbackMax).min,
              scalarValueRange(input.z, fallbackMin, fallbackMax).min,
            ),
            max: Math.max(
              scalarValueRange(input.x, fallbackMin, fallbackMax).max,
              scalarValueRange(input.y, fallbackMin, fallbackMax).max,
              scalarValueRange(input.z, fallbackMin, fallbackMax).max,
            ),
          };
        }
        const values = input.curve.map(
          (key: ParticleCurveKeyframe) => key.value,
        );
        const multiplier = input.multiplier ?? 1;
        return finiteMinMax(values, fallbackMin, fallbackMax, multiplier);
      }
      case "random-between-two-curves": {
        const values = [
          ...input.minCurve.map((key: ParticleCurveKeyframe) => key.value),
          ...input.maxCurve.map((key: ParticleCurveKeyframe) => key.value),
        ];
        const multiplier = input.multiplier ?? 1;
        return finiteMinMax(values, fallbackMin, fallbackMax, multiplier);
      }
      case "random-between-two-vectors":
        return {
          min: Math.min(
            input.min[0] ?? fallbackMin,
            input.max[0] ?? fallbackMax,
          ),
          max: Math.max(
            input.min[0] ?? fallbackMin,
            input.max[0] ?? fallbackMax,
          ),
        };
    }
  }
  if ("min" in input || "max" in input) {
    const min = input.min ?? fallbackMin;
    const max = input.max ?? input.min ?? fallbackMax;
    return { min, max };
  }

  return { min: fallbackMin, max: fallbackMax };
}

function scalarValueCurve(
  input: ParticleScalarValue | ParticleVec3Value,
  fallback: number,
): readonly ParticleCurveKeyframe[] {
  if (typeof input === "object" && input !== null && !Array.isArray(input)) {
    if ("mode" in input) {
      if (input.mode === "curve") {
        return "curve" in input
          ? input.curve
          : scalarValueCurve(input.x, fallback);
      }
      if (input.mode === "random-between-two-curves") {
        return input.maxCurve;
      }
    }
  }

  const range = scalarValueRange(input, fallback, fallback);
  return [
    { t: 0, value: range.max },
    { t: 1, value: range.max },
  ];
}

function colorValueStart(
  input: ParticleColorValue,
): readonly [number, number, number, number] {
  if (typeof input !== "object" || input === null || !("mode" in input)) {
    return tuple4(input);
  }
  switch (input.mode) {
    case "constant":
      return tuple4(input.color);
    case "random-between-two-colors":
      return tuple4(input.max);
    case "gradient":
      return tuple4(input.gradient[0]?.color ?? [1, 1, 1, 1]);
    case "random-between-two-gradients":
      return tuple4(input.maxGradient[0]?.color ?? [1, 1, 1, 1]);
  }

  return [1, 1, 1, 1];
}

function colorValueGradient(
  input: ParticleColorValue,
  fallback: readonly [number, number, number, number],
): readonly ParticleGradientKeyframe[] {
  if (typeof input !== "object" || input === null || !("mode" in input)) {
    return [
      { t: 0, color: tuple4(input) },
      { t: 1, color: tuple4(input) },
    ];
  }
  switch (input.mode) {
    case "constant":
      return [
        { t: 0, color: tuple4(input.color) },
        { t: 1, color: tuple4(input.color) },
      ];
    case "random-between-two-colors":
      return [
        { t: 0, color: tuple4(input.max) },
        { t: 1, color: tuple4(input.max) },
      ];
    case "gradient":
      return input.gradient;
    case "random-between-two-gradients":
      return input.maxGradient;
  }

  return [
    { t: 0, color: fallback },
    { t: 1, color: fallback },
  ];
}

function vec3ValueMax(
  input: ParticleVec3Value,
): readonly [number, number, number] {
  if (typeof input !== "object" || input === null || !("mode" in input)) {
    return tuple3(input);
  }
  switch (input.mode) {
    case "constant":
      return tuple3(input.value);
    case "random-between-two-vectors":
      return tuple3(input.max);
    case "curve":
      return [
        scalarValueRange(input.x, 0, 0).max,
        scalarValueRange(input.y, 0, 0).max,
        scalarValueRange(input.z, 0, 0).max,
      ];
  }

  return [0, 0, 0];
}

function markUnsupportedModuleFeatures(
  input: ParticleEmitterEffectAssetInput,
  partiallySupportedFields: Set<string>,
  unsupportedFields: Set<string>,
  diagnostics: ParticleEffectRuntimeFeatureDiagnostic[],
): void {
  const partiallySupported: readonly {
    readonly condition: boolean;
    readonly field: string;
    readonly message: string;
    readonly supportedModes: readonly ParticleEffectRuntimeMode[];
    readonly unsupportedModes: readonly ParticleEffectRuntimeMode[];
  }[] = [
    {
      condition:
        input.shape?.type === "donut" ||
        input.shape?.type === "grid" ||
        input.shape?.type === "rectangle" ||
        input.shape?.type === "mesh-surface",
      field: "shape.type",
      message:
        "This emitter shape is implemented for continuous emitters; burst emitters still use authored burst positions and velocity jitter. Mesh-surface sampling uses the authored shape bounds as a deterministic surface proxy.",
      supportedModes: ["continuous"],
      unsupportedModes: ["burst"],
    },
    {
      condition: input.renderer?.renderMode === "mesh",
      field: "renderer.renderMode",
      message:
        "Mesh particle render mode preserves dependencies and uses a distinct runtime variant, but currently renders particles as billboarding impostors instead of instanced mesh geometry.",
      supportedModes: ["burst", "continuous"],
      unsupportedModes: [],
    },
    {
      condition: input.renderer?.renderMode === "trail",
      field: "renderer.renderMode",
      message:
        "Trail render mode uses motion-vector impostor ribbons instead of full trail mesh history.",
      supportedModes: ["burst", "continuous"],
      unsupportedModes: [],
    },
    {
      condition: input.trails?.enabled === true,
      field: "trails",
      message:
        "Particle trails render as motion-vector impostor ribbons; continuous particles honor trail lifetime, ratio, and minimum vertex distance, while burst particles use velocity length.",
      supportedModes: ["continuous"],
      unsupportedModes: ["burst"],
    },
    {
      condition: input.collision?.enabled === true,
      field: "collision",
      message:
        "Collision response is implemented for continuous world-plane particles; burst particle buffers and custom collider callbacks are not applied yet.",
      supportedModes: ["continuous"],
      unsupportedModes: ["burst"],
    },
    {
      condition: input.speedOverLifetime?.enabled === true,
      field: "speedOverLifetime",
      message:
        "Speed over lifetime is implemented for continuous emitters; burst particle buffers do not apply speed-curve modulation yet.",
      supportedModes: ["continuous"],
      unsupportedModes: ["burst"],
    },
    {
      condition: input.colorBySpeed?.enabled === true,
      field: "colorBySpeed",
      message:
        "Color by speed is implemented for continuous emitters; burst particle buffers do not apply speed-dependent color modulation yet.",
      supportedModes: ["continuous"],
      unsupportedModes: ["burst"],
    },
    {
      condition: input.sizeBySpeed?.enabled === true,
      field: "sizeBySpeed",
      message:
        "Size by speed is implemented for continuous emitters; burst particle buffers do not apply speed-dependent size modulation yet.",
      supportedModes: ["continuous"],
      unsupportedModes: ["burst"],
    },
    {
      condition: input.rotationBySpeed?.enabled === true,
      field: "rotationBySpeed",
      message:
        "Rotation by speed is implemented for continuous emitters; burst particle buffers do not apply speed-dependent billboard rotation yet.",
      supportedModes: ["continuous"],
      unsupportedModes: ["burst"],
    },
    {
      condition: input.noise?.enabled === true,
      field: "noise",
      message:
        "Noise/turbulence is implemented for continuous emitters; burst particle buffers do not apply procedural noise yet.",
      supportedModes: ["continuous"],
      unsupportedModes: ["burst"],
    },
    {
      condition:
        input.renderer?.softParticles !== undefined &&
        input.renderer.softParticles !== false,
      field: "renderer.softParticles",
      message:
        "Soft particles fade against scene depth on single-sample default canvas targets; MSAA and offscreen render targets fall back to regular particle rendering.",
      supportedModes: ["burst", "continuous"],
      unsupportedModes: [],
    },
    {
      condition: input.orbitalVelocityOverLifetime?.enabled === true,
      field: "orbitalVelocityOverLifetime",
      message:
        "Orbital velocity is implemented for continuous emitters; burst particle buffers do not apply orbital motion yet.",
      supportedModes: ["continuous"],
      unsupportedModes: ["burst"],
    },
  ];
  const unsupported: readonly [boolean, string, string][] = [
    [
      (input.subEmitters?.length ?? 0) > 0,
      "subEmitters",
      "Subemitters are represented in the schema for importers, but runtime spawning is not implemented yet.",
    ],
  ];

  for (const partial of partiallySupported) {
    const { condition, field, message, supportedModes, unsupportedModes } =
      partial;

    if (!condition) {
      continue;
    }
    partiallySupportedFields.add(field);
    diagnostics.push(
      runtimeFeatureDiagnostic({
        code: "particleEffect.partiallySupportedFeature",
        field,
        severity: "info",
        supportedModes,
        unsupportedModes,
        message,
      }),
    );
  }

  for (const [condition, field, message] of unsupported) {
    if (!condition) {
      continue;
    }
    unsupportedFields.add(field);
    diagnostics.push(
      runtimeFeatureDiagnostic({
        code: "particleEffect.unsupportedFeature",
        field,
        severity: "warning",
        supportedModes: [],
        unsupportedModes: ["burst", "continuous"],
        message,
      }),
    );
  }
}

function sortedCurve(
  curve: readonly ParticleCurveKeyframe[],
): readonly ParticleCurveKeyframe[] {
  return [...curve].sort((a, b) => a.t - b.t);
}

function sortedGradient(
  gradient: readonly ParticleGradientKeyframe[],
): readonly ParticleGradientKeyframe[] {
  return [...gradient].sort((a, b) => a.t - b.t);
}

function sampleCurve(
  curve: readonly ParticleCurveKeyframe[],
  t: number,
): number {
  if (curve.length === 0) {
    return 1;
  }

  const first = curve[0] as ParticleCurveKeyframe;
  const last = curve[curve.length - 1] as ParticleCurveKeyframe;

  if (t <= first.t) {
    return first.value;
  }
  if (t >= last.t) {
    return last.value;
  }

  for (let index = 1; index < curve.length; index += 1) {
    const next = curve[index] as ParticleCurveKeyframe;
    const previous = curve[index - 1] as ParticleCurveKeyframe;

    if (t <= next.t) {
      const span = Math.max(0.000001, next.t - previous.t);
      const f = (t - previous.t) / span;
      return previous.value + (next.value - previous.value) * f;
    }
  }

  return last.value;
}

function sampleGradient(
  gradient: readonly ParticleGradientKeyframe[],
  t: number,
): readonly [number, number, number, number] {
  if (gradient.length === 0) {
    return [1, 1, 1, 1];
  }

  const first = gradient[0] as ParticleGradientKeyframe;
  const last = gradient[gradient.length - 1] as ParticleGradientKeyframe;

  if (t <= first.t) {
    return tuple4(first.color);
  }
  if (t >= last.t) {
    return tuple4(last.color);
  }

  for (let index = 1; index < gradient.length; index += 1) {
    const next = gradient[index] as ParticleGradientKeyframe;
    const previous = gradient[index - 1] as ParticleGradientKeyframe;

    if (t <= next.t) {
      const span = Math.max(0.000001, next.t - previous.t);
      const f = (t - previous.t) / span;
      const a = tuple4(previous.color);
      const b = tuple4(next.color);

      return [
        lerp(a[0], b[0], f),
        lerp(a[1], b[1], f),
        lerp(a[2], b[2], f),
        lerp(a[3], b[3], f),
      ];
    }
  }

  return tuple4(last.color);
}

function validateRange(
  rangeValue: ParticleScalarRange,
  field: string,
  diagnostics: ParticleEffectDiagnostic[],
): void {
  if (
    !Number.isFinite(rangeValue.min) ||
    !Number.isFinite(rangeValue.max) ||
    rangeValue.min < 0 ||
    rangeValue.max < rangeValue.min
  ) {
    diagnostics.push(diagnostic("particleEffect.invalidRange", field));
  }
}

function validateFiniteRange(
  rangeValue: ParticleScalarRange,
  field: string,
  diagnostics: ParticleEffectDiagnostic[],
): void {
  if (
    !Number.isFinite(rangeValue.min) ||
    !Number.isFinite(rangeValue.max) ||
    rangeValue.max < rangeValue.min
  ) {
    diagnostics.push(diagnostic("particleEffect.invalidRange", field));
  }
}

function validateCurve(
  curve: readonly ParticleCurveKeyframe[],
  field: string,
  diagnostics: ParticleEffectDiagnostic[],
): void {
  if (
    curve.length === 0 ||
    curve.some(
      (key, index) =>
        !Number.isFinite(key.t) ||
        key.t < 0 ||
        key.t > 1 ||
        !Number.isFinite(key.value) ||
        (index > 0 && key.t < (curve[index - 1]?.t ?? 0)),
    )
  ) {
    diagnostics.push(diagnostic("particleEffect.invalidCurve", field));
  }
}

function validateGradient(
  gradient: readonly ParticleGradientKeyframe[],
  field: string,
  diagnostics: ParticleEffectDiagnostic[],
): void {
  if (
    gradient.length === 0 ||
    gradient.some(
      (key, index) =>
        !Number.isFinite(key.t) ||
        key.t < 0 ||
        key.t > 1 ||
        !tuple4(key.color).every(Number.isFinite) ||
        (index > 0 && key.t < (gradient[index - 1]?.t ?? 0)),
    )
  ) {
    diagnostics.push(diagnostic("particleEffect.invalidGradient", field));
  }
}

function validateShapeModule(
  shape: Required<ParticleShapeModuleInput>,
  diagnostics: ParticleEffectDiagnostic[],
): void {
  if (
    shape.radius < 0 ||
    shape.radiusThickness < 0 ||
    shape.radiusThickness > 1 ||
    shape.arc < 0 ||
    shape.angle < 0 ||
    shape.randomDirectionAmount < 0 ||
    shape.sphericalDirectionAmount < 0 ||
    !tuple3(shape.box).every(Number.isFinite) ||
    !tuple3(shape.scale).every(Number.isFinite)
  ) {
    diagnostics.push(diagnostic("particleEffect.invalidShape", "shape"));
  }
}

function validateRendererModule(
  renderer: ParticleEmitterEffectAsset["renderer"],
  diagnostics: ParticleEffectDiagnostic[],
): void {
  if (
    renderer.softParticles.nearFade !== undefined &&
    renderer.softParticles.farFade !== undefined &&
    renderer.softParticles.nearFade > renderer.softParticles.farFade
  ) {
    diagnostics.push(
      diagnostic("particleEffect.invalidRenderer", "renderer.softParticles"),
    );
  }
}

function validateTextureSheetAnimationModule(
  textureSheetAnimation: Required<ParticleTextureSheetAnimationModuleInput>,
  diagnostics: ParticleEffectDiagnostic[],
): void {
  const [columns, rows] = textureSheetAnimation.tiles;
  const startFrame = scalarValueRange(textureSheetAnimation.startFrame, 0, 0);

  if (
    !positiveInteger(columns ?? 0) ||
    !positiveInteger(rows ?? 0) ||
    !positiveFinite(textureSheetAnimation.cycleCount) ||
    startFrame.min < 0 ||
    !Number.isFinite(startFrame.min) ||
    !Number.isFinite(startFrame.max)
  ) {
    diagnostics.push(
      diagnostic("particleEffect.invalidRange", "textureSheetAnimation"),
    );
  }
}

function diagnostic(
  code: ParticleEffectDiagnosticCode,
  field: string,
): ParticleEffectDiagnostic {
  return {
    code,
    field,
    message: `${field} is not valid for a GPU particle effect.`,
  };
}

function runtimeFeatureDiagnostic(
  diagnostic: ParticleEffectRuntimeFeatureDiagnostic,
): ParticleEffectRuntimeFeatureDiagnostic {
  return diagnostic;
}

function finiteOr(value: number | undefined, fallback: number): number {
  return value === undefined || !Number.isFinite(value) ? fallback : value;
}

function finiteMinMax(
  values: readonly number[],
  fallbackMin: number,
  fallbackMax: number,
  multiplier: number,
): ParticleScalarRange {
  const finite = values
    .filter(Number.isFinite)
    .map((value) => value * multiplier);
  if (finite.length === 0) {
    return { min: fallbackMin, max: fallbackMax };
  }

  return {
    min: Math.min(...finite),
    max: Math.max(...finite),
  };
}

function positiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function positiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function nonNegativeFinite(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function tuple3(value: Vec3Like): readonly [number, number, number] {
  return [value[0] ?? 0, value[1] ?? 0, value[2] ?? 0];
}

function tuple4(value: Vec4Like): readonly [number, number, number, number] {
  return [value[0] ?? 0, value[1] ?? 0, value[2] ?? 0, value[3] ?? 0];
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
