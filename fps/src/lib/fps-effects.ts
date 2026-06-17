export type SpriteUvRect = readonly [number, number, number, number];
export type SpriteAnimationFrame = SpriteUvRect | null;

export interface SpriteFrameSelection {
  readonly atlasFrame: number;
  readonly visible: boolean;
  readonly uvRect: SpriteUvRect;
}

const FULL_SPRITE_UV: SpriteUvRect = [0, 0, 1, 1];

export function sourceSpriteFrameForLife(
  frames: readonly SpriteAnimationFrame[],
  normalizedLife: number,
): SpriteFrameSelection {
  if (frames.length === 0 || normalizedLife <= 0) {
    return {
      atlasFrame: 0,
      visible: false,
      uvRect: FULL_SPRITE_UV,
    };
  }

  const elapsed = 1 - clamp01(normalizedLife);
  const atlasFrame = Math.min(
    frames.length - 1,
    Math.max(0, Math.floor(elapsed * frames.length)),
  );
  const uvRect = frames[atlasFrame] ?? null;

  return {
    atlasFrame,
    visible: uvRect !== null,
    uvRect: uvRect ?? FULL_SPRITE_UV,
  };
}

export function sourceSpriteAlphaForFrame(
  frame: Pick<SpriteFrameSelection, "visible">,
): number {
  return frame.visible ? 1 : 0;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
