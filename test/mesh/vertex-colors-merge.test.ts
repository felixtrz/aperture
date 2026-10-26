import { describe, expect, it } from "vitest";
import {
  createBoxMeshAsset,
  createHeightfieldMeshAsset,
  createLineListMeshAsset,
  createMergedMeshAsset,
  createMeshGpuUploadPlan,
  createPlaneMeshAsset,
  createTriangleListMeshAsset,
  HeightfieldMeshError,
  MergeMeshError,
  TriangleListMeshError,
  validateMeshAsset,
  type MeshAsset,
} from "@aperture-engine/render";

function attributes(mesh: MeshAsset): string[] {
  return mesh.vertexStreams[0]!.attributes.map(
    (attribute) =>
      `${attribute.semantic}:${attribute.format}@${attribute.offset}`,
  );
}

function floatsAt(
  mesh: MeshAsset,
  vertex: number,
  offset: number,
  size: number,
) {
  const stream = mesh.vertexStreams[0]!;
  const base = (vertex * stream.arrayStride) / 4 + offset / 4;
  return Array.from(stream.data.slice(base, base + size) as Float32Array);
}

function thrown(run: () => unknown): Error {
  try {
    run();
  } catch (error) {
    return error as Error;
  }
  throw new Error("expected a throw");
}

const triangle = [
  [0, 0, 0],
  [1, 0, 0],
  [0, 1, 0],
] as const;

describe("triangle-list vertex colors", () => {
  it("adds an interleaved float32x4 COLOR_0 stream after POSITION/NORMAL/UV", () => {
    const mesh = createTriangleListMeshAsset({
      positions: triangle,
      colors: [
        [1, 0, 0],
        [0, 1, 0, 0.5],
        [0, 0, 1],
      ],
    });

    expect(mesh.vertexStreams[0]!.arrayStride).toBe(48);
    expect(attributes(mesh)).toEqual([
      "POSITION:float32x3@0",
      "NORMAL:float32x3@12",
      "TEXCOORD_0:float32x2@24",
      "COLOR_0:float32x4@32",
    ]);
    expect(floatsAt(mesh, 0, 32, 4)).toEqual([1, 0, 0, 1]);
    expect(floatsAt(mesh, 1, 32, 4)).toEqual([0, 1, 0, 0.5]);
    expect(validateMeshAsset(mesh)).toEqual({ valid: true, diagnostics: [] });
    expect(createMeshGpuUploadPlan(mesh).valid).toBe(true);
  });

  it("copies source colors onto flat-expanded indexed corners", () => {
    const mesh = createTriangleListMeshAsset({
      positions: [
        [0, 0, 0],
        [1, 0, 0],
        [0, 1, 0],
        [1, 1, 0],
      ],
      indices: [0, 1, 2, 2, 1, 3],
      colors: [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
        [1, 1, 1],
      ],
    });

    expect(mesh.vertexStreams[0]!.vertexCount).toBe(6);
    // Second face corners are source vertices 2, 1, 3.
    expect(floatsAt(mesh, 3, 32, 4)).toEqual([0, 0, 1, 1]);
    expect(floatsAt(mesh, 4, 32, 4)).toEqual([0, 1, 0, 1]);
    expect(floatsAt(mesh, 5, 32, 4)).toEqual([1, 1, 1, 1]);
  });

  it("keeps the uncolored layout byte-identical when colors are omitted", () => {
    const mesh = createTriangleListMeshAsset({ positions: triangle });
    expect(mesh.vertexStreams[0]!.arrayStride).toBe(32);
    expect(attributes(mesh)).not.toContain("COLOR_0:float32x4@32");
  });

  it("reports the offending color entry", () => {
    const error = thrown(() =>
      createTriangleListMeshAsset({
        positions: triangle,
        colors: [
          [1, 0, 0],
          [0, 1] as unknown as [number, number, number],
          [0, 0, 1],
        ],
      }),
    );
    expect(error).toBeInstanceOf(TriangleListMeshError);
    expect((error as TriangleListMeshError).path).toBe("colors[1]");

    const count = thrown(() =>
      createTriangleListMeshAsset({ positions: triangle, colors: [[1, 1, 1]] }),
    );
    expect((count as TriangleListMeshError).path).toBe("colors");
  });
});

