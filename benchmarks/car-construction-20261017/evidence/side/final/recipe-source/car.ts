import {
  material,
  mesh,
  type Entity,
  type PolygonMeshDescriptorOptions,
  type SpawnCommands,
  type SystemTransformInput,
} from "@aperture-engine/app/systems";

type Point = readonly [number, number, number];
type Face = PolygonMeshDescriptorOptions["faces"][number];

/** Display-space hex palette converted explicitly for linear material inputs. */
export function linearColor(hex: number): [number, number, number, number] {
  const values = [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255].map((n) => {
    const v = n / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return [values[0]!, values[1]!, values[2]!, 1];
}

function facing(outline: readonly Point[], normal: Point): Point[] {
  const [a, b, c] = outline;
  const u = b!.map((v, i) => v - a![i]!),
    v = c!.map((q, i) => q - a![i]!);
  const dot =
    (u[1]! * v[2]! - u[2]! * v[1]!) * normal[0] +
    (u[2]! * v[0]! - u[0]! * v[2]!) * normal[1] +
    (u[0]! * v[1]! - u[1]! * v[0]!) * normal[2];
  return dot < 0 ? [...outline].reverse() : [...outline];
}

/** Bilinear coordinates stay on a planar quad and share exact window boundaries. */
function patch(
  quad: readonly Point[],
  u0: number,
  v0: number,
  u1: number,
  v1: number,
): Point[] {
  const point = (u: number, v: number): Point =>
    [0, 1, 2].map(
      (i) =>
        (1 - v) * ((1 - u) * quad[0]![i]! + u * quad[1]![i]!) +
        v * ((1 - u) * quad[3]![i]! + u * quad[2]![i]!),
    ) as unknown as Point;
  return [point(u0, v0), point(u1, v0), point(u1, v1), point(u0, v1)];
}

/**
 * Body and opaque glazing partition one closed shell. Window holes and panes
 * use the same corners; pillars/sills are the remaining body surface. There
 * are no glass boxes, overlapping roof slabs, or coplanar backing faces.
 */
export function fittedCarSurfaces(): {
  body: PolygonMeshDescriptorOptions;
  glazing: PolygonMeshDescriptorOptions;
} {
  const body: Face[] = [],
    glazing: Face[] = [];
  const footprint: readonly (readonly [number, number])[] = [
    [-0.54, -1.24],
    [0.54, -1.24],
    [0.64, -1.1],
    [0.64, 1.06],
    [0.54, 1.24],
    [-0.54, 1.24],
    [-0.64, 1.06],
    [-0.64, -1.1],
  ];
  const belt = footprint.map(([x, z]): Point => [x, 0.75, z]);
  const base = footprint.map(([x, z]): Point => [x * 0.96, 0.29, z * 0.96]);
  const cabin: Point[] = [
    [-0.6, 0.75, -0.84],
    [0.6, 0.75, -0.84],
    [0.6, 0.75, 0.7],
    [-0.6, 0.75, 0.7],
  ];
  const roof: Point[] = [
    [-0.46, 1.37, -0.46],
    [0.46, 1.37, -0.46],
    [0.46, 1.37, 0.34],
    [-0.46, 1.37, 0.34],
  ];
  body.push(
    { outline: facing(base, [0, -1, 0]) },
    { outline: facing(belt, [0, 1, 0]), holes: [cabin] },
    { outline: facing(roof, [0, 1, 0]) },
  );
  for (let i = 0; i < belt.length; i++) {
    const j = (i + 1) % belt.length;
    body.push({
      outline: facing(
        [base[i]!, base[j]!, belt[j]!, belt[i]!],
        [belt[i]![0] + belt[j]![0], 0, belt[i]![2] + belt[j]![2]],
      ),
    });
  }
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    const face = facing(
      [cabin[i]!, cabin[j]!, roof[j]!, roof[i]!],
      [cabin[i]![0] + cabin[j]![0], 0, cabin[i]![2] + cabin[j]![2]],
    );
    const side = i === 1 || i === 3;
    const holes = side
      ? [
          patch(face, 0.065, 0.12, 0.47, 0.88),
          patch(face, 0.53, 0.12, 0.935, 0.88),
        ]
      : [patch(face, 0.075, 0.11, 0.925, 0.89)];
    body.push({ outline: face, holes });
    glazing.push(...holes.map((outline) => ({ outline })));
  }
  return {
    body: { label: "Car body with integrated window surrounds", faces: body },
    glazing: { label: "Fitted car glazing", faces: glazing },
  };
}

export interface FittedCarOptions {
  readonly key: string;
  readonly color: number;
  readonly transform?: SystemTransformInput;
}

/** Reusable ECS assembly; move/rotate the parent instead of composing each part. */
export function spawnFittedCar(
  spawn: SpawnCommands,
  options: FittedCarOptions,
): Entity {
  const root = spawn.group({
    key: options.key,
    ...(options.transform === undefined
      ? {}
      : { transform: options.transform }),
  });
  const surfaces = fittedCarSurfaces();
  const paint = material.standard({
    baseColor: linearColor(options.color),
    roughness: 0.64,
  });
  const glass = material.standard({
    baseColor: linearColor(0x30444a),
    roughness: 0.65,
  });
  const part = (
    name: string,
    geometry: ReturnType<typeof mesh.box>,
    surface: ReturnType<typeof material.standard>,
    translation: Point = [0, 0, 0],
    rotationEulerDegrees: Point = [0, 0, 0],
  ) =>
    spawn.mesh({
      key: `${options.key}.${name}`,
      mesh: geometry,
      material: surface,
      transform: { parent: root, translation, rotationEulerDegrees },
      castShadow: true,
      receiveShadow: true,
    });
  part("body", mesh.polygons(surfaces.body), paint);
  part("glazing", mesh.polygons(surfaces.glazing), glass);
  const rubber = material.standard({
    baseColor: linearColor(0x252a2c),
    roughness: 0.92,
  });
  const silver = material.standard({
    baseColor: linearColor(0xa8afa9),
    roughness: 0.48,
  });
  const dark = material.standard({
    baseColor: linearColor(0x344047),
    roughness: 0.65,
  });
  const lamp = material.standard({
    baseColor: linearColor(0xffe8b3),
    roughness: 0.38,
  });
  const tail = material.standard({
    baseColor: linearColor(0xa83a2f),
    roughness: 0.38,
  });
  for (const side of [-1, 1]) {
    for (const z of [-0.77, 0.78]) {
      const key = `${side}.${z}`;
      part(
        `tire.${key}`,
        mesh.cylinder({ radius: 0.3, depth: 0.18, segments: 14 }),
        rubber,
        [side * 0.635, 0.3, z],
        [0, 0, 90],
      );
      part(
        `hub.${key}`,
        mesh.cylinder({ radius: 0.18, depth: 0.025, segments: 12 }),
        silver,
        [side * 0.735, 0.3, z],
        [0, 0, 90],
      );
      part(
        `hub-center.${key}`,
        mesh.cylinder({ radius: 0.105, depth: 0.028, segments: 12 }),
        dark,
        [side * 0.75, 0.3, z],
        [0, 0, 90],
      );
    }
    part(`mirror.${side}`, mesh.box({ size: [0.14, 0.1, 0.15] }), paint, [
      side * 0.68,
      0.83,
      0.51,
    ]);
    part(`handle.${side}`, mesh.box({ size: [0.025, 0.045, 0.14] }), silver, [
      side * 0.645,
      0.67,
      -0.13,
    ]);
    part(`headlight.${side}`, mesh.box({ size: [0.18, 0.19, 0.035] }), lamp, [
      side * 0.37,
      0.565,
      1.247,
    ]);
    part(`taillight.${side}`, mesh.box({ size: [0.18, 0.15, 0.035] }), tail, [
      side * 0.37,
      0.56,
      -1.247,
    ]);
  }
  part(
    "front-bumper",
    mesh.box({ size: [1.12, 0.12, 0.105] }),
    silver,
    [0, 0.34, 1.265],
  );
  part(
    "rear-bumper",
    mesh.box({ size: [1.12, 0.1, 0.09] }),
    silver,
    [0, 0.35, -1.26],
  );
  part("grille", mesh.box({ size: [0.5, 0.2, 0.025] }), dark, [0, 0.55, 1.254]);
  for (let i = 0; i < 4; i++)
    part(`grille-slat.${i}`, mesh.box({ size: [0.46, 0.014, 0.012] }), silver, [
      0,
      0.49 + i * 0.041,
      1.27,
    ]);
  return root;
}
