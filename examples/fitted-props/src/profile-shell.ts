import type { PolygonMeshDescriptorOptions } from "@aperture-engine/app/systems";
import {
  bridgeProfiles,
  facing,
  windowPanel,
  type Face,
  type Point,
} from "./panels.ts";

/** X is width, Y height, Z rear to front. These are caller-owned measurements. */
export interface ProfileSection {
  readonly z: number;
  readonly halfWidth: number;
  readonly shoulderY: number;
  readonly crownY: number;
  readonly crownHalfWidth: number;
}

export type WindowBand = "right" | "top" | "left";
export interface ProfileShape {
  readonly baseY: number;
  /** Common inward slope of both side panels: X inset per unit of height. */
  readonly sideSlope: number;
  readonly sections: readonly ProfileSection[];
  readonly windows?: readonly {
    /** Zero-based interval between this section and the next. */
    readonly section: number;
    readonly band: WindowBand;
    readonly bounds?: readonly [number, number, number, number];
  }[];
}

export type ProfileSurfaces = Record<
  "sides" | "shoulders" | "top" | "base" | "ends" | "glazing",
  PolygonMeshDescriptorOptions
>;

/** Six corresponding corners; separate shoulder/crown inputs preserve a real bevel. */
export function sectionProfile(
  shape: ProfileShape,
  s: ProfileSection,
): Point[] {
  const shoulderX = s.halfWidth - shape.sideSlope * (s.shoulderY - shape.baseY);
  return [
    [s.halfWidth, shape.baseY, s.z],
    [shoulderX, s.shoulderY, s.z],
    [s.crownHalfWidth, s.crownY, s.z],
    [-s.crownHalfWidth, s.crownY, s.z],
    [-shoulderX, s.shoulderY, s.z],
    [-s.halfWidth, shape.baseY, s.z],
  ];
}

/**
 * A closed shell partitioned by surface role, with exact planar window infills.
 * No vehicle dimensions, automatic fitting, hidden solids or ECS state live here.
 */
export function profileShell(shape: ProfileShape): ProfileSurfaces {
  if (
    !Number.isFinite(shape.baseY) ||
    !Number.isFinite(shape.sideSlope) ||
    shape.sideSlope < 0
  )
    throw new RangeError(
      "profile: finite baseY and nonnegative sideSlope required",
    );
  if (shape.sections.length < 2)
    throw new RangeError("profile: at least two sections required");
  const profiles = shape.sections.map((s, i) => {
    if (
      ![s.z, s.halfWidth, s.shoulderY, s.crownY, s.crownHalfWidth].every(
        Number.isFinite,
      ) ||
      (i > 0 && s.z <= shape.sections[i - 1]!.z)
    )
      throw new RangeError(
        `profile section ${i}: finite dimensions and increasing z required`,
      );
    const shoulderX =
      s.halfWidth - shape.sideSlope * (s.shoulderY - shape.baseY);
    if (
      !(
        shape.baseY < s.shoulderY &&
        s.shoulderY < s.crownY &&
        0 < s.crownHalfWidth &&
        s.crownHalfWidth < shoulderX
      )
    )
      throw new RangeError(
        `profile section ${i}: need base < shoulder < crown and 0 < crown width < shoulder width`,
      );
    return sectionProfile(shape, s);
  });
  const bands = [
    "sides",
    "shoulders",
    "top",
    "shoulders",
    "sides",
    "base",
  ] as const;
  const windowBands = { right: 0, top: 2, left: 4 } as const;
  const windows = new Map<
    string,
    NonNullable<ProfileShape["windows"]>[number]
  >();
  for (const window of shape.windows ?? []) {
    const key = `${window.section}:${windowBands[window.band]}`;
    if (
      !Number.isInteger(window.section) ||
      window.section < 0 ||
      window.section >= profiles.length - 1 ||
      !Object.hasOwn(windowBands, window.band) ||
      windows.has(key)
    )
      throw new RangeError(
        `profile window ${key}: unique valid section/band required`,
      );
    windows.set(key, window);
  }
  const faces: Record<keyof ProfileSurfaces, Face[]> = {
    sides: [],
    shoulders: [],
    top: [],
    base: [],
    ends: [],
    glazing: [],
  };
  for (let section = 0; section < profiles.length - 1; section++) {
    const a = profiles[section]!,
      b = profiles[section + 1]!;
    for (let band = 0; band < 6; band++) {
      const next = (band + 1) % 6,
        label = `profile section ${section}, band ${band}`;
      const window = windows.get(`${section}:${band}`);
      if (window) {
        const { surround, pane } = windowPanel(
          [a[band]!, a[next]!, b[next]!, b[band]!],
          window.bounds,
          label,
        );
        faces[bands[band]!].push(surround);
        faces.glazing.push(pane);
      } else
        faces[bands[band]!].push(
          ...bridgeProfiles(
            [a[band]!, a[next]!],
            [b[band]!, b[next]!],
            false,
            label,
          ),
        );
    }
  }
  faces.ends.push(
    { outline: facing(profiles[0]!, [0, 0, -1]) },
    { outline: facing(profiles.at(-1)!, [0, 0, 1]) },
  );
  return {
    sides: { faces: faces.sides },
    shoulders: { faces: faces.shoulders },
    top: { faces: faces.top },
    base: { faces: faces.base },
    ends: { faces: faces.ends },
    glazing: { faces: faces.glazing },
  };
}
