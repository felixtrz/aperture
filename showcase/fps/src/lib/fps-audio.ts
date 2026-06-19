export const SOURCE_FOOTSTEP_VOLUME_DB = -5;
export const SOURCE_FOOTSTEP_SPEED_THRESHOLD = 1;
export const SOURCE_FOOTSTEP_GAIN = dbToLinearGain(SOURCE_FOOTSTEP_VOLUME_DB);
export const SOURCE_ONE_SHOT_VOLUME_DB = -10;
export const SOURCE_ONE_SHOT_GAIN = dbToLinearGain(SOURCE_ONE_SHOT_VOLUME_DB);
export const SOURCE_ONE_SHOT_MIN_TIME_SCALE = 0.9;
export const SOURCE_ONE_SHOT_MAX_TIME_SCALE = 1.1;

export interface SourceFootstepAudibleInput {
  readonly grounded: boolean;
  readonly velocityX: number;
  readonly velocityZ: number;
  readonly threshold?: number;
}

export type SourceEnemyDamageAudioEvent = "enemy-hurt" | "enemy-destroy";

export function dbToLinearGain(db: number): number {
  return 10 ** (db / 20);
}

export function sourceFootstepAudible(
  input: SourceFootstepAudibleInput,
): boolean {
  const threshold = input.threshold ?? SOURCE_FOOTSTEP_SPEED_THRESHOLD;
  return (
    input.grounded &&
    (Math.abs(input.velocityX) > threshold ||
      Math.abs(input.velocityZ) > threshold)
  );
}

export function sourceOneShotTimeScale(randomUnit: number): number {
  const sample = clamp01(randomUnit);
  return (
    SOURCE_ONE_SHOT_MIN_TIME_SCALE +
    (SOURCE_ONE_SHOT_MAX_TIME_SCALE - SOURCE_ONE_SHOT_MIN_TIME_SCALE) * sample
  );
}

export function sourceEnemyDamageAudioEvents(input: {
  readonly currentHealth: number;
  readonly damage: number;
}): readonly SourceEnemyDamageAudioEvent[] {
  if (input.currentHealth <= 0) return [];

  const remaining = input.currentHealth - input.damage;
  return remaining <= 0
    ? ["enemy-hurt", "enemy-destroy"]
    : ["enemy-hurt"];
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
