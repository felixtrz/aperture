import { describe, expect, it } from "vitest";

import {
  LocalTransform,
  WorldTransform,
  quatFromAxisAngle,
  type Entity,
} from "@aperture-engine/simulation";
import {
  Ik,
  createSimulationApp,
  updateIkConstraints,
  withIk,
  withTransform,
  type CcdIkConstraint,
  type IkSolverState,
  type SimulationApp,
  type TwoBoneIkConstraint,
} from "@aperture-engine/runtime";

// F2 (three.js parity plan): the fixed-step IK ECS system. Proves the full
// world-read → solve → local-write → re-resolve pipeline: IK adjusts the
// animated base pose to plant the effector on the target, the pole controls the
// bend, weight 0 is a byte-identical no-op, and identical inputs replay to a
// bit-identical pose.

function worldPosition(entity: Entity): readonly number[] {
  const column = entity.getVectorView(WorldTransform, "col3");
  return [column[0] ?? 0, column[1] ?? 0, column[2] ?? 0];
}

function localRotation(entity: Entity): readonly number[] {
  return Array.from(entity.getVectorView(LocalTransform, "rotation"));
}

/**
 * A downward-hanging two-bone limb: root at y=2, mid at y=1, end at y=0 (unit
 * bones, reach 2). Returns the joints plus a solver entity carrying the IK
 * constraint (so the caller can mutate target/pole/weight before stepping).
 */
function buildTwoBoneApp(options?: {
  polePosition?: readonly [number, number, number];
  weight?: number;
  baseRootRotation?: readonly [number, number, number, number];
}): {
  app: SimulationApp;
  root: Entity;
  mid: Entity;
  end: Entity;
  constraint: TwoBoneIkConstraint;
} {
  const app = createSimulationApp({ worldOptions: { entityCapacity: 16 } });
  const root = app.spawn(withTransform({ translation: [0, 2, 0] }));
  const mid = app.spawn(
    withTransform({ translation: [0, -1, 0], parent: root }),
  );
  const end = app.spawn(
    withTransform({ translation: [0, -1, 0], parent: mid }),
  );

  if (options?.baseRootRotation !== undefined) {
    // Stand in for an animated base pose: the driver would write this each step;
    // here we set it once so IK must override it to still reach the target.
    root
      .getVectorView(LocalTransform, "rotation")
      .set(options.baseRootRotation);
  }

  const solver = app.spawn(
    withIk({
      constraints: [
        {
          kind: "two-bone",
          root,
          mid,
          end,
          targetPosition: [0, 0, 0],
          ...(options?.polePosition === undefined
            ? {}
            : { polePosition: options.polePosition }),
          weight: options?.weight ?? 1,
        },
      ],
    }),
  );

  const state = solver.getValue(Ik, "state") as IkSolverState;
  const constraint = state.constraints[0] as TwoBoneIkConstraint;
  return { app, root, mid, end, constraint };
}

