import {
  EcsType,
  LocalTransform,
  Parent,
  WorldTransform,
  clamp,
  createTwoBoneIkResult,
  decomposeTrsMatrix,
  defineComponent,
  mat4,
  quat,
  quatConjugate,
  quatMultiply,
  quatNormalize,
  quatSlerp,
  solveCcdChain,
  solveTwoBoneIk,
  vec3,
  type EcsWorld,
  type Entity,
  type Quat,
  type Vec3,
  type Vec3Like,
} from "@aperture-engine/simulation";

/**
 * Engine ECS inverse-kinematics systems. Per fixed step (AFTER the animation
 * driver has written the base pose and AFTER world-transform resolution, but
 * BEFORE the skinning-palette compute), every {@link Ik} constraint reads the
 * resolved joint WORLD transforms, solves for a corrected pose with the pure
 * {@link solveTwoBoneIk}/{@link solveCcdChain} math, and writes the result back
 * into the joints' `LocalTransform` rotations. The runtime `step()` re-resolves
 * world transforms after IK so the corrected pose is same-frame for the skin
 * palette + extraction.
 *
 * The constraint state is a live object held by reference on the component (like
 * the animation driver's mixer); a worker can mutate `targetPosition`/`weight`/
 * `enabled` each frame (e.g. from a physics raycast in the foot-placement demo).
 * All math is pure and deterministic, so identical inputs at a fixed step
 * produce bit-identical joint output.
 */

/** Shared IK constraint fields. */
interface IkConstraintBase {
  /** Blend from the animated base pose (0) to the fully solved pose (1). */
  weight: number;
  /** When false the constraint is skipped (no writes). */
  enabled: boolean;
  /** Target world position; used when {@link targetEntity} is null/undefined. */
  targetPosition?: Vec3Like | null;
  /** Target entity whose world position is the goal (takes precedence). */
  targetEntity?: Entity | null;
}

/** Analytic two-bone (arm/leg) constraint with an optional pole hint. */
export interface TwoBoneIkConstraint extends IkConstraintBase {
  readonly kind: "two-bone";
  /** Root joint (hip/shoulder). */
  root: Entity;
  /** Mid joint (knee/elbow). */
  mid: Entity;
  /** End joint (foot/wrist) — the effector. */
  end: Entity;
  /** Pole world position; the mid joint bends toward it. */
  polePosition?: Vec3Like | null;
  /** Pole entity whose world position is the pole hint (takes precedence). */
  poleEntity?: Entity | null;
}

/** N-joint cyclic-coordinate-descent constraint. */
export interface CcdIkConstraint extends IkConstraintBase {
  readonly kind: "ccd";
  /** Chain joints, root → tip; each joint's parent must be the previous one. */
  joints: readonly Entity[];
  /** Effector entity (rigidly attached to the tip joint). */
  end: Entity;
  /** Maximum solver iterations. */
  iterations: number;
  /** Convergence distance; the solve stops once the effector is this close. */
  tolerance?: number;
  /** Optional per-joint per-iteration rotation clamp, in radians. */
  maxAngle?: number;
}

export type IkConstraint = TwoBoneIkConstraint | CcdIkConstraint;

/** Live IK solver state held (by reference) on the {@link Ik} component. */
export interface IkSolverState {
  readonly constraints: IkConstraint[];
}

export const Ik = defineComponent(
  "aperture.runtime.ik",
  {
    // The live IkSolverState (constraint list). Held by reference (same-thread);
    // never snapshot-transported.
    state: { type: EcsType.Object, default: null },
  },
  "Per-entity IK solver: a list of two-bone/CCD constraints writing joint local transforms.",
);

/** Authoring input for a two-bone constraint (weight/enabled default sensibly). */
export interface TwoBoneIkConstraintInput {
  readonly kind: "two-bone";
  readonly root: Entity;
  readonly mid: Entity;
  readonly end: Entity;
  readonly targetEntity?: Entity | null;
  readonly targetPosition?: Vec3Like | null;
  readonly poleEntity?: Entity | null;
  readonly polePosition?: Vec3Like | null;
  readonly weight?: number;
  readonly enabled?: boolean;
}

