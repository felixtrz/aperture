---
"@aperture-engine/math": minor
"@aperture-engine/runtime": minor
---

IK — two-bone + CCD (parity plan F2) — the analog of three.js `CCDIKSolver`,
plus an analytic two-bone (arm/leg) solver three.js's addon lacks. Both ship as
**fixed-step ECS systems that write joint LOCAL transforms**, running AFTER the
F1 animation driver and world-transform resolution but BEFORE the skinning
palette, so IK adjusts the animated base pose same-frame.

**Pure, deterministic solver math (`@aperture-engine/math` `ik.ts`).**
`solveTwoBoneIk(...)` is a law-of-cosines two-bone solver: given the root/mid/end
joint world positions, a target, and an optional pole hint, it clamps the target
into the reachable annulus `[|l1-l2|, l1+l2]` (so an over/under-reach straightens
toward the target instead of producing NaN), places the elbow/knee in the bend
plane the pole selects, and returns the new WORLD rotations of the root + mid
joints (plus the resulting mid/effector positions and a `reached` flag).
`solveCcdChain(...)` is a cyclic-coordinate-descent N-joint solver: iterating tip
→ root, each joint swings (shortest-arc, optionally angle-limited via `maxAngle`)
to bring the effector toward the target, stopping at a fixed iteration count or a
`tolerance`; it works on a private copy of the chain geometry and returns each
joint's new WORLD rotation + the final effector position. Both reuse the shared
vec3/quat helpers, are array-first and allocation-light, and are pure (no
`Date.now()`/`Math.random()`), so identical inputs are bit-identical out. New
public quaternion helpers `quatConjugate`/`quatDot`/`quatSlerp` and
`shortestArcQuaternion` back them. Unit-tested: two-bone reach / over-reach-clamp
/ pole-direction-flip, CCD convergence / unreachable-stretch, plus replay
equality for each.

**Authoring surface + fixed-step system (`@aperture-engine/runtime`).** An `Ik`
component holds a live `IkSolverState` (a list of `TwoBoneIkConstraint` /
`CcdIkConstraint` objects — the chain entities, a target as a world position OR a
target entity, an optional pole, a `weight`, and `enabled`/`iterations`/
`tolerance`), authored with `withIk({ constraints })`. Because the state is held
by reference (like the F1 mixer's driver state), a worker mutates
`targetPosition`/`weight`/`enabled` each frame — e.g. from a physics raycast.
`updateIkConstraints(world)` solves every constraint in order: it reads the
resolved joint WORLD transforms, runs the pure solver, converts the resulting
world rotations to each joint's LOCAL rotation via the parent world rotations
(root's parent is unchanged; a child's parent is its predecessor's freshly-solved
world rotation), blends from the animated pose by `weight` (per-joint slerp), and
writes the joint `LocalTransform` rotation. The runtime `step()` calls it between
transform resolution and the skin palette, and **re-resolves world transforms
only when a constraint actually wrote**, so the corrected pose is same-frame for
the palette + extraction.

**Byte-identity + determinism.** A constraint at `weight 0` (or `enabled: false`)
writes NOTHING and the second resolve is skipped, so a frame with no active IK is
byte-identical to a pre-F2 frame (proven by a no-op system test asserting the
joint rotations and `solved === 0` are untouched). The `Ik` component is
registered LAST so no existing component's type index shifts, and no determinism
fixture uses IK — `test/determinism` stays GREEN with no refresh. Every skip path
emits a structured `aperture.runtime.ik.*` diagnostic
(`missingWorldTransform`/`missingTarget`/`invalidChain`) rather than throwing.

**Foot-placement demo (`examples/foot-placement-ik`) + e2e.** A leg rig (hip →
knee → foot parented chain) is planted onto a tilted static ramp found by a
`backend.raycastFirst(...)` PHYSICS RAYCAST cast straight down under the foot; the
hit point becomes the two-bone IK target and the knee bends onto the surface.
`test/e2e/foot-placement-ik.spec.ts` asserts the foot lands at the raycast hit
height within tolerance, that moving the foot along the ramp lands it at a new
raycast-found height, that a front/back pole flips the knee's bend direction while
planting the foot identically, and a same-input replay to a bit-identical pose.
The F1 `locomotion-blend` + `animation-skinning` e2e stay GREEN (no animation
regression).

Limitations (honest): no rotation/angle LIMITS or twist constraints on the
solvers beyond CCD's optional per-iteration `maxAngle` clamp (three.js
`CCDIKSolver` exposes per-joint min/max Euler limits — not implemented);
weight-blended reach is exact only at `weight 1` (a partial weight is a per-joint
slerp toward the animated pose, so the effector lands short by design); the
two-bone and CCD solvers assume a direct parent chain with unit joint scale;
there is no app-facade `spawn` option (IK is authored through the runtime
`withIk` trait, which the demo worker uses directly).