describe("two-bone IK system", () => {
  it("plants the effector on the target within tolerance", () => {
    const { app, end, constraint } = buildTwoBoneApp();
    constraint.targetPosition = [1, 1, 0]; // distance sqrt(2) from root < reach 2

    app.step(1 / 60, 1 / 60);

    const position = worldPosition(end);
    expect(position[0]).toBeCloseTo(1, 3);
    expect(position[1]).toBeCloseTo(1, 3);
    expect(position[2]).toBeCloseTo(0, 3);
  });

  it("overrides an animated base pose to still reach the target", () => {
    // A 30° yaw base pose on the root (as an animation driver would leave it).
    const base = Array.from(quatFromAxisAngle([0, 1, 0], Math.PI / 6)) as [
      number,
      number,
      number,
      number,
    ];
    const { app, end, root, constraint } = buildTwoBoneApp({
      baseRootRotation: base,
    });
    constraint.targetPosition = [0.8, 1.2, 0.4];

    app.step(1 / 60, 1 / 60);

    // IK wrote a NEW root rotation (base was overridden) and the effector lands
    // on the target regardless of the base pose.
    expect(localRotation(root)).not.toEqual(base);
    const position = worldPosition(end);
    expect(position[0]).toBeCloseTo(0.8, 3);
    expect(position[1]).toBeCloseTo(1.2, 3);
    expect(position[2]).toBeCloseTo(0.4, 3);
  });

  it("bends the knee toward the pole (opposite poles flip the bend)", () => {
    const front = buildTwoBoneApp({ polePosition: [0.7, 1, 1] });
    front.constraint.targetPosition = [0, 1, 0]; // reachable, forces a bend
    front.app.step(1 / 60, 1 / 60);

    const back = buildTwoBoneApp({ polePosition: [0.7, 1, -1] });
    back.constraint.targetPosition = [0, 1, 0];
    back.app.step(1 / 60, 1 / 60);

    const frontMid = worldPosition(front.mid);
    const backMid = worldPosition(back.mid);
    expect(frontMid[2]).toBeGreaterThan(0.2);
    expect(backMid[2]).toBeLessThan(-0.2);
  });

  it("is a byte-identical no-op at weight 0", () => {
    const { app, root, mid, end, constraint } = buildTwoBoneApp({ weight: 0 });
    constraint.targetPosition = [1, 1, 0];

    const rootBefore = localRotation(root);
    const midBefore = localRotation(mid);

    const report = updateIkConstraints(app.world);

    expect(report.solved).toBe(0);
    expect(report.constraints).toBe(1);
    // No writes: the joint local rotations are untouched...
    expect(localRotation(root)).toEqual(rootBefore);
    expect(localRotation(mid)).toEqual(midBefore);
    // ...and after a full step the effector stays at its rest pose.
    app.step(1 / 60, 1 / 60);
    const position = worldPosition(end);
    expect(position[0]).toBeCloseTo(0, 5);
    expect(position[1]).toBeCloseTo(0, 5);
  });

  it("replays to a bit-identical pose from identical inputs (determinism)", () => {
    function run(): readonly number[] {
      const { app, root, mid, constraint } = buildTwoBoneApp({
        polePosition: [0.5, 1, 0.8],
      });
      constraint.targetPosition = [0.6, 1.3, 0.2];
      for (let step = 0; step < 5; step += 1) {
        app.step(1 / 60, step / 60);
      }
      return [...localRotation(root), ...localRotation(mid)];
    }

    expect(run()).toEqual(run());
  });
});

describe("CCD IK system", () => {
  /** A 3-joint chain hanging along -y from the origin, plus an effector tip. */
  function buildCcdApp(): {
    app: SimulationApp;
    joints: Entity[];
    end: Entity;
    constraint: CcdIkConstraint;
  } {
    const app = createSimulationApp({ worldOptions: { entityCapacity: 16 } });
    const j0 = app.spawn(withTransform({ translation: [0, 3, 0] }));
    const j1 = app.spawn(
      withTransform({ translation: [0, -1, 0], parent: j0 }),
    );
    const j2 = app.spawn(
      withTransform({ translation: [0, -1, 0], parent: j1 }),
    );
    const end = app.spawn(
      withTransform({ translation: [0, -1, 0], parent: j2 }),
    );
    const joints = [j0, j1, j2];

    const solver = app.spawn(
      withIk({
        constraints: [
          {
            kind: "ccd",
            joints,
            end,
            targetPosition: [0, 0, 0],
            iterations: 24,
            tolerance: 1e-3,
          },
        ],
      }),
    );
    const state = solver.getValue(Ik, "state") as IkSolverState;
    const constraint = state.constraints[0] as CcdIkConstraint;
    return { app, joints, end, constraint };
  }

  it("converges the chain effector onto a reachable target", () => {
    const { app, end, constraint } = buildCcdApp();
    // Root at y=3; reach 3 from j0 to the effector. Target within reach.
    constraint.targetPosition = [1.4, 1.8, 0];

    app.step(1 / 60, 1 / 60);

    const position = worldPosition(end);
    expect(position[0]).toBeCloseTo(1.4, 2);
    expect(position[1]).toBeCloseTo(1.8, 2);
    expect(position[2]).toBeCloseTo(0, 2);
  });

  it("replays to a bit-identical CCD pose (determinism)", () => {
    function run(): readonly number[] {
      const { app, joints, constraint } = buildCcdApp();
      constraint.targetPosition = [1.2, 1.5, 0.6];
      app.step(1 / 60, 1 / 60);
      return joints.flatMap((joint) => localRotation(joint));
    }
    expect(run()).toEqual(run());
  });
});