/** Authoring input for a CCD constraint. */
export interface CcdIkConstraintInput {
  readonly kind: "ccd";
  readonly joints: readonly Entity[];
  readonly end: Entity;
  readonly targetEntity?: Entity | null;
  readonly targetPosition?: Vec3Like | null;
  readonly iterations?: number;
  readonly tolerance?: number;
  readonly maxAngle?: number;
  readonly weight?: number;
  readonly enabled?: boolean;
}

export type IkConstraintInput = TwoBoneIkConstraintInput | CcdIkConstraintInput;

/** Build a mutable {@link IkSolverState} from declarative constraint inputs. */
export function createIkSolverState(input: {
  readonly constraints: Iterable<IkConstraintInput>;
}): IkSolverState {
  const constraints: IkConstraint[] = [];
  for (const source of input.constraints) {
    if (source.kind === "two-bone") {
      constraints.push({
        kind: "two-bone",
        root: source.root,
        mid: source.mid,
        end: source.end,
        targetEntity: source.targetEntity ?? null,
        targetPosition: source.targetPosition ?? null,
        poleEntity: source.poleEntity ?? null,
        polePosition: source.polePosition ?? null,
        weight: source.weight ?? 1,
        enabled: source.enabled ?? true,
      });
    } else {
      constraints.push({
        kind: "ccd",
        joints: [...source.joints],
        end: source.end,
        targetEntity: source.targetEntity ?? null,
        targetPosition: source.targetPosition ?? null,
        iterations: source.iterations ?? 12,
        tolerance: source.tolerance ?? 1e-3,
        ...(source.maxAngle === undefined ? {} : { maxAngle: source.maxAngle }),
        weight: source.weight ?? 1,
        enabled: source.enabled ?? true,
      });
    }
  }
  return { constraints };
}

/** Report from {@link updateIkConstraints}. */
export interface IkUpdateReport {
  /** Number of constraints that wrote a corrected pose this step. */
  readonly solved: number;
  /** Total number of constraints considered. */
  readonly constraints: number;
}

// Diagnostics are deduplicated per solver state so a persistently mis-authored
// constraint logs once, not every fixed step.
const warnedStates = new WeakMap<IkSolverState, Set<string>>();

function warnIk(
  state: IkSolverState,
  diagnostic: { readonly code: string; readonly message: string },
): void {
  let warned = warnedStates.get(state);
  if (warned === undefined) {
    warned = new Set<string>();
    warnedStates.set(state, warned);
  }
  if (warned.has(diagnostic.code)) {
    return;
  }
  warned.add(diagnostic.code);
  console.warn(`[aperture] ${diagnostic.code}: ${diagnostic.message}`);
}

// Per-call scratch (the systems are single-threaded and sequential, so module
// scratch is safe and keeps the per-step path allocation-light).
const scratchMatrix = mat4();
const scratchPosition = vec3();

function readWorldPosition(entity: Entity, out: Vec3): Vec3 | null {
  if (!entity.hasComponent(WorldTransform)) {
    return null;
  }
  const col3 = entity.getVectorView(WorldTransform, "col3");
  out[0] = col3[0] ?? 0;
  out[1] = col3[1] ?? 0;
  out[2] = col3[2] ?? 0;
  return out;
}

function readWorldRotation(entity: Entity, out: Quat): Quat | null {
  if (!entity.hasComponent(WorldTransform)) {
    return null;
  }
  scratchMatrix.set(entity.getVectorView(WorldTransform, "col0"), 0);
  scratchMatrix.set(entity.getVectorView(WorldTransform, "col1"), 4);
  scratchMatrix.set(entity.getVectorView(WorldTransform, "col2"), 8);
  scratchMatrix.set(entity.getVectorView(WorldTransform, "col3"), 12);
  const decomposed = decomposeTrsMatrix(scratchMatrix);
  if (decomposed === null) {
    return null;
  }
  out[0] = decomposed.rotation[0] ?? 0;
  out[1] = decomposed.rotation[1] ?? 0;
  out[2] = decomposed.rotation[2] ?? 0;
  out[3] = decomposed.rotation[3] ?? 1;
  return out;
}

