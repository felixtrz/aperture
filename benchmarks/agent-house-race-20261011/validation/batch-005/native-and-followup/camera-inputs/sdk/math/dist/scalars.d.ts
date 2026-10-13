import type { Vec3Like } from "./types.js";
export declare function read(values: ArrayLike<number>, index: number, label: string): number;
export declare function v3(values: Vec3Like, index: number): number;
export declare function clamp(value: number, min: number, max: number): number;
export declare function clamp01(value: number): number;
export declare function lerp(from: number, to: number, t: number): number;
export declare function inverseLerp(value: number, inMin: number, inMax: number): number;
export declare function remap(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number;
export declare function remapClamped(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number;
export declare function expSmoothingAlpha(delta: number, smoothing: number): number;
export declare function lerpAngle(from: number, to: number, t: number): number;
export declare function hexColor(hex: number, alpha?: number): [number, number, number, number];
export declare function assertFinitePositive(value: number, label: string): void;
export declare function assertFiniteNumber(value: number, label: string): void;
//# sourceMappingURL=scalars.d.ts.map