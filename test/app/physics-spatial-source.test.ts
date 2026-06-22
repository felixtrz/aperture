import { describe, expect, it } from "vitest";
import type { PhysicsCommand } from "@aperture-engine/physics";
import { createTestPhysicsBackend } from "@aperture-engine/physics/testing";
import {
  AssetRegistry,
  createWorld,
  type Entity,
} from "@aperture-engine/simulation";
import { createApertureSystemContext } from "@aperture-engine/app/systems";

describe("physics spatial source", () => {
  it("routes collider-source spatial raycasts to the installed physics backend", () => {
    const world = createWorld({ entityCapacity: 8 });
    const context = createApertureSystemContext({
      world,
      assetsRegistry: new AssetRegistry(),
    });
    const near = world.createEntity();
    const far = world.createEntity();
    const stale = world.createEntity();
    const backend = createTestPhysicsBackend();

    backend.init();
    backend.sync({
      commands: [
        bodyCommand(near, [2, 0, 0]),
        bodyCommand(far, [4, 0, 0]),
        bodyCommand(stale, [6, 0, 0]),
      ],
    });
    stale.destroy();
    backend.step(1 / 60, 1);
    context.physics.setBackend(backend);

    const ray = {
      origin: [0, 0, 0] as const,
      direction: [1, 0, 0] as const,
    };

    expect(
      context.spatial.raycastFirst(ray, {
        source: "collider",
        maxDistance: 10,
      }),
    ).toMatchObject({
      entity: { entity: near, ref: { index: near.index } },
      distance: 1.5,
      point: [1.5, 0, 0],
      source: "collider",
    });
    expect(
      context.spatial
        .raycastAll(ray, {
          source: "collider",
          maxDistance: 10,
        })
        .map((hit) => hit.entity.entity),
    ).toEqual([near, far]);
    expect(
      context.spatial.raycastFirst(ray, {
        source: "collider",
        query: { entities: new Set([far]) },
        maxDistance: 10,
      })?.entity.entity,
    ).toBe(far);
    expect(
      context.spatial.raycastFirst(ray, {
        source: "collider",
        filter: (entity) => entity !== near,
        maxDistance: 10,
      })?.entity.entity,
    ).toBe(far);

    backend.dispose();
  });

  it("keeps collider source empty until a backend is installed", () => {
    const world = createWorld({ entityCapacity: 4 });
    const context = createApertureSystemContext({
      world,
      assetsRegistry: new AssetRegistry(),
    });
    const entity = world.createEntity();

    context.spatial.setBounds([
      { entity, worldAabb: { min: [1, -1, -1], max: [2, 1, 1] } },
    ]);

    const ray = {
      origin: [0, 0, 0] as const,
      direction: [1, 0, 0] as const,
    };

    expect(
      context.spatial.raycastFirst(ray, { source: "collider" }),
    ).toBeNull();
    expect(context.spatial.raycastAll(ray, { source: "collider" })).toEqual([]);
    expect(
      context.spatial.raycastFirst(ray, {
        source: "collider",
        fallback: "bounds",
      })?.source,
    ).toBe("bounds");
  });
});

function bodyCommand(
  entity: Entity,
  translation: [number, number, number],
): Extract<PhysicsCommand, { readonly kind: "upsertBody" }> {
  return {
    kind: "upsertBody",
    entity: `${entity.index}:${entity.generation}`,
    transform: {
      translation,
      rotation: [0, 0, 0, 1],
    },
    radius: 0.5,
  };
}
