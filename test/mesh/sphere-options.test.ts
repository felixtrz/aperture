import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  createSphereMeshAsset,
  SphereMeshError,
  type SphereMeshOptions,
} from "@aperture-engine/render";

describe("sphere mesh option diagnostics", () => {
  it("rejects facade segment controls and lists the direct factory controls", () => {
    const options = { radius: 1.15, segments: 7, heightSegements: 5 };
    expect(() => createSphereMeshAsset(options)).toThrow(
      expect.objectContaining({
        name: "SphereMeshError",
        path: "segments",
        message: expect.stringContaining('"segments", "heightSegements"'),
        suggestedFix: expect.stringContaining(
          "Accepted options: label, radius, widthSegments, heightSegments.",
        ),
      }),
    );
  });

  it.each(["raduis", "constructor", "toString", "__proto__"])(
    "rejects unsupported own JSON key %s",
    (key) => {
      const options: SphereMeshOptions = JSON.parse(`{"radius":1,"${key}":7}`);
      expect(() => createSphereMeshAsset(options)).toThrow(
        expect.objectContaining({
          path: key,
          message: expect.stringContaining(JSON.stringify(key)),
        }),
      );
    },
  );

  it.each([null, [], 1, "sphere", false])(
    "gives actionable feedback for malformed runtime options: %j",
    (options) => {
      expect(() =>
        createSphereMeshAsset(options as unknown as SphereMeshOptions),
      ).toThrow(SphereMeshError);
      expect(() =>
        createSphereMeshAsset(options as unknown as SphereMeshOptions),
      ).toThrow("Sphere options must be an object.");
    },
  );

  it("accepts labels and null prototypes without treating inherited metadata as options", () => {
    const options = {
      label: "Small sphere",
      radius: 0.3,
      widthSegments: 8,
      heightSegments: 4,
    };
    for (const prototype of [null, { note: "inherited metadata" }]) {
      const input = Object.assign(Object.create(prototype) as object, options);
      expect(createSphereMeshAsset(input)).toEqual(
        createSphereMeshAsset(options),
      );
    }
    expect(createSphereMeshAsset(options).label).toBe("Small sphere");
  });

  // Recorded before key validation, including each boundary's existing
  // defaults, numeric fallbacks, clamping, and fractional normalization.
  const existingBuffers: readonly {
    name: string;
    options?: SphereMeshOptions;
    sha256: string;
  }[] = [
    {
      name: "defaults",
      sha256:
        "89845afa9bc90559d3e1b9736842aa2ded5dfd32de272654d54302f7caebffb8",
    },
    {
      name: "independent width and height controls",
      options: { radius: 1.15, widthSegments: 7, heightSegments: 5 },
      sha256:
        "bea320ec4c1b792946dce0c7a87666e58e654d48bf2c04f21e6beed59f6210d2",
    },
    {
      name: "radius fallback and fractional segments",
      options: { radius: -1, widthSegments: 7.9, heightSegments: 5.5 },
      sha256:
        "c9e229e7700e9271c37195a58a94c311fc4b5762d9dc8f190b278e5a3c060842",
    },
    {
      name: "non-finite radius and segments",
      options: {
        radius: Infinity,
        widthSegments: NaN,
        heightSegments: Infinity,
      },
      sha256:
        "4c3112f4dfda87e907927edf9405ca9e8e495bc9250cfdcdd26924bf5ed01c74",
    },
    {
      name: "segment clamps",
      options: { radius: 2, widthSegments: 1, heightSegments: 129 },
      sha256:
        "18df89a14fa246d4d1273f3ab5ebcbef003745d610c4350d948b193609dee055",
    },
    {
      name: "label",
      options: {
        label: "Named sphere",
        radius: 0.3,
        widthSegments: 8,
        heightSegments: 4,
      },
      sha256:
        "e5dfc7decf05a9256d193bb9407f0758b3759d63235ca5e3ee2f23020917ffea",
    },
  ];
  it.each(existingBuffers)(
    "preserves existing bytes: $name",
    ({ options, sha256 }) => {
      const mesh = createSphereMeshAsset(options);
      const hash = createHash("sha256");
      for (const data of [
        ...mesh.vertexStreams.map((stream) => stream.data),
        mesh.indexBuffer!.data,
      ]) {
        hash.update(
          new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
        );
      }
      expect(hash.digest("hex")).toBe(sha256);
    },
  );
});
