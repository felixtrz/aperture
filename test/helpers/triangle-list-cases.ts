import type { TriangleListMeshOptions } from "@aperture-engine/render";

export const triangle: TriangleListMeshOptions = {
  positions: [
    [0, 0, 0],
    [2, 0, 0],
    [0, 3, 0],
  ],
};

export const invalidTriangleLists: readonly {
  readonly name: string;
  readonly options: unknown;
  readonly path: string;
}[] = [
  { name: "null options", options: null, path: "options" },
  { name: "missing options", options: undefined, path: "options" },
  { name: "array options", options: [], path: "options" },
  { name: "primitive options", options: 1, path: "options" },
  { name: "numeric label", options: { ...triangle, label: 1 }, path: "label" },
  { name: "missing positions", options: {}, path: "positions" },
  {
    name: "flat position buffer",
    options: { positions: new Float32Array(9) },
    path: "positions",
  },
  { name: "empty positions", options: { positions: [] }, path: "positions" },
  {
    name: "two positions",
    options: {
      positions: [
        [0, 0, 0],
        [1, 0, 0],
      ],
    },
    path: "positions",
  },
  {
    name: "incomplete triangle",
    options: { positions: [...triangle.positions, [1, 1, 0]] },
    path: "positions",
  },
  {
    name: "sparse positions",
    options: { positions: new Array(3) },
    path: "positions[0]",
  },
  {
    name: "null position",
    options: { positions: [null, ...triangle.positions.slice(1)] },
    path: "positions[0]",
  },
  {
    name: "short position",
    options: { positions: [[0, 0], ...triangle.positions.slice(1)] },
    path: "positions[0]",
  },
  {
    name: "long position",
    options: { positions: [[0, 0, 0, 0], ...triangle.positions.slice(1)] },
    path: "positions[0]",
  },
  ...[NaN, Infinity, -Infinity, 1e39, "0", null, undefined].map(
    (value, index) => ({
      name: `invalid position scalar ${index}`,
      options: { positions: [[value, 0, 0], ...triangle.positions.slice(1)] },
      path: "positions[0][0]",
    }),
  ),
  {
    name: "empty indices",
    options: { ...triangle, indices: [] },
    path: "indices",
  },
  {
    name: "null indices",
    options: { ...triangle, indices: null },
    path: "indices",
  },
  {
    name: "float indices",
    options: { ...triangle, indices: new Float32Array([0, 1, 2]) },
    path: "indices",
  },
  {
    name: "incomplete indexed triangle",
    options: { ...triangle, indices: [0, 1] },
    path: "indices",
  },
  {
    name: "sparse indices",
    options: { ...triangle, indices: new Array(3) },
    path: "indices[0]",
  },
  ...[-1, 3, 0.5, NaN, Infinity, "0", 0x100000000].map((value, index) => ({
    name: `invalid index ${index}`,
    options: { ...triangle, indices: [value, 1, 2] },
    path: "indices[0]",
  })),
  {
    name: "too few normals",
    options: { ...triangle, normals: [[0, 0, 1]] },
    path: "normals",
  },
  {
    name: "too many normals",
    options: {
      ...triangle,
      normals: Array.from({ length: 4 }, () => [0, 0, 1]),
    },
    path: "normals",
  },
  {
    name: "flat normals",
    options: { ...triangle, normals: new Float32Array(9) },
    path: "normals",
  },
  {
    name: "short normal",
    options: {
      ...triangle,
      normals: [
        [0, 1],
        [0, 0, 1],
        [0, 0, 1],
      ],
    },
    path: "normals[0]",
  },
  {
    name: "sparse normals",
    options: { ...triangle, normals: new Array(3) },
    path: "normals[0]",
  },
  {
    name: "zero normal",
    options: {
      ...triangle,
      normals: [
        [0, 0, 0],
        [0, 0, 1],
        [0, 0, 1],
      ],
    },
    path: "normals[0]",
  },
  {
    name: "underflow normal",
    options: {
      ...triangle,
      normals: [
        [1e-50, 0, 0],
        [0, 0, 1],
        [0, 0, 1],
      ],
    },
    path: "normals[0]",
  },
  {
    name: "infinite normal",
    options: {
      ...triangle,
      normals: [
        [0, Infinity, 0],
        [0, 0, 1],
        [0, 0, 1],
      ],
    },
    path: "normals[0][1]",
  },
  {
    name: "float32 normal overflow",
    options: {
      ...triangle,
      normals: [
        [1e39, 0, 0],
        [0, 0, 1],
        [0, 0, 1],
      ],
    },
    path: "normals[0][0]",
  },
  { name: "null uvs", options: { ...triangle, uvs: null }, path: "uvs" },
  {
    name: "wrong uv count",
    options: { ...triangle, uvs: [[0, 0]] },
    path: "uvs",
  },
  {
    name: "long uv tuple",
    options: {
      ...triangle,
      uvs: [
        [0, 0, 0],
        [0, 0],
        [0, 0],
      ],
    },
    path: "uvs[0]",
  },
  {
    name: "sparse uvs",
    options: { ...triangle, uvs: new Array(3) },
    path: "uvs[0]",
  },
  {
    name: "float32 uv overflow",
    options: {
      ...triangle,
      uvs: [
        [1e39, 0],
        [0, 0],
        [0, 0],
      ],
    },
    path: "uvs[0][0]",
  },
  {
    name: "NaN uv",
    options: {
      ...triangle,
      uvs: [
        [0, NaN],
        [0, 0],
        [0, 0],
      ],
    },
    path: "uvs[0][1]",
  },
  {
    name: "collinear face",
    options: {
      positions: [
        [0, 0, 0],
        [1, 1, 1],
        [2, 2, 2],
      ],
    },
    path: "positions[0..2]",
  },
  {
    name: "repeated indexed vertex",
    options: { ...triangle, indices: [0, 1, 2, 0, 1, 0] },
    path: "indices[3..5]",
  },
  {
    name: "explicit normals do not bypass degenerate check",
    options: {
      ...triangle,
      indices: [0, 1, 0],
      normals: [
        [0, 0, 1],
        [0, 0, 1],
        [0, 0, 1],
      ],
    },
    path: "indices[0..2]",
  },
  {
    name: "positions collapse at float32 precision",
    options: {
      positions: [
        [16777216, 0, 0],
        [16777217, 0, 0],
        [16777216, 1, 0],
      ],
    },
    path: "positions[0..2]",
  },
  {
    name: "positions collapse at float32 underflow",
    options: {
      positions: [
        [0, 0, 0],
        [1e-50, 0, 0],
        [0, 1e-50, 0],
      ],
    },
    path: "positions[0..2]",
  },
  {
    name: "bounding sphere float32 overflow",
    options: {
      positions: [
        [-3e38, -3e38, -3e38],
        [3e38, 3e38, -3e38],
        [3e38, -3e38, 3e38],
      ],
    },
    path: "positions",
  },
];
