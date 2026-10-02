import type { LatheMeshOptions } from "@aperture-engine/render";

export const openLathe: LatheMeshOptions = {
  profile: [
    [1, 0],
    [1, 1],
  ],
};
export const thickBowl: LatheMeshOptions = {
  label: "Thick bowl",
  radialSegments: 12,
  profile: [
    [0, 0],
    [1, 0],
    [1.2, 1],
    [1, 1],
    [0.8, 0.2],
    [0, 0.2],
  ],
};
export const invalidLathes: readonly {
  name: string;
  options: unknown;
  path: string;
}[] = [
  ...[undefined, null, [], 1, "lathe"].map((options, i) => ({
    name: `invalid options ${i}`,
    options,
    path: "options",
  })),
  { name: "numeric label", options: { ...openLathe, label: 1 }, path: "label" },
  ...[undefined, null, [], [[1, 0]], new Float32Array(4)].map((profile, i) => ({
    name: `invalid profile ${i}`,
    options: { profile },
    path: "profile",
  })),
  ...[undefined, null, [], [1], [1, 2, 3], new Float32Array(2)].map(
    (point, i) => ({
      name: `invalid point ${i}`,
      options: { profile: [[1, 0], point] },
      path: "profile[1]",
    }),
  ),
  {
    name: "sparse point",
    options: { profile: [[1, 0], new Array(2)] },
    path: "profile[1][0]",
  },
  {
    name: "sparse profile",
    options: { profile: new Array(2) },
    path: "profile[0]",
  },
  ...[0, 1].flatMap((axis) =>
    [NaN, Infinity, -Infinity, 1e39, "1", null, undefined].map((value, i) => ({
      name: `invalid coordinate ${axis}/${i}`,
      options: { profile: [[1, 0], axis === 0 ? [value, 1] : [1, value]] },
      path: `profile[1][${axis}]`,
    })),
  ),
  ...[-1, -1e-50, 1e-50].map((radius, i) => ({
    name: `invalid radius ${i}`,
    options: {
      profile: [
        [radius, 0],
        [1, 1],
      ],
    },
    path: "profile[0][0]",
  })),
  ...[null, "32", 0, 2, 129, 3.5, NaN, Infinity].map((radialSegments, i) => ({
    name: `invalid segments ${i}`,
    options: { ...openLathe, radialSegments },
    path: "radialSegments",
  })),
  {
    name: "interior pole",
    options: {
      profile: [
        [1, 0],
        [0, 1],
        [1, 2],
      ],
    },
    path: "profile[1][0]",
  },
  {
    name: "all axis",
    options: {
      profile: [
        [0, 0],
        [0, 1],
      ],
    },
    path: "profile",
  },
  {
    name: "duplicate point",
    options: {
      profile: [
        [1, 0],
        [1, 0],
      ],
    },
    path: "profile[1]",
  },
  {
    name: "rounded duplicate radius",
    options: {
      profile: [
        [1, 0],
        [1 + 1e-9, 0],
      ],
    },
    path: "profile[1]",
  },
  {
    name: "rounded duplicate height",
    options: {
      profile: [
        [1, 1e8],
        [1, 1e8 + 1],
      ],
    },
    path: "profile[1]",
  },
  {
    name: "collapsed radial segment",
    options: {
      profile: [
        [2 ** -149, 0],
        [2 ** -149, 1],
      ],
      radialSegments: 128,
    },
    path: "profile[0..1].segments[0]",
  },
  {
    name: "overflowing bounds",
    options: {
      profile: [
        [3.4e38, -3.4e38],
        [3.4e38, 3.4e38],
      ],
      radialSegments: 4,
    },
    path: "profile",
  },
];
