import { describe, expect, it } from "vitest";
import {
  LocalTransform,
  assetHandleKey,
  createMeshHandle,
  serializeEntityRef,
  type Entity,
} from "@aperture-engine/simulation";
import { PhysicsRigidBodyType } from "@aperture-engine/physics";
import { createTestPhysicsBackend } from "@aperture-engine/physics/testing";
import { createPlaneMeshAsset } from "@aperture-engine/render";
import { createApertureHeadlessRunner } from "@aperture-engine/app/headless";
import { defineApertureConfig } from "@aperture-engine/app/config";
import type { CreateApertureAppOptions } from "@aperture-engine/app/advanced";

describe("app physics facade", () => {
  it("installs Rapier through createApertureApp physics config and steps settling bodies", async () => {
    const runner = await createPhysicsRunner({ physics: true });
    const context = runner.app.context;
    const body = context.spawn.physics({
      key: "physics.facade.dynamic",
      transform: { translation: [0, 2, 0] },
      physics: {
        rigidBody: { type: PhysicsRigidBodyType.Dynamic },
        collider: { shape: { kind: "sphere", radius: 0.25 } },
      },
    });

    context.spawn.physics({
      key: "physics.facade.ground",
      transform: { translation: [0, -0.25, 0] },
      physics: {
        rigidBody: { type: PhysicsRigidBodyType.Static },
        collider: { shape: { kind: "box", halfExtents: [4, 0.25, 4] } },
      },
    });

    const beforeY = readY(body);

    for (let frame = 0; frame < 40; frame += 1) {
      runner.step(1 / 60, frame / 60);
    }

    const summary = context.physics.summary();

    expect(runner.app.physics?.backend.kind).toBe("rapier");
    expect(summary.backend).toMatchObject({
      kind: "rapier",
      execution: "simulation-worker",
    });
    expect(summary.step).toMatchObject({
      enabled: true,
      bodyCount: 2,
      colliderCount: 2,
    });
    expect(readY(body)).toBeLessThan(beforeY);
  });

  it("wires a declarative config.physics block through the headless runner (F12)", async () => {
    // Physics is declared ONLY in the config — nothing is passed as the
    // imperative `physics` option. Before the fix the headless runner dropped
    // config.physics: fixedUpdate never fired and no backend was installed.
    const runner = await createApertureHeadlessRunner({
      config: defineApertureConfig({
        mode: "headless",
        systems: [],
        physics: { backend: "rapier", gravity: [0, -9.81, 0] },
        render: { defaultCamera: false, defaultLight: false },
      }),
    });
    const context = runner.app.context;
    const box = context.spawn.physics({
      key: "physics.config.box",
      transform: { translation: [0, 6, 0] },
      physics: {
        rigidBody: { type: PhysicsRigidBodyType.Dynamic },
        collider: { shape: { kind: "box", halfExtents: [0.5, 0.5, 0.5] } },
      },
    });
    context.spawn.physics({
      key: "physics.config.ground",
      transform: { translation: [0, 0, 0] },
      physics: {
        rigidBody: { type: PhysicsRigidBodyType.Static },
        collider: { shape: { kind: "box", halfExtents: [5, 0.5, 5] } },
      },
    });

    for (let frame = 0; frame < 180; frame += 1) {
      runner.step(1 / 60, frame / 60);
    }

    // The backend installed from config.physics, the fixed-step clock advanced,
    // and the dynamic box came to rest on the static ground (contacts resolve):
    // ground top 0.5 + box half-height 0.5 ≈ 1.0.
    expect(runner.app.physics?.backend.kind).toBe("rapier");
    expect(context.physics.summary().step).toMatchObject({
      enabled: true,
      bodyCount: 2,
      colliderCount: 2,
    });
    expect(readY(box)).toBeGreaterThan(0.9);
    expect(readY(box)).toBeLessThan(1.1);
  });

  it("installs custom backends through the same facade and supports character movement", async () => {
    const runner = await createPhysicsRunner({
      physics: { backend: () => createTestPhysicsBackend() },
    });
    const context = runner.app.context;

    context.spawn.physics({
      key: "physics.facade.floor",
      transform: { translation: [0, 0, 0] },
      physics: {
        rigidBody: { type: PhysicsRigidBodyType.Static },
        collider: { shape: { kind: "sphere", radius: 0.5 } },
      },
    });
    const character = context.spawn.physics({
      key: "physics.facade.character",
      transform: { translation: [0, 1, 0] },
      physics: {
        rigidBody: { type: PhysicsRigidBodyType.KinematicPosition },
        collider: { shape: { kind: "sphere", radius: 0.5 } },
        characterController: true,
      },
    });

    runner.step(1 / 60, 0);

    expect(runner.app.physics?.backend.kind).toBe("test");
    expect(
      context.physics.moveCharacter({
        entity: character,
        desiredTranslation: [0, 0, 0],
        settings: { snapToGroundDistance: 0.05 },
      }),
    ).toMatchObject({
      entity: serializeEntityRef(character),
      grounded: true,
    });
  });

  it("disposes physics through the app feature lifecycle", async () => {
    const runner = await createPhysicsRunner({
      physics: { backend: () => createTestPhysicsBackend() },
    });
    const context = runner.app.context;

    runner.step(1 / 60, 0);

    expect(context.physics.summary().backend).toMatchObject({ kind: "test" });

    await runner.app.dispose();
    await runner.app.dispose();

    expect(context.physics.summary()).toMatchObject({
      backend: null,
      sync: null,
      step: null,
      readback: null,
      writeback: null,
      eventCount: 0,
    });
  });

  it("threads asset-backed collider geometry into Rapier without direct backend construction", async () => {
    const runner = await createPhysicsRunner({
      physics: {
        backend: "rapier",
        colliderGeometry: { kind: "assets" },
      },
    });
    const context = runner.app.context;
    const terrain = createMeshHandle("terrain");

    context.assetsRegistry.register(terrain);
    context.assetsRegistry.markReady(
      terrain,
      createPlaneMeshAsset({ width: 4, height: 4 }),
    );
    context.spawn.physics({
      key: "physics.facade.asset-ground",
      physics: {
        rigidBody: { type: PhysicsRigidBodyType.Static },
        collider: {
          shape: {
            kind: "trimesh",
            meshId: assetHandleKey(terrain),
          },
        },
      },
    });

    runner.step(1 / 60, 0);

    expect(context.physics.summary()).toMatchObject({
      backend: { kind: "rapier" },
      sync: {
        bodyCount: 1,
        colliderCount: 1,
        unsupportedFeatureCount: 0,
      },
    });
  });
});

async function createPhysicsRunner(options: {
  readonly physics: NonNullable<CreateApertureAppOptions["physics"]>;
}) {
  return createApertureHeadlessRunner({
    config: defineApertureConfig({
      mode: "headless",
      systems: [],
      render: { defaultCamera: false, defaultLight: false },
    }),
    physics: options.physics,
  });
}

function readY(entity: Entity): number {
  const translation = entity.getVectorView(LocalTransform, "translation");
  const value = translation[1];

  if (value === undefined) {
    throw new Error("Expected entity to have a LocalTransform translation.");
  }

  return value;
}
