import { describe, expect, it } from "vitest";

import {
  buildColliderHandleIndex,
  colliderMatchForHandle,
} from "../../packages/physics-rapier/src/colliders.js";
import type {
  RapierBodyEntry,
  RapierColliderEntry,
} from "../../packages/physics-rapier/src/types.js";

function fakeCollider(entity: string, handle: number): RapierColliderEntry {
  return {
    entity,
    collider: { handle } as RapierColliderEntry["collider"],
    descriptor: {} as RapierColliderEntry["descriptor"],
  };
}

function fakeBody(
  entity: string,
  colliders: readonly RapierColliderEntry[],
): RapierBodyEntry {
  return { entity, colliders } as unknown as RapierBodyEntry;
}

describe("buildColliderHandleIndex", () => {
  it("indexes every collider handle to its body/collider match", () => {
    const a = fakeBody("a", [fakeCollider("a", 10), fakeCollider("a-2", 11)]);
    const b = fakeBody("b", [fakeCollider("b", 20)]);
    const bodies = new Map([
      ["a", a],
      ["b", b],
    ]);

    const index = buildColliderHandleIndex(bodies);

    expect(index.size).toBe(3);
    expect(index.get(10)).toEqual({ body: a, collider: a.colliders[0] });
    expect(index.get(11)).toEqual({ body: a, collider: a.colliders[1] });
    expect(index.get(20)).toEqual({ body: b, collider: b.colliders[0] });
    expect(index.get(99)).toBeUndefined();
  });

  it("matches the linear-scan colliderMatchForHandle for every handle", () => {
    const a = fakeBody("a", [fakeCollider("a", 1)]);
    const b = fakeBody("b", [fakeCollider("b", 2), fakeCollider("b-2", 3)]);
    const bodies = new Map([
      ["a", a],
      ["b", b],
    ]);

    const index = buildColliderHandleIndex(bodies);

    // Present and absent handles both agree with the O(n) scan it replaces.
    for (const handle of [1, 2, 3, 4]) {
      expect(index.get(handle) ?? null).toEqual(
        colliderMatchForHandle(bodies, handle),
      );
    }
  });

  it("returns an empty index for an empty body store", () => {
    expect(buildColliderHandleIndex(new Map()).size).toBe(0);
  });
});