function readParentWorldRotation(entity: Entity, out: Quat): Quat {
  const parent = entity.hasComponent(Parent)
    ? (entity.getValue(Parent, "entity") as Entity | null | undefined)
    : null;
  if (parent === null || parent === undefined) {
    return identityQuat(out);
  }
  return readWorldRotation(parent, out) ?? identityQuat(out);
}

function identityQuat(out: Quat): Quat {
  out[0] = 0;
  out[1] = 0;
  out[2] = 0;
  out[3] = 1;
  return out;
}

function resolveGoalPosition(
  entity: Entity | null | undefined,
  position: Vec3Like | null | undefined,
  out: Vec3,
): Vec3 | null {
  if (entity !== null && entity !== undefined) {
    return readWorldPosition(entity, out);
  }
  if (position !== null && position !== undefined) {
    out[0] = position[0] ?? 0;
    out[1] = position[1] ?? 0;
    out[2] = position[2] ?? 0;
    return out;
  }
  return null;
}

function writeBlendedRotation(
  entity: Entity,
  targetLocal: Quat,
  weight: number,
): void {
  const view = entity.getVectorView(LocalTransform, "rotation");
  if (weight >= 1) {
    const normalized = quatNormalize(targetLocal);
    view.set(normalized);
    return;
  }
  const current = quat(view[0] ?? 0, view[1] ?? 0, view[2] ?? 0, view[3] ?? 1);
  const blended = quatSlerp(current, targetLocal, weight);
  view.set(blended);
}

const twoBoneResult = createTwoBoneIkResult();
const rootPos = vec3();
const midPos = vec3();
const endPos = vec3();
const targetPos = vec3();
const polePos = vec3();
const rootWorldRot = quat();
const midWorldRot = quat();
const parentRot = quat();
const localRot = quat();

function solveTwoBoneConstraint(
  state: IkSolverState,
  constraint: TwoBoneIkConstraint,
  weight: number,
): boolean {
  if (
    readWorldPosition(constraint.root, rootPos) === null ||
    readWorldPosition(constraint.mid, midPos) === null ||
    readWorldPosition(constraint.end, endPos) === null ||
    readWorldRotation(constraint.root, rootWorldRot) === null ||
    readWorldRotation(constraint.mid, midWorldRot) === null
  ) {
    warnIk(state, {
      code: "aperture.runtime.ik.missingWorldTransform",
      message:
        "Two-bone IK skipped: a joint has no resolved WorldTransform. IK must run after transform resolution.",
    });
    return false;
  }

  const target = resolveGoalPosition(
    constraint.targetEntity,
    constraint.targetPosition,
    targetPos,
  );
  if (target === null) {
    warnIk(state, {
      code: "aperture.runtime.ik.missingTarget",
      message:
        "Two-bone IK skipped: the constraint has neither a target entity nor a target position.",
    });
    return false;
  }

  const pole = resolveGoalPosition(
    constraint.poleEntity,
    constraint.polePosition,
    polePos,
  );

  solveTwoBoneIk(
    {
      rootPosition: rootPos,
      midPosition: midPos,
      endPosition: endPos,
      targetPosition: target,
      rootWorldRotation: rootWorldRot,
      midWorldRotation: midWorldRot,
      ...(pole === null ? {} : { polePosition: pole }),
    },
    twoBoneResult,
  );

  // World → local. The root's parent world rotation is unchanged this step; the
  // mid's parent is the root, whose NEW world rotation the solver just produced.
  readParentWorldRotation(constraint.root, parentRot);
  quatMultiply(
    quatConjugate(parentRot),
    twoBoneResult.rootWorldRotation,
    localRot,
  );
  writeBlendedRotation(constraint.root, localRot, weight);

  quatMultiply(
    quatConjugate(twoBoneResult.rootWorldRotation),
    twoBoneResult.midWorldRotation,
    localRot,
  );
  writeBlendedRotation(constraint.mid, localRot, weight);
  return true;
}

