import { describe, expect, it } from "vitest";
import {
  PhysicsRigidBodyType,
  createPhysicsResultBuffer,
  validatePhysicsCharacterMove,
} from "@aperture-engine/physics";
import { createRapierPhysicsBackend } from "@aperture-engine/physics-rapier";
import { createTestPhysicsBackend } from "@aperture-engine/physics/testing";

describe("physics character controller", () => {
  it("validates finite character movement settings", () => {
    expect(
      validatePhysicsCharacterMove({
        entity: "character",
        desiredTranslation: [1, 0, 0],
        settings: {
          offset: 0.02,
          up: [0, 1, 0],
          maxSlopeClimbAngle: Math.PI / 4,
          minSlopeSlideAngle: Math.PI / 3,
          snapToGroundDistance: 0.1,
          autostep: {
            maxHeight: 0.35,
            minWidth: 0.2,
          },
          characterMass: 70,
        },
      }),
    ).toEqual([]);

    expect(
      validatePhysicsCharacterMove({
        entity: "",
        desiredTranslation: [1, Number.NaN, 0],
        settings: {
          offset: 0,
          up: [0, 0, 0],
          snapToGroundDistance: -1,
          autostep: {
            maxHeight: -0.1,
            minWidth: 0,
          },
          characterMass: -1,
        },
      }).map((diagnostic) => diagnostic.code),
    ).toEqual([
      "aperture.physics.invalid.entity",
      "aperture.physics.invalid.desiredTranslation",
      "aperture.physics.invalid.offset",
      "aperture.physics.invalid.snapToGroundDistance",
      "aperture.physics.invalid.characterMass",
      "aperture.physics.invalid.autostep.maxHeight",
      "aperture.physics.invalid.autostep.minWidth",
    ]);
  });

  it("moves and slides deterministically in the test backend", () => {
    const backend = createTestPhysicsBackend();

    backend.init();
    backend.sync({
      commands: [
        {
          kind: "upsertBody",
          entity: "floor",
          bodyType: PhysicsRigidBodyType.Static,
          transform: {
            translation: [0, 0, 0],
            rotation: [0, 0, 0, 1],
          },
          radius: 0.5,
        },
        {
          kind: "upsertBody",
          entity: "character",
          bodyType: PhysicsRigidBodyType.KinematicPosition,
          transform: {
            translation: [0, 1, 0],
            rotation: [0, 0, 0, 1],
          },
          radius: 0.5,
        },
        {
          kind: "upsertBody",
          entity: "wall",
          bodyType: PhysicsRigidBodyType.Static,
          transform: {
            translation: [1, 1, 0],
            rotation: [0, 0, 0, 1],
          },
          radius: 0.5,
        },
      ],
    });

    const result = backend.moveCharacter?.({
      entity: "character",
      desiredTranslation: [2, 0, 1],
      settings: {
        snapToGroundDistance: 0.05,
      },
    });

    expect(result).toMatchObject({
      entity: "character",
      desiredTranslation: [2, 0, 1],
      movement: [0, 0, 1],
      targetTranslation: [0, 1, 1],
      grounded: true,
    });
    expect(result?.collisions).toHaveLength(1);
    expect(result?.collisions[0]).toMatchObject({
      entity: "wall",
      normal: [-1, 0, 0],
    });
  });

  it("uses Rapier to walk a grounded kinematic capsule and slide along a wall", async () => {
    const backend = createRapierPhysicsBackend({ gravity: [0, -9.81, 0] });

    await backend.init();
    backend.sync({
      commands: [
        floorCommand(),
        {
          kind: "upsertBody",
          entity: "wall",
          bodyType: PhysicsRigidBodyType.Static,
          transform: {
            translation: [0.8, 0.75, 0.25],
            rotation: [0, 0, 0, 1],
          },
          collider: {
            shape: { kind: "box", halfExtents: [0.05, 0.75, 0.5] },
          },
        },
        characterCommand([0, 0.75, 0]),
      ],
    });
    backend.step(1 / 60, 0);

    const result = backend.moveCharacter?.({
      entity: "character",
      desiredTranslation: [1, -0.02, 0.65],
      settings: {
        snapToGroundDistance: 0.12,
        maxSlopeClimbAngle: Math.PI / 4,
        minSlopeSlideAngle: Math.PI / 3,
        autostep: false,
      },
    });

    expect(result).not.toBeNull();
    expect(result?.grounded).toBe(true);
    expect(result?.movement[0] ?? 0).toBeGreaterThan(0.45);
    expect(result?.movement[0] ?? 0).toBeLessThan(0.58);
    expect(result?.movement[2] ?? 0).toBeGreaterThan(0.45);
    expect(
      result?.collisions.some((collision) => collision.entity === "wall"),
    ).toBe(true);

    backend.step(1 / 60, 1);
    const results = createPhysicsResultBuffer();
    backend.readResults(results);
    const character = results.bodies.find(
      (body) => body.entity === "character",
    );

    expect(character?.transform.translation[0]).toBeCloseTo(
      result?.targetTranslation[0] ?? 0,
      4,
    );
    expect(character?.transform.translation[2]).toBeCloseTo(
      result?.targetTranslation[2] ?? 0,
      4,
    );
    backend.dispose();
  });

  it("uses Rapier autostep to climb a configured low obstacle", async () => {
    const backend = createRapierPhysicsBackend({ gravity: [0, -9.81, 0] });

    await backend.init();
    backend.sync({
      commands: [
        floorCommand(),
        {
          kind: "upsertBody",
          entity: "step",
          bodyType: PhysicsRigidBodyType.Static,
          transform: {
            translation: [0.65, 0.1, 0],
            rotation: [0, 0, 0, 1],
          },
          collider: {
            shape: { kind: "box", halfExtents: [0.15, 0.1, 0.45] },
          },
        },
        characterCommand([0, 0.75, 0]),
      ],
    });
    backend.step(1 / 60, 0);

    const blocked = backend.moveCharacter?.({
      entity: "character",
      desiredTranslation: [1.1, 0, 0],
      settings: {
        snapToGroundDistance: 0.12,
        autostep: false,
      },
    });

    backend.sync({
      commands: [characterCommand([0, 0.75, 0])],
    });
    backend.step(1 / 60, 1);

    const stepped = backend.moveCharacter?.({
      entity: "character",
      desiredTranslation: [1.1, 0, 0],
      settings: {
        snapToGroundDistance: 0.12,
        autostep: {
          maxHeight: 0.35,
          minWidth: 0.2,
        },
      },
    });

    expect(blocked?.movement[0] ?? 0).toBeLessThan(0.45);
    expect(stepped?.movement[0] ?? 0).toBeGreaterThan(0.85);
    expect(stepped?.targetTranslation[1] ?? 0).toBeGreaterThan(0.9);
    backend.dispose();
  });

  it("uses Rapier slope limits to reject a too-steep incline", async () => {
    const backend = createRapierPhysicsBackend({ gravity: [0, -9.81, 0] });

    await backend.init();
    backend.sync({
      commands: [
        floorCommand(),
        {
          kind: "upsertBody",
          entity: "steep-slope",
          bodyType: PhysicsRigidBodyType.Static,
          transform: {
            translation: [0.75, 0.34, 0],
            rotation: quatFromZRotation(Math.PI / 3),
          },
          collider: {
            shape: { kind: "box", halfExtents: [0.8, 0.05, 0.45] },
          },
        },
        characterCommand([0, 0.75, 0]),
      ],
    });
    backend.step(1 / 60, 0);

    const result = backend.moveCharacter?.({
      entity: "character",
      desiredTranslation: [1.2, 0, 0],
      settings: {
        snapToGroundDistance: 0.12,
        maxSlopeClimbAngle: Math.PI / 6,
        minSlopeSlideAngle: Math.PI / 4,
        autostep: false,
      },
    });

    expect(result).not.toBeNull();
    expect(result?.movement[0] ?? 0).toBeLessThan(0.55);
    expect(
      result?.collisions.some(
        (collision) =>
          collision.entity === "steep-slope" && collision.normal[1] < 0.7,
      ),
    ).toBe(true);
    backend.dispose();
  });
});

function floorCommand() {
  return {
    kind: "upsertBody" as const,
    entity: "floor",
    bodyType: PhysicsRigidBodyType.Static,
    transform: {
      translation: [0, -0.05, 0] as const,
      rotation: [0, 0, 0, 1] as const,
    },
    collider: {
      shape: {
        kind: "box" as const,
        halfExtents: [5, 0.05, 5] as const,
      },
    },
  };
}

function characterCommand(translation: readonly [number, number, number]) {
  return {
    kind: "upsertBody" as const,
    entity: "character",
    bodyType: PhysicsRigidBodyType.KinematicPosition,
    transform: {
      translation,
      rotation: [0, 0, 0, 1] as const,
    },
    collider: {
      shape: {
        kind: "capsule" as const,
        radius: 0.25,
        halfHeight: 0.5,
      },
    },
  };
}

function quatFromZRotation(
  radians: number,
): readonly [number, number, number, number] {
  return [0, 0, Math.sin(radians / 2), Math.cos(radians / 2)];
}
