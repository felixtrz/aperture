import { describe, expect, it } from "vitest";
import {
  createPolygonMeshAsset,
  PolygonMeshError,
  validateMeshAsset,
  type PolygonMeshOptions,
  type PolygonMeshPoint,
  type MeshAsset,
} from "@aperture-engine/render";

const square: PolygonMeshPoint[] = [
  [0, 0, 0],
  [4, 0, 0],
  [4, 4, 0],
  [0, 4, 0],
];
const opening: PolygonMeshPoint[] = [
  [1, 1, 0],
  [3, 1, 0],
  [3, 3, 0],
  [1, 3, 0],
];
function vertices(asset: MeshAsset) {
  const values = asset.vertexStreams[0]!.data as Float32Array;
  return Array.from({ length: values.length / 8 }, (_, i) =>
    Array.from(values.slice(i * 8, i * 8 + 8)),
  );
}
function triangles(asset: MeshAsset) {
  const points = vertices(asset);
  const ids = Array.from(asset.indexBuffer!.data);
  return Array.from({ length: ids.length / 3 }, (_, i) =>
    ids.slice(i * 3, i * 3 + 3).map((j) => points[j]!),
  );
}
function area(asset: MeshAsset) {
  return triangles(asset).reduce((sum, [a, b, c]) => {
    const u = b!.map((x, i) => x - a![i]!),
      v = c!.map((x, i) => x - a![i]!);
    return (
      sum +
      Math.hypot(
        u[1]! * v[2]! - u[2]! * v[1]!,
        u[2]! * v[0]! - u[0]! * v[2]!,
        u[0]! * v[1]! - u[1]! * v[0]!,
      ) /
        2
    );
  }, 0);
}

