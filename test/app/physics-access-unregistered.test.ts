import { describe, expect, it } from "vitest";
import { AssetRegistry, createWorld } from "@aperture-engine/simulation";
import { createApertureSystemContext } from "@aperture-engine/app/systems";

/**
 * Regression gate for the elics registration hazard: component registration
 * lives on module-global component singletons, and elics' raw
 * Entity.hasComponent throws (`Cannot read properties of null`) on a component
 * that was never registered anywhere in the process.
 *
 * This file must stay in its own test file and must NOT register or add any
 * physics component: file-level isolation is what guarantees the components
 * are unregistered when the facade reads run. Reads through the physics facade
 * must treat unregistered components as absent instead of crashing.
 */
describe("physics system access before any component registration", () => {
  it("reads zero velocities and refuses joint breaks on a bare world", () => {
    const world = createWorld({ entityCapacity: 1 });
    const context = createApertureSystemContext({
      world,
      assetsRegistry: new AssetRegistry(),
    });
    const body = world.createEntity();

    expect(context.physics.getLinearVelocity(body)).toEqual([0, 0, 0]);
    expect(context.physics.getAngularVelocity(body)).toEqual([0, 0, 0]);
    expect(context.physics.breakJoint(body)).toBe(false);
  });
});
