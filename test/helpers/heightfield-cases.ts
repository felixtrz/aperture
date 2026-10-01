import type { HeightfieldMeshOptions } from "@aperture-engine/render";

export const flatHeightfield: HeightfieldMeshOptions = {
  heights: [
    [0, 0],
    [0, 0],
  ],
};

export const invalidHeightfields: readonly {
  readonly name: string;
  readonly options: unknown;
  readonly path: string;
}[] = [
  { name: "missing options", options: undefined, path: "options" },
  { name: "null options", options: null, path: "options" },
  { name: "array options", options: [], path: "options" },
  { name: "primitive options", options: 1, path: "options" },
  {
    name: "numeric label",
    options: { ...flatHeightfield, label: 1 },
    path: "label",
  },
  ...[undefined, null, [], [[0, 1]], new Float32Array(4)].map(
    (heights, index) => ({
      name: `invalid outer grid ${index}`,
      options: { heights },
      path: "heights",
    }),
  ),
  ...[null, [], [1], new Float32Array(2), undefined].map((row, index) => ({
    name: `invalid row ${index}`,
    options: { heights: [[0, 1], row] },
    path: "heights[1]",
  })),
  {
    name: "sparse row",
    options: { heights: [[0, 0], new Array(2)] },
    path: "heights[1][0]",
  },
  {
    name: "sparse grid",
    options: { heights: new Array(2) },
    path: "heights[0]",
  },
  {
    name: "ragged long row",
    options: {
      heights: [
        [0, 0],
        [0, 0, 0],
      ],
    },
    path: "heights[1]",
  },
  {
    name: "ragged short row",
    options: {
      heights: [
        [0, 0, 0],
        [0, 0],
      ],
    },
    path: "heights[1]",
  },
  ...[NaN, Infinity, -Infinity, 1e39, "0", null, undefined].map(
    (height, index) => ({
      name: `invalid sample ${index}`,
      options: {
        heights: [
          [0, 0],
          [0, height],
        ],
      },
      path: "heights[1][1]",
    }),
  ),
  ...["width", "depth"].flatMap((axis) =>
    [NaN, Infinity, -Infinity, 1e39, 0, -1, 1e-50, "1", null].map(
      (value, index) => ({
        name: `invalid ${axis} ${index}`,
        options: { ...flatHeightfield, [axis]: value },
        path: axis,
      }),
    ),
  ),
  {
    name: "collapsed columns",
    options: {
      heights: [
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ],
      width: 2 ** -148,
    },
    path: "width",
  },
  {
    name: "collapsed rows",
    options: {
      heights: [
        [0, 0],
        [0, 0],
        [0, 0],
        [0, 0],
      ],
      depth: 2 ** -148,
    },
    path: "depth",
  },
  {
    name: "overflowing bounds",
    options: {
      heights: [
        [-3.4e38, 3.4e38],
        [-3.4e38, 3.4e38],
      ],
      width: 3.4e38,
      depth: 3.4e38,
    },
    path: "heights",
  },
];
