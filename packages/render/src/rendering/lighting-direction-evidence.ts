import type { RenderSnapshot } from "./snapshot-core-types.js";
import type { RenderEntityRef } from "./snapshot-packet-types.js";

type Vector3 = readonly [number, number, number];

export interface DirectionalLightingCameraEvidence {
  readonly viewId: number;
  readonly camera: RenderEntityRef;
  /**
   * Orthogonal camera scale is normalized. Missing/singular/nonfinite matrices
   * and nonorthogonal (sheared) bases are reported without a guessed basis.
   */
  readonly status:
    | "ready"
    | "invalid-light-transform"
    | "invalid-camera-transform"
    | "non-orthogonal-camera-basis";
  /** Components along camera right, up and backward (toward the camera). */
  readonly towardLightCamera: Vector3 | null;
  /** 0 means toward the camera, 180 means along its forward viewing axis. */
  readonly angleFromCameraAxisDegrees: number | null;
  /**
   * [right, down] camera-plane displacement per unit world height, not pixels.
   * Ignores occlusion. Perspective pixel displacement also needs a position.
   * Null when the camera/light is invalid or the light is at/below the horizon.
   */
  readonly groundShadowCameraPlanePerUnitHeight:
    | readonly [number, number]
    | null;
}

export interface DirectionalLightingEvidence {
  readonly lightId: number;
  readonly entity: RenderEntityRef;
  /** Authored unitless intensity and linear RGBA; null for nonfinite inputs. */
  readonly intensity: number | null;
  readonly color: readonly [number, number, number, number] | null;
  /** Geometry validity only; does not judge intensity, color or aesthetics. */
  readonly status: "ready" | "invalid-light-transform";
  /** Normalized world +Z of the light; photons travel in the opposite direction. */
  readonly towardLightWorld: Vector3 | null;
  readonly worldElevationDegrees: number | null;
  readonly groundShadow: {
    readonly status:
      | "ready"
      | "invalid-light-transform"
      | "light-at-or-below-horizon";
    /** Horizontal Y=constant receiver, per unit height above it; ignores occlusion. */
    readonly displacementWorldPerUnitHeight: Vector3 | null;
  };
  readonly cameraStatus: "available" | "no-cameras";
  /** All extracted active views, sorted by view ID and entity. */
  readonly cameras: readonly DirectionalLightingCameraEvidence[];
}

interface CameraBasis {
  readonly right: Vector3;
  readonly up: Vector3;
  readonly backward: Vector3;
}

/** Informational geometry only: no suitability thresholds or rendering changes. */
export function directionalLightingEvidence(
  snapshot: RenderSnapshot,
): DirectionalLightingEvidence[] {
  const lights = snapshot.lights.filter(
    (light) => light.kind === "directional",
  );
  if (lights.length === 0) return [];
  const cameras = [...snapshot.views]
    .sort(
      (a, b) =>
        a.viewId - b.viewId ||
        a.camera.index - b.camera.index ||
        a.camera.generation - b.camera.generation,
    )
    .map((view) => ({
      view,
      basis: cameraBasis(snapshot.viewMatrices, view.viewMatrixOffset),
    }));

  return lights
    .sort(
      (a, b) =>
        a.lightId - b.lightId ||
        a.entity.index - b.entity.index ||
        a.entity.generation - b.entity.generation,
    )
    .map((light): DirectionalLightingEvidence => {
      const offset = light.worldTransformOffset;
      const towardLight = validAffineMatrix(snapshot.transforms, offset)
        ? normalized(
            [
              snapshot.transforms[offset + 8]!,
              snapshot.transforms[offset + 9]!,
              snapshot.transforms[offset + 10]!,
            ],
            0.0001,
          )
        : null;
      // Match the light packer's direction convention and degeneracy boundary,
      // but report invalid data rather than reproducing its fallback direction.
      const shadow: Vector3 | null =
        towardLight !== null && towardLight[1] > 0
          ? [
              cleanZero(-towardLight[0] / towardLight[1]),
              0,
              cleanZero(-towardLight[2] / towardLight[1]),
            ]
          : null;
      return {
        lightId: light.lightId,
        entity: { ...light.entity },
        intensity: Number.isFinite(light.intensity) ? light.intensity : null,
        color: finiteColor(light.color),
        status: towardLight === null ? "invalid-light-transform" : "ready",
        towardLightWorld: towardLight,
        worldElevationDegrees:
          towardLight === null ? null : degrees(Math.asin(towardLight[1])),
        groundShadow: {
          status:
            towardLight === null
              ? "invalid-light-transform"
              : shadow === null
                ? "light-at-or-below-horizon"
                : "ready",
          displacementWorldPerUnitHeight: shadow,
        },
        cameraStatus: cameras.length === 0 ? "no-cameras" : "available",
        cameras: cameras.map(({ view, basis }) => {
          const components: Vector3 | null =
            towardLight !== null && typeof basis !== "string"
              ? [
                  dot(towardLight, basis.right),
                  dot(towardLight, basis.up),
                  dot(towardLight, basis.backward),
                ]
              : null;
          return {
            viewId: view.viewId,
            camera: { ...view.camera },
            status:
              typeof basis === "string"
                ? basis
                : towardLight === null
                  ? "invalid-light-transform"
                  : "ready",
            towardLightCamera: components,
            angleFromCameraAxisDegrees:
              components === null
                ? null
                : degrees(Math.acos(Math.max(-1, Math.min(1, components[2])))),
            groundShadowCameraPlanePerUnitHeight:
              shadow !== null && typeof basis !== "string"
                ? [dot(shadow, basis.right), cleanZero(-dot(shadow, basis.up))]
                : null,
          };
        }),
      };
    });
}

