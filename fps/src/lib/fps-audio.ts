export const SOURCE_FOOTSTEP_VOLUME_DB = -5;
export const SOURCE_FOOTSTEP_SPEED_THRESHOLD = 1;
export const SOURCE_FOOTSTEP_GAIN = dbToLinearGain(SOURCE_FOOTSTEP_VOLUME_DB);

export interface SourceFootstepAudibleInput {
  readonly grounded: boolean;
  readonly velocityX: number;
  readonly velocityZ: number;
  readonly threshold?: number;
}

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