describe("heightfield vertex colors", () => {
  const heights = [
    [0, 0.5],
    [0.25, 1],
  ];

  it("maps colors[row][column] to the matching sample", () => {
    const mesh = createHeightfieldMeshAsset({
      heights,
      colors: [
        [
          [0.1, 0.5, 0.1],
          [0.2, 0.6, 0.2],
        ],
        [
          [0.5, 0.4, 0.3],
          [1, 1, 1],
        ],
      ],
    });

    expect(attributes(mesh)).toContain("COLOR_0:float32x4@32");
    // First corner of the first triangle is sample (0, 0).
    expect(floatsAt(mesh, 0, 32, 4)).toEqual([
      Math.fround(0.1),
      Math.fround(0.5),
      Math.fround(0.1),
      1,
    ]);
    expect(validateMeshAsset(mesh).valid).toBe(true);
  });

  it("rejects color grids that do not match the height grid", () => {
    const rows = thrown(() =>
      createHeightfieldMeshAsset({
        heights,
        colors: [
          [
            [1, 1, 1],
            [1, 1, 1],
          ],
        ],
      }),
    );
    expect(rows).toBeInstanceOf(HeightfieldMeshError);
    expect((rows as HeightfieldMeshError).path).toBe("colors");

    const columns = thrown(() =>
      createHeightfieldMeshAsset({
        heights,
        colors: [
          [
            [1, 1, 1],
            [1, 1, 1],
          ],
          [[1, 1, 1]],
        ],
      }),
    );
    expect((columns as HeightfieldMeshError).path).toBe("colors[1]");

    const entry = thrown(() =>
      createHeightfieldMeshAsset({
        heights,
        colors: [
          [
            [1, 1, 1],
            [1, 1, 1],
          ],
          [
            [1, 1, 1],
            [1, Number.NaN, 1],
          ],
        ],
      }),
    );
    expect(entry).toBeInstanceOf(HeightfieldMeshError);
    expect((entry as HeightfieldMeshError).path).toBe("colors[1][1][1]");
  });
});

