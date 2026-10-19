import {
  createSystem,
  material,
  mesh,
  type SpawnCommands,
} from "@aperture-engine/app/systems";
import {
  profileShell,
  type ProfileShape,
  type ProfileSurfaces,
} from "./profile-shell.ts";
import type { Point } from "./panels.ts";

export type ShapeStudy = "vehicle" | "housing";
export type ShapeVariant = "boxy" | "shaped";
export type ShapeView = "hero" | "side" | "front" | "rear";

/** Editable proportions, not a reference-specific finished asset. Front is +Z. */
export const shapeStudies: Record<ShapeStudy, ProfileShape> = {
  vehicle: {
    baseY: 0.66,
    sideSlope: 0.12,
    sections: [
      {
        z: -1.9,
        halfWidth: 0.62,
        shoulderY: 0.85,
        crownY: 0.95,
        crownHalfWidth: 0.49,
      },
      {
        z: -1.15,
        halfWidth: 0.7,
        shoulderY: 1.45,
        crownY: 1.61,
        crownHalfWidth: 0.46,
      },
      {
        z: 0.15,
        halfWidth: 0.7,
        shoulderY: 1.43,
        crownY: 1.59,
        crownHalfWidth: 0.46,
      },
      {
        z: 0.7,
        halfWidth: 0.67,
        shoulderY: 0.91,
        crownY: 1.02,
        crownHalfWidth: 0.46,
      },
      {
        z: 1.9,
        halfWidth: 0.59,
        shoulderY: 0.78,
        crownY: 0.91,
        crownHalfWidth: 0.43,
      },
    ],
    windows: [
      { section: 1, band: "right" },
      { section: 1, band: "left" },
      { section: 2, band: "top" },
    ],
  },
  housing: {
    baseY: 0,
    sideSlope: 0.1,
    sections: [
      {
        z: -0.55,
        halfWidth: 0.75,
        shoulderY: 0.9,
        crownY: 1.02,
        crownHalfWidth: 0.55,
      },
      {
        z: 0.65,
        halfWidth: 0.66,
        shoulderY: 0.42,
        crownY: 0.57,
        crownHalfWidth: 0.46,
      },
    ],
    windows: [{ section: 0, band: "top", bounds: [0.14, 0.16, 0.86, 0.84] }],
  },
};

/** Independent caller-owned data; variants keep the same envelope and stations. */
export function studyShape(
  study: ShapeStudy,
  variant: ShapeVariant,
): ProfileShape {
  const shape = structuredClone(shapeStudies[study]);
  if (variant === "shaped") return shape;
  const width = Math.max(...shape.sections.map((s) => s.halfWidth));
  const height = Math.max(...shape.sections.map((s) => s.crownY));
  return {
    ...shape,
    sideSlope: 0,
    sections: shape.sections.map((s) => ({
      ...s,
      halfWidth: width,
      shoulderY: height - 0.04,
      crownY: height,
      crownHalfWidth: width - 0.04,
    })),
  };
}

export const studyWheels = {
  radius: 0.3,
  halfDepth: 0.11,
  x: 0.72,
  axles: [-1.18, 1.18],
} as const;

