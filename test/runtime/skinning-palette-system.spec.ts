import { describe, expect, it } from "vitest";

import {
  LocalTransform,
  WorldTransform,
  createLocalTransform,
  createWorld,
  createWorldTransform,
  identityMat4,
  quatFromAxisAngle,
  registerTransformComponents,
  resolveWorldTransforms,
  type Entity,
  type EcsWorld,
} from "@aperture-engine/simulation";
import {
  Skin,
  registerRenderAuthoringComponents,
} from "@aperture-engine/render";
import {
  createSimulationApp,
  updateSkeletonPalettes,
} from "@aperture-engine/runtime";

function translation16(x: number, y: number, z: number): number[] {
  // prettier-ignore
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
}

function identity16(): number[] {
  return translation16(0, 0, 0);
}

function block(palette: Float32Array, jointIndex: number): number[] {
  return Array.from(palette.subarray(jointIndex * 16, jointIndex * 16 + 16));
}

function expectMatrixClose(
  actual: readonly number[],
  expected: readonly number[],
): void {
  expect(actual).toHaveLength(expected.length);
  for (let i = 0; i < expected.length; i += 1) {
    expect(actual[i]).toBeCloseTo(expected[i]!, 5);
  }
}

/** Add a LocalTransform (+ a deliberately stale WorldTransform) to `entity`. */
function addTransform(
  entity: Entity,
  local: Parameters<typeof createLocalTransform>[0],
): void {
  entity.addComponent(LocalTransform, createLocalTransform(local));
  entity.addComponent(WorldTransform, createWorldTransform(identityMat4()));
}

function setupSkinnedWorld(input: {
  readonly world: EcsWorld;
  readonly joint0Local: Parameters<typeof createLocalTransform>[0];
  readonly joint1Local: Parameters<typeof createLocalTransform>[0];
  readonly inverseBindMatrices: Float32Array;
}): { mesh: Entity; joint0: Entity; joint1: Entity; palette: Float32Array } {
  const { world } = input;
  registerTransformComponents(world);
  registerRenderAuthoringComponents(world);

  const joint0 = world.createEntity();
  addTransform(joint0, input.joint0Local);
  const joint1 = world.createEntity();
  addTransform(joint1, input.joint1Local);

  const mesh = world.createEntity();
  addTransform(mesh, {});
  const palette = new Float32Array(32);
  mesh.addComponent(Skin, {
    jointCount: 2,
    jointMatrices: palette,
    skeleton: {
      joints: [joint0, joint1],
      inverseBindMatrices: input.inverseBindMatrices,
    },
  });

  return { mesh, joint0, joint1, palette };
}

describe("skinning palette compute system", () => {
  it("computes palette_i = inverseMeshWorld * jointWorld_i * inverseBind_i", () => {
    const world = createWorld();
    const { palette } = setupSkinnedWorld({
      world,
      joint0Local: { translation: [1, 0, 0] },
      joint1Local: { translation: [0, 1, 0] },
      inverseBindMatrices: new Float32Array([...identity16(), ...identity16()]),
    });

    resolveWorldTransforms(world);
    expect(updateSkeletonPalettes(world)).toBe(1);

    // Mesh world is identity and inverse-bind is identity, so each palette
    // block equals the joint's world transform.
    expectMatrixClose(block(palette, 0), translation16(1, 0, 0));
    expectMatrixClose(block(palette, 1), translation16(0, 1, 0));
  });

  it("yields identity palettes at the bind pose", () => {
    const world = createWorld();
    // Bind pose: inverseBind_i = inverse(jointWorld_i) (mesh world identity).
    const { palette } = setupSkinnedWorld({
      world,
      joint0Local: { translation: [2, 0, 0] },
      joint1Local: { translation: [0, -3, 0] },
      inverseBindMatrices: new Float32Array([
        ...translation16(-2, 0, 0),
        ...translation16(0, 3, 0),
      ]),
    });

    resolveWorldTransforms(world);
    updateSkeletonPalettes(world);

    expectMatrixClose(block(palette, 0), identity16());
    expectMatrixClose(block(palette, 1), identity16());
  });

  it("re-stepping a rotated joint changes only that joint's palette block", () => {
    const world = createWorld();
    const { joint0, palette } = setupSkinnedWorld({
      world,
      joint0Local: { translation: [1, 0, 0] },
      joint1Local: { translation: [0, 1, 0] },
      inverseBindMatrices: new Float32Array([...identity16(), ...identity16()]),
    });

    resolveWorldTransforms(world);
    updateSkeletonPalettes(world);
    const joint0Before = block(palette, 0);
    const joint1Before = block(palette, 1);

    // Rotate joint 0 by 90deg about Z and recompute.
    joint0
      .getVectorView(LocalTransform, "rotation")
      .set(quatFromAxisAngle([0, 0, 1], Math.PI / 2));
    resolveWorldTransforms(world);
    updateSkeletonPalettes(world);

    expect(block(palette, 0)).not.toEqual(joint0Before);
    expect(block(palette, 1)).toEqual(joint1Before);
  });

  it("reflects same-frame joint transforms when run from step() after resolution", () => {
    const app = createSimulationApp();
    const world = app.world;
    registerTransformComponents(world);
    registerRenderAuthoringComponents(world);

    const joint = world.createEntity();
    // LocalTransform says (3,0,0) but the seeded WorldTransform is identity:
    // only a post-resolution palette compute will reflect (3,0,0).
    addTransform(joint, { translation: [3, 0, 0] });

    const mesh = world.createEntity();
    addTransform(mesh, {});
    const palette = new Float32Array(16);
    mesh.addComponent(Skin, {
      jointCount: 1,
      jointMatrices: palette,
      skeleton: {
        joints: [joint],
        inverseBindMatrices: new Float32Array(identity16()),
      },
    });

    app.step();

    // Same-frame: palette reflects the resolved (3,0,0), not the stale identity.
    expectMatrixClose(block(palette, 0), translation16(3, 0, 0));
  });
});
