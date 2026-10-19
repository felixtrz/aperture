import {
  material,
  mesh,
  type Entity,
  type PolygonMeshDescriptorOptions,
  type SpawnCommands,
  type SystemTransformInput,
} from "@aperture-engine/app/systems";
import {
  bridgeProfiles,
  facing,
  windowPanel,
  type Face,
  type Point,
} from "./panels.ts";

export interface CabinSection {
  readonly z: number;
  readonly halfWidth: number;
  readonly height: number;
}

/** Dimensions belong to this worked example, not to the generic panel helpers. */
export const vehicleDimensions = {
  baseY: 0.25,
  sideTop: 0.96,
  beltY: 1.08,
  sideWidth: 0.78,
  wellBack: 0.48,
  wheelY: 0.34,
  wheelRadius: 0.34,
  wheelX: 0.75,
  wheelHalfDepth: 0.1,
  openingRadius: 0.39,
  lipRadius: 0.46,
  lipX: 0.805,
  archSegments: 10,
  axles: [-1.01, 0.94] as const,
};

export const cabinSections: readonly CabinSection[] = [
  { z: -1.5, halfWidth: 0.66, height: 1.77 },
  { z: -1.29, halfWidth: 0.69, height: 1.99 },
  { z: -0.2, halfWidth: 0.68, height: 2.02 },
  { z: 0.4, halfWidth: 0.65, height: 1.94 },
  { z: 1.1, halfWidth: 0.59, height: 1.22 },
];

/**
 * Six semantic corners: belt, shoulder and crown, mirrored across X.
 * A fixed side slope keeps each side panel planar even as its height and its
 * longitudinal taper change. The crown has a separate, stronger bevel.
 */
export function cabinProfile(section: CabinSection): Point[] {
  const shoulderY = section.height - 0.1;
  const shoulderX =
    section.halfWidth - 0.18 * (shoulderY - vehicleDimensions.beltY);
  return [
    [section.halfWidth, vehicleDimensions.beltY, section.z],
    [shoulderX, shoulderY, section.z],
    [shoulderX - 0.06, section.height, section.z],
    [-shoulderX + 0.06, section.height, section.z],
    [-shoulderX, shoulderY, section.z],
    [-section.halfWidth, vehicleDimensions.beltY, section.z],
  ];
}

/** The same samples drive the side cutout, lip and wheel-well reveal. */
export function archProfile(
  x: number,
  centerZ: number,
  radius: number,
): Point[] {
  const d = vehicleDimensions;
  return [
    [x, d.baseY, centerZ - radius],
    ...Array.from({ length: d.archSegments + 1 }, (_, i): Point => {
      const a = Math.PI - (i * Math.PI) / d.archSegments;
      return [
        x,
        d.wheelY + Math.sin(a) * radius,
        centerZ + Math.cos(a) * radius,
      ];
    }),
    [x, d.baseY, centerZ + radius],
  ];
}

export interface VehicleSurfaces {
  readonly lower: PolygonMeshDescriptorOptions;
  readonly cabin: PolygonMeshDescriptorOptions;
  readonly glazing: PolygonMeshDescriptorOptions;
  readonly wells: PolygonMeshDescriptorOptions;
}

/**
 * One boundary shell, partitioned by material. Wheel wells are concave recesses
 * open to the exterior, with inward-facing ceilings and visible back walls.
 * There is no solid body behind the tires, cabin, glass or hood.
 */
