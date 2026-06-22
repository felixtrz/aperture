import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { createApertureApp, defineApertureConfig } from "@aperture-engine/app";
import {
  listMutableComponentFields,
  setApertureEntityComponentField,
} from "@aperture-engine/app/entity-lookup";
import { createSystem, material, mesh } from "@aperture-engine/app/systems";
import { Camera, Light, Visibility } from "@aperture-engine/render";
import type { Entity } from "@aperture-engine/simulation";

// AF-3 (readiness roadmap R3.1): the agent write path covers render-side
// authoring components, the AI_TOOLING doc enumerates exactly the registry,
// and a visibility mutation observably removes the draw from extraction.

async function createMutationApp() {
  const refs: { mover: Entity | null; camera: Entity | null } = {
    mover: null,
    camera: null,
  };
  const SetupSystem = class extends createSystem({ priority: 0 }) {
    override init(): void {
      refs.camera = this.spawn.camera({
        key: "camera.mutation",
        transform: { translation: [0, 0, 5], lookAt: [0, 0, 0] },
      });
      refs.mover = this.spawn.mesh({
        key: "mutation.target",
        mesh: mesh.box({ size: 0.5 }),
        material: material.standard(),
        transform: { translation: [0, 0, 0] },
      });
      // spawn.mesh leaves Visibility implicit (absent means visible);
      // mutating it through the write path requires the component.
      refs.mover.addComponent(Visibility);
    }
  };

  const app = await createApertureApp({
    config: defineApertureConfig({ mode: "headless", systems: [] }),
    systems: [{ default: SetupSystem }],
  });
  app.step(1 / 60, 0);

  return { app, refs };
}

function entityRef(entity: Entity): { index: number; generation: number } {
  return { index: entity.index, generation: entity.generation };
}

describe("render-side component mutation registry (AF-3)", () => {
  it("keeps the AI_TOOLING doc allowlist in lockstep with the registry", () => {
    const doc = readFileSync(
      path.join(process.cwd(), "docs/AI_TOOLING.md"),
      "utf8",
    );

    for (const [component, fields] of Object.entries(
      listMutableComponentFields(),
    )) {
      const line = doc
        .split("\n")
        .find((candidate) => candidate.includes(`\`${component}\`:`));

      expect(
        line,
        `docs/AI_TOOLING.md is missing the allowlist line for '${component}' — regenerate the Mutating Tools list from listMutableComponentFields()`,
      ).toBeDefined();

      for (const field of fields) {
        expect(
          line,
          `docs/AI_TOOLING.md line for '${component}' is missing field '${field}'`,
        ).toContain(`\`${field}\``);
      }
    }
  });

  it("disabling Visibility through the write path removes the draw from extraction", async () => {
    const { app, refs } = await createMutationApp();
    const target = refs.mover as Entity;

    expect(app.extract(1).meshDraws).toHaveLength(1);

    const report = setApertureEntityComponentField(app.lowLevel.world, {
      entity: entityRef(target),
      component: Visibility.id,
      field: "visible",
      value: false,
    });

    expect(report.ok).toBe(true);
    expect(target.getValue(Visibility, "visible")).toBe(false);

    app.step(1 / 60, 1 / 60);
    expect(app.extract(2).meshDraws).toHaveLength(0);

    // And back: the loop is reversible from the prior snapshot value.
    setApertureEntityComponentField(app.lowLevel.world, {
      entity: entityRef(target),
      component: Visibility.id,
      field: "visible",
      value: true,
    });
    app.step(1 / 60, 2 / 60);
    expect(app.extract(3).meshDraws).toHaveLength(1);
  });

  it("writes camera and light fields and reads them back", async () => {
    const { app, refs } = await createMutationApp();
    const world = app.lowLevel.world;
    const camera = refs.camera as Entity;

    expect(
      setApertureEntityComponentField(world, {
        entity: entityRef(camera),
        component: Camera.id,
        field: "priority",
        value: 7,
      }).ok,
    ).toBe(true);
    expect(camera.getValue(Camera, "priority")).toBe(7);

    expect(
      setApertureEntityComponentField(world, {
        entity: entityRef(camera),
        component: Camera.id,
        field: "clearColor",
        value: [0.1, 0.2, 0.3, 1],
      }).ok,
    ).toBe(true);
    expect(
      Array.from(camera.getVectorView(Camera, "clearColor")).map((channel) =>
        Number(channel.toFixed(3)),
      ),
    ).toEqual([0.1, 0.2, 0.3, 1]);
  });

  it("rejects invalid values and missing components with the family diagnostics", async () => {
    const { app, refs } = await createMutationApp();
    const world = app.lowLevel.world;
    const target = refs.mover as Entity;

    const wrongType = setApertureEntityComponentField(world, {
      entity: entityRef(target),
      component: Visibility.id,
      field: "visible",
      value: "nope",
    });
    expect(wrongType.ok).toBe(false);
    expect(!wrongType.ok && wrongType.diagnostic.code).toBe(
      "aperture.entityLookup.invalidComponentFieldValue",
    );
    expect(target.getValue(Visibility, "visible")).toBe(true);

    const missing = setApertureEntityComponentField(world, {
      entity: entityRef(target),
      component: Light.id,
      field: "intensity",
      value: 2,
    });
    expect(missing.ok).toBe(false);
    expect(!missing.ok && missing.diagnostic.code).toBe(
      "aperture.entityLookup.componentMissing",
    );

    const nonPositive = setApertureEntityComponentField(world, {
      entity: entityRef(refs.camera as Entity),
      component: Camera.id,
      field: "near",
      value: 0,
    });
    expect(nonPositive.ok).toBe(false);
    expect(!nonPositive.ok && nonPositive.diagnostic.code).toBe(
      "aperture.entityLookup.invalidComponentFieldValue",
    );

    const badColor = setApertureEntityComponentField(world, {
      entity: entityRef(refs.camera as Entity),
      component: Camera.id,
      field: "clearColor",
      value: [1, 2],
    });
    expect(badColor.ok).toBe(false);

    const nonInteger = setApertureEntityComponentField(world, {
      entity: entityRef(refs.camera as Entity),
      component: Camera.id,
      field: "priority",
      value: 1.5,
    });
    expect(nonInteger.ok).toBe(false);
  });
});