function solveCcdConstraint(
  state: IkSolverState,
  constraint: CcdIkConstraint,
  weight: number,
): boolean {
  const joints = constraint.joints;
  if (joints.length < 2) {
    warnIk(state, {
      code: "aperture.runtime.ik.invalidChain",
      message: "CCD IK skipped: a chain needs at least two joints.",
    });
    return false;
  }

  const jointPositions: Vec3[] = [];
  const jointWorldRotations: Quat[] = [];
  for (const joint of joints) {
    const position = readWorldPosition(joint, vec3());
    const rotation = readWorldRotation(joint, quat());
    if (position === null || rotation === null) {
      warnIk(state, {
        code: "aperture.runtime.ik.missingWorldTransform",
        message:
          "CCD IK skipped: a joint has no resolved WorldTransform. IK must run after transform resolution.",
      });
      return false;
    }
    jointPositions.push(position);
    jointWorldRotations.push(rotation);
  }

  const effector = readWorldPosition(constraint.end, scratchPosition);
  const target = resolveGoalPosition(
    constraint.targetEntity,
    constraint.targetPosition,
    targetPos,
  );
  if (effector === null || target === null) {
    warnIk(state, {
      code: "aperture.runtime.ik.missingTarget",
      message:
        "CCD IK skipped: the effector has no WorldTransform or the constraint has no target.",
    });
    return false;
  }

  const result = solveCcdChain({
    jointPositions,
    jointWorldRotations,
    endPosition: effector,
    targetPosition: target,
    iterations: constraint.iterations,
    ...(constraint.tolerance === undefined
      ? {}
      : { tolerance: constraint.tolerance }),
    ...(constraint.maxAngle === undefined
      ? {}
      : { maxAngle: constraint.maxAngle }),
  });

  // World → local, root → tip. Joint i's parent world rotation is the solved
  // world rotation of joint i-1 (a direct parent chain); joint 0's parent is
  // above the chain and unchanged this step.
  readParentWorldRotation(joints[0] as Entity, parentRot);
  for (let index = 0; index < joints.length; index += 1) {
    const worldRotation = result.worldRotations[index] as Quat;
    quatMultiply(quatConjugate(parentRot), worldRotation, localRot);
    writeBlendedRotation(joints[index] as Entity, localRot, weight);
    parentRot[0] = worldRotation[0] ?? 0;
    parentRot[1] = worldRotation[1] ?? 0;
    parentRot[2] = worldRotation[2] ?? 0;
    parentRot[3] = worldRotation[3] ?? 1;
  }
  return true;
}

/**
 * Solve every IK constraint in `world`, writing corrected joint local
 * rotations. Returns how many constraints wrote (so the caller can skip a
 * redundant transform re-resolution when nothing changed). Safe to call on
 * worlds with no IK constraints — it writes nothing and is byte-identical to a
 * pre-IK frame.
 */
export function updateIkConstraints(world: EcsWorld): IkUpdateReport {
  const query = world.queryManager.registerQuery({ required: [Ik] });
  let solved = 0;
  let constraints = 0;

  for (const entity of query.entities) {
    const state = entity.getValue(Ik, "state") as
      | IkSolverState
      | null
      | undefined;
    if (state === null || state === undefined) {
      continue;
    }

    for (const constraint of state.constraints) {
      constraints += 1;
      const weight = clamp(constraint.weight, 0, 1);
      // Weight 0 (or disabled) leaves the animated pose untouched — no write,
      // so the frame stays byte-identical to a pre-IK frame.
      if (!constraint.enabled || weight <= 0) {
        continue;
      }
      const wrote =
        constraint.kind === "two-bone"
          ? solveTwoBoneConstraint(state, constraint, weight)
          : solveCcdConstraint(state, constraint, weight);
      if (wrote) {
        solved += 1;
      }
    }
  }

  return { solved, constraints };
}
