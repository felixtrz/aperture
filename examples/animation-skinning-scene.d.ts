export const clearColor: readonly [number, number, number, number];
export const animationReadbackSamples: readonly {
  readonly id: string;
  readonly x: number;
  readonly y: number;
}[];
export const CLIP_NAME: string;
export const MORPH_TARGET_COUNT: number;
export const SKIN_JOINT_COUNT: number;
export const ASSET_KEY: string;
export const MESH_NODE_KEY: string;
export function buildAnimationSkinningGlb(): Uint8Array;
export function animationSkinningDataUrl(): string;
export function registerAnimationSkinningRenderAssets(
  aperture: unknown,
  registry: unknown,
): void;
