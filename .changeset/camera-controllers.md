---
"@aperture-engine/app": minor
---

Camera controllers round-out (parity plan H1) — three new reusable,
ECS-authoritative camera controllers join the existing orbit / fly / follow set,
narrowing the three.js controls gap. Each is a factory returning a readonly
handle with state getters, input-agnostic mapping methods, and
`applyTo(world): boolean`; like the existing controllers they are pure math + a
`LocalTransform` write through the normal ECS component path (resolved via a
generation-checked `EcsEntityRef`), never cache a scene-graph node, and never
read the DOM — so they run identically in a worker or headless. The app wires the
DOM (pointer-lock, pointer drag, wheel, WASD) and forwards deltas.

**`createFpsCameraController`** — the packaged pointer-lock FPS pattern.
`lookFromPointerLock(dx, dy)` maps RAW `movementX`/`movementY` **pixel** deltas
(scaled by a radians-per-pixel `sensitivity`, not a normalized 0..1 drag) to
yaw/pitch, with pitch clamped just inside ±90° (no gimbal flip). Movement is
**ground-constrained**: `move(forward, right, up)` walks along `forward()` — the
horizontal projection of the look direction, so its Y is always 0 and you never
gain altitude by looking up — plus a horizontal `right()` strafe and a separate
`up` amount for eye height; `lookDirection()` exposes the full pitched facing.

**`createMapCameraController`** — an oblique/top-down `MapControls` analog.
`panFromDrag(dx, dy)` slides the target across the ground (XZ) plane, mapping
screen drag deltas to world translation along the camera's ground-projected
right/forward axes scaled by the current distance so the grab point tracks the
cursor (grab-drag); `zoomFromWheel(delta)` dollies the eye (changing distance and
height); `rotate(deltaHeading)` spins the heading. Pitch is clamped strictly
inside the poles so the top-down look-at basis never degenerates.

**`createArcballCameraController`** — a Shoemake virtual-trackball with full
**3-DOF** rotation (unlike orbit's 2-DOF azimuth/elevation, the arcball rolls).
`rotateFromDrag(fromX, fromY, toX, toY)` (or the continuous `beginDrag`/`dragTo`
pair) projects two normalized `[-1, 1]` pointer positions onto a virtual unit
sphere and accumulates the rotation carrying the first onto the second into the
orientation quaternion; the eye is `target + orientation · [0, 0, distance]`.
`zoomFromWheel(delta)` dollies. Quaternion math is reused from
`@aperture-engine/math` (`quatFromAxisAngle`, `quatMultiply`, `rotateVec3ByQuat`)
rather than reimplemented.

Ships per-controller examples (`examples/fps-camera`, `examples/map-camera`,
`examples/arcball-camera`) that build the low-level extraction app, drive the
controller by scripting its characteristic input (FPS: a pointer-lock look delta

- a level WASD walk; map: a pan drag + a wheel zoom; arcball: a trackball drag +
  a wheel zoom), and publish before/after pose values plus pixel-grid readback
  deltas. Each has a Playwright e2e asserting the input-driven pose deltas AND that
  the rendered image changed measurably.

**Deviations (honest).** The controllers are the core input→pose math only: no
momentum/damping (three.js `TrackballControls`/`MapControls` inertia), no
first-person collision/gravity (`PointerLockControls` is unopinionated too, but
there is no character-collision layer here), and no arcball on-screen gizmo or
focus-animation. The arcball accumulates orientation with `@aperture-engine/math`
quaternions (Float32 kernel), renormalized each drag so it stays stable. The
translate gizmo and rotate/scale transform gizmo remain a separate item (H2).
