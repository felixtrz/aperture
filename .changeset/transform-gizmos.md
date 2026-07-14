---
"@aperture-engine/app": minor
---

Transform gizmo completion (parity plan H2) — two new ECS-authoritative transform
gizmos, `createRotateGizmo` and `createScaleGizmo`, join the existing
`createTranslateGizmo` to reach three.js `TransformControls` parity for the gizmo
itself. Both share the translate gizmo's context shape
(`{ world, spawn, hierarchy, interaction, cameras }`), option surface
(`target`, `size?`, `thickness?`, `layerMask?`, `tag?`), and handle-management
contract (`{ target, handles, sync(world), dispose() }`), and — like the translate
gizmo — are pure math + a `LocalTransform` write with no DOM or renderer overlay,
so they run identically in a worker or headless. Both are driven through the
**same interaction frame** as the translate gizmo: each spawns Pickable handle
entities parented to the target (world-preserving `setParent`) and subscribes them
via `context.interaction.onDrag(handleRef, …)`, reading the pointer ray from
`context.cameras.main.rayFromPointer(event.position)`. `sync(world)` re-aligns the
handles to the world axes at the target each frame; `dispose()` unsubscribes and
destroys the handles.

**`createRotateGizmo`** — three axis-**ring** handles (`mesh.torus`, one per world
axis, `handles.{x,y,z}`). A drag projects the pointer ray onto the ring's
axis-plane through the target's world position, measures the **signed angle
swept** from the drag-start radial direction to the current one, and composes that
incremental rotation (an axis-angle quaternion about the world axis, mapped into
the parent frame for a parented target) onto the drag-start rotation quaternion —
writing `LocalTransform.rotation`. Option `snapAngle?` (radians) quantizes the
applied angle to the nearest multiple (`0`/undefined = free). The angle projection
is guarded against the degenerate edge-on frame (ray parallel to the ring plane).

**`createScaleGizmo`** — three axis-handle boxes plus an optional **uniform**
center handle (`handles.{x,y,z}` + `handles.uniform?` when `uniform: true`). An
axis drag reuses the translate gizmo's closest-point-on-axis projection to turn
pointer motion into an axis-parameter delta, maps it to a multiplicative **scale
factor** (dragging the handle out by one `size` doubles the axis), and writes
`LocalTransform.scale` along that axis only; the uniform handle measures
horizontal pointer displacement on the camera-facing plane and scales all three
axes together. Option `snapIncrement?` quantizes the **resulting** scale
(`0`/undefined = free), and every write is clamped to a small positive minimum so
a drag can never produce a non-positive/degenerate scale.

The snapping / swept-angle / closest-point / scale-factor math ships as pure,
individually exported functions (`snapToIncrement`, `signedAngleOnPlane`,
`rayPlaneIntersection`, `closestPointParamOnAxis`, `scaleFactorFromDelta`,
`guardScale`, `inPlaneRightAxis`, `MIN_GIZMO_SCALE`) unit-tested at boundary /
sign / degenerate cases. A headless route test drives both gizmos through the
interaction frame, and two Playwright routes (`examples/rotate-gizmo`,
`examples/scale-gizmo`) script a pointer press + drag and assert the snapped
component delta on the real GPU (rotate: a pure +Z rotation of exactly π/4; scale:
X scaled to a 0.5 multiple while Y/Z stay fixed).

Deviations (honest): the gizmos are world-space / world-axis only — no
screen-space constant-size handle scaling and no local-vs-world-space toggle
(three.js `TransformControls` offers both). Rotate uses the Aperture torus
(XZ-plane / +Y-normal) oriented per axis; ring picking is bounds-based, so a ring
is unambiguously grabbed where only its own bounds are under the pointer.
