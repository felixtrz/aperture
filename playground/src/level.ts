export type Vec3 = readonly [number, number, number];

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export type LevelAssetId =
  | "block"
  | "blockLong"
  | "platform"
  | "coin"
  | "jewel"
  | "tree"
  | "crate"
  | "flag"
  | "spikes"
  | "heart";

export interface PlatformSpec {
  readonly key: string;
  readonly asset: Extract<LevelAssetId, "block" | "blockLong" | "platform">;
  readonly position: Vec3;
  readonly scale: Vec3;
  readonly bounds: Rect;
}

export interface PropSpec {
  readonly key: string;
  readonly asset: Exclude<LevelAssetId, "coin" | "jewel" | "spikes">;
  readonly position: Vec3;
  readonly scale: Vec3;
  readonly rotationEulerDegrees?: Vec3;
}

export interface GemSpec {
  readonly asset: Extract<LevelAssetId, "coin" | "jewel">;
  readonly position: Vec3;
  readonly scale: Vec3;
  readonly radius: number;
}

export interface HazardSpec {
  readonly key: string;
  readonly asset: Extract<LevelAssetId, "spikes">;
  readonly position: Vec3;
  readonly scale: Vec3;
  readonly bounds: Rect;
}

export const PLAYER = {
  start: [-4.7, 0.98, 0.12] as const,
  feetOffset: 0.62,
  visualScale: [1, 1, 1] as const,
  assetScale: [0.86, 0.86, 0.86] as const,
  width: 0.55,
  height: 1.05,
  speed: 4.2,
  jumpSpeed: 6.8,
  gravity: -17.5,
  fallLimit: -2.2,
};

export const CAMERA = {
  distance: 8.8,
  yOffset: 3.1,
  minY: 3.55,
  targetYOffset: 0.05,
} as const;

export const LEVEL = {
  goalX: 5.65,
  platforms: [
    {
      key: "start",
      asset: "blockLong",
      position: [-3.8, 0, 0],
      scale: [1.4, 0.8, 1],
      bounds: { x: -3.8, y: 0, width: 3.9, height: 0.72 },
    },
    {
      key: "middle",
      asset: "blockLong",
      position: [0.25, 0.85, 0],
      scale: [1.15, 0.65, 1],
      bounds: { x: 0.25, y: 0.85, width: 3.2, height: 0.58 },
    },
    {
      key: "upper",
      asset: "platform",
      position: [3.1, 1.65, 0],
      scale: [1.25, 0.7, 1],
      bounds: { x: 3.1, y: 1.65, width: 2.4, height: 0.44 },
    },
    {
      key: "finish",
      asset: "blockLong",
      position: [5.95, 0.35, 0],
      scale: [1.15, 0.7, 1],
      bounds: { x: 5.95, y: 0.35, width: 3.1, height: 0.62 },
    },
  ] satisfies readonly PlatformSpec[],
  gems: [
    {
      asset: "coin",
      position: [-3.7, 1.15, 0],
      scale: [0.55, 0.55, 0.55],
      radius: 0.55,
    },
    {
      asset: "jewel",
      position: [-1.0, 1.3, 0],
      scale: [0.55, 0.55, 0.55],
      radius: 0.55,
    },
    {
      asset: "coin",
      position: [0.25, 1.95, 0],
      scale: [0.55, 0.55, 0.55],
      radius: 0.55,
    },
    {
      asset: "jewel",
      position: [3.1, 2.65, 0],
      scale: [0.58, 0.58, 0.58],
      radius: 0.58,
    },
    {
      asset: "coin",
      position: [5.5, 1.35, 0],
      scale: [0.55, 0.55, 0.55],
      radius: 0.55,
    },
  ] satisfies readonly GemSpec[],
  hazards: [
    {
      key: "pit-spikes",
      asset: "spikes",
      position: [1.85, -0.12, 0],
      scale: [0.85, 0.85, 0.85],
      bounds: { x: 1.85, y: 0.1, width: 1.0, height: 0.46 },
    },
  ] satisfies readonly HazardSpec[],
  props: [
    {
      key: "pine-left",
      asset: "tree",
      position: [-5.4, 0.14, -0.72],
      scale: [0.82, 0.82, 0.82],
    },
    {
      key: "crate-left",
      asset: "crate",
      position: [-2.55, 0.66, -0.18],
      scale: [0.62, 0.62, 0.62],
    },
    {
      key: "heart",
      asset: "heart",
      position: [1.65, 2.7, -0.12],
      scale: [0.5, 0.5, 0.5],
      rotationEulerDegrees: [0, 20, 0],
    },
    {
      key: "finish-flag",
      asset: "flag",
      position: [6.75, 0.98, -0.05],
      scale: [0.72, 0.72, 0.72],
      rotationEulerDegrees: [0, -25, 0],
    },
  ] satisfies readonly PropSpec[],
} as const;

export const TOTAL_GEMS = LEVEL.gems.length;
