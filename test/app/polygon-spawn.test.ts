import { describe, expect, expectTypeOf, it } from "vitest";
import { createApertureApp, defineApertureConfig } from "@aperture-engine/app";
import {
  mesh,
  material,
  type PolygonMeshDescriptorOptions,
} from "@aperture-engine/app/systems";
import {
  createPolygonMeshAsset,
  validateMeshAsset,
  type PolygonMeshOptions,
  type MeshAsset,
} from "@aperture-engine/render";
import { createMeshHandle } from "@aperture-engine/simulation";

const options: PolygonMeshOptions = {
  faces: [
    {
      outline: [
        [0, 0, 0],
        [3, 0, 0],
        [3, 3, 0],
        [0, 3, 0],
      ],
      holes: [
        [
          [1, 1, 0],
          [2, 1, 0],
          [2, 2, 0],
          [1, 2, 0],
        ],
      ],
    },
  ],
};
describe("polygon app facade", () => {
  it("exposes typed immutable descriptor shells", () => {
    expectTypeOf<PolygonMeshDescriptorOptions>().toEqualTypeOf<PolygonMeshOptions>();
    expectTypeOf(mesh.polygons)
      .parameter(0)
      .toEqualTypeOf<PolygonMeshDescriptorOptions>();
    const input = { ...options, label: "panel" },
      descriptor = mesh.polygons(input);
    input.label = "changed";
    expect(Object.isFrozen(descriptor)).toBe(true);
    expect(descriptor.options).not.toBe(input);
    expect(descriptor).toEqual({
      kind: "polygons",
      options: { ...options, label: "panel" },
    });
  });
  it.each([
    ["opening", options],
    [
      "planar face requiring Float32 rounding validation",
      {
        faces: [
          {
            outline: [
              [2.1050000000000004, 4.205224260382408, -1.6721650178268475],
              [2.1057045526222904, 4.215518003855974, -1.6899412726713368],
              [2.128094949138243, 4.206611498242559, -1.6745606374374675],
              [2.128, 4.205224260382408, -1.6721650178268475],
            ],
          },
        ],
      } satisfies PolygonMeshOptions,
    ],
  ] as const)(
    "publishes %s and rejects invalid replacements atomically",
    async (_, input) => {
      const app = await createApertureApp({
        config: defineApertureConfig({
          mode: "headless",
          render: {
            defaultEnvironment: false,
            defaultCamera: false,
            defaultLight: false,
          },
        }),
        systems: [],
      });
      try {
        app.context.spawn.mesh({
          key: "panel",
          mesh: mesh.polygons(input),
          material: material.standard(),
        });
        const handle = createMeshHandle("panel.mesh");
        const before = app.lowLevel.assets.get<"mesh", MeshAsset>(
          handle,
        )!.asset!;
        expect(before).toEqual(createPolygonMeshAsset(input));
        expect(validateMeshAsset(before).valid).toBe(true);
        const manifest = app.lowLevel.assets.createManifestReport();
        for (const key of ["invalid"])
          expect(() =>
            app.context.spawn.mesh({
              key,
              mesh: mesh.polygons({
                faces: [
                  {
                    outline: [
                      [0, 0, 0],
                      [1, 0, 0],
                      [1, 1, 1],
                      [0, 1, 0],
                    ],
                  },
                ],
              }),
              material: material.standard(),
            }),
          ).toThrow(
            expect.objectContaining({
              code: "aperture.spawn.invalidPolygonMesh",
              detail: { path: expect.stringContaining("faces[0].outline") },
            }),
          );
        expect(app.lowLevel.assets.get<"mesh", MeshAsset>(handle)!.asset).toBe(
          before,
        );
        expect(app.lowLevel.assets.createManifestReport()).toEqual(manifest);
      } finally {
        await app.dispose();
      }
    },
  );
});