export function utilityVehicleSurfaces(): VehicleSurfaces {
  const d = vehicleDimensions;
  const lower: Face[] = [],
    cabin: Face[] = [],
    glazing: Face[] = [],
    wells: Face[] = [];
  const footprint: readonly (readonly [number, number])[] = [
    [-0.61, -1.85],
    [0.61, -1.85],
    [d.sideWidth, -1.61],
    [d.sideWidth, 1.43],
    [0.61, 1.78],
    [-0.61, 1.78],
    [-d.sideWidth, 1.43],
    [-d.sideWidth, -1.61],
  ];
  const shoulder = footprint.map(([x, z]): Point => [x, d.sideTop, z]);
  const belt = footprint.map(
    ([x, z]): Point => [x - Math.sign(x) * 0.08, d.beltY, z],
  );
  lower.push(
    ...bridgeProfiles(shoulder, belt, true).map((face) => ({
      outline: facing(face.outline, [
        face.outline[0]![0],
        1,
        face.outline[0]![2],
      ]),
    })),
  );

  // End and corner panels. The two long sides own their actual arch cutouts.
  for (const i of [0, 1, 3, 4, 5, 7]) {
    const j = (i + 1) % footprint.length,
      a = shoulder[i]!,
      b = shoulder[j]!;
    lower.push({
      outline: facing(
        [[a[0], d.baseY, a[2]], [b[0], d.baseY, b[2]], b, a],
        [a[0] + b[0], 0, a[2] + b[2]],
      ),
    });
  }

  const floorSides: Point[][] = [];
  for (const sign of [1, -1]) {
    const side: Point[] = [[sign * d.sideWidth, d.baseY, -1.61]];
    const floor: Point[] = [side[0]!];
    for (const z of d.axles) {
      const outer = archProfile(sign * d.sideWidth, z, d.lipRadius);
      const lip = archProfile(sign * d.lipX, z, d.openingRadius);
      const back = archProfile(sign * d.wellBack, z, d.openingRadius);
      side.push(...outer);
      lower.push(
        ...bridgeProfiles(outer, lip).map((face) => ({
          outline: facing(face.outline, [sign, 0, 0]),
        })),
      );
      wells.push(
        ...bridgeProfiles(lip, back).map((face) => {
          const midpoint = face.outline.reduce<number[]>(
            (sum, p) => sum.map((v, i) => v + p[i]! / face.outline.length),
            [0, 0, 0],
          );
          return {
            outline: facing(face.outline, [
              0,
              d.wheelY - midpoint[1]!,
              z - midpoint[2]!,
            ]),
          };
        }),
      );
      wells.push({ outline: facing(back, [sign, 0, 0]) });
      floor.push(
        outer[0]!,
        lip[0]!,
        back[0]!,
        back.at(-1)!,
        lip.at(-1)!,
        outer.at(-1)!,
      );
    }
    side.push([sign * d.sideWidth, d.baseY, 1.43]);
    floor.push(side.at(-1)!);
    side.push(
      [sign * d.sideWidth, d.sideTop, 1.43],
      [sign * d.sideWidth, d.sideTop, -1.61],
    );
    lower.push({ outline: facing(side, [sign, 0, 0]) });
    floorSides.push(floor);
  }
  lower.push({
    outline: facing(
      [
        [-0.61, d.baseY, -1.85],
        [0.61, d.baseY, -1.85],
        ...floorSides[0]!,
        [0.61, d.baseY, 1.78],
        [-0.61, d.baseY, 1.78],
        ...[...floorSides[1]!].reverse(),
      ],
      [0, -1, 0],
    ),
  });

  const sections = cabinSections.map(cabinProfile);
  const opening = [
    ...sections.map((s) => s[0]!),
    ...[...sections].reverse().map((s) => s.at(-1)!),
  ];
  lower.push({ outline: facing(belt, [0, 1, 0]), holes: [opening] });
  cabin.push({ outline: facing(sections[0]!, [0, 0, -1]) });
  cabin.push({ outline: facing(sections.at(-1)!, [0, 0, 1]) });
  for (let i = 0; i < sections.length - 1; i++) {
    const panels = bridgeProfiles(
      sections[i]!,
      sections[i + 1]!,
      false,
      `cabin sections ${i}/${i + 1}`,
    );
    for (let j = 0; j < panels.length; j++) {
      const hasWindow =
        (i >= 2 && (j === 0 || j === 4)) || (i === 3 && j === 2);
      if (hasWindow) {
        const { surround, pane } = windowPanel(
          panels[j]!.outline,
          undefined,
          `cabin section ${i}, cell ${j}`,
        );
        cabin.push(surround);
        glazing.push(pane);
      } else cabin.push(panels[j]!);
    }
  }
  return {
    lower: { label: "Fitted lower shell and wheel arch lips", faces: lower },
    cabin: { label: "Sectioned cabin with window surrounds", faces: cabin },
    glazing: { label: "Exact window infills", faces: glazing },
    wells: {
      label: "Recessed wheel well ceilings and back walls",
      faces: wells,
    },
  };
}

