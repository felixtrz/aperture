import { readFile } from "node:fs/promises";
import { describe, expect, expectTypeOf, it } from "vitest";
import { createApertureApp, defineApertureConfig } from "@aperture-engine/app";
import {
  material,
  mesh,
  type LatheMeshDescriptorOptions,
} from "@aperture-engine/app/systems";
import {
  createLatheMeshAsset,
  type LatheMeshOptions,
  type MeshAsset,
} from "@aperture-engine/render";
import { createMeshHandle } from "@aperture-engine/simulation";
import {
  collectCandidateSources,
  discoverPackageExportInfo,
} from "../../packages/cli/src/reference/source-collection.js";
import { invalidLathes, openLathe, thickBowl } from "../helpers/lathe-cases.js";
const config = defineApertureConfig({
  mode: "headless",
  render: {
    defaultCamera: false,
    defaultLight: false,
    defaultEnvironment: false,
  },
});
const app = () => createApertureApp({ config, systems: [] });

describe("app lathe authoring", () => {
  it("exports typed, frozen, shallow-copy descriptors", () => {
    expectTypeOf<LatheMeshDescriptorOptions>().toEqualTypeOf<LatheMeshOptions>();
    expectTypeOf(mesh.lathe)
      .parameter(0)
      .toEqualTypeOf<LatheMeshDescriptorOptions>();
    const options = { ...openLathe, label: "Original" };
    const descriptor = mesh.lathe(options);
    options.label = "Changed";
    expect(Object.isFrozen(descriptor)).toBe(true);
    expect(descriptor.options).not.toBe(options);
    expect(descriptor).toEqual({
      kind: "lathe",
      options: { ...openLathe, label: "Original" },
    });
  });
  it("reports malformed profiles without publishing assets or reserving the spawn key", async () => {
    const scene = await app();
    try {
      for (const { options, path } of invalidLathes) {
        expect(() =>
          scene.context.spawn.mesh({
            key: "retry",
            mesh: { kind: "lathe", options: options as LatheMeshOptions },
            material: material.standard(),
          }),
        ).toThrow(
          expect.objectContaining({
            name: "ApertureSystemError",
            code: "aperture.spawn.invalidLatheMesh",
            detail: { path },
            suggestedFix: expect.stringContaining("profile points"),
          }),
        );
        expect(scene.lowLevel.assets.createManifestReport().total).toBe(0);
      }
      scene.context.spawn.mesh({
        key: "retry",
        mesh: mesh.lathe(thickBowl),
        material: material.standard(),
      });
      expect(
        scene.lowLevel.assets.get<"mesh", MeshAsset>(
          createMeshHandle("retry.mesh"),
        )!.asset,
      ).toEqual(createLatheMeshAsset(thickBowl));
    } finally {
      await scene.dispose();
    }
  });
  it("preserves unexpected accessor failures and permits retry", async () => {
    const scene = await app();
    const failure = new Error("profile accessor failed");
    try {
      expect(() =>
        scene.context.spawn.mesh({
          key: "retry",
          mesh: {
            kind: "lathe",
            options: {
              get profile(): LatheMeshOptions["profile"] {
                throw failure;
              },
            },
          },
          material: material.standard(),
        }),
      ).toThrow(failure);
      expect(scene.lowLevel.assets.createManifestReport().total).toBe(0);
      expect(() =>
        scene.context.spawn.mesh({
          key: "retry",
          mesh: mesh.lathe(openLathe),
          material: material.standard(),
        }),
      ).not.toThrow();
    } finally {
      await scene.dispose();
    }
  });
  it("republishes new normals and bounds through the same extracted entity and mesh handle", async () => {
    const scene = await app();
    try {
      const initial = createLatheMeshAsset(openLathe);
      const dynamic = scene.context.meshes.dynamic("lathe.dynamic", {
        initial,
      });
      scene.context.spawn.camera({
        key: "camera",
        camera: { frustumCulling: false },
        transform: { translation: [0, 4, 6], lookAt: [0, 0, 0] },
      });
      scene.context.spawn.mesh({
        key: "shape",
        mesh: dynamic.handle,
        material: material.standard(),
      });
      const before = scene.extract();
      const edited = createLatheMeshAsset({
        profile: [
          [1, 0],
          [2, 3],
        ],
      });
      expect(dynamic.publish(edited)).toMatchObject({
        handle: dynamic.handle,
        version: 2,
      });
      const after = scene.extract();
      expect(after.meshDraws).toHaveLength(1);
      expect(after.meshDraws[0]!.mesh).toEqual(before.meshDraws[0]!.mesh);
      expect(after.meshDraws[0]!.renderId).toEqual(
        before.meshDraws[0]!.renderId,
      );
      expect(
        after.bounds[after.meshDraws[0]!.boundsIndex]!.localAabb.max[1],
      ).toBe(3);
      expect(dynamic.get()).toBe(edited);
      expect(edited.vertexStreams[0]!.data).not.toEqual(
        initial.vertexStreams[0]!.data,
      );
      expect(() =>
        dynamic.publish(
          createLatheMeshAsset({
            profile: [
              [0, 0],
              [0, 1],
            ],
          }),
        ),
      ).toThrow();
      expect(dynamic.get()).toBe(edited);
    } finally {
      await scene.dispose();
    }
  });
  it("makes the factory and option type discoverable through public references and docs", async () => {
    const sources = await collectCandidateSources(
      process.cwd(),
      await discoverPackageExportInfo(process.cwd()),
    );
    for (const file of [
      "packages/render/src/mesh/primitives-lathe.ts",
      "packages/render/src/mesh/lathe-types.ts",
    ])
      expect(sources.find((s) => s.file === file)?.entrypoint).toContain(
        "@aperture-engine/render",
      );
    const docs = await readFile("docs/AUTHORING.md", "utf8");
    for (const text of [
      "mesh.lathe",
      "createLatheMeshAsset",
      "radialSegments",
      "Self-intersections",
      "dynamic.publish",
    ])
      expect(docs).toContain(text);
  }, 30_000);
});