describe("createMergedMeshAsset", () => {
  const unitBox = createBoxMeshAsset({ width: 1, height: 1, depth: 1 });
  const translate = (x: number, y: number, z: number) => [
    1,
    0,
    0,
    0,
    0,
    1,
    0,
    0,
    0,
    0,
    1,
    0,
    x,
    y,
    z,
    1,
  ];

  it("bakes transformed parts into one indexed triangle mesh", () => {
    const merged = createMergedMeshAsset([
      { mesh: unitBox },
      { mesh: unitBox, matrix: translate(3, 0, 0) },
    ]);
    const boxVertices = unitBox.vertexStreams[0]!.vertexCount;
    const boxIndices = unitBox.indexBuffer!.data.length;

    expect(merged.vertexStreams[0]!.vertexCount).toBe(boxVertices * 2);
    expect(merged.indexBuffer!.data).toHaveLength(boxIndices * 2);
    expect(merged.indexBuffer!.data[boxIndices]).toBe(
      unitBox.indexBuffer!.data[0]! + boxVertices,
    );
    expect(merged.localAabb).toEqual({
      min: [-0.5, -0.5, -0.5],
      max: [3.5, 0.5, 0.5],
    });
    expect(attributes(merged)).not.toContain("COLOR_0:float32x4@32");
    expect(validateMeshAsset(merged)).toEqual({ valid: true, diagnostics: [] });
  });

  it("writes per-part colors as COLOR_0 only when a part is colored", () => {
    const merged = createMergedMeshAsset([
      { mesh: unitBox, color: [0.8, 0.1, 0.1] },
      { mesh: unitBox, matrix: translate(0, 2, 0) },
    ]);
    const boxVertices = unitBox.vertexStreams[0]!.vertexCount;

    expect(attributes(merged)).toContain("COLOR_0:float32x4@32");
    expect(floatsAt(merged, 0, 32, 4)).toEqual([
      Math.fround(0.8),
      Math.fround(0.1),
      Math.fround(0.1),
      1,
    ]);
    // Uncolored parts stay white so the material color shows through.
    expect(floatsAt(merged, boxVertices, 32, 4)).toEqual([1, 1, 1, 1]);
    expect(validateMeshAsset(merged).valid).toBe(true);
  });

  it("keeps outward winding and normals under mirrored or rotated matrices", () => {
    const mirrored = [-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    const quarterTurnY = [0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1];
    for (const matrix of [mirrored, quarterTurnY]) {
      const merged = createMergedMeshAsset([{ mesh: unitBox, matrix }]);
      const indices = merged.indexBuffer!.data;
      for (let corner = 0; corner < indices.length; corner += 3) {
        const [a, b, c] = [
          indices[corner]!,
          indices[corner + 1]!,
          indices[corner + 2]!,
        ];
        const pa = floatsAt(merged, a, 0, 3);
        const pb = floatsAt(merged, b, 0, 3);
        const pc = floatsAt(merged, c, 0, 3);
        const ab = [pb[0]! - pa[0]!, pb[1]! - pa[1]!, pb[2]! - pa[2]!];
        const ac = [pc[0]! - pa[0]!, pc[1]! - pa[1]!, pc[2]! - pa[2]!];
        const face = [
          ab[1]! * ac[2]! - ab[2]! * ac[1]!,
          ab[2]! * ac[0]! - ab[0]! * ac[2]!,
          ab[0]! * ac[1]! - ab[1]! * ac[0]!,
        ];
        const normal = floatsAt(merged, a, 12, 3);
        const centroid = [0, 1, 2].map((k) => (pa[k]! + pb[k]! + pc[k]!) / 3);
        // Counterclockwise faces, stored normals and the outward direction agree.
        expect(
          face[0]! * normal[0]! + face[1]! * normal[1]! + face[2]! * normal[2]!,
        ).toBeGreaterThan(0);
        expect(
          centroid[0]! * normal[0]! +
            centroid[1]! * normal[1]! +
            centroid[2]! * normal[2]!,
        ).toBeGreaterThan(0);
      }
    }
  });

  it("gives every triangle its own face normal with flatShading", () => {
    const merged = createMergedMeshAsset(
      [{ mesh: unitBox, matrix: translate(1, 0, 0), color: [0.5, 0.5, 0.5] }],
      { flatShading: true },
    );
    const indices = merged.indexBuffer!.data;

    expect(merged.vertexStreams[0]!.vertexCount).toBe(indices.length);
    for (let corner = 0; corner < indices.length; corner += 3) {
      const normals = [0, 1, 2].map((k) => floatsAt(merged, corner + k, 12, 3));
      expect(normals[1]).toEqual(normals[0]);
      expect(normals[2]).toEqual(normals[0]);
    }
    expect(floatsAt(merged, 0, 32, 4)).toEqual([0.5, 0.5, 0.5, 1]);
    expect(validateMeshAsset(merged).valid).toBe(true);
  });

  it("switches to uint32 indices past 65535 vertices", () => {
    const plane = createPlaneMeshAsset({
      width: 1,
      height: 1,
      widthSegments: 128,
      heightSegments: 128,
    });
    const parts = [0, 1, 2, 3].map((index) => ({
      mesh: plane,
      matrix: translate(index, 0, 0),
    }));
    const merged = createMergedMeshAsset(parts);

    expect(merged.vertexStreams[0]!.vertexCount).toBeGreaterThan(0xffff);
    expect(merged.indexBuffer!.format).toBe("uint32");
    expect(merged.indexBuffer!.data).toBeInstanceOf(Uint32Array);
    expect(validateMeshAsset(merged).valid).toBe(true);
  });

  it("rejects empty input, line meshes and collapsing matrices with a path", () => {
    expect(
      (thrown(() => createMergedMeshAsset([])) as MergeMeshError).path,
    ).toBe("parts");
    const lines = createLineListMeshAsset({
      positions: [
        [0, 0, 0],
        [1, 0, 0],
      ],
    });
    const lineError = thrown(() =>
      createMergedMeshAsset([{ mesh: unitBox }, { mesh: lines }]),
    );
    expect(lineError).toBeInstanceOf(MergeMeshError);
    expect((lineError as MergeMeshError).path).toBe(
      "parts[1].mesh.submeshes[0]",
    );

    const zeroScale = [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    expect(
      (
        thrown(() =>
          createMergedMeshAsset([{ mesh: unitBox, matrix: zeroScale }]),
        ) as MergeMeshError
      ).path,
    ).toBe("parts[0].matrix");
  });
});