describe("polygon surface meshes", () => {
  it("triangulates a concave surface without filling its notch", () => {
    const asset = createPolygonMeshAsset({
      faces: [
        {
          outline: [
            [0, 0, 0],
            [3, 0, 0],
            [3, 1, 0],
            [1, 1, 0],
            [1, 3, 0],
            [0, 3, 0],
          ],
        },
      ],
    });
    expect(area(asset)).toBeCloseTo(5);
    for (const triangle of triangles(asset)) {
      const center = [0, 1].map(
        (i) => triangle.reduce((n, p) => n + p[i]!, 0) / 3,
      );
      expect(center[0]! <= 1 || center[1]! <= 1).toBe(true);
    }
    expect(validateMeshAsset(asset).valid).toBe(true);
  });
  it("preserves a thin concave arch without reversed triangles or filling its hollow", () => {
    const arc = (radius: number): PolygonMeshPoint[] =>
      Array.from({ length: 7 }, (_, i) => [
        Math.fround(radius * Math.cos((i * Math.PI) / 6)),
        Math.fround(radius * Math.sin((i * Math.PI) / 6)),
        0,
      ]);
    const outline = [...arc(1), ...arc(0.9).reverse()];
    const signed = (
      a: readonly number[],
      b: readonly number[],
      c: readonly number[],
    ): number =>
      ((b[0]! - a[0]!) * (c[1]! - a[1]!) - (b[1]! - a[1]!) * (c[0]! - a[0]!)) /
      2;
    const fan = outline
      .slice(1, -1)
      .map((b, i) => signed(outline[0]!, b, outline[i + 2]!));
    // Signed areas alone cancel the overlap of an invalid first-corner fan.
    expect(fan.some((value) => value < 0)).toBe(true);
    const intendedArea = fan.reduce((sum, value) => sum + value, 0);
    expect(
      fan.reduce((sum, value) => sum + Math.abs(value), 0),
    ).toBeGreaterThan(intendedArea * 2);
    const asset = createPolygonMeshAsset({ faces: [{ outline }] });
    expect(validateMeshAsset(asset).valid).toBe(true);
    expect(area(asset)).toBeCloseTo(intendedArea, 7);
    expect(
      new Set(vertices(asset).map((p) => p.slice(0, 3).join(","))),
    ).toEqual(new Set(outline.map((p) => p.join(","))));
    for (const [a, b, c] of triangles(asset)) {
      expect(signed(a!, b!, c!)).toBeGreaterThan(0);
      const hollow = [0, 0.5, 0];
      expect(
        [
          signed(a!, b!, hollow),
          signed(b!, c!, hollow),
          signed(c!, a!, hollow),
        ].every((value) => value >= 0),
      ).toBe(false);
    }
  });
  it("keeps openings empty, including aligned hole edges", () => {
    const asset = createPolygonMeshAsset({
      faces: [{ outline: square, holes: [opening] }],
    });
    expect(area(asset)).toBeCloseTo(12);
    for (const triangle of triangles(asset)) {
      const x = triangle.reduce((n, p) => n + p[0]!, 0) / 3,
        y = triangle.reduce((n, p) => n + p[1]!, 0) / 3;
      expect(x > 1 && x < 3 && y > 1 && y < 3).toBe(false);
    }
    const reversed = createPolygonMeshAsset({
      faces: [{ outline: square, holes: [[...opening].reverse()] }],
    });
    expect(reversed).toEqual(asset);
  });
  it.each([0, 1, 2])(
    "preserves exact coordinates and outward winding on axis %s",
    (axis) => {
      const project = (p: PolygonMeshPoint): PolygonMeshPoint => {
        const out = [0, 0, 0];
        out[axis] = 7;
        out[(axis + 1) % 3] = p[0];
        out[(axis + 2) % 3] = p[1];
        return out as unknown as PolygonMeshPoint;
      };
      for (const direction of [1, -1]) {
        const outline = square.map(project);
        if (direction < 0) outline.reverse();
        const asset = createPolygonMeshAsset({ faces: [{ outline }] });
        for (const p of vertices(asset)) {
          expect(p[axis]).toBe(7);
          expect(p[3 + axis]).toBe(direction);
          expect(p.slice(6).every((x) => x >= 0 && x <= 1)).toBe(true);
        }
        for (const [a, b, c] of triangles(asset)) {
          const u = (axis + 1) % 3,
            v = (axis + 2) % 3;
          expect(
            ((b![u]! - a![u]!) * (c![v]! - a![v]!) -
              (b![v]! - a![v]!) * (c![u]! - a![u]!)) *
              direction,
          ).toBeGreaterThan(0);
        }
      }
    },
  );
  it("fits holes to a sloped cabin plane without changing the authored positions", () => {
    const slope = ([x, y]: PolygonMeshPoint): PolygonMeshPoint => [
      x,
      y,
      0.25 * x + 0.5 * y,
    ];
    const outlines = square.map(slope),
      holes = opening.map(slope);
    const asset = createPolygonMeshAsset({
      faces: [{ outline: outlines, holes: [holes] }],
    });
    expect(area(asset)).toBeCloseTo(12 * Math.sqrt(1.3125));
    const expected = new Set(
      [...outlines, ...holes].map((p) => p.map(Math.fround).join(",")),
    );
    for (const p of vertices(asset))
      expect(expected.has(p.slice(0, 3).join(","))).toBe(true);
  });
  it("owns its buffers and splits normals at face creases", () => {
    const outline = square.map((p) => [...p] as [number, number, number]);
    const asset = createPolygonMeshAsset({
      label: "corner",
      faces: [
        { outline },
        {
          outline: [
            [0, 0, 0],
            [0, 0, 4],
            [4, 0, 4],
            [4, 0, 0],
          ],
        },
      ],
    });
    const before = Array.from(asset.vertexStreams[0]!.data as Float32Array);
    outline[0]![0] = 500;
    expect(Array.from(asset.vertexStreams[0]!.data as Float32Array)).toEqual(
      before,
    );
    const origins = vertices(asset).filter((p) =>
      p.slice(0, 3).every((x) => x === 0),
    );
    expect(origins.map((p) => p.slice(3, 6))).toEqual(
      expect.arrayContaining([
        [0, 0, 1],
        [0, 1, 0],
      ]),
    );
  });
  const invalid: Array<[string, unknown, string]> = [
    ["missing options", undefined, "options"],
    ["empty faces", { faces: [] }, "faces"],
    ["invalid label", { label: 4, faces: [{ outline: square }] }, "label"],
    ["missing face", { faces: [null] }, "faces[0]"],
    [
      "NaN",
      {
        faces: [
          {
            outline: [
              [0, 0, 0],
              [1, 0, 0],
              [0, NaN, 0],
            ],
          },
        ],
      },
      "faces[0].outline[2]",
    ],
    [
      "float32 collapse",
      {
        faces: [
          {
            outline: [
              [1e9, 0, 0],
              [1e9 + 1, 0, 0],
              [1e9, 1, 0],
            ],
          },
        ],
      },
      "faces[0].outline",
    ],
    [
      "bent quad",
      {
        faces: [
          {
            outline: [
              [0, 0, 0],
              [4, 0, 0],
              [4, 4, 0.5],
              [0, 4, 0],
            ],
          },
        ],
      },
      "faces[0].outline",
    ],
    [
      "bowtie",
      {
        faces: [
          {
            outline: [
              [0, 0, 0],
              [3, 3, 0],
              [0, 3, 0],
              [3, 0, 0],
            ],
          },
        ],
      },
      "faces[0].outline",
    ],
    [
      "closing duplicate",
      { faces: [{ outline: [...square, square[0]] }] },
      "faces[0].outline",
    ],
    [
      "collinear corner",
      {
        faces: [
          {
            outline: [
              [0, 0, 0],
              [2, 0, 0],
              [4, 0, 0],
              [4, 4, 0],
              [0, 4, 0],
            ],
          },
        ],
      },
      "faces[0].outline",
    ],
    [
      "outside hole",
      {
        faces: [
          {
            outline: square,
            holes: [opening.map(([x, y, z]) => [x + 6, y, z])],
          },
        ],
      },
      "faces[0].holes[0]",
    ],
    [
      "touching hole",
      {
        faces: [
          {
            outline: square,
            holes: [opening.map(([x, y, z]) => [x - 1, y, z])],
          },
        ],
      },
      "faces[0].holes[0]",
    ],
    [
      "overlapping holes",
      {
        faces: [
          {
            outline: square,
            holes: [opening, opening.map(([x, y, z]) => [x + 0.2, y + 0.2, z])],
          },
        ],
      },
      "faces[0].holes[1]",
    ],
    [
      "hole off plane",
      {
        faces: [
          { outline: square, holes: [opening.map(([x, y]) => [x, y, 0.1])] },
        ],
      },
      "faces[0].holes[0]",
    ],
    [
      "too many faces",
      { faces: Array.from({ length: 4097 }, () => ({ outline: square })) },
      "faces",
    ],
  ];
  it.each(invalid)(
    "rejects %s with an authored field path",
    (_name, options, path) => {
      expect(() =>
        createPolygonMeshAsset(options as PolygonMeshOptions),
      ).toThrow(PolygonMeshError);
      try {
        createPolygonMeshAsset(options as PolygonMeshOptions);
      } catch (error) {
        expect((error as PolygonMeshError).path).toMatch(
          new RegExp("^" + path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
        );
      }
    },
  );
});
