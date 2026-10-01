import { describe, expect, it } from "vitest";
import { createApertureApp, defineApertureConfig } from "@aperture-engine/app";
import { material, mesh } from "@aperture-engine/app/systems";
import { Parent, type Entity } from "@aperture-engine/simulation";

const ref = (entity: Entity) => ({
  index: entity.index,
  generation: entity.generation,
});

describe("hierarchy children follows authoritative Parent relationships", () => {
  it("returns parented groups and meshes before and after the first step", async () => {
    const app = await createApertureApp({
      config: defineApertureConfig({
        mode: "headless",
        render: {
          defaultCamera: false,
          defaultLight: false,
          defaultEnvironment: false,
        },
      }),
      systems: [],
    });
    try {
      const root = app.context.spawn.group({ key: "root" });
      const branch = app.context.spawn.group({
        key: "branch",
        transform: { parent: root, translation: [1, 2, 3] },
      });
      const leaf = app.context.spawn.mesh({
        key: "leaf",
        mesh: mesh.box(),
        material: material.standard(),
        transform: { parent: branch },
      });

      expect(branch.getValue(Parent, "entity")).toBe(root);
      expect(app.context.hierarchy.children(ref(root))).toEqual({
        ok: true,
        children: [ref(branch)],
      });
      expect(app.context.hierarchy.children(ref(branch))).toEqual({
        ok: true,
        children: [ref(leaf)],
      });
      app.step(1 / 60);
      expect(app.context.hierarchy.children(ref(root)).children).toEqual([
        ref(branch),
      ]);
    } finally {
      await app.dispose();
    }
  });
});
