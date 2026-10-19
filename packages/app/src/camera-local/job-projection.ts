import type { CameraLocalJobSeed, CameraLocalVec3 } from "./types.js";

/**
 * Representation check for the existing job's zero-roll analytic camera model.
 * This only projects its initial pose; it contains no fitting or optimization.
 * Keep the degree/radian round trip because the job parameterization uses degrees.
 */
export function jobProjection(seed: CameraLocalJobSeed) {
  const radians = Math.PI / 180;
  const delta = seed.camera.translation.map(
    (v, i) => v - seed.camera.lookAt[i]!,
  );
  const distance = Math.hypot(...delta);
  const azimuthDegrees = Math.atan2(delta[0]!, delta[2]!) / radians;
  const elevationDegrees =
    Math.atan2(delta[1]!, Math.hypot(delta[0]!, delta[2]!)) / radians;
  const az = azimuthDegrees * radians;
  const el = elevationDegrees * radians;
  const backward: CameraLocalVec3 = [
    Math.sin(az) * Math.cos(el),
    Math.sin(el),
    Math.cos(az) * Math.cos(el),
  ];
  const right: CameraLocalVec3 = [Math.cos(az), 0, -Math.sin(az)];
  const up: CameraLocalVec3 = [
    -Math.sin(az) * Math.sin(el),
    Math.cos(el),
    -Math.cos(az) * Math.sin(el),
  ];
  const translation = seed.camera.lookAt.map(
    (v, i) => v + backward[i]! * distance,
  ) as unknown as CameraLocalVec3;
  const dot = (a: readonly number[], b: CameraLocalVec3) =>
    a.reduce((sum, value, i) => sum + value * b[i]!, 0);
  return {
    translation,
    pixels: seed.landmarks.map((point): readonly [number, number] | null => {
      const delta = point.world.map((v, i) => v - translation[i]!);
      const depth = -dot(delta, backward);
      if (seed.camera.projection === "perspective" && Math.abs(depth) < 1e-10)
        return null;
      const scale =
        seed.camera.projection === "perspective"
          ? seed.viewport.height /
            (2 * Math.tan((seed.camera.fovYDegrees * radians) / 2) * depth)
          : seed.viewport.height / seed.camera.orthographicHeight;
      const pixel = [
        seed.viewport.width / 2 + dot(delta, right) * scale,
        seed.viewport.height / 2 - dot(delta, up) * scale,
      ] as const;
      return pixel.every(Number.isFinite) ? pixel : null;
    }),
  };
}
