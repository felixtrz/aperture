import type {
  AssetHandle,
  SamplerHandle,
  TextureHandle,
  Vec3Like,
  Vec4Like,
} from "@aperture-engine/simulation";
import { SpriteBlendMode } from "../rendering/authoring-types.js";

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
}

export interface ParticleEffectAssetInput {
  readonly label?: string;
  readonly capacity?: number;
  readonly duration?: number;
  readonly looping?: boolean;
  readonly prewarm?: boolean;
  readonly emissionRate?: number;
  readonly bursts?: readonly ParticleBurst[];
  readonly lifetime?: Partial<ParticleScalarRange>;
  readonly startSpeed?: Partial<ParticleScalarRange>;
  readonly startSize?: Partial<ParticleScalarRange>;
  readonly startColor?: Vec4Like;
  readonly endColor?: Vec4Like;
  readonly gravity?: Vec3Like;
  readonly blendMode?: SpriteBlendMode;
  readonly texture?: TextureHandle | null;
  readonly sampler?: SamplerHandle | null;
  readonly atlasFrameCount?: number;
  readonly sizeOverLifetime?: readonly ParticleCurveKeyframe[];
  readonly colorOverLifetime?: readonly ParticleGradientKeyframe[];
  readonly curveSampleCount?: number;
}

export interface ParticleEffectCurveTable {
  readonly sampleCount: number;
  /** One float per normalized lifetime sample. */
  readonly sizeOverLifetime: Float32Array;
  /** RGBA, four floats per normalized lifetime sample. */
  readonly colorOverLifetime: Float32Array;
}

export interface ParticleEffectAsset {
  readonly kind: "particle-effect";
  readonly label: string;
  readonly capacity: number;
  readonly duration: number;
  readonly looping: boolean;
  readonly prewarm: boolean;
  readonly emissionRate: number;
  readonly bursts: readonly ParticleBurst[];
  readonly lifetime: ParticleScalarRange;
  readonly startSpeed: ParticleScalarRange;
  readonly startSize: ParticleScalarRange;
  readonly startColor: readonly [number, number, number, number];
  readonly endColor: readonly [number, number, number, number];
  readonly gravity: readonly [number, number, number];
  readonly blendMode: SpriteBlendMode;
  readonly texture?: TextureHandle | null;
  readonly sampler?: SamplerHandle | null;
  readonly atlasFrameCount: number;
  readonly sizeOverLifetime: readonly ParticleCurveKeyframe[];
  readonly colorOverLifetime: readonly ParticleGradientKeyframe[];
  readonly curves: ParticleEffectCurveTable;
}

export type ParticleEffectDiagnosticCode =
  | "particleEffect.invalidCapacity"
  | "particleEffect.invalidDuration"
  | "particleEffect.invalidEmissionRate"
  | "particleEffect.invalidBurst"
  | "particleEffect.invalidRange"
  | "particleEffect.invalidAtlasFrameCount"
  | "particleEffect.invalidCurve"
  | "particleEffect.invalidGradient";

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

export function createParticleEffectAsset(
  input: ParticleEffectAssetInput = {},
): ParticleEffectAsset {
  const sizeOverLifetime = sortedCurve(
    input.sizeOverLifetime ?? [
      { t: 0, value: 1 },
      { t: 1, value: 1 },
    ],
  );
  const colorOverLifetime = sortedGradient(
    input.colorOverLifetime ?? [
      { t: 0, color: input.startColor ?? [1, 1, 1, 1] },
      { t: 1, color: input.endColor ?? input.startColor ?? [1, 1, 1, 1] },
    ],
  );
  const asset: Omit<ParticleEffectAsset, "curves"> = {
    kind: "particle-effect",
    label: input.label ?? "ParticleEffect",
    capacity: Math.trunc(input.capacity ?? 1024),
    duration: input.duration ?? 5,
    looping: input.looping ?? true,
    prewarm: input.prewarm ?? false,
    emissionRate: input.emissionRate ?? 64,
    bursts: [...(input.bursts ?? [])].map((burst) => ({
      time: burst.time,
      count: Math.trunc(burst.count),
    })),
    lifetime: range(input.lifetime, 1, 1),
    startSpeed: range(input.startSpeed, 0, 0),
    startSize: range(input.startSize, 1, 1),
    startColor: tuple4(input.startColor ?? [1, 1, 1, 1]),
    endColor: tuple4(input.endColor ?? input.startColor ?? [1, 1, 1, 1]),
    gravity: tuple3(input.gravity ?? [0, 0, 0]),
    blendMode: input.blendMode ?? SpriteBlendMode.Additive,
    ...(input.texture === undefined ? {} : { texture: input.texture }),
    ...(input.sampler === undefined ? {} : { sampler: input.sampler }),
    atlasFrameCount: Math.trunc(input.atlasFrameCount ?? 1),
    sizeOverLifetime,
    colorOverLifetime,
  };

  return Object.freeze({
    ...asset,
    curves: packParticleEffectCurves({
      sizeOverLifetime,
      colorOverLifetime,
      sampleCount: input.curveSampleCount ?? DEFAULT_CURVE_SAMPLE_COUNT,
    }),
  });
}

export function validateParticleEffectAsset(
  asset: ParticleEffectAsset,
): ParticleEffectValidationReport {
  const diagnostics: ParticleEffectDiagnostic[] = [];

  if (!positiveInteger(asset.capacity)) {
    diagnostics.push(diagnostic("particleEffect.invalidCapacity", "capacity"));
  }
  if (!positiveFinite(asset.duration)) {
    diagnostics.push(diagnostic("particleEffect.invalidDuration", "duration"));
  }
  if (!nonNegativeFinite(asset.emissionRate)) {
    diagnostics.push(
      diagnostic("particleEffect.invalidEmissionRate", "emissionRate"),
    );
  }
  validateRange(asset.lifetime, "lifetime", diagnostics);
  validateRange(asset.startSpeed, "startSpeed", diagnostics);
  validateRange(asset.startSize, "startSize", diagnostics);
  if (!positiveInteger(asset.atlasFrameCount)) {
    diagnostics.push(
      diagnostic("particleEffect.invalidAtlasFrameCount", "atlasFrameCount"),
    );
  }
  for (let index = 0; index < asset.bursts.length; index += 1) {
    const burst = asset.bursts[index] as ParticleBurst;
    if (!nonNegativeFinite(burst.time) || !positiveInteger(burst.count)) {
      diagnostics.push(
        diagnostic("particleEffect.invalidBurst", `bursts.${index}`),
      );
    }
  }
  validateCurve(asset.sizeOverLifetime, "sizeOverLifetime", diagnostics);
  validateGradient(asset.colorOverLifetime, "colorOverLifetime", diagnostics);

  return { valid: diagnostics.length === 0, diagnostics };
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
  const dependencies: AssetHandle[] = [];

  if (asset.texture !== undefined && asset.texture !== null) {
    dependencies.push(asset.texture);
  }
  if (asset.sampler !== undefined && asset.sampler !== null) {
    dependencies.push(asset.sampler);
  }

  return dependencies;
}

function range(
  input: Partial<ParticleScalarRange> | undefined,
  fallbackMin: number,
  fallbackMax: number,
): ParticleScalarRange {
  const min = input?.min ?? fallbackMin;
  const max = input?.max ?? input?.min ?? fallbackMax;

  return { min, max };
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
