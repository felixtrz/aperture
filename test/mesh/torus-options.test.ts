import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  createTorusMeshAsset,
  TorusMeshError,
  type TorusMeshOptions,
} from "@aperture-engine/render";

describe("torus option feedback", () => {
  it("reports every unsupported option with the distinct ring and tube controls", () => {
    const options = {
      majorRadius: 0.43,
      minorRadius: 0.042,
      radialSegments: 6,
      tubularSegments: 16,
    };
    expect(() => createTorusMeshAsset(options)).toThrow(
      expect.objectContaining({
        name: "TorusMeshError",
        path: "minorRadius",
        message: expect.stringContaining('"minorRadius", "tubularSegments"'),
        suggestedFix: expect.stringContaining(
          "radialSegments around the main ring, and tubeSegments around the tube cross-section",
        ),
      }),
    );
  });

  it.each(["tubeRaduis", "constructor", "toString", "__proto__"])(
    "rejects an unsupported own JSON key: %s",
    (key) => {
      const options: TorusMeshOptions = JSON.parse(
        `{"majorRadius":1,"${key}":0.1}`,
      );
      expect(() => createTorusMeshAsset(options)).toThrow(
        expect.objectContaining({
          path: key,
          message: expect.stringContaining(JSON.stringify(key)),
        }),
      );
    },
  );

  it.each([null, [], 1, "torus", false])(
    "gives actionable feedback for a malformed runtime options container: %j",
    (options) => {
      expect(() =>
        createTorusMeshAsset(options as unknown as TorusMeshOptions),
      ).toThrow(TorusMeshError);
      expect(() =>
        createTorusMeshAsset(options as unknown as TorusMeshOptions),
      ).toThrow("Torus options must be an object.");
    },
  );

  it("accepts labels and null prototypes without treating inherited metadata as options", () => {
    const options = { label: "Band", majorRadius: 0.43, tubeRadius: 0.042 };
    for (const prototype of [null, { note: "inherited metadata" }]) {
      const input = Object.assign(Object.create(prototype) as object, options);
      expect(createTorusMeshAsset(input)).toEqual(
        createTorusMeshAsset(options),
      );
    }
    expect(createTorusMeshAsset(options).label).toBe("Band");
  });

  // Recorded from the existing factory before adding key validation. These
  // guard its buffers, including legacy fallback/clamping behavior.
  const existingBuffers: readonly {
    name: string;
    options?: TorusMeshOptions;
    sha256: string;
  }[] = [
    {
      name: "defaults",
      sha256:
        "5d66bd42d19283740ffce26cb4af2fa1597113e7e9cf6fcd651234a268621942",
    },
    {
      name: "independent ring and tube controls",
      options: {
        label: "Band",
        majorRadius: 0.43,
        tubeRadius: 0.042,
        radialSegments: 16,
        tubeSegments: 6,
      },
      sha256:
        "443a75d612fa291d255341be2fe2a673c83076c61b439980a7d6c14d0b4ec017",
    },
    {
      name: "radius fallbacks and fractional segments",
      options: {
        majorRadius: -1,
        tubeRadius: 0,
        radialSegments: 7.9,
        tubeSegments: 5.5,
      },
      sha256:
        "cd8127f57fcc8b035a48726e0798932838ed8665f93b3428fab4feb72fe93cfa",
    },
    {
      name: "non-finite radii and segments",
      options: {
        majorRadius: Infinity,
        tubeRadius: NaN,
        radialSegments: NaN,
        tubeSegments: Infinity,
      },
      sha256:
        "55babd5bc843875e356854b703ef04fb041e6f7ea04207753dc863ab6575d46f",
    },
  ];
  it.each(existingBuffers)(
    "preserves existing bytes: $name",
    ({ options, sha256 }) => {
      const mesh = createTorusMeshAsset(options);
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
