export type AnimationBlendPath = "translation" | "rotation" | "scale";

export interface WeightedAnimationClipSample {
  readonly clipId: string;
  readonly targetId: string;
  readonly path: AnimationBlendPath;
  readonly weight: number;
  readonly value: readonly number[];
}

export interface AnimationBlendContributor {
  readonly clipId: string;
  readonly weight: number;
  readonly normalizedWeight: number;
}

export interface BlendedAnimationChannel {
  readonly targetId: string;
  readonly path: AnimationBlendPath;
  readonly value: readonly number[];
  readonly weight: number;
  readonly contributors: readonly AnimationBlendContributor[];
}

export interface AnimationClipWeight {
  readonly clipId: string;
  readonly weight: number;
}

export interface AnimationCrossFade {
  readonly fromClipId: string;
  readonly toClipId: string;
  readonly durationSeconds: number;
}

interface AnimationBlendGroup {
  readonly targetId: string;
  readonly path: AnimationBlendPath;
  readonly value: number[];
  readonly contributors: AnimationBlendContributorScratch[];
  totalWeight: number;
  referenceRotation: readonly [number, number, number, number] | null;
}

interface AnimationBlendContributorScratch {
  readonly clipId: string;
  readonly weight: number;
}

export function clampAnimationClipWeight(weight: number): number {
  if (!Number.isFinite(weight) || weight <= 0) {
    return 0;
  }

  return Math.min(weight, 1);
}

export function blendAnimationClipSamples(
  samples: readonly WeightedAnimationClipSample[],
): BlendedAnimationChannel[] {
  const groups = new Map<string, AnimationBlendGroup>();

  for (const sample of samples) {
    const weight = clampAnimationClipWeight(sample.weight);

    if (weight <= 0) {
      continue;
    }

    const key = animationBlendGroupKey(sample.targetId, sample.path);
    let group = groups.get(key);

    if (group === undefined) {
      group = {
        targetId: sample.targetId,
        path: sample.path,
        value: sample.path === "rotation" ? [0, 0, 0, 0] : [0, 0, 0],
        contributors: [],
        totalWeight: 0,
        referenceRotation: null,
      };
      groups.set(key, group);
    }

    const value = normalizeAnimationBlendValue(sample.path, sample.value);

    if (sample.path === "rotation") {
      const rotation: readonly [number, number, number, number] = [
        value[0] ?? 0,
        value[1] ?? 0,
        value[2] ?? 0,
        value[3] ?? 1,
      ];
      group.referenceRotation ??= rotation;
      const sign =
        quaternionDot(group.referenceRotation, rotation) < 0 ? -1 : 1;

      group.value[0] = (group.value[0] ?? 0) + rotation[0] * sign * weight;
      group.value[1] = (group.value[1] ?? 0) + rotation[1] * sign * weight;
      group.value[2] = (group.value[2] ?? 0) + rotation[2] * sign * weight;
      group.value[3] = (group.value[3] ?? 0) + rotation[3] * sign * weight;
    } else {
      group.value[0] = (group.value[0] ?? 0) + (value[0] ?? 0) * weight;
      group.value[1] = (group.value[1] ?? 0) + (value[1] ?? 0) * weight;
      group.value[2] = (group.value[2] ?? 0) + (value[2] ?? 0) * weight;
    }

    group.totalWeight += weight;
    group.contributors.push({ clipId: sample.clipId, weight });
  }

  return Array.from(groups.values(), (group) => {
    const value =
      group.path === "rotation"
        ? normalizeAnimationBlendValue(group.path, group.value)
        : group.value.map((component) => component / group.totalWeight);

    return {
      targetId: group.targetId,
      path: group.path,
      value,
      weight: Number(group.totalWeight.toFixed(6)),
      contributors: group.contributors.map((contributor) => ({
        clipId: contributor.clipId,
        weight: contributor.weight,
        normalizedWeight: Number(
          (contributor.weight / group.totalWeight).toFixed(6),
        ),
      })),
    };
  });
}

export function crossFadeTo(
  fromClipId: string,
  toClipId: string,
  durationSeconds: number,
): AnimationCrossFade {
  return {
    fromClipId,
    toClipId,
    durationSeconds: Math.max(
      0,
      Number.isFinite(durationSeconds) ? durationSeconds : 0,
    ),
  };
}

export function sampleAnimationCrossFade(
  crossFade: AnimationCrossFade,
  elapsedSeconds: number,
): AnimationClipWeight[] {
  const progress =
    crossFade.durationSeconds <= 0
      ? 1
      : clamp01(elapsedSeconds / crossFade.durationSeconds);

  return [
    { clipId: crossFade.fromClipId, weight: Number((1 - progress).toFixed(6)) },
    { clipId: crossFade.toClipId, weight: Number(progress.toFixed(6)) },
  ];
}

function animationBlendGroupKey(
  targetId: string,
  path: AnimationBlendPath,
): string {
  return `${targetId}\u0000${path}`;
}

function normalizeAnimationBlendValue(
  path: AnimationBlendPath,
  value: readonly number[],
): number[] {
  if (path === "rotation") {
    const x = finiteComponent(value, 0, 0);
    const y = finiteComponent(value, 1, 0);
    const z = finiteComponent(value, 2, 0);
    const w = finiteComponent(value, 3, 1);
    const length = Math.hypot(x, y, z, w);

    if (length <= 0 || !Number.isFinite(length)) {
      return [0, 0, 0, 1];
    }

    return [x / length, y / length, z / length, w / length];
  }

  return [
    finiteComponent(value, 0, path === "scale" ? 1 : 0),
    finiteComponent(value, 1, path === "scale" ? 1 : 0),
    finiteComponent(value, 2, path === "scale" ? 1 : 0),
  ];
}

function finiteComponent(
  value: readonly number[],
  index: number,
  fallback: number,
): number {
  const component = value[index];

  return typeof component === "number" && Number.isFinite(component)
    ? component
    : fallback;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return Math.min(value, 1);
}

function quaternionDot(
  a: readonly [number, number, number, number],
  b: readonly [number, number, number, number],
): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
}
