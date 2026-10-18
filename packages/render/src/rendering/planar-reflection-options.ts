/** A horizontal, depth-masked scene reflection. All values are portable data. */
export interface WebGpuPlanarReflectionOptions {
  readonly height?: number;
  readonly strength?: number;
  /** Linear RGB attenuation of reflected radiance. Default white; useful for stylized water. */
  readonly tint?: readonly [number, number, number];
  readonly resolutionScale?: number;
  /** World-space tolerance for identifying the receiver surface. */
  readonly surfaceTolerance?: number;
  /** Clip reflected geometry below height + clipBias. */
  readonly clipBias?: number;
  /** UV displacement amplitude; zero produces an undistorted mirror. */
  readonly distortion?: number;
  /** World-space ripple frequency multiplier. Default 1; larger values shorten ripples. */
  readonly distortionFrequency?: number;
  readonly blurPixels?: number;
}

export function resolvePlanarReflectionOptions(
  options: WebGpuPlanarReflectionOptions,
): Required<WebGpuPlanarReflectionOptions> {
  if (options === null || typeof options !== "object" || Array.isArray(options))
    throw new Error("planarReflection must be an options object.");
  const tint = options.tint === undefined ? [1, 1, 1] : options.tint;
  if (
    !Array.isArray(tint) ||
    tint.length !== 3 ||
    [0, 1, 2].some(
      (i) =>
        typeof tint[i] !== "number" ||
        !Number.isFinite(tint[i]) ||
        tint[i]! < 0 ||
        tint[i]! > 1,
    )
  )
    throw new Error(
      "planarReflection.tint must be a linear RGB tuple with values between 0 and 1.",
    );
  for (const key of [
    "height",
    "strength",
    "resolutionScale",
    "surfaceTolerance",
    "clipBias",
    "distortion",
    "distortionFrequency",
    "blurPixels",
  ] as const)
    if (options[key] !== undefined && typeof options[key] !== "number")
      throw new Error(`planarReflection.${key} must be a number.`);
  const result = {
    height: options.height ?? 0,
    strength: options.strength ?? 0.25,
    resolutionScale: options.resolutionScale ?? 0.5,
    surfaceTolerance: options.surfaceTolerance ?? 0.02,
    clipBias: options.clipBias ?? 0.01,
    distortion: options.distortion ?? 0.002,
    distortionFrequency: options.distortionFrequency ?? 1,
    blurPixels: options.blurPixels ?? 1,
  };
  const ranges: Record<keyof typeof result, readonly [number, number]> = {
    height: [-1e6, 1e6],
    strength: [0, 1],
    resolutionScale: [0.1, 1],
    surfaceTolerance: [0.00001, 1],
    clipBias: [0.00001, 1],
    distortion: [0, 0.05],
    distortionFrequency: [0.1, 32],
    blurPixels: [0, 8],
  };
  for (const key of Object.keys(result) as (keyof typeof result)[]) {
    const value = result[key],
      [min, max] = ranges[key];
    if (!Number.isFinite(value) || value < min || value > max)
      throw new Error(
        `planarReflection.${key} must be finite and between ${min} and ${max}.`,
      );
  }
  return { ...result, tint: [tint[0]!, tint[1]!, tint[2]!] };
}
