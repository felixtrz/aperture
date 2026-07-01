import { describe, expect, it } from "vitest";

import { defineApertureConfig } from "@aperture-engine/app/config";
import { createApertureHeadlessRunner } from "@aperture-engine/app/headless";
import { createSystem, material, mesh } from "@aperture-engine/app/systems";

describe("spawn option diagnostics", () => {
  it("surfaces headless-loaded spawn shape mistakes (F17)", async () => {
    class InvalidSpawnSystem extends createSystem({ priority: 0 }) {
      override init(): void {
        this.spawn.mesh({
          key: "child",
          mesh: mesh.box({ size: [1, 1, 1] }),
          material: material.standard(),
          parent: "root",
        } as never);

        this.spawn.fog({
          kind: "linear",
        } as never);

        this.spawn.particles({
          effect: { kind: "burst", id: "boom" },
        } as never);
      }
    }

    const runner = await createApertureHeadlessRunner({
      config: defineApertureConfig({
        mode: "headless",
        render: { defaultCamera: false, defaultLight: false },
      }),
      systems: [{ default: InvalidSpawnSystem }],
    });

    runner.step(1 / 60, 0);

    const diagnostics = runner.getStatus().diagnostics;
    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "aperture.spawn.unknownOption",
          data: expect.objectContaining({
            spawnKind: "mesh",
            unknown: ["parent"],
          }),
        }),
        expect.objectContaining({
          code: "aperture.spawn.unknownOption",
          data: expect.objectContaining({
            spawnKind: "fog",
            unknown: ["kind"],
          }),
        }),
        expect.objectContaining({
          code: "aperture.spawn.invalidParticleEffectHandle",
          data: expect.objectContaining({
            received: expect.objectContaining({ kind: "burst" }),
          }),
        }),
      ]),
    );
  });
});
