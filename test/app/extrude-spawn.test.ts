import { describe, expect, expectTypeOf, it } from "vitest";
import { createApertureApp, defineApertureConfig } from "@aperture-engine/app";
import {
  material,
  mesh,
  type ExtrudeMeshDescriptorOptions,
} from "@aperture-engine/app/systems";
import {
  createExtrudeMeshAsset,
  type ExtrudeMeshOptions,
} from "@aperture-engine/render";
import { facade } from "../fixtures/extrude-authoring/scene.js";
import {
  collectCandidateSources,
  discoverPackageExportInfo,
} from "../../packages/cli/src/reference/source-collection.js";

describe("app extrusion authoring", () => {
  it("exports typed frozen descriptors with copied options", () => {
    expectTypeOf<ExtrudeMeshDescriptorOptions>().toEqualTypeOf<ExtrudeMeshOptions>();
    expectTypeOf(mesh.extrude)
      .parameter(0)
      .toEqualTypeOf<ExtrudeMeshDescriptorOptions>();
    const options = { ...facade };
    const descriptor = mesh.extrude(options);
    options.depth = 10;
    expect(Object.isFrozen(descriptor)).toBe(true);
    expect(descriptor.options).not.toBe(options);
    expect(descriptor).toEqual({ kind: "extrude", options: facade });
  });
  it("rejects invalid geometry transactionally and publishes indexed assets through normal extraction", async () => {
    const app = await createApertureApp({
      config: defineApertureConfig({
        mode: "headless",
        render: {
          defaultCamera: false,
          defaultEnvironment: false,
          defaultLight: false,
        },
      }),
      systems: [],
    });
    try {
      expect(() =>
        app.context.spawn.mesh({
          key: "facade",
          mesh: mesh.extrude({ ...facade, depth: 0 }),
          material: material.standard(),
        }),
      ).toThrow(
        expect.objectContaining({
          name: "ApertureSystemError",
          code: "aperture.spawn.invalidExtrudeMesh",
          detail: { path: "depth" },
        }),
      );
      expect(app.lowLevel.assets.createManifestReport().total).toBe(0);
      app.context.spawn.mesh({
        key: "facade",
        mesh: mesh.extrude(facade),
        material: material.standard(),
      });
      app.context.spawn.camera({
        key: "camera",
        camera: { frustumCulling: false },
        transform: { translation: [4, 3, 10], lookAt: [4, 3, 0] },
      });
      const dynamic = app.context.meshes.dynamic("facade.mesh");
      expect(dynamic.get()).toEqual(createExtrudeMeshAsset(facade));
      expect(dynamic.get()!.indexBuffer).toBeDefined();
      const before = app.extract();
      const edited = createExtrudeMeshAsset({ ...facade, depth: 1 });
      expect(dynamic.publish(edited)).toMatchObject({ version: 2 });
      const after = app.extract();
      expect(after.meshDraws).toHaveLength(1);
      expect(after.meshDraws[0]!.mesh).toEqual(before.meshDraws[0]!.mesh);
      expect(after.meshDraws[0]!.renderId).toBe(before.meshDraws[0]!.renderId);
      expect(
        after.bounds[after.meshDraws[0]!.boundsIndex]!.localAabb.max[2],
      ).toBe(1);
    } finally {
      await app.dispose();
    }
  });
  it("exposes factory and option types to authoring references", async () => {
    const sources = await collectCandidateSources(
      process.cwd(),
      await discoverPackageExportInfo(process.cwd()),
    );
    for (const file of [
      "packages/render/src/mesh/primitives-extrude.ts",
      "packages/render/src/mesh/extrude-types.ts",
    ])
      expect(sources.find((s) => s.file === file)?.entrypoint).toContain(
        "@aperture-engine/render",
      );
  }, 30000);
});
