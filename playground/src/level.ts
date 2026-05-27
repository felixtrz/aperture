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
  | "blockLowLong"
  | "blockLarge"
  | "platform"
  | "platformOverhang"
  | "coin"
  | "jewel"
  | "tree"
  | "crate"
  | "flag"
  | "spikes"
  | "heart"
  | "spring"
  | "sign"
  | "fence";

export interface PlatformSpec {
  readonly key: string;
  readonly asset: Extract<
    LevelAssetId,
    "block" | "blockLong" | "blockLowLong" | "blockLarge" | "platform"
  >;
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

export interface CloudSpec {
  readonly key: string;
  readonly position: Vec3;
  readonly scale: Vec3;
}

export const PLAYER = {
  start: [-5.65, 1.05, 0.12] as const,
  feetOffset: 0.62,
  visualScale: [0.95, 1, 0.95] as const,
  assetScale: [0.86, 0.86, 0.86] as const,
  width: 0.54,
  height: 1.05,
  speed: 4.45,
  jumpSpeed: 7.1,
  gravity: -18.25,
  fallLimit: -2.35,
};

export const CAMERA = {
  distance: 8.6,
  yOffset: 3.05,
  minY: 3.55,
  targetYOffset: 0.1,
  smoothing: 0.18,
} as const;

export const LEVEL = {
  startX: -5.65,
  goalX: 7.45,
  platforms: [
    {
      key: "start",
      asset: "blockLong",
      position: [-4.85, 0, 0],
      scale: [1.45, 0.82, 1],
      bounds: { x: -4.85, y: 0, width: 4.1, height: 0.72 },
    },
    {
      key: "step-one",
      asset: "block",
      position: [-1.55, 0.72, 0],
      scale: [0.84, 0.68, 1],
      bounds: { x: -1.55, y: 0.72, width: 1.55, height: 0.58 },
    },
    {
      key: "middle",
      asset: "blockLong",
      position: [1.05, 1.35, 0],
      scale: [1.18, 0.64, 1],
      bounds: { x: 1.05, y: 1.35, width: 3.25, height: 0.58 },
    },
    {
      key: "upper",
      asset: "platform",
      position: [4.1, 2.18, 0],
      scale: [1.35, 0.72, 1],
      bounds: { x: 4.1, y: 2.18, width: 2.55, height: 0.44 },
    },
    {
      key: "finish",
      asset: "blockLong",
      position: [7.25, 0.5, 0],
      scale: [1.32, 0.72, 1],
      bounds: { x: 7.25, y: 0.5, width: 3.55, height: 0.62 },
    },
  ] satisfies readonly PlatformSpec[],
  gems: [
    {
      asset: "coin",
      position: [-5.55, 1.22, 0],
      scale: [0.52, 0.52, 0.52],
      radius: 0.55,
    },
    {
      asset: "jewel",
      position: [-4.35, 1.62, 0],
      scale: [0.56, 0.56, 0.56],
      radius: 0.78,
    },
    {
      asset: "coin",
      position: [-1.55, 1.82, 0],
      scale: [0.52, 0.52, 0.52],
      radius: 0.55,
    },
    {
      asset: "coin",
      position: [1.05, 2.38, 0],
      scale: [0.52, 0.52, 0.52],
      radius: 0.55,
    },
    {
      asset: "jewel",
      position: [4.1, 3.22, 0],
      scale: [0.6, 0.6, 0.6],
      radius: 0.6,
    },
    {
      asset: "coin",
      position: [8.1, 1.48, 0],
      scale: [0.52, 0.52, 0.52],
      radius: 0.84,
    },
  ] satisfies readonly GemSpec[],
  hazards: [
    {
      key: "low-spikes",
      asset: "spikes",
      position: [2.75, -0.08, 0],
      scale: [0.9, 0.9, 0.9],
      bounds: { x: 2.75, y: 0.12, width: 1.0, height: 0.46 },
    },
    {
      key: "finish-spikes",
      asset: "spikes",
      position: [5.75, -0.08, 0],
      scale: [0.82, 0.82, 0.82],
      bounds: { x: 5.75, y: 0.12, width: 0.92, height: 0.42 },
    },
  ] satisfies readonly HazardSpec[],
  props: [
    {
      key: "left-tree",
      asset: "tree",
      position: [-6.65, 0.2, -0.8],
      scale: [0.86, 0.86, 0.86],
    },
    {
      key: "start-sign",
      asset: "sign",
      position: [-5.95, 0.62, -0.32],
      scale: [0.56, 0.56, 0.56],
      rotationEulerDegrees: [0, 18, 0],
    },
    {
      key: "crate-stack",
      asset: "crate",
      position: [-3.15, 0.68, -0.22],
      scale: [0.58, 0.58, 0.58],
    },
    {
      key: "spring",
      asset: "spring",
      position: [-0.52, 1.05, -0.08],
      scale: [0.46, 0.46, 0.46],
    },
    {
      key: "heart",
      asset: "heart",
      position: [2.45, 2.74, -0.12],
      scale: [0.48, 0.48, 0.48],
      rotationEulerDegrees: [0, 24, 0],
    },
    {
      key: "finish-flag",
      asset: "flag",
      position: [8.26, 1.16, -0.08],
      scale: [0.76, 0.76, 0.76],
      rotationEulerDegrees: [0, -24, 0],
    },
    {
      key: "finish-fence",
      asset: "fence",
      position: [7.25, 1.1, -0.58],
      scale: [0.78, 0.78, 0.78],
    },
  ] satisfies readonly PropSpec[],
  clouds: [
    {
      key: "cloud-left",
      position: [-4.8, 4.7, -1.5],
      scale: [1.35, 0.42, 0.22],
    },
    {
      key: "cloud-mid",
      position: [0.8, 5.2, -1.7],
      scale: [1.6, 0.48, 0.22],
    },
    {
      key: "cloud-right",
      position: [6.5, 4.85, -1.55],
      scale: [1.45, 0.44, 0.22],
    },
  ] satisfies readonly CloudSpec[],
} as const;

export const TOTAL_GEMS = LEVEL.gems.length;