function spawnStudy(
  spawn: SpawnCommands,
  study: ShapeStudy,
  variant: ShapeVariant,
  x: number,
): void {
  const root = spawn.group({
    key: study,
    transform: { translation: [x, 0, 0] },
  });
  const colors: Record<
    keyof ProfileSurfaces,
    readonly [number, number, number, number]
  > = {
    sides: study === "vehicle" ? [0.08, 0.27, 0.24, 1] : [0.3, 0.19, 0.07, 1],
    shoulders: [0.46, 0.53, 0.43, 1],
    top: [0.64, 0.68, 0.54, 1],
    ends: [0.2, 0.34, 0.29, 1],
    base: [0.08, 0.1, 0.09, 1],
    glazing: [0.018, 0.045, 0.061, 1],
  };
  for (const [part, surfaces] of Object.entries(
    profileShell(studyShape(study, variant)),
  )) {
    if (!surfaces.faces.length) continue;
    spawn.mesh({
      key: `${study}.${part}`,
      mesh: mesh.polygons(surfaces),
      material: material.standard({
        baseColor: colors[part as keyof ProfileSurfaces],
        roughness: part === "glazing" ? 0.28 : 0.7,
      }),
      transform: { parent: root },
      castShadow: true,
      receiveShadow: true,
    });
  }
  if (study !== "vehicle") return;
  const rubber = material.standard({ baseColor: [0.026, 0.032, 0.028, 1] });
  const metal = material.standard({
    baseColor: [0.31, 0.34, 0.3, 1],
    roughness: 0.45,
  });
  spawn.mesh({
    key: "vehicle.chassis",
    mesh: mesh.box({ size: [1, 0.48, 3.2] }),
    material: rubber,
    transform: { parent: root, translation: [0, 0.42, 0] },
    castShadow: true,
    receiveShadow: true,
  });
  const w = studyWheels;
  for (const z of w.axles) {
    spawn.mesh({
      key: `axle.${z}`,
      mesh: mesh.cylinder({ radius: 0.07, depth: 2 * w.x, segments: 8 }),
      material: metal,
      transform: {
        parent: root,
        translation: [0, w.radius, z],
        rotationEulerDegrees: [0, 0, 90],
      },
      castShadow: true,
      receiveShadow: true,
    });
    for (const sign of [-1, 1]) {
      spawn.mesh({
        key: `tire.${z}.${sign}`,
        mesh: mesh.lathe({
          profile: [
            [0.16, -w.halfDepth],
            [0.25, -w.halfDepth],
            [w.radius, -0.06],
            [w.radius, 0.06],
            [0.25, w.halfDepth],
            [0.16, w.halfDepth],
            [0.16, -w.halfDepth],
          ],
          radialSegments: 16,
        }),
        material: rubber,
        transform: {
          parent: root,
          translation: [sign * w.x, w.radius, z],
          rotationEulerDegrees: [0, 0, 90],
        },
        castShadow: true,
        receiveShadow: true,
      });
      spawn.mesh({
        key: `hub.${z}.${sign}`,
        mesh: mesh.cylinder({
          radius: 0.16,
          depth: w.halfDepth * 2 + 0.02,
          segments: 12,
        }),
        material: metal,
        transform: {
          parent: root,
          translation: [sign * w.x, w.radius, z],
          rotationEulerDegrees: [0, 0, 90],
        },
        castShadow: true,
        receiveShadow: true,
      });
    }
  }
}

/** Explicit camera/variant controls keep comparison renders reproducible. */
export function makeShapeSheetSystem(
  options: {
    readonly variant?: ShapeVariant;
    readonly subject?: ShapeStudy | "both";
    readonly view?: ShapeView;
  } = {},
) {
  const { variant = "shaped", subject = "both", view = "hero" } = options;
  const target: Point = [0, 0.75, 0];
  const eye: Record<ShapeView, Point> = {
    hero: [6, 4, 7],
    side: [8, 0.75, 0],
    front: [0, 0.75, 8],
    rear: [0, 0.75, -8],
  };
  return class ProfileShapeSheet extends createSystem({ priority: 0 }) {
    override init(): void {
      this.spawn.camera({
        key: "camera",
        transform: { translation: eye[view], lookAt: target },
        camera: {
          projection: "orthographic",
          orthographicHeight: subject === "both" ? 4.2 : 3.5,
          near: 0.1,
          far: 80,
          clearColor: [0.87, 0.86, 0.81, 1],
        },
      });
      this.spawn.light({
        key: "sun",
        kind: "directional",
        intensity: 3.2,
        color: [1, 0.94, 0.83, 1],
        transform: { rotationEulerDegrees: [-46, -32, 0] },
        shadow: {
          mapSize: 2048,
          cascadeCount: 1,
          shadowType: 1,
          filterRadius: 3,
          normalBias: 0.015,
          orthographicSize: 12,
          center: [0, 0.8, 0],
          lightDistance: 15,
          near: 0.1,
          far: 35,
        },
      });
      this.spawn.mesh({
        key: "ground",
        mesh: mesh.box({ size: [200, 0.08, 200] }),
        material: material.standard({ baseColor: [0.72, 0.7, 0.63, 1] }),
        transform: { translation: [0, -0.04, 0] },
        receiveShadow: true,
      });
      if (subject !== "housing")
        spawnStudy(
          this.spawn,
          "vehicle",
          variant,
          subject === "both" ? -1.1 : 0,
        );
      if (subject !== "vehicle")
        spawnStudy(
          this.spawn,
          "housing",
          variant,
          subject === "both" ? 1.15 : 0,
        );
    }
  };
}

export default makeShapeSheetSystem();
