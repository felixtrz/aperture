import {
  mesh,
  material,
  type SpawnCommands,
} from "@aperture-engine/app/systems";

export type Point = readonly [number, number, number];
export function linearColor(hex: number): [number, number, number, number] {
  const c = [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255].map((v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return [c[0]!, c[1]!, c[2]!, 1];
}

/** Independent width, length and height profiles make a full belly and raked bow. */
export function skiffSections(): Point[][] {
  const outline = [
    [0, 2.3],
    [0.55, 1.95],
    [0.88, 1.1],
    [0.94, -0.1],
    [0.86, -1.3],
    [0.65, -1.9],
    [-0.65, -1.9],
    [-0.86, -1.3],
    [-0.94, -0.1],
    [-0.88, 1.1],
    [-0.55, 1.95],
  ] as const;
  return [
    { y: -0.08, width: 0.56, length: 0.72 },
    { y: 0.18, width: 0.83, length: 0.9 },
    { y: 0.5, width: 0.98, length: 0.99 },
    { y: 0.78, width: 1, length: 1 },
  ].map((section) =>
    outline.map(
      ([x, z]): Point => [
        x * section.width,
        section.y + Math.max(0, z - 1.2) * 0.12,
        z * section.length,
      ],
    ),
  );
}

export function spawnSkiff(spawn: SpawnCommands): void {
  const parent = spawn.group({
    key: "skiff",
    transform: {
      translation: [1.5, 0, 0.5],
      rotationEulerDegrees: [0, -14, 0],
    },
  });
  const sections = skiffSections();
  for (let i = 0; i < 3; i++)
    spawn.mesh({
      key: `skiff.band.${i}`,
      mesh: mesh.loft({
        sections: [sections[i]!, sections[i + 1]!],
        flipWinding: true,
      }),
      material: material.standard({
        baseColor: linearColor([0x793726, 0xb54d2d, 0xd87245][i]!),
      }),
      transform: { parent },
      castShadow: true,
      receiveShadow: true,
    });
  const top = sections[3]!,
    inside = top.map(([x, y, z]): Point => [x * 0.86, y, z * 0.92]);
  spawn.mesh({
    key: "skiff.rim",
    mesh: mesh.loft({ sections: [top, inside], flipWinding: true }),
    material: material.standard({ baseColor: linearColor(0xeee0b8) }),
    transform: { parent },
    castShadow: true,
    receiveShadow: true,
  });
  const floor = inside.map(([x, , z]): Point => [x * 0.88, 0.29, z * 0.9]);
  spawn.mesh({
    key: "skiff.interior",
    mesh: mesh.loft({ sections: [inside, floor], flipWinding: true }),
    material: material.standard({ baseColor: linearColor(0x8c8061) }),
    transform: { parent },
    receiveShadow: true,
  });
  spawn.mesh({
    key: "skiff.floor",
    mesh: mesh.polygons({ faces: [{ outline: floor }] }),
    material: material.standard({ baseColor: linearColor(0xa39675) }),
    transform: { parent },
    receiveShadow: true,
  });
  for (const z of [-1, 0.8])
    spawn.mesh({
      key: `skiff.seat.${z}`,
      mesh: mesh.box({ size: [1.42, 0.1, 0.32] }),
      material: material.standard({ baseColor: linearColor(0xb8a47d) }),
      transform: { translation: [0, 0.54, z], parent },
      castShadow: true,
      receiveShadow: true,
    });
}

/** The same helper builds an open arch strip, unrelated to the boat's closed sections. */
export function spawnCanopy(spawn: SpawnCommands): void {
  const parent = spawn.group({
    key: "canopy",
    transform: { translation: [-2.2, 0, -1.5] },
  });
  const sections = [-0.7, 0.7].map((z) =>
    Array.from({ length: 9 }, (_, i): Point => {
      const angle = (i / 8) * Math.PI;
      return [Math.cos(angle) * 1.3, 1.65 + Math.sin(angle) * 0.75, z];
    }),
  );
  spawn.mesh({
    key: "canopy.shell",
    mesh: mesh.loft({ sections, closed: false, flipWinding: true }),
    material: material.standard({ baseColor: linearColor(0x2e7b79) }),
    transform: { parent },
    castShadow: true,
    receiveShadow: true,
  });
  for (const x of [-1.25, 1.25])
    for (const z of [-0.6, 0.6])
      spawn.mesh({
        key: `canopy.post.${x}.${z}`,
        mesh: mesh.box({ size: [0.1, 1.8, 0.1] }),
        material: material.standard({ baseColor: linearColor(0xb89d68) }),
        transform: { parent, translation: [x, 0.9, z] },
        castShadow: true,
        receiveShadow: true,
      });
  for (const sign of [-1, 1])
    spawn.mesh({
      key: `canopy.brace.${sign}`,
      mesh: mesh.extrudeBetween({
        outline: [
          [-0.045, -0.045],
          [0.045, -0.045],
          [0.045, 0.045],
          [-0.045, 0.045],
        ],
        start: [sign * 1.25, 1.15, 0.6],
        end: [sign * 0.65, 2.14, 0.6],
      }),
      material: material.standard({ baseColor: linearColor(0xb89d68) }),
      transform: { parent },
      castShadow: true,
      receiveShadow: true,
    });
}