export function spawnUtilityVehicle(
  spawn: SpawnCommands,
  key: string,
  transform?: SystemTransformInput,
): Entity {
  const root = spawn.group({ key, ...(transform ? { transform } : {}) });
  const surface = (
    color: readonly [number, number, number, number],
    roughness = 0.7,
  ) => material.standard({ baseColor: color, roughness });
  const paint = surface([0.13, 0.29, 0.24, 1]),
    roof = surface([0.62, 0.69, 0.58, 1]);
  const rubber = surface([0.022, 0.027, 0.028, 1], 0.9),
    metal = surface([0.38, 0.42, 0.39, 1], 0.4);
  const part = (
    name: string,
    geometry: ReturnType<typeof mesh.polygons>,
    finish: ReturnType<typeof material.standard>,
    translation: Point = [0, 0, 0],
    rotationEulerDegrees: Point = [0, 0, 0],
  ) =>
    spawn.mesh({
      key: `${key}.${name}`,
      mesh: geometry,
      material: finish,
      transform: { parent: root, translation, rotationEulerDegrees },
      castShadow: true,
      receiveShadow: true,
    });
  const geometry = utilityVehicleSurfaces();
  part("lower", mesh.polygons(geometry.lower), paint);
  part("cabin", mesh.polygons(geometry.cabin), roof);
  part(
    "glass",
    mesh.polygons(geometry.glazing),
    surface([0.025, 0.058, 0.075, 1], 0.3),
  );
  part("wells", mesh.polygons(geometry.wells), rubber);
  const d = vehicleDimensions,
    r = d.wheelRadius,
    halfDepth = d.wheelHalfDepth;
  for (const sign of [-1, 1])
    for (const z of d.axles) {
      const id = `${sign}.${z}`;
      part(
        `tire.${id}`,
        mesh.lathe({
          profile: [
            [r * 0.59, -halfDepth],
            [r * 0.82, -halfDepth],
            [r, -halfDepth * 0.6],
            [r, halfDepth * 0.6],
            [r * 0.82, halfDepth],
            [r * 0.59, halfDepth],
            [r * 0.59, -halfDepth],
          ],
          radialSegments: 16,
        }),
        rubber,
        [sign * d.wheelX, d.wheelY, z],
        [0, 0, 90],
      );
      part(
        `rim.${id}`,
        mesh.cylinder({
          radius: r * 0.6,
          depth: halfDepth * 2 + 0.015,
          segments: 16,
        }),
        metal,
        [sign * d.wheelX, d.wheelY, z],
        [0, 0, 90],
      );
      part(
        `hub.${id}`,
        mesh.lathe({
          profile: [
            [0, -0.02],
            [r * 0.35, -0.02],
            [r * 0.45, 0],
            [r * 0.35, 0.04],
            [0, 0.05],
          ],
          radialSegments: 12,
        }),
        metal,
        [sign * (d.wheelX + halfDepth + 0.01), d.wheelY, z],
        [0, 0, -sign * 90],
      );
    }
  for (const sign of [-1, 1]) {
    part(
      `lamp.${sign}`,
      mesh.cylinder({ radius: 0.115, depth: 0.03, segments: 12 }),
      surface([0.85, 0.82, 0.61, 1], 0.4),
      [sign * 0.39, 0.73, 1.79],
      [90, 0, 0],
    );
    part(
      `mirror-stem.${sign}`,
      mesh.tube({
        path: [
          [sign * 0.58, 1.3, 0.65],
          [sign * 0.72, 1.3, 0.65],
        ],
        radius: 0.018,
        radialSegments: 8,
      }),
      rubber,
    );
    part(
      `mirror.${sign}`,
      mesh.beveledBox({ size: [0.12, 0.18, 0.1], bevel: 0.02 }),
      rubber,
      [sign * 0.72, 1.33, 0.65],
    );
  }
  part(
    "bumper",
    mesh.beveledBox({ size: [1.38, 0.14, 0.14], bevel: 0.025 }),
    metal,
    [0, 0.34, 1.82],
  );
  part(
    "grille",
    mesh.box({ size: [0.43, 0.21, 0.025] }),
    rubber,
    [0, 0.73, 1.79],
  );
  return root;
}
