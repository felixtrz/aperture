import type { AssetHandle, SamplerHandle, TextureHandle, Vec3Like, Vec4Like } from "@aperture-engine/simulation";
import { ParticleBlendMode, ParticleSimulationSpace } from "./authoring.js";
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
export type ParticleScalarValue = number | Partial<ParticleScalarRange> | ParticleConstantScalar | ParticleRandomScalar | ParticleCurveScalar | ParticleRandomCurveScalar;
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
export type ParticleColorValue = Vec4Like | ParticleConstantColor | ParticleRandomColor | ParticleGradientColor | ParticleRandomGradientColor;
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
export type ParticleVec3Value = Vec3Like | ParticleConstantVec3 | ParticleRandomVec3 | ParticleCurveVec3;
export type ParticleCullingMode = "automatic" | "always-simulate" | "pause-and-catch-up" | "pause";
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
export type ParticleShapeType = "point" | "sphere" | "hemisphere" | "cone" | "circle" | "box" | "donut" | "grid" | "rectangle" | "mesh-surface";
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
export type ParticleRenderMode = "billboard" | "stretched-billboard" | "horizontal-billboard" | "vertical-billboard" | "mesh" | "trail";
export type ParticleSortMode = "none" | "distance" | "oldest" | "youngest";
export interface ParticleSoftParticleInput {
    readonly enabled?: boolean;
    readonly nearFade?: number;
    readonly farFade?: number;
}
export interface ParticleRendererModuleInput {
    readonly renderMode?: ParticleRenderMode;
    readonly blendMode?: ParticleBlendMode;
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
export type ParticleEffectAssetInput = ParticleEmitterEffectAssetInput | ParticleCompositeEffectAssetInput;
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
    readonly blendMode: ParticleBlendMode;
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
    readonly renderer: Required<Omit<ParticleRendererModuleInput, "texture" | "sampler" | "softParticles">> & {
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
export type ParticleEffectAsset = ParticleEmitterEffectAsset | ParticleCompositeEffectAsset;
/** Narrows a particle effect asset to a leaf emitter effect. */
export declare function isParticleEmitterEffectAsset(asset: ParticleEffectAsset): asset is ParticleEmitterEffectAsset;
/** Narrows a particle effect asset to a composite effect. */
export declare function isParticleCompositeEffectAsset(asset: ParticleEffectAsset): asset is ParticleCompositeEffectAsset;
export type ParticleEffectRuntimeMode = "burst" | "continuous";
export type ParticleEffectRuntimeFeatureDiagnosticCode = "particleEffect.unsupportedFeature" | "particleEffect.partiallySupportedFeature";
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
export type ParticleEffectDiagnosticCode = "particleEffect.invalidVersion" | "particleEffect.legacyField" | "particleEffect.invalidCapacity" | "particleEffect.invalidDuration" | "particleEffect.invalidEmissionRate" | "particleEffect.invalidLinearDamping" | "particleEffect.invalidBurst" | "particleEffect.invalidRange" | "particleEffect.invalidAtlasFrameCount" | "particleEffect.invalidCurve" | "particleEffect.invalidGradient" | "particleEffect.invalidModule" | "particleEffect.invalidShape" | "particleEffect.invalidRenderer" | "particleEffect.invalidComposite" | "particleEffect.compositeMixedModules" | "particleEffect.invalidCompositeEmitter" | "particleEffect.invalidCompositeChildEffect";
export interface ParticleEffectDiagnostic {
    readonly code: ParticleEffectDiagnosticCode;
    readonly field: string;
    readonly message: string;
}
export interface ParticleEffectValidationReport {
    readonly valid: boolean;
    readonly diagnostics: readonly ParticleEffectDiagnostic[];
}
/**
 * Detects whether a particle effect input describes a composite effect. An
 * input is composite when it sets `type: "composite"` or carries an `emitters`
 * array. Leaf Shuriken modules (`main`, `emission`, ...) belong to the emitter
 * form; mixing the two is rejected by {@link validateParticleEffectInput}.
 */
export declare function isCompositeEffectInput(input: ParticleEffectAssetInput): input is ParticleCompositeEffectAssetInput;
/**
 * Normalizes a particle effect input into a runtime-ready asset. Dispatches to
 * the leaf emitter or composite normalizer based on the input shape, so a
 * single authoring entry point covers both Shuriken-style emitters and
 * Unity-prefab-style composite VFX.
 */
export declare function createParticleEffectAsset(input?: ParticleEffectAssetInput): ParticleEffectAsset;
export declare function createParticleEmitterEffectAsset(input?: ParticleEmitterEffectAssetInput): ParticleEmitterEffectAsset;
export declare function createParticleCompositeEffectAsset(input?: ParticleCompositeEffectAssetInput): ParticleCompositeEffectAsset;
export declare function analyzeParticleEffectRuntimeFeatures(input?: ParticleEffectRuntimeFeatureInput): ParticleEffectRuntimeFeatureReport;
export declare function validateParticleEffectAsset(asset: ParticleEffectAsset): ParticleEffectValidationReport;
export declare function validateParticleCompositeEffectAsset(asset: ParticleCompositeEffectAsset): ParticleEffectValidationReport;
export declare function validateParticleEffectInput(input: unknown): ParticleEffectValidationReport;
export declare function packParticleEffectCurves(input: {
    readonly sizeOverLifetime: readonly ParticleCurveKeyframe[];
    readonly colorOverLifetime: readonly ParticleGradientKeyframe[];
    readonly sampleCount?: number;
}): ParticleEffectCurveTable;
export declare function particleEffectDependencies(asset: ParticleEffectAsset): readonly AssetHandle[];
//# sourceMappingURL=effects.d.ts.map