export function copyDirectionalLightingEvidence(
  lights: readonly DirectionalLightingEvidence[],
): DirectionalLightingEvidence[] {
  return lights.map((light) => ({
    ...light,
    entity: { ...light.entity },
    color: light.color === null ? null : [...light.color],
    towardLightWorld:
      light.towardLightWorld === null ? null : [...light.towardLightWorld],
    groundShadow: {
      ...light.groundShadow,
      displacementWorldPerUnitHeight:
        light.groundShadow.displacementWorldPerUnitHeight === null
          ? null
          : [...light.groundShadow.displacementWorldPerUnitHeight],
    },
    cameras: light.cameras.map((camera) => ({
      ...camera,
      camera: { ...camera.camera },
      towardLightCamera:
        camera.towardLightCamera === null
          ? null
          : [...camera.towardLightCamera],
      groundShadowCameraPlanePerUnitHeight:
        camera.groundShadowCameraPlanePerUnitHeight === null
          ? null
          : [...camera.groundShadowCameraPlanePerUnitHeight],
    })),
  }));
}

function cameraBasis(
  matrices: Float32Array,
  offset: number,
): CameraBasis | "invalid-camera-transform" | "non-orthogonal-camera-basis" {
  if (!validAffineMatrix(matrices, offset)) return "invalid-camera-transform";
  // Rows of the world-to-view matrix carry the resolved camera axes. Normalize
  // scale without discarding parent orientation or roll; no Euler inference.
  const right = normalized([
    matrices[offset]!,
    matrices[offset + 4]!,
    matrices[offset + 8]!,
  ]);
  const up = normalized([
    matrices[offset + 1]!,
    matrices[offset + 5]!,
    matrices[offset + 9]!,
  ]);
  const backward = normalized([
    matrices[offset + 2]!,
    matrices[offset + 6]!,
    matrices[offset + 10]!,
  ]);
  if (right === null || up === null || backward === null)
    return "invalid-camera-transform";
  // Sheared cameras do not have an orthonormal viewing basis. Report that limit
  // explicitly instead of inventing an orientation through Gram-Schmidt.
  if (
    Math.max(
      Math.abs(dot(right, up)),
      Math.abs(dot(right, backward)),
      Math.abs(dot(up, backward)),
    ) > 0.00001
  ) {
    return "non-orthogonal-camera-basis";
  }
  return { right, up, backward };
}

function validAffineMatrix(matrices: Float32Array, offset: number): boolean {
  if (!Number.isInteger(offset) || offset < 0 || offset + 16 > matrices.length)
    return false;
  for (let index = offset; index < offset + 16; index += 1) {
    if (!Number.isFinite(matrices[index])) return false;
  }
  if (
    matrices[offset + 3] !== 0 ||
    matrices[offset + 7] !== 0 ||
    matrices[offset + 11] !== 0 ||
    matrices[offset + 15] !== 1
  )
    return false;
  const a = matrices[offset]!,
    b = matrices[offset + 4]!,
    c = matrices[offset + 8]!;
  const d = matrices[offset + 1]!,
    e = matrices[offset + 5]!,
    f = matrices[offset + 9]!;
  const g = matrices[offset + 2]!,
    h = matrices[offset + 6]!,
    i = matrices[offset + 10]!;
  return a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g) !== 0;
}

function normalized(vector: Vector3, minimumLength = 0): Vector3 | null {
  const length = Math.hypot(...vector);
  if (!(length > minimumLength)) return null;
  return [
    cleanZero(vector[0] / length),
    cleanZero(vector[1] / length),
    cleanZero(vector[2] / length),
  ];
}

function dot(a: Vector3, b: Vector3): number {
  return cleanZero(a[0] * b[0] + a[1] * b[1] + a[2] * b[2]);
}

function cleanZero(value: number): number {
  return value === 0 ? 0 : value;
}

function finiteColor(
  color: RenderSnapshot["lights"][number]["color"],
): readonly [number, number, number, number] | null {
  const channels = [color[0], color[1], color[2], color[3]] as const;
  return channels.every(Number.isFinite) ? channels : null;
}

function degrees(radians: number): number {
  return radians * (180 / Math.PI);
}
